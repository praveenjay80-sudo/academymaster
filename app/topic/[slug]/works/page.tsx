"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

interface Work {
  _type: "essential";
  id: string;
  title: string;
  authors: string[];
  year: number;
  type: "TEXTBOOK" | "SEMINAL_PAPER" | "POPULAR_SCIENCE" | "SURVEY" | "CLASSIC_ORIGINAL";
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  plain_description: string;
  why_it_matters: string;
  prerequisites: string;
  what_you_gain: string;
  free_access: string;
  best_edition: string;
}

interface AntiWork {
  _type: "anti_library";
  title: string;
  reason: string;
}

type WorkEntry = Work | AntiWork;

const TYPE_LABELS: Record<string, string> = {
  TEXTBOOK: "Textbook",
  SEMINAL_PAPER: "Seminal Paper",
  POPULAR_SCIENCE: "Popular Science",
  SURVEY: "Survey/Review",
  CLASSIC_ORIGINAL: "Classic Original",
};

const DIFF_COLOR: Record<string, string> = {
  BEGINNER: "var(--green)",
  INTERMEDIATE: "var(--accent)",
  ADVANCED: "var(--red)",
};

function extractEntries(text: string): { entries: WorkEntry[]; remaining: string } {
  const entries: WorkEntry[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    let depth = 0;
    let inString = false;
    let escaped = false;
    let end = -1;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inString) { escaped = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) { end = j; break; }
      }
    }
    if (end === -1) break;
    const objStr = text.slice(start, end + 1);
    try {
      const entry = JSON.parse(objStr) as WorkEntry;
      if (entry._type === "essential" && (entry as Work).title) entries.push(entry);
      else if (entry._type === "anti_library" && (entry as AntiWork).title) entries.push(entry);
    } catch { /* malformed */ }
    i = end + 1;
  }
  const remaining = i < text.length ? text.slice(i) : "";
  return { entries, remaining };
}

function ChapterBreakdown({ topic, work, onClose }: { topic: string; work: Work; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `work-chapters:${topic}:${work.id}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) { setContent(data); setLoading(false); return; }
      } catch { /* invalid */ }
    }
    abortRef.current = new AbortController();
    setLoading(true); setContent("");
    (async () => {
      try {
        const res = await fetch("/api/work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, title: work.title, authors: work.authors.join(", "), type: work.type }),
          signal: abortRef.current!.signal,
        });
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let full = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          full += dec.decode(value, { stream: true });
          setContent(full);
        }
        localStorage.setItem(cacheKey, JSON.stringify({ data: full, ts: Date.now() }));
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") setContent("Error loading chapter breakdown.");
      } finally { setLoading(false); }
    })();
    return () => abortRef.current?.abort();
  }, [cacheKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function md(text: string) {
    return text
      .replace(/^## (.+)$/gm, '<h2 style="color:var(--accent);font-size:1rem;font-weight:700;margin:1.5rem 0 0.5rem;text-transform:uppercase;letter-spacing:0.05em;font-family:Georgia,serif;border-bottom:1px solid var(--border);padding-bottom:0.3rem">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color:var(--text-primary);font-size:0.95rem;font-weight:600;margin:1.2rem 0 0.3rem;font-family:Georgia,serif">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color:var(--text-secondary)">$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary);border:1px solid var(--border);border-radius:3px;padding:0.1rem 0.3rem;font-size:0.85em;color:var(--accent)">$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-dim);padding-left:1rem;margin:0.5rem 0;color:var(--text-secondary);font-style:italic">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li style="padding:0.2rem 0 0.2rem 1.2rem;position:relative;color:var(--text-primary);line-height:1.7">◆ $1</li>')
      .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul style="list-style:none;padding:0;margin:0.4rem 0">${m}</ul>`)
      .replace(/\n\n+/g, '</p><p style="color:var(--text-primary);line-height:1.8;margin:0.4rem 0">')
      .replace(/^(?!<[hul]|<\/[hul]|<block)(.+)$/gm, m => m.trim() ? `<p style="color:var(--text-primary);line-height:1.8;margin:0.4rem 0">${m}</p>` : '');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(0,0,0,0.7)' }} onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 p-6 pb-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--blue)', border: '1px solid rgba(96,165,250,0.3)' }}>
                  {TYPE_LABELS[work.type]}
                </span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: DIFF_COLOR[work.difficulty], border: `1px solid ${DIFF_COLOR[work.difficulty]}40` }}>
                  {work.difficulty}
                </span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                  {work.year}
                </span>
              </div>
              <h2 className="text-xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>{work.title}</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{work.authors?.join(", ")}</p>
            </div>
            <button onClick={onClose} className="text-xl p-2 shrink-0" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
          {work.free_access && !work.free_access.toLowerCase().includes("not freely") && (
            <div className="mt-3 p-2 rounded text-xs" style={{ background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: 'var(--green)' }}>
              Free access: {work.free_access}
            </div>
          )}
        </div>
        <div className="p-6">
          {loading && !content && (
            <div className="flex items-center gap-3 py-8" style={{ color: 'var(--text-muted)' }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span style={{ fontFamily: 'Georgia, serif' }}>Writing chapter-by-chapter breakdown…</span>
            </div>
          )}
          {content && <div dangerouslySetInnerHTML={{ __html: md(content) }} />}
        </div>
      </div>
    </div>
  );
}

