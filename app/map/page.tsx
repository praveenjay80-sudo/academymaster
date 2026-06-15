"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface StageConcept {
  name: string;
  description: string;
}

interface StageWork {
  title: string;
  authors?: string[];
  category: "PEDAGOGICAL" | "SEMINAL" | "BREAKTHROUGH";
  reading_time: string;
  why?: string;
}

interface LearningStage {
  stage: string;
  layout: "sequential" | "parallel";
  parallel_group: string | null;
  concepts: StageConcept[];
  work: StageWork | null;
  duration: string;
  milestone?: string;
}

type RenderGroup =
  | { type: "sequential"; stage: LearningStage }
  | { type: "parallel"; stages: LearningStage[] };

type Status = "idle" | "streaming" | "done" | "error";

// ── NDJSON extractor ───────────────────────────────────────────────────────────

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
        else if (ch === "}") { depth--; if (depth === 0) { try { out.push(JSON.parse(buf.slice(i, j + 1))); } catch { /**/ } i = j + 1; break; } }
      }
      j++;
    }
    if (depth > 0) break;
  }
  return [out, buf.slice(i)];
}

// ── Group stages for rendering ────────────────────────────────────────────────

function groupStages(stages: LearningStage[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < stages.length) {
    const s = stages[i];
    if (s.layout === "sequential" || !s.parallel_group) {
      groups.push({ type: "sequential", stage: s });
      i++;
    } else {
      const group: LearningStage[] = [s];
      let j = i + 1;
      while (j < stages.length && stages[j].parallel_group === s.parallel_group) {
        group.push(stages[j]);
        j++;
      }
      groups.push({ type: "parallel", stages: group });
      i = j;
    }
  }
  return groups;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const CAT: Record<string, { color: string; label: string; bg: string }> = {
  PEDAGOGICAL: { color: "#60a5fa", label: "Pedagogical", bg: "#60a5fa18" },
  SEMINAL:     { color: "#a78bfa", label: "Seminal",     bg: "#a78bfa18" },
  BREAKTHROUGH:{ color: "#fb923c", label: "Breakthrough", bg: "#fb923c18" },
};

// ── Stage card ─────────────────────────────────────────────────────────────────

function StageCard({ stage, index, isParallel }: { stage: LearningStage; index: number; isParallel?: boolean }) {
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const cat = stage.work ? CAT[stage.work.category] : null;
  const accentColor = cat?.color ?? "var(--accent)";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: `1px solid var(--border)`,
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 10,
        overflow: "hidden",
        flex: isParallel ? 1 : undefined,
        animation: "fadeSlideIn 0.35s ease-out both",
      }}
    >
      {/* Stage header */}
      <div style={{ padding: "13px 16px 10px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: accentColor, fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", letterSpacing: 0.5 }}>
              STEP {index}
            </span>
            {isParallel && (
              <span style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 7px" }}>
                parallel
              </span>
            )}
          </div>
          <span style={{ color: "var(--accent)", fontSize: 12, fontFamily: "Georgia, serif", fontWeight: "bold" }}>
            ⏱ {stage.duration}
          </span>
        </div>
      </div>

      {/* Concepts */}
      <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
        <button
          onClick={() => setConceptsOpen(o => !o)}
          style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: conceptsOpen ? 8 : 0 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>CONCEPTS</span>
            <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{stage.concepts.length}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: "auto" }}>{conceptsOpen ? "▲" : "▼"}</span>
          </div>
          {/* Concept pills */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {stage.concepts.map(c => (
              <span
                key={c.name}
                style={{ fontSize: 11, padding: "3px 9px", borderRadius: 12, background: accentColor + "18", color: accentColor, fontFamily: "Georgia, serif" }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </button>

        {/* Concept descriptions */}
        {conceptsOpen && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 7 }}>
            {stage.concepts.map(c => (
              <div key={c.name}>
                <div style={{ color: "var(--text-primary)", fontSize: 12, fontWeight: "bold", fontFamily: "Georgia, serif", marginBottom: 2 }}>{c.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.6 }}>{c.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Work */}
      {stage.work ? (
        <div style={{ padding: "10px 16px", borderBottom: stage.milestone ? "1px solid var(--border-subtle)" : "none" }}>
          <button
            onClick={() => setWorkOpen(o => !o)}
            style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: cat!.bg, color: cat!.color, fontWeight: "bold" }}>
                    {cat!.label}
                  </span>
                  <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{stage.work.reading_time}</span>
                  <span style={{ color: "var(--text-muted)", fontSize: 10, marginLeft: "auto" }}>{workOpen ? "▲" : "▼"}</span>
                </div>
                <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", lineHeight: 1.3 }}>
                  📚 {stage.work.title}
                </div>
                {stage.work.authors && stage.work.authors.length > 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 2 }}>
                    {stage.work.authors.join(", ")}
                  </div>
                )}
              </div>
            </div>
          </button>
          {workOpen && stage.work.why && (
            <div style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.65, paddingTop: 8, borderTop: "1px solid var(--border-subtle)" }}>
              {stage.work.why}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "8px 16px", borderBottom: stage.milestone ? "1px solid var(--border-subtle)" : "none" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>No primary text — work through concepts independently</span>
        </div>
      )}

      {/* Milestone */}
      {stage.milestone && (
        <div style={{ padding: "9px 16px", background: "var(--bg-secondary)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10, fontWeight: "bold", letterSpacing: 1 }}>MILESTONE </span>
          <span style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.5 }}>{stage.milestone}</span>
        </div>
      )}
    </div>
  );
}

