"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface Concept {
  id: string;
  name: string;
  description: string;
  difficulty: "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
  prerequisites: string[];
  unlocks: string[];
  category: string;
  key_works?: string[];
}

interface MapWork {
  order: number;
  category: "PEDAGOGICAL" | "SEMINAL" | "BREAKTHROUGH";
  title: string;
  authors?: string[];
  year?: number;
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
  reading_time: string;
  why_essential?: string;
  what_you_gain?: string;
  prereqs?: string;
}

type Status = "idle" | "streaming" | "done" | "error";

// ── Brace-counting NDJSON extractor ───────────────────────────────────────────

function extractObjects(buf: string): [unknown[], string] {
  const out: unknown[] = [];
  let i = 0;
  while (i < buf.length) {
    if (buf[i] !== "{") { i++; continue; }
    let depth = 0, j = i, inStr = false, esc = false;
    while (j < buf.length) {
      const ch = buf[j];
      if (esc) { esc = false; }
      else if (ch === "\\" && inStr) { esc = true; }
      else if (ch === '"') { inStr = !inStr; }
      else if (!inStr) {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            try { out.push(JSON.parse(buf.slice(i, j + 1))); } catch { /**/ }
            i = j + 1; break;
          }
        }
      }
      j++;
    }
    if (depth > 0) break;
  }
  return [out, buf.slice(i)];
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CONCEPT_DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED: "#f87171",
};
const WORK_DIFF_COLOR: Record<string, string> = {
  BEGINNER: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED: "#f87171",
};
const CAT_COLOR: Record<string, string> = {
  PEDAGOGICAL: "#60a5fa",
  SEMINAL: "#a78bfa",
  BREAKTHROUGH: "#fb923c",
};
const TTL = 14 * 24 * 60 * 60 * 1000;

// ── Concept card ───────────────────────────────────────────────────────────────

function ConceptCard({ c }: { c: Concept }) {
  const color = CONCEPT_DIFF_COLOR[c.difficulty] ?? "#c9a84c";
  return (
    <div style={{
      background: "var(--bg-card)",
      borderLeft: `3px solid ${color}`,
      border: `1px solid ${color}20`,
      borderRadius: 8,
      padding: "11px 13px",
      marginBottom: 8,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 5 }}>
        <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", lineHeight: 1.3 }}>
          {c.name}
        </div>
        <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: color + "22", color, fontWeight: "bold", flexShrink: 0, whiteSpace: "nowrap" }}>
          {c.difficulty === "FOUNDATIONAL" ? "FOUND." : c.difficulty === "INTERMEDIATE" ? "INTER." : "ADV."}
        </span>
      </div>
      <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.65 }}>{c.description}</div>
      {c.category && (
        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 5, letterSpacing: 0.5 }}>{c.category}</div>
      )}
      {c.key_works && c.key_works.length > 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 4 }}>📚 {c.key_works.join(" · ")}</div>
      )}
      {c.prerequisites && c.prerequisites.length > 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 3 }}>
          Needs: {c.prerequisites.slice(0, 3).join(", ")}
        </div>
      )}
    </div>
  );
}

// ── Work card ──────────────────────────────────────────────────────────────────

function WorkCard({ w }: { w: MapWork }) {
  const [open, setOpen] = useState(false);
  const catColor = CAT_COLOR[w.category] ?? "#c9a84c";
  const diffColor = WORK_DIFF_COLOR[w.difficulty] ?? "#c9a84c";

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderRadius: open ? "8px 8px 0 0" : 8,
          padding: "12px 14px",
          cursor: "pointer",
          transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = catColor + "80")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ color: catColor, fontSize: 14, fontWeight: "bold", fontFamily: "Georgia, serif", flexShrink: 0, minWidth: 24, marginTop: 1 }}>
            {w.order}.
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", lineHeight: 1.3 }}>
              {w.title}
            </div>
            {w.authors && w.authors.length > 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
                {w.authors.join(", ")}{w.year ? ` · ${w.year}` : ""}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 9, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: catColor + "20", color: catColor, fontWeight: "bold" }}>
            {w.category}
          </span>
          <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 10, background: diffColor + "20", color: diffColor }}>
            {w.difficulty}
          </span>
          <span style={{ fontSize: 12, color: "var(--accent)", marginLeft: "auto", fontFamily: "Georgia, serif", fontWeight: "bold" }}>
            ⏱ {w.reading_time}
          </span>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{
          background: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          padding: "13px 14px 15px",
        }}>
          {w.why_essential && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: "0 0 9px" }}>
              <strong style={{ color: "var(--text-primary)" }}>Why essential: </strong>{w.why_essential}
            </p>
          )}
          {w.what_you_gain && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: "0 0 9px" }}>
              <strong style={{ color: "var(--accent)" }}>You gain: </strong>{w.what_you_gain}
            </p>
          )}
          {w.prereqs && w.prereqs.toLowerCase() !== "none" && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: 0 }}>
              <strong style={{ color: "var(--text-muted)" }}>Before reading: </strong>{w.prereqs}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Streaming status indicator ─────────────────────────────────────────────────

