"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

interface CanonFigure {
  _type: "figure";
  id: string;
  name: string;
  years: string;
  contribution: string;
  concept_ids: string[];
  work_ids: string[];
  influenced_by: string[];
  influenced: string[];
  surprising_fact: string;
}

interface CanonConcept {
  _type: "concept";
  id: string;
  name: string;
  description: string;
  difficulty: "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED";
  category: string;
  prerequisites: string[];
  unlocks: string[];
  figure_ids: string[];
  work_ids: string[];
  analogy: string;
}

interface CanonWork {
  _type: "work";
  id: string;
  title: string;
  authors: string[];
  year: number;
  category: "PEDAGOGICAL" | "SEMINAL" | "BREAKTHROUGH";
  difficulty: string;
  reading_time: string;
  concept_ids: string[];
  why_essential: string;
  what_you_gain: string;
  prereqs: string;
}

interface CanonEvent {
  _type: "event";
  id: string;
  year: number;
  era: string;
  title: string;
  description: string;
  significance: string;
  event_type: string;
  figure_id?: string;
  concept_id?: string;
  work_id?: string;
}

interface CanonStage {
  _type: "stage";
  stage_id: string;
  level: "FOUNDATIONS" | "INTERMEDIATE" | "ADVANCED" | "SPECIALIZATION" | "RESEARCH";
  layout: "sequential" | "parallel";
  parallel_group: string | null;
  track: string | null;
  track_position: number | null;
  title: string;
  concept_ids: string[];
  work_id: string | null;
  work_title: string | null;
  work_authors: string[];
  work_category: string | null;
  duration: string;
  milestone: string;
  prerequisites: string[];
}

type RenderGroup =
  | { type: "seq"; stage: CanonStage }
  | { type: "par"; tracks: { name: string | null; stages: CanonStage[] }[] };

type Status = "idle" | "streaming" | "done" | "error";

// ── Constants ──────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED:     "#f87171",
};

const CAT: Record<string, { color: string; bg: string }> = {
  PEDAGOGICAL:  { color: "#60a5fa", bg: "#60a5fa14" },
  SEMINAL:      { color: "#a78bfa", bg: "#a78bfa14" },
  BREAKTHROUGH: { color: "#fb923c", bg: "#fb923c14" },
};

const EVENT_COLOR: Record<string, string> = {
  DISCOVERY:      "#4ade80",
  PUBLICATION:    "#60a5fa",
  PARADIGM_SHIFT: "#fb923c",
  APPLICATION:    "#a78bfa",
  CONTROVERSY:    "#f87171",
};

const LEVEL_COLOR: Record<string, string> = {
  FOUNDATIONS:    "#4ade80",
  INTERMEDIATE:   "#60a5fa",
  ADVANCED:       "#c9a84c",
  SPECIALIZATION: "#a78bfa",
  RESEARCH:       "#fb923c",
};

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

// ── Group stages into render groups ───────────────────────────────────────────

function groupStages(stages: CanonStage[]): RenderGroup[] {
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < stages.length) {
    const s = stages[i];
    if (s.layout === "sequential" || !s.parallel_group) {
      groups.push({ type: "seq", stage: s });
      i++;
    } else {
      const pg = s.parallel_group;
      const pgStages: CanonStage[] = [];
      while (i < stages.length && stages[i].parallel_group === pg) { pgStages.push(stages[i]); i++; }
      const trackMap = new Map<string, CanonStage[]>();
      pgStages.forEach(st => {
        const k = st.track ?? "__";
        if (!trackMap.has(k)) trackMap.set(k, []);
        trackMap.get(k)!.push(st);
      });
      trackMap.forEach(v => v.sort((a, b) => (a.track_position ?? 0) - (b.track_position ?? 0)));
      const tracks = [...trackMap.entries()].map(([name, sts]) => ({ name: name === "__" ? null : name, stages: sts }));
      groups.push({ type: "par", tracks });
    }
  }
  return groups;
}