// ── Connector arrow ────────────────────────────────────────────────────────────

function Arrow({ label }: { label?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0, margin: "2px 0" }}>
      <div style={{ width: 1, height: 16, background: "var(--border)" }} />
      {label && (
        <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 0.8, padding: "2px 0" }}>{label}</div>
      )}
      <div style={{ color: "var(--border)", fontSize: 14, lineHeight: 1 }}>▼</div>
    </div>
  );
}

// ── Waterfall renderer ─────────────────────────────────────────────────────────

function Waterfall({ groups, streaming }: { groups: RenderGroup[]; streaming: boolean }) {
  let stepCounter = 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {groups.map((group, gi) => {
        const isFirst = gi === 0;
        if (group.type === "sequential") {
          stepCounter++;
          const idx = stepCounter;
          return (
            <div key={`seq-${gi}`}>
              {!isFirst && <Arrow label={group.stage.layout === "sequential" ? "sequential" : undefined} />}
              <StageCard stage={group.stage} index={idx} />
            </div>
          );
        } else {
          const parallelSteps = group.stages.map(() => ++stepCounter);
          return (
            <div key={`par-${gi}`}>
              {!isFirst && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 1, height: 14, background: "var(--border)" }} />
                  <div style={{ fontSize: 9, color: "#60a5fa", letterSpacing: 0.8, padding: "2px 8px", border: "1px solid #60a5fa40", borderRadius: 8, background: "#60a5fa10" }}>
                    PARALLEL — study simultaneously
                  </div>
                  <div style={{ display: "flex", gap: 0 }}>
                    {group.stages.map((_, i) => (
                      <div key={i} style={{ width: `${100 / group.stages.length}%`, display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <div style={{ width: 1, height: 12, background: "var(--border)" }} />
                        <div style={{ color: "var(--border)", fontSize: 12, lineHeight: 1 }}>▼</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 12 }}>
                {group.stages.map((stage, si) => (
                  <StageCard key={stage.stage} stage={stage} index={parallelSteps[si]} isParallel />
                ))}
              </div>
            </div>
          );
        }
      })}

      {/* Streaming indicator */}
      {streaming && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 4 }}>
          <div style={{ width: 1, height: 16, background: "var(--border)" }} />
          <div style={{ color: "var(--accent)", fontSize: 12, fontFamily: "Georgia, serif" }}>● generating…</div>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

function MapInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("topic") ?? "";
  const label = searchParams.get("label") ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [query, setQuery] = useState("");
  const [stages, setStages] = useState<LearningStage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [gen, setGen] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `learning-flow:${slug}`;
  const TTL = 14 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!slug) return;

    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL && Array.isArray(data) && data.length > 0) {
          setStages(data);
          setStatus("done");
          return;
        }
      }
    } catch { /**/ }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setStages([]);
    setStatus("streaming");

    (async () => {
      const all: LearningStage[] = [];
      try {
        const res = await fetch("/api/learning-flow", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: label }),
          signal,
        });
        if (!res.ok) { setStatus("error"); return; }

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value);
          const [objs, rem] = extractObjects(buf);
          buf = rem;
          for (const obj of objs as LearningStage[]) {
            if (obj.stage && obj.layout && Array.isArray(obj.concepts)) {
              all.push(obj);
              setStages(prev => [...prev, obj]);
            }
          }
        }

        localStorage.setItem(cacheKey, JSON.stringify({ data: all, ts: Date.now() }));
        setStatus("done");
      } catch (e: unknown) {
        if ((e as Error)?.name !== "AbortError") setStatus("error");
      }
    })();

    return () => { abortRef.current?.abort(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, gen]);

  function regenerate() {
    abortRef.current?.abort();
    localStorage.removeItem(cacheKey);
    setStages([]);
    setStatus("idle");
    setGen(g => g + 1);
  }

  function stop() {
    abortRef.current?.abort();
    setStatus("done");
  }

  function navigate(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const s = q.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    router.push(`/map?topic=${s}&label=${encodeURIComponent(q)}`);
    setQuery("");
  }

  const groups = groupStages(stages);
  const isStreaming = status === "streaming";

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>

      {/* CSS animation */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "13px 24px", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10 }}>
        <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>← Home</a>
        <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 19, fontWeight: "bold", flexShrink: 0 }}>◈ Learning Map</span>

        {slug && (
          <span style={{ color: "var(--text-secondary)", fontFamily: "Georgia, serif", fontSize: 15, flex: 1 }}>{label}</span>
        )}

        <form onSubmit={navigate} style={{ display: "flex", gap: 6, maxWidth: 360 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="New topic…"
            style={{ flex: 1, background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontFamily: "Georgia, serif", fontSize: 13, outline: "none", minWidth: 0 }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button type="submit" disabled={!query.trim()} style={{ background: query.trim() ? "var(--accent)" : "var(--bg-card)", color: query.trim() ? "#0d1117" : "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", cursor: query.trim() ? "pointer" : "default", flexShrink: 0 }}>
            Go →
          </button>
        </form>

        {slug && (
          isStreaming ? (
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
          )
        )}

        <a href="/browse"
          style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >◈ Browse</a>
      </header>

      {/* ── No topic landing ────────────────────────────────────────────── */}
      {!slug && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, padding: 40 }}>
          <div style={{ fontSize: 52 }}>◈</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 24, margin: 0 }}>Learning Map</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 480, lineHeight: 1.8, margin: 0 }}>
            Enter any subject and get a waterfall learning map — concepts and key readings in the exact order to tackle them, with sequential steps where each builds on the last, and parallel branches where the field splits into independent tracks.
          </p>
          <form onSubmit={navigate} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Game Theory, Measure Theory, Evolutionary Biology…"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "13px 18px", fontFamily: "Georgia, serif", fontSize: 15, width: 360, outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
              autoFocus
            />
            <button type="submit" disabled={!query.trim()} style={{ background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 8, padding: "13px 24px", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", cursor: "pointer" }}>
              Generate →
            </button>
          </form>

          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            {[["#60a5fa", "Pedagogical"], ["#a78bfa", "Seminal"], ["#fb923c", "Breakthrough"]].map(([color, lbl]) => (
              <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{lbl}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Waterfall ──────────────────────────────────────────────────── */}
      {slug && (
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 24px" }}>
          <div style={{ maxWidth: 760, margin: "0 auto" }}>

            {/* Status / legend row */}
            {stages.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {stages.length} stage{stages.length !== 1 ? "s" : ""}
                  {isStreaming ? " · generating…" : " · complete"}
                </span>
                <div style={{ display: "flex", gap: 12, marginLeft: "auto" }}>
                  {[["#60a5fa", "Pedagogical"], ["#a78bfa", "Seminal"], ["#fb923c", "Breakthrough"]].map(([color, lbl]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{lbl}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {status === "streaming" && stages.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", paddingTop: 60 }}>
                Building your learning map…
              </div>
            )}

            {status === "error" && (
              <div style={{ color: "var(--red)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
                Something went wrong. <button onClick={regenerate} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14 }}>Try again →</button>
              </div>
            )}

            <Waterfall groups={groups} streaming={isStreaming} />

            {/* Completion marker */}
            {status === "done" && stages.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 8 }}>
                <div style={{ width: 1, height: 20, background: "var(--border)" }} />
                <div style={{ border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 20px", color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 13 }}>
                  ✓ Mastery
                </div>
              </div>
            )}
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
