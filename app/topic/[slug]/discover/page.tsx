"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StreamingContent from "@/components/StreamingContent";

function DiscoverInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
          <strong style={{ color: 'var(--accent)' }}>Where to go next:</strong> Now that you understand {label}, discover which adjacent fields your knowledge unlocks, find surprising connections to totally different subjects, and see what deeper questions mastering this topic opens up.
        </p>
      </div>
      <StreamingContent
        endpoint="/api/discover"
        body={{ topic: label }}
        cacheKey={`discover:${slug}`}
        label="Discover adjacent fields, surprising connections and what to explore next"
      />
    </div>
  );
}

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <DiscoverInner />
    </Suspense>
  );
}