function StreamDot({ status }: { status: Status }) {
  if (status === "streaming") return <span style={{ color: "var(--accent)", fontSize: 11 }}>● generating…</span>;
  if (status === "done") return <span style={{ color: "#4ade80", fontSize: 11 }}>✓</span>;
  if (status === "error") return <span style={{ color: "#f87171", fontSize: 11 }}>✕ error</span>;
  return null;
}

// ── Main ───────────────────────────────────────────────────────────────────────

function MapInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("topic") ?? "";
  const label = searchParams.get("label") ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [query, setQuery] = useState("");
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [works, setWorks] = useState<MapWork[]>([]);
  const [conceptStatus, setConceptStatus] = useState<Status>("idle");
  const [workStatus, setWorkStatus] = useState<Status>("idle");
  const [gen, setGen] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const conceptsKey = `concepts-list-v2:${slug}`;
  const worksKey = `map-works:${slug}`;

  useEffect(() => {
    if (!slug) return;

    let conceptsCached = false;
    let worksCached = false;

    try {
      const raw = localStorage.getItem(conceptsKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL && Array.isArray(data) && data.length > 0) {
          setConcepts(data);
          setConceptStatus("done");
          conceptsCached = true;
        }
      }
    } catch { /**/ }

    try {
      const raw = localStorage.getItem(worksKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL && Array.isArray(data) && data.length > 0) {
          setWorks(data);
          setWorkStatus("done");
          worksCached = true;
        }
      }
    } catch { /**/ }

    if (conceptsCached && worksCached) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;

    if (!conceptsCached) {
      setConcepts([]);
      setConceptStatus("streaming");
      runConceptStream(slug, label, signal);
    }
    if (!worksCached) {
      setWorks([]);
      setWorkStatus("streaming");
      runWorkStream(label, signal);
    }

    return () => { abortRef.current?.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, gen]);

  async function runConceptStream(slug: string, label: string, signal: AbortSignal) {
    const all: Concept[] = [];
    try {
      const res = await fetch("/api/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label }),
        signal,
      });
      if (!res.ok) { setConceptStatus("error"); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        const [objs, rem] = extractObjects(buf);
        buf = rem;
        for (const obj of objs as Concept[]) {
          if (obj.id && obj.name && obj.difficulty) {
            all.push(obj);
            setConcepts(prev => [...prev, obj]);
          }
        }
      }
      localStorage.setItem(conceptsKey, JSON.stringify({ data: all, ts: Date.now() }));
      setConceptStatus("done");
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setConceptStatus("error");
    }
  }

  async function runWorkStream(label: string, signal: AbortSignal) {
    const all: MapWork[] = [];
    try {
      const res = await fetch("/api/map-works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label }),
        signal,
      });
      if (!res.ok) { setWorkStatus("error"); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value);
        const [objs, rem] = extractObjects(buf);
        buf = rem;
        for (const obj of objs as MapWork[]) {
          if (obj.title && obj.category && obj.difficulty) {
            all.push(obj);
            setWorks(prev =>
              [...prev.filter(w => w.order !== obj.order), obj]
                .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
            );
          }
        }
      }
      localStorage.setItem(worksKey, JSON.stringify({ data: all, ts: Date.now() }));
      setWorkStatus("done");
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setWorkStatus("error");
    }
  }

  function regenerate() {
    abortRef.current?.abort();
    localStorage.removeItem(conceptsKey);
    localStorage.removeItem(worksKey);
    setConcepts([]);
    setWorks([]);
    setConceptStatus("idle");
    setWorkStatus("idle");
    setGen(g => g + 1);
  }

  function stop() {
    abortRef.current?.abort();
    if (conceptStatus === "streaming") setConceptStatus("done");
    if (workStatus === "streaming") setWorkStatus("done");
  }

  function navigate(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const s = q.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    router.push(`/map?topic=${s}&label=${encodeURIComponent(q)}`);
    setQuery("");
  }

  const isStreaming = conceptStatus === "streaming" || workStatus === "streaming";

  const DIFF_GROUPS: { key: Concept["difficulty"]; color: string }[] = [
    { key: "FOUNDATIONAL", color: "#4ade80" },
    { key: "INTERMEDIATE", color: "#c9a84c" },
    { key: "ADVANCED", color: "#f87171" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "13px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>← Home</a>
        <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 19, fontWeight: "bold", flexShrink: 0 }}>◈ Learning Map</span>

        <form onSubmit={navigate} style={{ display: "flex", gap: 6, flex: 1, maxWidth: 440 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={label || "Enter any topic…"}
            style={{
              flex: 1, background: "var(--bg-card)", color: "var(--text-primary)",
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "7px 12px", fontFamily: "Georgia, serif", fontSize: 13, outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button type="submit" disabled={!query.trim()} style={{
            background: query.trim() ? "var(--accent)" : "var(--bg-card)",
            color: query.trim() ? "#0d1117" : "var(--text-muted)",
            border: "1px solid var(--border)", borderRadius: 8, padding: "7px 16px",
            fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold",
            cursor: query.trim() ? "pointer" : "default", flexShrink: 0,
          }}>
            Go →
          </button>
        </form>

        {slug && (isStreaming ? (
          <button onClick={stop} style={{ background: "none", color: "var(--red)", border: "1px solid var(--red)", borderRadius: 8, padding: "6px 14px", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>
            ■ Stop
          </button>
        ) : (
          <button onClick={regenerate} style={{ background: "none", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >
            ↺ Regenerate
          </button>
        ))}

        <a href="/browse"
          style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >◈ Browse Themes</a>
      </header>

      {/* ── No topic: landing ──────────────────────────────────────────── */}
      {!slug && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40 }}>
          <div style={{ fontSize: 52 }}>◈</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 24, margin: 0 }}>Master Any Topic</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 460, lineHeight: 1.8, margin: 0 }}>
            Enter any subject to instantly generate its complete concept map and reading order — every concept you need to understand, every book and paper in the order to read them, with time estimates — all in one place.
          </p>
          <form onSubmit={navigate} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Game Theory, Measure Theory, Evolutionary Biology…"
              style={{
                background: "var(--bg-card)", color: "var(--text-primary)",
                border: "1px solid var(--border)", borderRadius: 8,
                padding: "13px 18px", fontFamily: "Georgia, serif", fontSize: 15, width: 360, outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
              autoFocus
            />
            <button type="submit" disabled={!query.trim()} style={{
              background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 8,
              padding: "13px 24px", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer",
            }}>
              Generate →
            </button>
          </form>
        </div>
      )}

      {/* ── Two-column streaming view ──────────────────────────────────── */}
      {slug && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* LEFT: Concepts ─────────────────────────────────────────── */}
          <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden" }}>

            {/* Column header */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Concepts</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{concepts.length} concepts</span>
                <StreamDot status={conceptStatus} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {DIFF_GROUPS.map(g => (
                  <div key={g.key} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: g.color }} />
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{g.key === "FOUNDATIONAL" ? "Found." : g.key === "INTERMEDIATE" ? "Inter." : "Adv."}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Concept cards by difficulty */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {conceptStatus === "streaming" && concepts.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
                  Generating concepts…
                </div>
              )}
              {DIFF_GROUPS.map(g => {
                const group = concepts.filter(c => c.difficulty === g.key);
                if (group.length === 0) return null;
                return (
                  <div key={g.key} style={{ marginBottom: 18 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
                      <div style={{ height: 1, flex: 1, background: g.color + "35" }} />
                      <span style={{ color: g.color, fontSize: 9, fontWeight: "bold", letterSpacing: 1.4, whiteSpace: "nowrap" }}>
                        {g.key} ({group.length})
                      </span>
                      <div style={{ height: 1, flex: 1, background: g.color + "35" }} />
                    </div>
                    {group.map(c => <ConceptCard key={c.id} c={c} />)}
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: Reading order ────────────────────────────────────── */}
          <div style={{ flex: "0 0 50%", display: "flex", flexDirection: "column", overflow: "hidden" }}>

            {/* Column header */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>Reading Order — Zero to Mastery</span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>{works.length} works</span>
                <StreamDot status={workStatus} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {[["#60a5fa", "Pedagogical"], ["#a78bfa", "Seminal"], ["#fb923c", "Breakthrough"]].map(([color, lbl]) => (
                  <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                    <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{lbl}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Work cards */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              {workStatus === "streaming" && works.length === 0 && (
                <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textAlign: "center", paddingTop: 48 }}>
                  Generating reading list…
                </div>
              )}
              {works.map(w => <WorkCard key={`${w.order}:${w.title}`} w={w} />)}
            </div>
          </div>

        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>Loading…</span>
      </div>
    }>
      <MapInner />
    </Suspense>
  );
}