// ── Concept card ───────────────────────────────────────────────────────────────

function ConceptCard({
  concept, linkedFigures, linkedWorks, linkedEvent, isParallel,
}: {
  concept: CanonConcept;
  linkedFigures: CanonFigure[];
  linkedWorks: CanonWork[];
  linkedEvent: CanonEvent | null;
  isParallel?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dc = DIFF_COLOR[concept.difficulty] ?? "#c9a84c";

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderLeft: `4px solid ${dc}`,
      borderRadius: 10,
      overflow: "hidden",
      flex: isParallel ? "1 1 0" : undefined,
      animation: "fadeSlideIn 0.3s ease-out both",
    }}>
      {/* Header */}
      <div style={{ padding: "11px 14px 9px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
          <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 6, background: dc + "18", color: dc, fontWeight: "bold", letterSpacing: 0.3 }}>
            {concept.difficulty}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{concept.category}</span>
        </div>
        <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", lineHeight: 1.3 }}>
          {concept.name}
        </div>
      </div>

      {/* Description + analogy — always visible */}
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.75, margin: 0 }}>
          {concept.description}
        </p>
        {concept.analogy && (
          <p style={{
            color: dc, fontFamily: "Georgia, serif", fontSize: 12,
            lineHeight: 1.65, fontStyle: "italic", margin: "9px 0 0",
            padding: "6px 10px",
            borderLeft: `3px solid ${dc}40`,
            background: dc + "09",
          }}>
            "{concept.analogy}"
          </p>
        )}
      </div>

      {/* Glance row: figures + works + event year as chips */}
      <div style={{ padding: "8px 14px", display: "flex", flexWrap: "wrap", gap: 5, borderBottom: "1px solid var(--border-subtle)" }}>
        {linkedFigures.map(f => (
          <span key={f.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#c9a84c18", color: "#c9a84c", fontFamily: "Georgia, serif" }}>
            👤 {f.name}
          </span>
        ))}
        {linkedWorks.map(w => {
          const wc = CAT[w.category]?.color ?? "#60a5fa";
          return (
            <span key={w.id} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: wc + "18", color: wc, fontFamily: "Georgia, serif" }}>
              📚 {w.title}
            </span>
          );
        })}
        {linkedEvent && (
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "#6b728018", color: "#6b7280" }}>
            🕰 {linkedEvent.year}
          </span>
        )}
        {linkedFigures.length === 0 && linkedWorks.length === 0 && !linkedEvent && (
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>Loading context…</span>
        )}
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", padding: "7px 14px", background: "none", border: "none", cursor: "pointer", textAlign: "left", display: "flex", alignItems: "center", gap: 5 }}
      >
        <span style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 0.8 }}>
          {open ? "▲ HIDE CONTEXT" : "▼ SHOW CONTEXT"}
        </span>
        {(linkedFigures.length > 0 || linkedWorks.length > 0 || linkedEvent) && !open && (
          <span style={{ fontSize: 9, color: "var(--text-muted)" }}>
            {[
              linkedFigures.length > 0 && `${linkedFigures.length} figure${linkedFigures.length > 1 ? "s" : ""}`,
              linkedWorks.length > 0 && `${linkedWorks.length} work${linkedWorks.length > 1 ? "s" : ""}`,
              linkedEvent && "1 event",
            ].filter(Boolean).join(" · ")}
          </span>
        )}
      </button>

      {/* Expanded context */}
      {open && (
        <div style={{ borderTop: "1px solid var(--border-subtle)" }}>

          {/* Figures */}
          {linkedFigures.length > 0 && (
            <div style={{ padding: "10px 14px", borderBottom: linkedWorks.length > 0 || linkedEvent ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 8 }}>DISCOVERED / DEVELOPED BY</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
                {linkedFigures.map(f => (
                  <div key={f.id} style={{ padding: "9px 11px", borderRadius: 7, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 }}>
                      <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold" }}>{f.name}</span>
                      <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{f.years}</span>
                    </div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.65, margin: 0 }}>{f.contribution}</p>
                    {f.surprising_fact && (
                      <p style={{ color: "var(--text-muted)", fontSize: 10, fontStyle: "italic", margin: "6px 0 0" }}>✦ {f.surprising_fact}</p>
                    )}
                    {f.influenced?.length > 0 && (
                      <div style={{ marginTop: 6, display: "flex", gap: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>Influenced:</span>
                        {f.influenced.slice(0, 4).map(n => (
                          <span key={n} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#c9a84c12", color: "#c9a84c" }}>{n}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Works */}
          {linkedWorks.length > 0 && (
            <div style={{ padding: "10px 14px", borderBottom: linkedEvent ? "1px solid var(--border-subtle)" : "none" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 8 }}>READ TO MASTER THIS CONCEPT</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {linkedWorks.map(w => {
                  const wc = CAT[w.category] ?? { color: "#60a5fa", bg: "#60a5fa14" };
                  return (
                    <div key={w.id} style={{ padding: "9px 11px", borderRadius: 7, background: wc.bg, border: `1px solid ${wc.color}30` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 9, color: wc.color, fontWeight: "bold" }}>{w.category}</span>
                        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>⏱ {w.reading_time}</span>
                        {w.year > 0 && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{w.year}</span>}
                      </div>
                      <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", marginBottom: 2 }}>
                        📚 {w.title}
                      </div>
                      <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6 }}>{w.authors.join(", ")}</div>
                      <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.65, margin: 0 }}>{w.why_essential}</p>
                      {w.what_you_gain && (
                        <p style={{ color: wc.color, fontSize: 10, lineHeight: 1.55, margin: "5px 0 0", fontStyle: "italic" }}>After this: {w.what_you_gain}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Timeline event */}
          {linkedEvent && (
            <div style={{ padding: "10px 14px" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 8 }}>HISTORICAL MOMENT</div>
              <div style={{ display: "flex", gap: 12, padding: "9px 11px", borderRadius: 7, background: "var(--bg-secondary)", border: "1px solid var(--border)" }}>
                <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                  <div style={{ color: EVENT_COLOR[linkedEvent.event_type] ?? "#c9a84c", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>{linkedEvent.year}</div>
                  <div style={{ fontSize: 8, color: EVENT_COLOR[linkedEvent.event_type] ?? "#c9a84c", marginTop: 2, lineHeight: 1.3 }}>{linkedEvent.event_type.replace(/_/g, " ")}</div>
                </div>
                <div>
                  <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", marginBottom: 3 }}>{linkedEvent.title}</div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.6, margin: 0 }}>{linkedEvent.description}</p>
                  {linkedEvent.significance && (
                    <p style={{ color: "var(--text-muted)", fontSize: 10, fontStyle: "italic", margin: "5px 0 0" }}>{linkedEvent.significance}</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stage block ────────────────────────────────────────────────────────────────

function StageBlock({
  stage, concepts, figures, works, events, isParallel,
}: {
  stage: CanonStage;
  concepts: CanonConcept[];
  figures: CanonFigure[];
  works: CanonWork[];
  events: CanonEvent[];
  isParallel?: boolean;
}) {
  const lc = LEVEL_COLOR[stage.level] ?? "#c9a84c";
  const stageConcepts = concepts.filter(c => stage.concept_ids?.includes(c.id));

  return (
    <div style={{ flex: isParallel ? "1 1 0" : undefined, minWidth: isParallel ? 280 : undefined }}>
      {/* Track label for parallel */}
      {isParallel && stage.track && (
        <div style={{ padding: "4px 10px", marginBottom: 8, borderRadius: 6, background: lc + "12", border: `1px solid ${lc}40`, fontSize: 10, color: lc, fontWeight: "bold", textAlign: "center", fontFamily: "Georgia, serif" }}>
          {stage.track}
        </div>
      )}

      {/* Stage header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, padding: "0 2px" }}>
        <span style={{ fontSize: 9, color: lc, fontWeight: "bold", letterSpacing: 1.2 }}>{stage.level}{stage.title ? ` · ${stage.title}` : ""}</span>
        <span style={{ fontSize: 9, color: "var(--accent)", fontFamily: "Georgia, serif" }}>⏱ {stage.duration}</span>
      </div>

      {/* Prerequisites */}
      {stage.prerequisites?.length > 0 && (
        <div style={{ marginBottom: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(0,0,0,0.2)", border: "1px solid var(--border-subtle)" }}>
          <div style={{ fontSize: 8, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 4 }}>PREREQUISITES</div>
          {stage.prerequisites.map((p, i) => (
            <div key={i} style={{ display: "flex", gap: 5, alignItems: "flex-start" }}>
              <span style={{ color: lc, fontSize: 10, lineHeight: 1.4, flexShrink: 0 }}>→</span>
              <span style={{ color: "var(--text-secondary)", fontSize: 10, lineHeight: 1.5 }}>{p}</span>
            </div>
          ))}
        </div>
      )}

      {/* Concept cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {stageConcepts.map(concept => {
          const linkedFigures = figures.filter(f => concept.figure_ids?.includes(f.id));
          const linkedWorks   = works.filter(w => concept.work_ids?.includes(w.id));
          const linkedEvent   = events.find(e => e.concept_id === concept.id) ?? null;
          return (
            <ConceptCard
              key={concept.id}
              concept={concept}
              linkedFigures={linkedFigures}
              linkedWorks={linkedWorks}
              linkedEvent={linkedEvent}
              isParallel={isParallel}
            />
          );
        })}
        {stageConcepts.length === 0 && (
          <div style={{ padding: "10px 14px", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--text-muted)", fontSize: 11 }}>
            Concepts loading…
          </div>
        )}
      </div>

      {/* Milestone */}
      {stage.milestone && (
        <div style={{ marginTop: 8, padding: "7px 10px", borderRadius: 6, background: lc + "10", border: `1px solid ${lc}25` }}>
          <span style={{ fontSize: 9, color: lc, fontWeight: "bold" }}>✓ MILESTONE </span>
          <span style={{ fontSize: 10, color: "var(--text-secondary)", lineHeight: 1.5 }}>{stage.milestone}</span>
        </div>
      )}
    </div>
  );
}

// ── Sequential arrow ───────────────────────────────────────────────────────────

function Arrow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "3px 0" }}>
      <div style={{ width: 1, height: 14, background: "var(--border)" }} />
      <div style={{ color: "var(--border)", fontSize: 13, lineHeight: 1 }}>▼</div>
    </div>
  );
}

// ── Level divider ─────────────────────────────────────────────────────────────

function LevelDivider({ level }: { level: string }) {
  const LEVEL_META: Record<string, string> = {
    FOUNDATIONS:    "Core prerequisites — everyone starts here",
    INTERMEDIATE:   "Building theoretical sophistication",
    ADVANCED:       "Deep mastery of the main apparatus",
    SPECIALIZATION: "Choose your specialist path",
    RESEARCH:       "Active frontier",
  };
  const color = LEVEL_COLOR[level] ?? "#c9a84c";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "20px 0 8px" }}>
      <div style={{ flex: 1, height: 1, background: color + "30" }} />
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 10, color, fontWeight: "bold", letterSpacing: 2 }}>{level}</div>
        {LEVEL_META[level] && <div style={{ fontSize: 9, color: "var(--text-muted)", marginTop: 1 }}>{LEVEL_META[level]}</div>}
      </div>
      <div style={{ flex: 1, height: 1, background: color + "30" }} />
    </div>
  );
}

// ── Parallel block with scroll buttons ────────────────────────────────────────

function ParallelBlock({
  tracks, concepts, figures, works, events, level, showFanout,
}: {
  tracks: { name: string | null; stages: CanonStage[] }[];
  concepts: CanonConcept[];
  figures: CanonFigure[];
  works: CanonWork[];
  events: CanonEvent[];
  level: string;
  showFanout: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);
  const lc = LEVEL_COLOR[level] ?? "#a78bfa";

  function updateScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => window.removeEventListener("resize", updateScroll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks]);

  const scroll = (dir: number) => scrollRef.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <div>
      {showFanout && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0 8px" }}>
          <div style={{ width: 1, height: 12, background: "var(--border)" }} />
          <div style={{ fontSize: 9, color: lc, letterSpacing: 0.8, padding: "2px 12px", border: `1px solid ${lc}45`, borderRadius: 8, background: lc + "10" }}>
            {tracks.length} PARALLEL TRACK{tracks.length !== 1 ? "S" : ""} — study simultaneously
          </div>
        </div>
      )}
      <div style={{ position: "relative" }}>
        {canLeft && (
          <button onClick={() => scroll(-1)} style={{ position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)", zIndex: 3, width: 32, height: 50, background: "rgba(13,17,23,0.92)", border: `1px solid ${lc}55`, borderLeft: "none", borderRadius: "0 8px 8px 0", color: lc, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `3px 0 10px rgba(0,0,0,0.4)` }}>‹</button>
        )}
        <div ref={scrollRef} onScroll={updateScroll} style={{ overflowX: "auto", paddingBottom: 4 }}>
          <div style={{ display: "flex", gap: 10, minWidth: "fit-content", padding: "2px 4px" }}>
            {tracks.map((track, ti) => (
              <div key={ti} style={{ display: "flex", flexDirection: "column", gap: 0, width: 310, flexShrink: 0 }}>
                {track.stages.map((stage, si) => (
                  <div key={stage.stage_id}>
                    {si > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0" }}>
                        <div style={{ width: 1, height: 10, background: "var(--border)" }} />
                        <div style={{ color: "var(--border)", fontSize: 10, lineHeight: 1 }}>▼</div>
                      </div>
                    )}
                    <StageBlock stage={stage} concepts={concepts} figures={figures} works={works} events={events} isParallel />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        {canRight && (
          <button onClick={() => scroll(1)} style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)", zIndex: 3, width: 32, height: 50, background: "rgba(13,17,23,0.92)", border: `1px solid ${lc}55`, borderRight: "none", borderRadius: "8px 0 0 8px", color: lc, fontSize: 20, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `-3px 0 10px rgba(0,0,0,0.4)` }}>›</button>
        )}
      </div>
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

function CanonInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [figures,  setFigures]  = useState<CanonFigure[]>([]);
  const [concepts, setConcepts] = useState<CanonConcept[]>([]);
  const [works,    setWorks]    = useState<CanonWork[]>([]);
  const [events,   setEvents]   = useState<CanonEvent[]>([]);
  const [stages,   setStages]   = useState<CanonStage[]>([]);
  const [status,   setStatus]   = useState<Status>("idle");
  const [gen,      setGen]      = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `canon-v2:${slug}`;
  const TTL = 14 * 24 * 60 * 60 * 1000;

  useEffect(() => {
    if (!slug) return;
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL && data) {
          setFigures(data.figures ?? []); setConcepts(data.concepts ?? []);
          setWorks(data.works ?? []); setEvents(data.events ?? []); setStages(data.stages ?? []);
          setStatus("done"); return;
        }
      }
    } catch { /**/ }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const { signal } = abortRef.current;
    setFigures([]); setConcepts([]); setWorks([]); setEvents([]); setStages([]);
    setStatus("streaming");

    (async () => {
      const allFigures: CanonFigure[] = [], allConcepts: CanonConcept[] = [],
            allWorks: CanonWork[] = [], allEvents: CanonEvent[] = [], allStages: CanonStage[] = [];
      try {
        const res = await fetch("/api/canon", {
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
          for (const obj of objs) {
            const o = obj as Record<string, unknown>;
            if (!o._type) continue;
            if (o._type === "figure")  { const v = o as unknown as CanonFigure;  allFigures.push(v);  setFigures(f => [...f, v]);  }
            if (o._type === "concept") { const v = o as unknown as CanonConcept; allConcepts.push(v); setConcepts(c => [...c, v]); }
            if (o._type === "work")    { const v = o as unknown as CanonWork;    allWorks.push(v);    setWorks(w => [...w, v]);    }
            if (o._type === "event")   { const v = o as unknown as CanonEvent;   allEvents.push(v);   setEvents(e => [...e, v]);   }
            if (o._type === "stage")   { const v = o as unknown as CanonStage;   allStages.push(v);   setStages(s => [...s, v]);   }
          }
        }

        localStorage.setItem(cacheKey, JSON.stringify({
          data: { figures: allFigures, concepts: allConcepts, works: allWorks, events: allEvents, stages: allStages },
          ts: Date.now(),
        }));
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
    setFigures([]); setConcepts([]); setWorks([]); setEvents([]); setStages([]);
    setStatus("idle"); setGen(g => g + 1);
  }

  const isStreaming = status === "streaming";
  const groups = groupStages(stages);
  let currentLevel = "";

  const total = figures.length + concepts.length + works.length + events.length + stages.length;

  return (
    <div style={{ minHeight: "100%", paddingBottom: 60 }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Status bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
        {total > 0 && (
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {figures.length} figures · {concepts.length} concepts · {works.length} works · {events.length} events · {stages.length} stages
            {isStreaming ? " · generating…" : " · complete"}
          </span>
        )}
        {isStreaming && total === 0 && (
          <span style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>Building your Canon…</span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          {isStreaming && (
            <button onClick={() => { abortRef.current?.abort(); setStatus("done"); }}
              style={{ padding: "5px 12px", background: "none", border: "1px solid var(--red)", borderRadius: 6, color: "var(--red)", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer" }}>
              ■ Stop
            </button>
          )}
          {status === "done" && (
            <button onClick={regenerate}
              style={{ padding: "5px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >↺ Regenerate</button>
          )}
        </div>
        {status === "error" && (
          <button onClick={regenerate} style={{ background: "none", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent)", padding: "5px 14px", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer" }}>
            Error — try again
          </button>
        )}
      </div>

      {/* Waterfall */}
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {groups.map((group, gi) => {
          const groupLevel = group.type === "seq" ? group.stage.level : group.tracks[0]?.stages[0]?.level ?? "FOUNDATIONS";
          const showDivider = groupLevel !== currentLevel;
          if (showDivider) currentLevel = groupLevel;

          if (group.type === "seq") {
            return (
              <div key={`seq-${gi}`}>
                {showDivider && <LevelDivider level={groupLevel} />}
                {gi > 0 && !showDivider && <Arrow />}
                <StageBlock stage={group.stage} concepts={concepts} figures={figures} works={works} events={events} />
              </div>
            );
          } else {
            return (
              <div key={`par-${gi}`}>
                {showDivider && <LevelDivider level={groupLevel} />}
                <ParallelBlock
                  tracks={group.tracks}
                  concepts={concepts}
                  figures={figures}
                  works={works}
                  events={events}
                  level={groupLevel}
                  showFanout={gi > 0}
                />
              </div>
            );
          }
        })}

        {/* Streaming pulse */}
        {isStreaming && stages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 8 }}>
            <div style={{ width: 1, height: 14, background: "var(--border)" }} />
            <div style={{ color: "var(--accent)", fontSize: 12, fontFamily: "Georgia, serif" }}>● generating…</div>
          </div>
        )}

        {/* Completion */}
        {status === "done" && stages.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 1, height: 18, background: "var(--border)" }} />
            <div style={{ border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 24px", color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 13 }}>
              ✓ Research Frontier
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CanonPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 300, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>
        Loading…
      </div>
    }>
      <CanonInner />
    </Suspense>
  );
}
