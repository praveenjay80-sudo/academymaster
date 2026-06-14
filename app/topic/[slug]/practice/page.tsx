"use client";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import StreamingContent from "@/components/StreamingContent";

function PracticeInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div>
      <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
        <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
          <strong style={{ color: 'var(--accent)' }}>How to use this:</strong> Reading is not enough — you need to actively test yourself. Work through the mastery quiz, do the canonical exercises, and try explaining concepts back in your own words (the Feynman technique). This is how real understanding sticks.
        </p>
      </div>
      <StreamingContent
        endpoint="/api/practice"
        body={{ topic: label }}
        cacheKey={`practice:${slug}`}
        label="Generate canonical exercises, a 20-question mastery quiz and Feynman prompts"
      />
    </div>
  );
}

export default function PracticePage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <PracticeInner />
    </Suspense>
  );
}
