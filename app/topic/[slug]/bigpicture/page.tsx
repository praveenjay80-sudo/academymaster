"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StreamingContent from "@/components/StreamingContent";

function BigPictureInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
          <strong style={{ color: 'var(--accent)' }}>The big picture:</strong> Where did this field come from? Who built it? What questions is it trying to answer? What&apos;s still unsolved? Understanding the story behind a subject makes everything easier to learn and remember.
        </p>
      </div>
      <StreamingContent
        endpoint="/api/bigpicture"
        body={{ topic: label }}
        cacheKey={`bigpicture:${slug}`}
        label="Generate the full history, key figures, open questions and cross-field connections"
      />
    </div>
  );
}

export default function BigPicturePage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <BigPictureInner />
    </Suspense>
  );
}
