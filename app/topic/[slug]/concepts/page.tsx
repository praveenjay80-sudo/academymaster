"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

interface Concept {
  id: string;
  name: string;
  description: string;
  difficulty: "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
  prerequisites: string[];
  unlocks: string[];
  category: string;
}

const DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "var(--green)",
  INTERMEDIATE: "var(--accent)",
  ADVANCED: "var(--red)",
};
const DIFF_LABEL: Record<string, string> = {
  FOUNDATIONAL: "Foundational",
  INTERMEDIATE: "Intermediate",
  ADVANCED: "Advanced",
};

/* ── Deep-dive slide-in panel ── */
function ConceptDeepDive({ topic, concept, onClose }: { topic: string; concept: Concept; onClose: () => void }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `concept-deep:${topic}:${concept.id}`;

  useEffect(() => {
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) { setContent(data); setLoading(false); return; }
      } catch { /* stale */ }
    }
    abortRef.current = new AbortController();
    setLoading(true); setContent("");
    (async () => {
      try {
        const res = await fetch("/api/concept", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic, concept: concept.name, prerequisites: concept.prerequisites }),
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
        if ((e as Error).name !== "AbortError") setContent("Error loading. Please try again.");
      } finally { setLoading(false); }
    })();
    return () => abortRef.current?.abort();
  }, [cacheKey, concept.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function md(text: string) {
    return text
      .replace(/^## (.+)$/gm, '<h2 style="color:var(--accent);font-size:1rem;font-weight:700;margin:1.5rem 0 0.4rem;text-transform:uppercase;letter-spacing:.05em;font-family:Georgia,serif;border-bottom:1px solid var(--border);padding-bottom:.3rem">$1</h2>')
      .replace(/^### (.+)$/gm, '<h3 style="color:var(--text-primary);font-size:.95rem;font-weight:600;margin:1rem 0 .3rem;font-family:Georgia,serif">$1</h3>')
      .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>')
      .replace(/\*(.+?)\*/g, '<em style="color:var(--text-secondary)">$1</em>')
      .replace(/`(.+?)`/g, '<code style="background:var(--bg-primary);border:1px solid var(--border);border-radius:3px;padding:.1rem .3rem;font-size:.85em;color:var(--accent)">$1</code>')
      .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-dim);padding-left:1rem;margin:.5rem 0;color:var(--text-secondary);font-style:italic">$1</blockquote>')
      .replace(/^- (.+)$/gm, '<li style="padding:.2rem 0 .2rem 1.2rem;color:var(--text-primary);line-height:1.7">◆ $1</li>')
      .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul style="list-style:none;padding:0;margin:.4rem 0">${m}</ul>`)
      .replace(/\n\n+/g, '</p><p style="color:var(--text-primary);line-height:1.8;margin:.4rem 0">')
      .replace(/^(?!<[hul]|<\/[hul]|<block)(.+)$/gm, m => m.trim() ? `<p style="color:var(--text-primary);line-height:1.8;margin:.4rem 0">${m}</p>` : '');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" style={{ background: 'rgba(0,0,0,.7)' }} onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto" style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 z-10 p-6 pb-4" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap gap-1.5 mb-2">
                <span className="text-xs px-2 py-0.5 rounded" style={{ color: DIFF_COLOR[concept.difficulty], border: `1px solid ${DIFF_COLOR[concept.difficulty]}40`, background: `${DIFF_COLOR[concept.difficulty]}10` }}>{DIFF_LABEL[concept.difficulty]}</span>
                {concept.category && <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-card)' }}>{concept.category}</span>}
              </div>
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>{concept.name}</h2>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{concept.description}</p>
            </div>
            <button onClick={onClose} className="text-xl p-2 shrink-0" style={{ color: 'var(--text-muted)' }}>✕</button>
          </div>
        </div>
        <div className="p-6">
          {loading && !content && (
            <div className="flex items-center gap-3 py-8" style={{ color: 'var(--text-muted)' }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span style={{ fontFamily: 'Georgia,serif' }}>Writing deep explanation…</span>
            </div>
          )}
          {content && <div dangerouslySetInnerHTML={{ __html: md(content) }} />}
        </div>
      </div>
    </div>
  );
}

/* ── Single concept card ── */
function ConceptCard({ c, allConcepts, index, onSelect, onCycleProgress, getStatus }: {
  c: Concept;
  allConcepts: Concept[];
  index: number;
  onSelect: (c: Concept) => void;
  onCycleProgress: (e: React.MouseEvent, id: string) => void;
  getStatus: (id: string) => string;
}) {
  const statusColors: Record<string, string> = { unread: 'var(--text-muted)', read: 'var(--blue)', understood: 'var(--accent)', mastered: 'var(--green)' };
  const statusIcons: Record<string, string> = { unread: '·', read: '○', understood: '◆', mastered: '✓' };
  const st = getStatus(c.id);
  const prereqs = allConcepts.filter(x => c.prerequisites.includes(x.id));
  const unlocks = allConcepts.filter(x => c.unlocks.includes(x.id));

  return (
    <div
      onClick={() => onSelect(c)}
      className="p-4 rounded-lg cursor-pointer group transition-all"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-subtle)',
        animation: `fadeSlideIn 0.35s ease-out ${Math.min(index * 0.05, 0.5)}s both`,
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-semibold text-sm leading-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>{c.name}</h3>
        <button
          onClick={e => onCycleProgress(e, c.id)}
          title="Track progress"
          className="text-lg leading-none shrink-0 transition-colors"
          style={{ color: statusColors[st] }}
        >
          {statusIcons[st]}
        </button>
      </div>
      <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>{c.description}</p>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: DIFF_COLOR[c.difficulty], background: `${DIFF_COLOR[c.difficulty]}12`, border: `1px solid ${DIFF_COLOR[c.difficulty]}30` }}>{DIFF_LABEL[c.difficulty]}</span>
        {c.category && <span className="text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-secondary)' }}>{c.category}</span>}
      </div>
      {(prereqs.length > 0 || unlocks.length > 0) && (
        <div className="mt-3 pt-3 space-y-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          {prereqs.length > 0 && <div className="text-xs" style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--blue)' }}>Needs: </span>{prereqs.map(p => p.name).join(', ')}</div>}
          {unlocks.length > 0 && <div className="text-xs" style={{ color: 'var(--text-muted)' }}><span style={{ color: 'var(--green)' }}>Unlocks: </span>{unlocks.map(u => u.name).join(', ')}</div>}
        </div>
      )}
      <div className="mt-2 text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }}>Click for full deep-dive →</div>
    </div>
  );
}

/* ── Main page ── */
function ConceptsPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Concept | null>(null);
  const [filter, setFilter] = useState<"ALL" | "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED">("ALL");
  const [search, setSearch] = useState("");
  const [progress, setProgress] = useState<Record<string, string>>({});
  const hasFetched = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `concepts-list-v2:${slug}`;

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    // Load progress from localStorage
    const p: Record<string, string> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("progress:concept:")) p[k.slice(17)] = localStorage.getItem(k)!;
    }
    setProgress(p);

    // Check cache
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) {
          setConcepts(data);
          setDone(true);
          return;
        }
      } catch { /* stale */ }
    }

    // Stream from API
    setStreaming(true);
    abortRef.current = new AbortController();
    const accumulated: Concept[] = [];

    (async () => {
      try {
        const res = await fetch("/api/concepts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: label }),
          signal: abortRef.current!.signal,
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        // Extract complete JSON objects from a buffer by counting braces
        function extractObjects(text: string): { objects: Concept[]; remaining: string } {
          const objects: Concept[] = [];
          let i = 0;
          while (i < text.length) {
            // Find start of an object
            const start = text.indexOf("{", i);
            if (start === -1) break;
            // Count braces to find matching close
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
            if (end === -1) break; // incomplete object — keep in buffer
            const objStr = text.slice(start, end + 1);
            try {
              const concept: Concept = JSON.parse(objStr);
              if (concept.id && concept.name && concept.difficulty) objects.push(concept);
            } catch { /* malformed — skip */ }
            i = end + 1;
          }
          // remaining = everything after the last complete object
          const remaining = i < text.length ? text.slice(i) : "";
          return { objects, remaining };
        }

        while (true) {
          const { done: rdDone, value } = await reader.read();
          if (rdDone) break;

          buf += dec.decode(value, { stream: true });
          const { objects, remaining } = extractObjects(buf);
          buf = remaining;

          if (objects.length > 0) {
            for (const c of objects) accumulated.push(c);
            setConcepts([...accumulated]);
          }
        }

        // Try any remaining buffer
        if (buf.trim()) {
          const { objects } = extractObjects(buf + "}"); // attempt to close if truncated
          for (const c of objects) if (!accumulated.find(a => a.id === c.id)) accumulated.push(c);
          if (objects.length) setConcepts([...accumulated]);
        }

        localStorage.setItem(cacheKey, JSON.stringify({ data: accumulated, ts: Date.now() }));
      } catch (e: unknown) {
        if ((e as Error).name !== "AbortError") setError("Failed to load concepts: " + (e as Error).message);
      } finally {
        setStreaming(false);
        setDone(true);
      }
    })();

    return () => abortRef.current?.abort();
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  function cycleProgress(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    const statuses = ["unread", "read", "understood", "mastered"];
    const current = progress[id] || "unread";
    const next = statuses[(statuses.indexOf(current) + 1) % statuses.length];
    localStorage.setItem(`progress:concept:${id}`, next);
    setProgress(prev => ({ ...prev, [id]: next }));
  }

  const getStatus = (id: string) => progress[id] || "unread";

  const filtered = concepts.filter(c => {
    if (filter !== "ALL" && c.difficulty !== filter) return false;
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groups = {
    FOUNDATIONAL: filtered.filter(c => c.difficulty === "FOUNDATIONAL"),
    INTERMEDIATE: filtered.filter(c => c.difficulty === "INTERMEDIATE"),
    ADVANCED: filtered.filter(c => c.difficulty === "ADVANCED"),
  };

  const totalMastered = concepts.filter(c => getStatus(c.id) === "mastered").length;

  return (
    <div>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.4; }
        }
      `}</style>

      {/* Streaming banner */}
      {streaming && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
          <span className="text-sm" style={{ color: 'var(--accent)', fontFamily: 'Georgia,serif' }}>
            Generating concept map… {concepts.length > 0 && `${concepts.length} concepts found so far`}
          </span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 rounded-lg" style={{ background: 'rgba(248,113,113,.1)', border: '1px solid var(--red)', color: 'var(--red)' }}>
          {error}
        </div>
      )}

      {/* Show this only once we have at least one concept OR we're done */}
      {(concepts.length > 0 || done) && (
        <>
          {/* Stats + search bar */}
          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-4">
              {[
                { label: 'Foundational', count: groups.FOUNDATIONAL.length, color: 'var(--green)' },
                { label: 'Intermediate', count: groups.INTERMEDIATE.length, color: 'var(--accent)' },
                { label: 'Advanced', count: groups.ADVANCED.length, color: 'var(--red)' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className="text-xl font-bold" style={{ color: s.color, fontFamily: 'Georgia,serif' }}>{s.count}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</div>
                </div>
              ))}
              {totalMastered > 0 && (
                <div className="text-center">
                  <div className="text-xl font-bold" style={{ color: 'var(--green)', fontFamily: 'Georgia,serif' }}>{totalMastered}</div>
                  <div className="text-xs" style={{ color: 'var(--text-muted)' }}>Mastered</div>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-40">
              <input
                type="text"
                placeholder="Search concepts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full px-4 py-2 rounded-lg outline-none text-sm"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}
              />
            </div>
            <div className="flex gap-1">
              {(["ALL", "FOUNDATIONAL", "INTERMEDIATE", "ADVANCED"] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)} className="px-3 py-1.5 rounded text-xs transition-all"
                  style={{ background: filter === f ? 'var(--accent)' : 'var(--bg-card)', color: filter === f ? '#0d1117' : 'var(--text-muted)', border: '1px solid ' + (filter === f ? 'var(--accent)' : 'var(--border)'), fontFamily: 'Georgia,serif' }}>
                  {f === "ALL" ? "All" : DIFF_LABEL[f]}
                </button>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="mb-6 p-4 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
            <p className="text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>
              <strong style={{ color: 'var(--accent)' }}>How to use this:</strong> Start with every <span style={{ color: 'var(--green)' }}>Foundational</span> concept. Click any card to get a complete plain-English deep-dive. Use <span style={{ color: 'var(--accent)' }}>· → ○ → ◆ → ✓</span> to track your progress.
            </p>
          </div>

          {/* Groups */}
          {([
            { key: 'FOUNDATIONAL', title: 'Start Here — Foundational Concepts', subtitle: 'The building blocks. Master these before anything else.', color: 'var(--green)' },
            { key: 'INTERMEDIATE', title: 'Build On It — Intermediate Concepts', subtitle: 'Once you have the foundations, these go deeper.', color: 'var(--accent)' },
            { key: 'ADVANCED', title: 'Go Deep — Advanced Concepts', subtitle: 'For when you want true mastery.', color: 'var(--red)' },
          ] as const).map(({ key, title, subtitle, color }) => (
            groups[key].length > 0 && (
              <div key={key} className="mb-10">
                <div className="mb-4">
                  <h2 className="text-lg font-bold mb-1" style={{ color, fontFamily: 'Georgia,serif' }}>{title}</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groups[key].map((c, i) => (
                    <ConceptCard key={c.id} c={c} allConcepts={concepts} index={i} onSelect={setSelected} onCycleProgress={cycleProgress} getStatus={getStatus} />
                  ))}
                </div>
              </div>
            )
          ))}

          {/* Bottom streaming indicator */}
          {streaming && (
            <div className="flex items-center gap-3 py-6 justify-center" style={{ color: 'var(--text-muted)' }}>
              <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <span style={{ fontFamily: 'Georgia,serif', fontSize: '0.9rem' }}>Finding more concepts…</span>
            </div>
          )}
        </>
      )}

      {/* Initial empty state with spinner */}
      {!done && concepts.length === 0 && !error && (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p style={{ color: 'var(--text-muted)', fontFamily: 'Georgia,serif' }}>Building concept map for <strong style={{ color: 'var(--accent)' }}>{label}</strong>…</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Concepts will appear one by one as they are generated</p>
        </div>
      )}

      {/* Deep dive panel */}
      {selected && <ConceptDeepDive topic={label} concept={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

export default function ConceptsPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <ConceptsPageInner />
    </Suspense>
  );
}
