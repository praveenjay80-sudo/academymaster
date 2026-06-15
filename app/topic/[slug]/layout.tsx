"use client";
import Link from "next/link";
import { useParams, usePathname, useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";

const TABS = [
  { id: "canon",    label: "◈ Canon",    desc: "Unified field view" },
  { id: "practice", label: "✏️ Practice", desc: "Exercises & quizzes" },
  { id: "tutor",    label: "🎓 Tutor",   desc: "Socratic dialogue" },
];

function clearTopicCache(slug: string, label: string) {
  [
    `sc2:practice:${slug}`,
    `canon-v1:${slug}`,
    `tutor-session:${slug}`,
  ].forEach(k => localStorage.removeItem(k));
}

function TopicLayoutInner({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  const [resetting, setResetting] = useState(false);

  // Persist topic label for the Learning Map
  useEffect(() => {
    const metaKey = `topic-meta:${slug}`;
    const existing = localStorage.getItem(metaKey);
    if (!existing) {
      localStorage.setItem(metaKey, JSON.stringify({ label, firstSeen: Date.now() }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const activeTab = TABS.find(t => pathname.includes(`/${t.id}`))?.id || "canon";

  function handleReset() {
    if (!confirm(`Clear all cached content for "${label}"? You'll need to regenerate each tab.`)) return;
    clearTopicCache(slug, label);
    setResetting(true);
    // Brief flash so user sees it worked, then reload
    setTimeout(() => { window.location.reload(); }, 300);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header className="sticky top-0 z-50 border-b" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 py-3">
            <Link href="/" className="text-xl font-bold transition-colors" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>
              ◈ AM
            </Link>
            <span style={{ color: 'var(--border)' }}>/</span>
            <h1 className="text-lg font-semibold flex-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
              {label}
            </h1>

            {/* Reset cache button */}
            <button
              onClick={handleReset}
              disabled={resetting}
              title="Clear all cached content for this topic"
              className="text-xs px-3 py-1.5 rounded transition-all"
              style={{
                background: resetting ? 'var(--accent-glow)' : 'var(--bg-card)',
                color: resetting ? 'var(--accent)' : 'var(--text-muted)',
                border: '1px solid ' + (resetting ? 'var(--accent-dim)' : 'var(--border)'),
                fontFamily: 'Georgia, serif',
              }}
            >
              {resetting ? '✓ Cleared' : '⟳ Reset Cache'}
            </button>
          </div>

          {/* Tabs */}
          <nav className="flex gap-1 overflow-x-auto pb-0 -mb-px">
            {TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const href = `/topic/${slug}/${tab.id}?label=${encodeURIComponent(label)}`;
              return (
                <Link
                  key={tab.id}
                  href={href}
                  className="flex items-center gap-1.5 px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition-all"
                  style={{
                    borderColor: isActive ? 'var(--accent)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontFamily: 'Georgia, serif',
                    background: 'transparent',
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {children}
      </main>
    </div>
  );
}

export default function TopicLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <TopicLayoutInner>{children}</TopicLayoutInner>
    </Suspense>
  );
}
