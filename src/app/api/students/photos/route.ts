import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PhotoVariant = "thumb" | "card" | "full";

const MAX_BATCH_IDS = 100;
const MAX_TRANSFORM_CACHE = 1500;

// Content-addressed transform cache (keyed by variant + SHA-1 of raw image bytes,
// never by student ID) so RLS always remains authoritative on every DB query while
// avoiding redundant sharp resize work across repeated page/modal opens.
const transformCache = new Map<string, string>();

let sharpPromise: Promise<typeof import("sharp") | null> | null = null;
async function getSharp() {
  if (!sharpPromise) {
    sharpPromise = import("sharp").catch(() => null);
  }
  return sharpPromise;
}

function setCachedTransform(key: string, value: string) {
  if (transformCache.size >= MAX_TRANSFORM_CACHE) {
    const oldestKey = transformCache.keys().next().value;
    if (oldestKey !== undefined) transformCache.delete(oldestKey);
  }
  transformCache.set(key, value);
}

async function transformDataUrl(raw: string, variant: PhotoVariant): Promise<string> {
  if (variant === "full") return raw;
  const trimmed = raw.trim();
  if (!trimmed.startsWith("data:image/")) return trimmed;

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx === -1) return trimmed;
  const header = trimmed.slice(0, commaIdx).toLowerCase();
  if (!header.includes(";base64")) return trimmed;

  const hash = crypto.createHash("sha1").update(trimmed).digest("base64url");
  const cacheKey = `${variant}:${hash}`;
  const cached = transformCache.get(cacheKey);
  if (cached) return cached;

  const sharpMod = await getSharp();
  if (!sharpMod) return trimmed;
  const sharpFn = sharpMod.default;

  try {
    const inputBuf = Buffer.from(trimmed.slice(commaIdx + 1), "base64");
    if (inputBuf.length === 0) return trimmed;

    let outUrl: string;
    if (variant === "card") {
      const outBuf = await sharpFn(inputBuf)
        .rotate()
        .resize(160, 196, { fit: "cover", position: "centre" })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 84 })
        .toBuffer();
      outUrl = `data:image/jpeg;base64,${outBuf.toString("base64")}`;
    } else {
      const outBuf = await sharpFn(inputBuf)
        .rotate()
        .resize(128, 128, { fit: "cover", position: "centre" })
        .flatten({ background: "#ffffff" })
        .webp({ quality: 75 })
        .toBuffer();
      outUrl = `data:image/webp;base64,${outBuf.toString("base64")}`;
    }

    // Only keep the resized version if it isn't larger than the source.
    const result = outUrl.length <= trimmed.length ? outUrl : trimmed;
    setCachedTransform(cacheKey, result);
    return result;
  } catch {
    return trimmed;
  }
}

export async function POST(request: Request) {
  let body: { ids?: unknown; variant?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.ids)) {
    return NextResponse.json({ error: "ids array is required" }, { status: 400 });
  }

  const uniqueIds = Array.from(
    new Set(
      body.ids
        .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
        .map((id) => id.trim())
    )
  ).slice(0, MAX_BATCH_IDS);

  const rawVariant = typeof body.variant === "string" ? body.variant : "thumb";
  const variant: PhotoVariant =
    rawVariant === "card" || rawVariant === "full" || rawVariant === "thumb" ? rawVariant : "thumb";

  if (uniqueIds.length === 0) {
    return NextResponse.json({ photos: {} }, { headers: { "Cache-Control": "private, no-store" } });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("students")
    .select("id, photo_url")
    .in("id", uniqueIds)
    .not("photo_url", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []).filter(
    (r: { id: string; photo_url: string | null }) =>
      Boolean(r.id && r.photo_url && String(r.photo_url).trim())
  );

  const photos: Record<string, string> = {};
  const CONCURRENCY = 16;
  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const slice = rows.slice(i, i + CONCURRENCY);
    await Promise.all(
      slice.map(async (row: { id: string; photo_url: string }) => {
        photos[row.id] = await transformDataUrl(row.photo_url, variant);
      })
    );
  }

  return NextResponse.json(
    { photos },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
