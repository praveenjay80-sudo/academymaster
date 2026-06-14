"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const EXAMPLE_TOPICS = [
  "Quantum Mechanics", "Game Theory", "Measure Theory",
  "Byzantine History", "Evolutionary Biology", "Machine Learning",
  "Roman Philosophy", "Number Theory", "Cognitive Science",
  "Thermodynamics", "Political Economy", "Linguistics",
];

export default function HomePage() {
  const [query, setQuery] = useState("");
  const router = useRouter();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const slug = query.trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    if (slug) router.push(`/topic/${slug}?label=${encodeURIComponent(query.trim())}`);
  }

  function goToTopic(t: string) {
    const slug = t.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    router.push(`/topic/${slug}?label=${encodeURIComponent(t)}`);
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="text-center mb-12 max-w-2xl">
        <div className="text-5xl mb-4" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif', letterSpacing: '-0.02em' }}>
          ◈ Academy Master
        </div>
        <p className="text-xl mb-3" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
          Master any academic topic — from complete beginner to expert.
        </p>
        <p style={{ color: 'var(--text-secondary)', lineHeight: '1.7', fontSize: '0.95rem' }}>
          Enter any subject and get a deep map of every concept you need to understand,
          every book with its chapter-by-chapter breakdown, a clear reading roadmap,
          and a full NotebookLM workspace — all explained in plain English.
        </p>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="w-full max-w-xl mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Enter any academic topic…"
            className="flex-1 px-5 py-4 text-lg rounded-lg outline-none transition-all"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif',
            }}
            onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
            onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            autoFocus
          />
          <button
            type="submit"
            disabled={!query.trim()}
            className="px-6 py-4 rounded-lg font-semibold text-lg transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia, serif' }}
          >
            Explore →
          </button>
        </div>
      </form>

      {/* Example topics */}
      <div className="max-w-xl w-full">
        <p className="text-center text-sm mb-3" style={{ color: 'var(--text-muted)' }}>Try one of these:</p>
        <div className="flex flex-wrap gap-2 justify-center">
          {EXAMPLE_TOPICS.map(t => (
            <button
              key={t}
              onClick={() => goToTopic(t)}
              className="px-3 py-1.5 rounded-md text-sm transition-all"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border)',
                color: 'var(--text-secondary)',
                fontFamily: 'Georgia, serif',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)';
                (e.currentTarget as HTMLElement).style.color = 'var(--accent)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)';
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl w-full px-4">
        {[
          { icon: '◈', title: 'Deep Concepts', desc: 'Every concept explained from scratch — definition, why it matters, common mistakes, self-test questions, and how it connects to others.' },
          { icon: '📚', title: 'Works in Detail', desc: 'Every major book and paper broken down chapter by chapter — what each chapter argues, what to read vs. skip, and how hard it is.' },
          { icon: '🎙️', title: 'NotebookLM', desc: 'One click to push everything into NotebookLM — generate a podcast, flashcards, and mind map, and ask questions about real sources.' },
        ].map(f => (
          <div key={f.title} className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
            <div className="text-2xl mb-2">{f.icon}</div>
            <div className="font-semibold mb-2" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>{f.title}</div>
            <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{f.desc}</div>
          </div>
        ))}
      </div>
    </main>
  );
}
