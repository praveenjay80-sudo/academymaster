"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StreamingContent from "@/components/StreamingContent";

function RoadmapInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
          <strong style={{ color: 'var(--accent)' }}>Your learning roadmap:</strong> Three tracks — Casual (1–2 weeks), Serious (1–3 months), and Researcher (6+ months). Each phase tells you exactly what to study, in what order, and how to know when you&apos;ve finished it.
        </p>
      </div>
      <StreamingContent
        endpoint="/api/roadmap"
        body={{ topic: label }}
        cacheKey={`roadmap:${slug}`}
        label="Generate a 3-track learning roadmap (Casual · Serious · Researcher)"
      />
    </div>
  );
}

export default function RoadmapPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <RoadmapInner />
    </Suspense>
  );
}
