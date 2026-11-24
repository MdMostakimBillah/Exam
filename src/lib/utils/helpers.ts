import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { calculateGrade as _calculateGrade, DEFAULT_SCALE } from '@/lib/storage/grading';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Global cap for every image upload in the app (logos, photos, payment
 *  proofs, branding images). Photos are stored as base64 in the DB, so a
 * tight cap keeps storage predictable (~150KB ≈ 4,500-5,000 students/GB). */
export const MAX_IMAGE_SIZE = 150 * 1024;

export function generateApplicationId(): string {
  const prefix = 'APP';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 6).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

export function generateCertificateNumber(): string {
  const prefix = 'SCX';
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).substr(2, 8).toUpperCase();
  return `${prefix}-${year}-${random}`;
}

export function generateTransactionId(): string {
  return 'TXN' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substr(2, 4).toUpperCase();
}

/** Retry a flaky server-action call once. Server actions can fail on a
 *  transient blip (dev rebuild, dropped connection, service restart) even
 *  though a second attempt succeeds a moment later. */
export async function retryOnce<T>(fn: () => Promise<T>, delayMs = 600): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return fn();
  }
}

export function calculateGrade(percentage: number): string {
  return _calculateGrade(percentage, DEFAULT_SCALE);
}

export function isPass(percentage: number): boolean {
  return percentage >= DEFAULT_SCALE.passPercent;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '...';
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'ACTIVE': case 'APPROVED': case 'PAID': case 'PUBLISHED': case 'VERIFIED': case 'GENERATED': case 'ELIGIBLE': case 'TALENT_POOL': case 'GENERAL':
      return 'text-emerald-400 bg-emerald-400/10';
    case 'PENDING': case 'PAYMENT_PENDING': case 'DRAFT': case 'REVIEW': case 'GENERATED':
      return 'text-amber-400 bg-amber-400/10';
    case 'REJECTED': case 'SUSPENDED': case 'FAILED': case 'NOT_ELIGIBLE': case 'ERROR':
      return 'text-red-400 bg-red-400/10';
    case 'CLOSED': case 'ARCHIVED': case 'INACTIVE': case 'REFUNDED':
      return 'text-zinc-400 bg-zinc-400/10';
    default:
      return 'text-brand-accent bg-brand-accent-soft';
  }
}

export function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/**
 * Capitalizes each word in a string (Title Case / Capitalized Words).
 * e.g., "mohammad ali" -> "Mohammad Ali", "dhanmondi, dhaka" -> "Dhanmondi, Dhaka"
 */
export function capitalizeWords(text: string): string {
  if (!text) return text;
  return text.replace(/(^|[\s.\-\/])([a-z])/g, (_, boundary, char) => boundary + char.toUpperCase());
}

export interface CompressImageOptions {
  maxSide?: number;
  maxSizeBytes?: number;
  initialQuality?: number;
}

/**
 * Calculates approximate decoded byte size of a base64 data URL.
 */
export function getBase64SizeInBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma === -1) return Math.floor((dataUrl.length * 3) / 4);
  const base64Str = dataUrl.slice(comma + 1);
  const padding = base64Str.endsWith('==') ? 2 : base64Str.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((base64Str.length * 3) / 4) - padding);
}

/**
 * Compresses an image File or Blob to WebP format with a maximum dimension (max side)
 * and maximum file size (default 150KB = 153,600 bytes).
 */
export async function compressImageToWebP(
  file: File | Blob,
  options: CompressImageOptions = {}
): Promise<string> {
  const maxSide = options.maxSide ?? 1024;
  const maxSizeBytes = options.maxSizeBytes ?? MAX_IMAGE_SIZE;
  const initialQuality = options.initialQuality ?? 0.85;

  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();

    const naturalMax = Math.max(img.naturalWidth, img.naturalHeight);
    if (naturalMax < 1) {
      throw new Error("Invalid image dimensions");
    }

    let currentSide = Math.min(maxSide, naturalMax);
    let quality = initialQuality;

    const render = (targetSide: number, q: number): string => {
      const scale = Math.min(1, targetSide / naturalMax);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return "";

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // White background so transparent PNGs/WebPs look clean on white paper / printouts
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      let out = canvas.toDataURL("image/webp", q);
      // Fallback if browser canvas does not support image/webp
      if (!out.startsWith("data:image/webp")) {
        out = canvas.toDataURL("image/jpeg", q);
      }
      return out;
    };

    let result = render(currentSide, quality);

    // Iteratively decrease quality and/or side until byte size <= maxSizeBytes
    while (result && getBase64SizeInBytes(result) > maxSizeBytes && (quality > 0.35 || currentSide > 300)) {
      if (quality > 0.4) {
        quality = Math.max(0.35, +(quality - 0.1).toFixed(2));
      } else {
        currentSide = Math.round(currentSide * 0.8);
        quality = 0.8;
      }
      result = render(currentSide, quality);
    }

    if (!result) {
      throw new Error("Failed to process image");
    }

    return result;
  } finally {
    URL.revokeObjectURL(url);
  }
}
