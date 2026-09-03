"use client";
import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";

export default function InstitutionSlugPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params.institutionSlug as string;
  useEffect(() => { router.push(`/i/${slug}/dashboard`); }, [slug, router]);
  return <div className="min-h-screen bg-[#080808] flex items-center justify-center"><div className="h-6 w-32 skeleton rounded" /></div>;
}
