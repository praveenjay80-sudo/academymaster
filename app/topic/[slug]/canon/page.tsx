"use client";
import { Suspense, useEffect, useRef, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { CanonConceptNode } from "@/components/CanonConceptGraph";

const CanonConceptGraph = dynamic(() => import("@/components/CanonConceptGraph"), { ssr: false });

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
  difficulty: "BEGINNER" | "INTERMEDIATE" | "ADVANCED";
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
  event_type: "DISCOVERY" | "PUBLICATION" | "PARADIGM_SHIFT" | "APPLICATION" | "CONTROVERSY";
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

type Layer = "concepts" | "timeline" | "figures" | "reading";
type SelType = "concept" | "work" | "figure" | "event" | null;
type Status = "idle" | "streaming" | "done" | "error";

// ── Constants ──────────────────────────────────────────────────────────────────

const DIFF_COLOR: Record<string, string> = {
  FOUNDATIONAL: "#4ade80",
  INTERMEDIATE: "#c9a84c",
  ADVANCED:     "#f87171",
};

const CAT_COLOR: Record<string, { color: string; bg: string }> = {
  PEDAGOGICAL:  { color: "#60a5fa", bg: "#60a5fa18" },
  SEMINAL:      { color: "#a78bfa", bg: "#a78bfa18" },
  BREAKTHROUGH: { color: "#fb923c", bg: "#fb923c18" },
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

const LAYERS: { id: Layer; label: string }[] = [
  { id: "concepts",  label: "◈ Concepts" },
  { id: "timeline",  label: "🕰 Timeline" },
  { id: "figures",   label: "🏛 Figures" },
  { id: "reading",   label: "🗺 Reading Path" },
];

// ── NDJSON extractor ──────────────────────────────────────────────────────────

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

// ── Chip ──────────────────────────────────────────────────────────────────────

function Chip({ label, color, onClick }: { label: string; color: string; onClick?: () => void }) {
  return (
    <span
      onClick={onClick}
      style={{
        fontSize: 10, padding: "2px 8px", borderRadius: 10,
        background: color + "20", color, border: `1px solid ${color}40`,
        cursor: onClick ? "pointer" : "default",
        fontFamily: "Georgia, serif", whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

function DetailPanel({
  selType, selId,
  concepts, works, figures, events,
  topic, label,
  onSelectConcept, onSelectWork, onSelectFigure,
  onClose,
}: {
  selType: SelType; selId: string | null;
  concepts: CanonConcept[]; works: CanonWork[]; figures: CanonFigure[]; events: CanonEvent[];
  topic: string; label: string;
  onSelectConcept: (id: string) => void;
  onSelectWork: (id: string) => void;
  onSelectFigure: (id: string) => void;
  onClose: () => void;
}) {
  const [chapters, setChapters] = useState<string>("");
  const [chaptersLoading, setChaptersLoading] = useState(false);
  const [chaptersOpen, setChaptersOpen] = useState(false);
  const chapterAbort = useRef<AbortController | null>(null);

  const concept = selType === "concept" ? concepts.find(c => c.id === selId) : null;
  const work    = selType === "work"    ? works.find(w => w.id === selId)    : null;
  const figure  = selType === "figure"  ? figures.find(f => f.id === selId)  : null;
  const event   = selType === "event"   ? events.find(e => e.id === selId)   : null;

  // Reset chapters when selection changes
  useEffect(() => {
    setChapters(""); setChaptersOpen(false); setChaptersLoading(false);
    chapterAbort.current?.abort();
  }, [selId]);

  async function loadChapters(w: CanonWork) {
    if (chapters || chaptersLoading) { setChaptersOpen(true); return; }
    chapterAbort.current?.abort();
    chapterAbort.current = new AbortController();
    setChaptersLoading(true); setChaptersOpen(true);
    try {
      const res = await fetch("/api/work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label, title: w.title, authors: w.authors.join(", "), type: w.category }),
        signal: chapterAbort.current.signal,
      });
      if (!res.ok) { setChaptersLoading(false); return; }
      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let text = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += dec.decode(value);
        setChapters(text);
      }
    } catch { /**/ }
    setChaptersLoading(false);
  }

  if (!selType || !selId) return null;

  const panelStyle: React.CSSProperties = {
    width: 340, flexShrink: 0,
    background: "var(--bg-secondary)",
    borderLeft: "1px solid var(--border)",
    display: "flex", flexDirection: "column",
    overflowY: "auto", position: "relative",
  };

  const hdr = (title: string, sub?: string, badge?: { label: string; color: string }) => (
    <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div style={{ flex: 1 }}>
          {badge && (
            <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 8, background: badge.color + "20", color: badge.color, fontWeight: "bold", letterSpacing: 0.5, display: "inline-block", marginBottom: 6 }}>
              {badge.label}
            </span>
          )}
          <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold", lineHeight: 1.3 }}>{title}</div>
          {sub && <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 3 }}>{sub}</div>}
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "var(--text-muted)", fontSize: 18, cursor: "pointer", lineHeight: 1, flexShrink: 0 }}>×</button>
      </div>
    </div>
  );

  const section = (label: string, children: React.ReactNode) => (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );

  const chipRow = (items: { label: string; color: string; onClick?: () => void }[]) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {items.map(i => <Chip key={i.label} {...i} />)}
    </div>
  );

  // ── Concept panel ────────────────────────────────────────────────────
  if (concept) {
    const diffColor = DIFF_COLOR[concept.difficulty] ?? "#c9a84c";
    const linkedFigures = figures.filter(f => concept.figure_ids?.includes(f.id));
    const linkedWorks   = works.filter(w => concept.work_ids?.includes(w.id));
    const unlockedConcepts = concepts.filter(c => concept.unlocks?.includes(c.id));
    const prereqConcepts   = concepts.filter(c => concept.prerequisites?.includes(c.id));

    return (
      <div style={panelStyle}>
        {hdr(concept.name, concept.category, { label: concept.difficulty, color: diffColor })}
        {section("EXPLANATION", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.75, margin: 0 }}>{concept.description}</p>)}
        {concept.analogy && section("ANALOGY", <p style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 12, lineHeight: 1.65, fontStyle: "italic", margin: 0 }}>"{concept.analogy}"</p>)}
        {prereqConcepts.length > 0 && section("REQUIRES FIRST", chipRow(prereqConcepts.map(c => ({ label: c.name, color: DIFF_COLOR[c.difficulty], onClick: () => onSelectConcept(c.id) }))))}
        {unlockedConcepts.length > 0 && section("UNLOCKS", chipRow(unlockedConcepts.map(c => ({ label: c.name, color: DIFF_COLOR[c.difficulty], onClick: () => onSelectConcept(c.id) }))))}
        {linkedFigures.length > 0 && section("DISCOVERED BY", chipRow(linkedFigures.map(f => ({ label: f.name, color: "#c9a84c", onClick: () => onSelectFigure(f.id) }))))}
        {linkedWorks.length > 0 && section("READ IN", (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {linkedWorks.map(w => {
              const wc = CAT_COLOR[w.category] ?? CAT_COLOR.PEDAGOGICAL;
              return (
                <div key={w.id} onClick={() => onSelectWork(w.id)} style={{ cursor: "pointer", padding: "6px 8px", borderRadius: 6, background: wc.bg, border: `1px solid ${wc.color}30` }}>
                  <div style={{ color: wc.color, fontSize: 10, fontWeight: "bold", marginBottom: 2 }}>{w.category} · {w.reading_time}</div>
                  <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12 }}>📚 {w.title}</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 1 }}>{w.authors.join(", ")}</div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // ── Work panel ───────────────────────────────────────────────────────
  if (work) {
    const wc = CAT_COLOR[work.category] ?? CAT_COLOR.PEDAGOGICAL;
    const linkedConcepts = concepts.filter(c => work.concept_ids?.includes(c.id));

    return (
      <div style={panelStyle}>
        {hdr(`📚 ${work.title}`, `${work.authors.join(", ")} · ${work.year}`, { label: work.category, color: wc.color })}
        {section("DETAILS", (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Chip label={work.difficulty} color={DIFF_COLOR[work.difficulty === "BEGINNER" ? "FOUNDATIONAL" : work.difficulty] ?? "#c9a84c"} />
            <Chip label={`⏱ ${work.reading_time}`} color="#6b7280" />
          </div>
        ))}
        {section("WHY ESSENTIAL", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{work.why_essential}</p>)}
        {section("WHAT YOU GAIN", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{work.what_you_gain}</p>)}
        {work.prereqs && section("PREREQUISITES", <p style={{ color: "var(--text-muted)", fontSize: 12, lineHeight: 1.6, margin: 0 }}>{work.prereqs}</p>)}
        {linkedConcepts.length > 0 && section("CONCEPTS COVERED", chipRow(linkedConcepts.map(c => ({ label: c.name, color: DIFF_COLOR[c.difficulty], onClick: () => onSelectConcept(c.id) }))))}
        <div style={{ padding: "10px 16px" }}>
          <button
            onClick={() => loadChapters(work)}
            style={{ width: "100%", padding: "8px", background: chaptersOpen ? "var(--bg-card)" : wc.bg, border: `1px solid ${wc.color}50`, borderRadius: 6, color: wc.color, fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer" }}
          >
            {chaptersLoading ? "Loading chapters…" : chaptersOpen ? "▲ Hide chapters" : "▼ Load chapter breakdown"}
          </button>
          {chaptersOpen && chapters && (
            <div style={{ marginTop: 8, color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.7, whiteSpace: "pre-wrap" }}>
              {chapters}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Figure panel ─────────────────────────────────────────────────────
  if (figure) {
    const theirConcepts = concepts.filter(c => figure.concept_ids?.includes(c.id));
    const theirWorks    = works.filter(w => figure.work_ids?.includes(w.id));
    const influencedBy  = figures.filter(f => figure.influenced_by?.includes(f.id));
    const theyInfluenced = figures.filter(f => figure.influenced?.includes(f.id));

    return (
      <div style={panelStyle}>
        {hdr(figure.name, figure.years)}
        {section("CONTRIBUTION", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.75, margin: 0 }}>{figure.contribution}</p>)}
        {figure.surprising_fact && section("SURPRISING FACT", <p style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 12, lineHeight: 1.65, fontStyle: "italic", margin: 0 }}>"{figure.surprising_fact}"</p>)}
        {theirConcepts.length > 0 && section("THEIR CONCEPTS", chipRow(theirConcepts.map(c => ({ label: c.name, color: DIFF_COLOR[c.difficulty], onClick: () => onSelectConcept(c.id) }))))}
        {theirWorks.length > 0 && section("THEIR WORKS", chipRow(theirWorks.map(w => ({ label: w.title, color: CAT_COLOR[w.category]?.color ?? "#60a5fa", onClick: () => onSelectWork(w.id) }))))}
        {influencedBy.length > 0 && section("INFLUENCED BY", chipRow(influencedBy.map(f => ({ label: f.name, color: "#6b7280", onClick: () => onSelectFigure(f.id) }))))}
        {theyInfluenced.length > 0 && section("THEY INFLUENCED", chipRow(theyInfluenced.map(f => ({ label: f.name, color: "#c9a84c", onClick: () => onSelectFigure(f.id) }))))}
      </div>
    );
  }

  // ── Event panel ──────────────────────────────────────────────────────
  if (event) {
    const evColor = EVENT_COLOR[event.event_type] ?? "#c9a84c";
    const relFigure  = event.figure_id  ? figures.find(f => f.id === event.figure_id)  : null;
    const relConcept = event.concept_id ? concepts.find(c => c.id === event.concept_id) : null;
    const relWork    = event.work_id    ? works.find(w => w.id === event.work_id)       : null;

    return (
      <div style={panelStyle}>
        {hdr(event.title, `${event.year} · ${event.era}`, { label: event.event_type.replace("_", " "), color: evColor })}
        {section("WHAT HAPPENED", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.75, margin: 0 }}>{event.description}</p>)}
        {section("SIGNIFICANCE", <p style={{ color: "var(--text-secondary)", fontSize: 12, lineHeight: 1.7, margin: 0 }}>{event.significance}</p>)}
        {(relFigure || relConcept || relWork) && section("CONNECTED TO", (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {relFigure  && <Chip label={`👤 ${relFigure.name}`}   color="#c9a84c" onClick={() => onSelectFigure(relFigure.id)} />}
            {relConcept && <Chip label={`◈ ${relConcept.name}`}  color={DIFF_COLOR[relConcept.difficulty]} onClick={() => onSelectConcept(relConcept.id)} />}
            {relWork    && <Chip label={`📚 ${relWork.title}`}    color="#60a5fa" onClick={() => onSelectWork(relWork.id)} />}
          </div>
        ))}
      </div>
    );
  }

  return null;
}

// ── Timeline layer ────────────────────────────────────────────────────────────

function TimelineLayer({ events, selectedId, onSelect }: {
  events: CanonEvent[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const sorted = [...events].sort((a, b) => a.year - b.year);
  const eras = new Map<string, CanonEvent[]>();
  sorted.forEach(e => {
    if (!eras.has(e.era)) eras.set(e.era, []);
    eras.get(e.era)!.push(e);
  });

  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 20px" }}>
      {[...eras.entries()].map(([era, evs]) => (
        <div key={era} style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 2, marginBottom: 12, borderBottom: "1px solid var(--border-subtle)", paddingBottom: 6 }}>
            {era.toUpperCase()}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {evs.map(ev => {
              const color = EVENT_COLOR[ev.event_type] ?? "#c9a84c";
              const isSelected = ev.id === selectedId;
              return (
                <div
                  key={ev.id}
                  onClick={() => onSelect(ev.id)}
                  style={{
                    display: "flex", gap: 14, alignItems: "flex-start", cursor: "pointer",
                    padding: "10px 12px", borderRadius: 8,
                    background: isSelected ? "var(--bg-secondary)" : "var(--bg-card)",
                    border: `1px solid ${isSelected ? color : "var(--border)"}`,
                    transition: "border-color 0.15s",
                  }}
                >
                  <div style={{ flexShrink: 0, textAlign: "center" }}>
                    <div style={{ color, fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold" }}>{ev.year}</div>
                    <div style={{ fontSize: 8, color, background: color + "18", padding: "1px 5px", borderRadius: 6, marginTop: 3, whiteSpace: "nowrap" }}>
                      {ev.event_type.replace("_", " ")}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", marginBottom: 3 }}>{ev.title}</div>
                    <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.6 }}>{ev.description}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Figures layer ─────────────────────────────────────────────────────────────

function FiguresLayer({ figures, concepts, selectedId, onSelect }: {
  figures: CanonFigure[];
  concepts: CanonConcept[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
        {figures.map(fig => {
          const isSelected = fig.id === selectedId;
          const theirConcepts = concepts.filter(c => fig.concept_ids?.includes(c.id));
          return (
            <div
              key={fig.id}
              onClick={() => onSelect(fig.id)}
              style={{
                padding: "14px 16px", borderRadius: 10, cursor: "pointer",
                background: isSelected ? "var(--bg-secondary)" : "var(--bg-card)",
                border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                boxShadow: isSelected ? "0 0 12px rgba(201,168,76,0.2)" : "none",
                transition: "border-color 0.15s, box-shadow 0.15s",
              }}
            >
              <div style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", marginBottom: 2 }}>{fig.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 8 }}>{fig.years}</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.6, marginBottom: 10 }}>
                {fig.contribution.slice(0, 120)}{fig.contribution.length > 120 ? "…" : ""}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {theirConcepts.slice(0, 4).map(c => (
                  <span key={c.id} style={{ fontSize: 9, padding: "2px 7px", borderRadius: 8, background: DIFF_COLOR[c.difficulty] + "18", color: DIFF_COLOR[c.difficulty] }}>
                    {c.name}
                  </span>
                ))}
                {theirConcepts.length > 4 && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>+{theirConcepts.length - 4} more</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Reading layer ─────────────────────────────────────────────────────────────

function ReadingLayer({ stages, concepts, onSelectConcept, onSelectWork }: {
  stages: CanonStage[];
  concepts: CanonConcept[];
  onSelectConcept: (id: string) => void;
  onSelectWork: (id: string) => void;
}) {
  // Group into sequential vs. parallel blocks
  const groups: ({ type: "seq"; stage: CanonStage } | { type: "par"; stages: CanonStage[] })[] = [];
  let i = 0;
  while (i < stages.length) {
    const s = stages[i];
    if (s.layout === "sequential" || !s.parallel_group) {
      groups.push({ type: "seq", stage: s });
      i++;
    } else {
      const pg = s.parallel_group;
      const grp: CanonStage[] = [];
      while (i < stages.length && stages[i].parallel_group === pg) { grp.push(stages[i]); i++; }
      // sub-group by track
      const trackMap = new Map<string, CanonStage[]>();
      grp.forEach(st => {
        const k = st.track ?? "__";
        if (!trackMap.has(k)) trackMap.set(k, []);
        trackMap.get(k)!.push(st);
      });
      trackMap.forEach(v => v.sort((a, b) => (a.track_position ?? 0) - (b.track_position ?? 0)));
      groups.push({ type: "par", stages: [...trackMap.values()].flat() });
    }
  }

  const levelColor = (level: string) => LEVEL_COLOR[level] ?? "#c9a84c";
  const catColor = (cat: string | null) => CAT_COLOR[cat ?? ""]?.color ?? "var(--accent)";

  function StageCard({ stage }: { stage: CanonStage }) {
    const lc = levelColor(stage.level);
    const wc = catColor(stage.work_category);
    const stageConcepts = concepts.filter(c => stage.concept_ids?.includes(c.id));

    return (
      <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderLeft: `4px solid ${lc}`, borderRadius: 8, padding: "10px 12px", flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 9, color: lc, fontWeight: "bold", letterSpacing: 0.5 }}>{stage.level}</span>
          <span style={{ fontSize: 9, color: "var(--accent)" }}>⏱ {stage.duration}</span>
        </div>
        <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", marginBottom: 7 }}>{stage.title}</div>
        {stage.prerequisites?.length > 0 && (
          <div style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 8, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1, marginBottom: 3 }}>REQUIRES</div>
            {stage.prerequisites.map((p, i) => (
              <div key={i} style={{ fontSize: 10, color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: 4 }}>
                <span style={{ color: lc }}>→</span>{p}
              </div>
            ))}
          </div>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: stageConcepts.length ? 7 : 0 }}>
          {stageConcepts.map(c => (
            <span key={c.id} onClick={() => onSelectConcept(c.id)} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 8, background: DIFF_COLOR[c.difficulty] + "18", color: DIFF_COLOR[c.difficulty], cursor: "pointer", fontFamily: "Georgia, serif" }}>
              {c.name}
            </span>
          ))}
        </div>
        {stage.work_id && (
          <div onClick={() => onSelectWork(stage.work_id!)} style={{ cursor: "pointer", padding: "5px 8px", borderRadius: 6, background: wc + "18", border: `1px solid ${wc}30`, marginTop: 4 }}>
            <div style={{ fontSize: 9, color: wc, fontWeight: "bold", marginBottom: 2 }}>{stage.work_category} · read now</div>
            <div style={{ fontSize: 11, color: "var(--text-primary)", fontFamily: "Georgia, serif" }}>📚 {stage.work_title}</div>
            {stage.work_authors?.length > 0 && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{stage.work_authors.join(", ")}</div>}
          </div>
        )}
        {stage.milestone && (
          <div style={{ marginTop: 7, fontSize: 10, color: "var(--text-muted)", background: "var(--bg-secondary)", padding: "5px 8px", borderRadius: 5 }}>
            <span style={{ color: lc, fontWeight: "bold" }}>✓ </span>{stage.milestone}
          </div>
        )}
      </div>
    );
  }

  let prevLevel = "";
  return (
    <div style={{ overflowY: "auto", height: "100%", padding: "16px 20px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {groups.map((g, gi) => {
          const level = g.type === "seq" ? g.stage.level : g.stages[0]?.level ?? "FOUNDATIONS";
          const lc = levelColor(level);
          const showDivider = level !== prevLevel;
          if (showDivider) prevLevel = level;

          return (
            <div key={gi}>
              {showDivider && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "16px 0 8px" }}>
                  <div style={{ flex: 1, height: 1, background: lc + "30" }} />
                  <span style={{ fontSize: 9, color: lc, fontWeight: "bold", letterSpacing: 2 }}>{level}</span>
                  <div style={{ flex: 1, height: 1, background: lc + "30" }} />
                </div>
              )}
              {gi > 0 && !showDivider && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "2px 0" }}>
                  <div style={{ width: 1, height: 12, background: "var(--border)" }} />
                  <div style={{ color: "var(--border)", fontSize: 11 }}>▼</div>
                </div>
              )}
              {g.type === "seq" ? (
                <StageCard stage={g.stage} />
              ) : (
                <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
                  {g.stages.map(st => <StageCard key={st.stage_id} stage={st} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

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
  const [layer,    setLayer]    = useState<Layer>("concepts");
  const [selType,  setSelType]  = useState<SelType>(null);
  const [selId,    setSelId]    = useState<string | null>(null);
  const [status,   setStatus]   = useState<Status>("idle");
  const [gen,      setGen]      = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const cacheKey = `canon-v1:${slug}`;
  const TTL = 14 * 24 * 60 * 60 * 1000;

  const select = useCallback((type: SelType, id: string) => { setSelType(type); setSelId(id); }, []);
  const onSelectConcept = useCallback((id: string) => { select("concept", id); setLayer("concepts"); }, [select]);
  const onSelectWork    = useCallback((id: string) => select("work", id),    [select]);
  const onSelectFigure  = useCallback((id: string) => { select("figure", id); setLayer("figures"); }, [select]);
  const onSelectEvent   = useCallback((id: string) => select("event", id),   [select]);
  const clearSel        = useCallback(() => { setSelType(null); setSelId(null); }, []);

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
    setStatus("idle"); setSelType(null); setSelId(null);
    setGen(g => g + 1);
  }

  const isStreaming = status === "streaming";
  const total = figures.length + concepts.length + works.length + events.length + stages.length;

  // Build concept graph nodes
  const graphConcepts: CanonConceptNode[] = concepts.map(c => ({
    ...c, isSelected: c.id === selId && selType === "concept", onClick: () => onSelectConcept(c.id),
  }));

  const hasPanel = selType !== null && selId !== null;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)" }}>
      {/* Layer switcher + status */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
        {LAYERS.map(l => (
          <button
            key={l.id}
            onClick={() => setLayer(l.id)}
            style={{
              padding: "10px 18px", background: "none", border: "none",
              borderBottom: `2px solid ${layer === l.id ? "var(--accent)" : "transparent"}`,
              color: layer === l.id ? "var(--accent)" : "var(--text-muted)",
              fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer",
              transition: "color 0.15s", whiteSpace: "nowrap",
            }}
          >{l.label}</button>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 11, color: "var(--text-muted)", paddingRight: 12 }}>
          {total > 0 && `${figures.length} figures · ${concepts.length} concepts · ${works.length} works · ${events.length} events`}
          {isStreaming ? " · generating…" : ""}
        </div>
        {status === "done" && (
          <button onClick={regenerate} style={{ marginRight: 12, padding: "5px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
          >↺ Regenerate</button>
        )}
      </div>

      {/* Canvas + Detail panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Layer canvas */}
        <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
          {status === "streaming" && total === 0 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 15 }}>
              Building your Canon…
            </div>
          )}
          {status === "error" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12 }}>
              <div style={{ color: "var(--red)", fontFamily: "Georgia, serif" }}>Something went wrong.</div>
              <button onClick={regenerate} style={{ background: "none", border: "1px solid var(--accent)", borderRadius: 6, color: "var(--accent)", padding: "6px 16px", fontFamily: "Georgia, serif", cursor: "pointer" }}>Try again</button>
            </div>
          )}

          {layer === "concepts" && concepts.length > 0 && (
            <CanonConceptGraph
              concepts={graphConcepts}
              selectedId={selType === "concept" ? selId : null}
              onSelect={onSelectConcept}
            />
          )}

          {layer === "timeline" && (
            <TimelineLayer events={events} selectedId={selType === "event" ? selId : null} onSelect={onSelectEvent} />
          )}

          {layer === "figures" && (
            <FiguresLayer figures={figures} concepts={concepts} selectedId={selType === "figure" ? selId : null} onSelect={onSelectFigure} />
          )}

          {layer === "reading" && (
            <ReadingLayer stages={stages} concepts={concepts} onSelectConcept={onSelectConcept} onSelectWork={onSelectWork} />
          )}
        </div>

        {/* Detail panel */}
        {hasPanel && (
          <DetailPanel
            selType={selType} selId={selId}
            concepts={concepts} works={works} figures={figures} events={events}
            topic={slug} label={label}
            onSelectConcept={onSelectConcept} onSelectWork={onSelectWork} onSelectFigure={onSelectFigure}
            onClose={clearSel}
          />
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