function WorkCard({ work, index, onSelect }: { work: Work; index: number; onSelect: (w: Work) => void }) {
  return (
    <div
      className="p-5 rounded-lg transition-all"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        animation: `fadeSlideIn 0.35s ease-out ${Math.min(index * 0.06, 0.6)}s both`,
      }}
    >
      <div className="flex items-start gap-4">
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-2">
            <span className="text-xs px-2 py-0.5 rounded" style={{ color: DIFF_COLOR[work.difficulty], background: `${DIFF_COLOR[work.difficulty]}15`, border: `1px solid ${DIFF_COLOR[work.difficulty]}30` }}>
              {work.difficulty.charAt(0) + work.difficulty.slice(1).toLowerCase()}
            </span>
            <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--blue)', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
              {TYPE_LABELS[work.type] ?? work.type}
            </span>
            {work.year && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{work.year}</span>}
          </div>
          <h3 className="text-lg font-bold mb-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>{work.title}</h3>
          <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
            {work.authors?.join(", ")}
            {work.best_edition && <span style={{ color: 'var(--text-muted)' }}> · {work.best_edition}</span>}
          </p>
          <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>{work.plain_description}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {[
              { label: "Why it matters", value: work.why_it_matters, icon: "◆" },
              { label: "Before reading, you need", value: work.prerequisites, icon: "→" },
              { label: "After reading, you'll be able to", value: work.what_you_gain, icon: "✓" },
              { label: "How to get it", value: work.free_access, icon: "🔓" },
            ].map(info => info.value && (
              <div key={info.label} className="p-3 rounded" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-xs font-semibold mb-1 uppercase tracking-wide" style={{ color: 'var(--accent)' }}>
                  {info.icon} {info.label}
                </div>
                <div className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{info.value}</div>
              </div>
            ))}
          </div>
          <button
            onClick={() => onSelect(work)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia, serif' }}
          >
            Chapter-by-Chapter Breakdown →
          </button>
        </div>
      </div>
    </div>
  );
}

function WorksPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [works, setWorks] = useState<Work[]>([]);
  const [antiLib, setAntiLib] = useState<AntiWork[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Work | null>(null);
  const [filter, setFilter] = useState<"ALL" | "BEGINNER" | "INTERMEDIATE" | "ADVANCED">("ALL");
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `works-list-v3:${slug}`;

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { works: w, anti, ts } = JSON.parse(cached);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) {
          setWorks(w); setAntiLib(anti); setDone(true); return;
        }
      } catch { /* stale */ }
    }

    setStreaming(true);
    abortRef.current = new AbortController();
    const accWorks: Work[] = [];
    const accAnti: AntiWork[] = [];

    (async () => {
      try {
        const res = await fetch("/api/works", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: label }),
          signal: abortRef.current!.signal,
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done: rdDone, value } = await reader.read();
          if (rdDone) break;
          buf += dec.decode(value, { stream: true });
          const { entries, remaining } = extractEntries(buf);
          buf = remaining;
          if (entries.length > 0) {
            for (const e of entries) {
              if (e._type === "essential") accWorks.push(e as Work);
              else accAnti.push(e as AntiWork);
            }
            setWorks([...accWorks]);
            setAntiLib([...accAnti]);
          }
        }

        if (buf.trim()) {
          const { entries } = extractEntries(buf + "}");
          for (const e of entries) {
            if (e._type === "essential" && !accWorks.find(w => w.id === (e as Work).id)) accWorks.push(e as Work);
            else if (e._type === "anti_library") accAnti.push(e as AntiWork);
          }
          setWorks([...accWorks]); setAntiLib([...accAnti]);
        }

        localStorage.setItem(cacheKey, JSON.stringify({ works: accWorks, anti: accAnti, ts: Date.now() }));
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") setError("Failed to load works. " + (e as Error).message);
      } finally {
        setStreaming(false);
        setDone(true);
      }
    })();

    return () => abortRef.current?.abort();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = works.filter(w => filter === "ALL" || w.difficulty === filter);

  return (
    <div>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
      `}</style>

      {/* Streaming banner */}
      {streaming && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
          <span className="text-sm" style={{ color: 'var(--accent)', fontFamily: 'Georgia,serif' }}>
            Finding essential works… {works.length > 0 && `${works.length} found so far`}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(248,113,113,.1)', border: '1px solid var(--red)', color: 'var(--red)' }}>{error}</div>
      )}

      {/* Initial loading state */}
      {!done && works.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Georgia,serif' }}>Finding all essential works for <strong style={{ color: 'var(--accent)' }}>{label}</strong>…</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Works will appear one by one as they are found</p>
        </div>
      )}

      {works.length > 0 && (
        <>
          {/* How to use tip */}
          <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>
              <strong style={{ color: 'var(--accent)' }}>How to use this:</strong> Works are ordered from beginner to advanced. Click <strong style={{ color: 'var(--accent)' }}>Chapter Breakdown</strong> on any work to see a detailed chapter-by-chapter guide — what each chapter teaches, how hard it is, and whether to read carefully or skim.
            </p>
          </div>

          {/* Filter + count */}
          <div className="flex items-center gap-2 mb-6 flex-wrap">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Difficulty:</span>
            {(["ALL", "BEGINNER", "INTERMEDIATE", "ADVANCED"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded text-xs transition-all"
                style={{
                  background: filter === f ? 'var(--accent)' : 'var(--bg-card)',
                  color: filter === f ? '#0d1117' : 'var(--text-muted)',
                  border: '1px solid ' + (filter === f ? 'var(--accent)' : 'var(--border)'),
                  fontFamily: 'Georgia,serif',
                }}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </button>
            ))}
            <span className="text-sm ml-auto" style={{ color: 'var(--text-muted)' }}>{filtered.length} works</span>
          </div>

          {/* Work cards */}
          <div className="space-y-4 mb-12">
            {filtered.map((work, i) => (
              <WorkCard key={work.id || i} work={work} index={i} onSelect={setSelected} />
            ))}
          </div>

          {/* Bottom spinner while streaming */}
          {streaming && (
            <div className="flex items-center gap-3 py-6 justify-center" style={{ color: 'var(--text-muted)' }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem' }}>Finding more works…</span>
            </div>
          )}

          {/* Anti-library */}
          {antiLib.length > 0 && (
            <div className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
              <h2 className="text-base font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>
                The Anti-Library — What NOT to Read (Yet)
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                These works look appealing but beginners often reach for them too early. Save them for later.
              </p>
              <div className="space-y-3">
                {antiLib.map((item, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded" style={{ background: 'var(--bg-secondary)' }}>
                    <span style={{ color: 'var(--red)' }}>✕</span>
                    <div>
                      <div className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>{item.title}</div>
                      <div className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.reason}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {selected && (
        <ChapterBreakdown topic={label} work={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

export default function WorksPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <WorksPageInner />
    </Suspense>
  );
}
