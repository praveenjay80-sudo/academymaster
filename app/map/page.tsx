"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

// ── Types ──────────────────────────────────────────────────────────────────────

type Level = "FOUNDATIONS" | "INTERMEDIATE" | "ADVANCED" | "SPECIALIZATION" | "RESEARCH";

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
  level?: Level;
  layout: "sequential" | "parallel";
  parallel_group: string | null;
  track?: string | null;
  track_position?: number | null;
  concepts: StageConcept[];
  work: StageWork | null;
  duration: string;
  milestone?: string;
}

interface TrackGroup {
  name: string | null;
  stages: LearningStage[];
}

type RenderGroup =
  | { type: "sequential"; stage: LearningStage }
  | { type: "parallel"; tracks: TrackGroup[]; parallel_group: string; level: Level };

type Status = "idle" | "streaming" | "done" | "error";

// ── Constants ──────────────────────────────────────────────────────────────────

const CAT: Record<string, { color: string; label: string; bg: string }> = {
  PEDAGOGICAL:  { color: "#60a5fa", label: "Pedagogical",  bg: "#60a5fa18" },
  SEMINAL:      { color: "#a78bfa", label: "Seminal",      bg: "#a78bfa18" },
  BREAKTHROUGH: { color: "#fb923c", label: "Breakthrough",  bg: "#fb923c18" },
};

const LEVEL_META: Record<string, { color: string; desc: string }> = {
  FOUNDATIONS:    { color: "#4ade80", desc: "Core prerequisites — everyone starts here" },
  INTERMEDIATE:   { color: "#60a5fa", desc: "Building theoretical sophistication" },
  ADVANCED:       { color: "#c9a84c", desc: "Deep mastery of the main apparatus" },
  SPECIALIZATION: { color: "#a78bfa", desc: "Specialist tracks — choose your path" },
  RESEARCH:       { color: "#fb923c", desc: "Active frontier" },
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
            i = j + 1;
            break;
          }
        }
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
      const pgId = s.parallel_group;
      const pgStages: LearningStage[] = [];
      let j = i;
      while (j < stages.length && stages[j].parallel_group === pgId) {
        pgStages.push(stages[j]);
        j++;
      }
      // Sub-group by track name
      const trackMap = new Map<string, LearningStage[]>();
      for (const ps of pgStages) {
        const key = ps.track ?? "__default__";
        if (!trackMap.has(key)) trackMap.set(key, []);
        trackMap.get(key)!.push(ps);
      }
      // Sort each track by track_position, preserve insertion order across tracks
      const tracks: TrackGroup[] = [];
      for (const [name, tstages] of trackMap) {
        tstages.sort((a, b) => (a.track_position ?? 1) - (b.track_position ?? 1));
        tracks.push({ name: name === "__default__" ? null : name, stages: tstages });
      }
      const level: Level = (s.level ?? "ADVANCED") as Level;
      groups.push({ type: "parallel", tracks, parallel_group: pgId, level });
      i = j;
    }
  }
  return groups;
}

// ── Level divider ─────────────────────────────────────────────────────────────

function LevelDivider({ level }: { level: string }) {
  const meta = LEVEL_META[level] ?? { color: "#6b7280", desc: "" };
  return (
    <div style={{ maxWidth: 720, margin: "28px auto 6px", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, height: 1, background: meta.color + "35" }} />
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
        <span style={{ fontSize: 10, color: meta.color, letterSpacing: 2, fontWeight: "bold" }}>{level}</span>
        {meta.desc && (
          <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 0.5 }}>{meta.desc}</span>
        )}
      </div>
      <div style={{ flex: 1, height: 1, background: meta.color + "35" }} />
    </div>
  );
}

// ── Stage card ─────────────────────────────────────────────────────────────────

function StageCard({
  stage,
  stepLabel,
  isParallel,
}: {
  stage: LearningStage;
  stepLabel: string;
  isParallel?: boolean;
}) {
  const [conceptsOpen, setConceptsOpen] = useState(false);
  const [workOpen, setWorkOpen] = useState(false);
  const cat = stage.work ? CAT[stage.work.category] : null;
  const accentColor = cat?.color ?? "var(--accent)";

  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: `4px solid ${accentColor}`,
        borderRadius: 10,
        overflow: "hidden",
        animation: "fadeSlideIn 0.35s ease-out both",
      }}
    >
      {/* Header */}
      <div style={{ padding: "11px 14px 9px", borderBottom: "1px solid var(--border-subtle)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ color: accentColor, fontFamily: "Georgia, serif", fontSize: 11, fontWeight: "bold", letterSpacing: 0.5 }}>
              {stepLabel}
            </span>
            {isParallel && (
              <span style={{ fontSize: 9, color: "var(--text-muted)", background: "var(--bg-secondary)", border: "1px solid var(--border)", borderRadius: 10, padding: "1px 6px" }}>
                parallel
              </span>
            )}
          </div>
          <span style={{ color: "var(--accent)", fontSize: 11, fontFamily: "Georgia, serif", fontWeight: "bold" }}>
            ⏱ {stage.duration}
          </span>
        </div>
      </div>

      {/* Concepts */}
      <div style={{ padding: "9px 14px", borderBottom: "1px solid var(--border-subtle)" }}>
        <button
          onClick={() => setConceptsOpen(o => !o)}
          style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: conceptsOpen ? 7 : 0 }}>
            <span style={{ color: "var(--text-muted)", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>CONCEPTS</span>
            <span style={{ color: "var(--text-muted)", fontSize: 9 }}>{stage.concepts.length}</span>
            <span style={{ color: "var(--text-muted)", fontSize: 9, marginLeft: "auto" }}>{conceptsOpen ? "▲" : "▼"}</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {stage.concepts.map(c => (
              <span
                key={c.name}
                style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: accentColor + "18", color: accentColor, fontFamily: "Georgia, serif" }}
              >
                {c.name}
              </span>
            ))}
          </div>
        </button>
        {conceptsOpen && (
          <div style={{ marginTop: 9, display: "flex", flexDirection: "column", gap: 7 }}>
            {stage.concepts.map(c => (
              <div key={c.name}>
                <div style={{ color: "var(--text-primary)", fontSize: 11, fontWeight: "bold", fontFamily: "Georgia, serif", marginBottom: 2 }}>{c.name}</div>
                <div style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.6 }}>{c.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Work */}
      {stage.work ? (
        <div style={{ padding: "9px 14px", borderBottom: stage.milestone ? "1px solid var(--border-subtle)" : "none" }}>
          <button
            onClick={() => setWorkOpen(o => !o)}
            style={{ width: "100%", background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, padding: "2px 7px", borderRadius: 10, background: cat!.bg, color: cat!.color, fontWeight: "bold" }}>
                {cat!.label}
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 9 }}>{stage.work.reading_time}</span>
              <span style={{ color: "var(--text-muted)", fontSize: 9, marginLeft: "auto" }}>{workOpen ? "▲" : "▼"}</span>
            </div>
            <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", lineHeight: 1.3 }}>
              📚 {stage.work.title}
            </div>
            {stage.work.authors && stage.work.authors.length > 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 10, marginTop: 2 }}>
                {stage.work.authors.join(", ")}
              </div>
            )}
          </button>
          {workOpen && stage.work.why && (
            <div style={{ marginTop: 7, color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.65, paddingTop: 7, borderTop: "1px solid var(--border-subtle)" }}>
              {stage.work.why}
            </div>
          )}
        </div>
      ) : (
        <div style={{ padding: "7px 14px", borderBottom: stage.milestone ? "1px solid var(--border-subtle)" : "none" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>Work through concepts independently</span>
        </div>
      )}

      {/* Milestone */}
      {stage.milestone && (
        <div style={{ padding: "7px 14px", background: "var(--bg-secondary)" }}>
          <span style={{ color: "var(--text-muted)", fontSize: 9, fontWeight: "bold", letterSpacing: 1 }}>MILESTONE </span>
          <span style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.5 }}>{stage.milestone}</span>
        </div>
      )}
    </div>
  );
}

// ── Mini arrow (within track) ─────────────────────────────────────────────────

function MiniArrow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "1px 0" }}>
      <div style={{ width: 1, height: 10, background: "var(--border)" }} />
      <div style={{ color: "var(--border)", fontSize: 10, lineHeight: 1 }}>▼</div>
    </div>
  );
}

// ── Track column ──────────────────────────────────────────────────────────────

function TrackColumn({ track, levelColor }: { track: TrackGroup; levelColor: string }) {
  return (
    <div style={{ flex: "0 0 270px", display: "flex", flexDirection: "column" }}>
      {track.name && (
        <div style={{
          padding: "5px 10px",
          marginBottom: 7,
          borderRadius: 6,
          background: levelColor + "12",
          border: `1px solid ${levelColor}40`,
          fontSize: 10,
          color: levelColor,
          fontWeight: "bold",
          letterSpacing: 0.5,
          textAlign: "center",
          fontFamily: "Georgia, serif",
        }}>
          {track.name}
        </div>
      )}
      {track.stages.map((stage, i) => (
        <div key={stage.stage}>
          {i > 0 && <MiniArrow />}
          <StageCard
            stage={stage}
            stepLabel={`STAGE ${i + 1}`}
            isParallel
          />
        </div>
      ))}
    </div>
  );
}

// ── Sequential arrow ──────────────────────────────────────────────────────────

function Arrow() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "2px auto", maxWidth: 720 }}>
      <div style={{ width: 1, height: 14, background: "var(--border)" }} />
      <div style={{ color: "var(--border)", fontSize: 13, lineHeight: 1 }}>▼</div>
    </div>
  );
}

// ── Waterfall renderer ─────────────────────────────────────────────────────────

function Waterfall({ groups, streaming }: { groups: RenderGroup[]; streaming: boolean }) {
  let stepCounter = 0;
  let currentLevel = "";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {groups.map((group, gi) => {
        const groupLevel = group.type === "sequential"
          ? (group.stage.level ?? "FOUNDATIONS")
          : group.level;

        const showDivider = groupLevel !== currentLevel;
        if (showDivider) currentLevel = groupLevel;

        if (group.type === "sequential") {
          stepCounter++;
          const idx = stepCounter;
          return (
            <div key={`seq-${gi}`}>
              {showDivider && <LevelDivider level={groupLevel} />}
              <div style={{ maxWidth: 720, margin: "0 auto" }}>
                {gi > 0 && !showDivider && <Arrow />}
                <StageCard stage={group.stage} stepLabel={`STEP ${idx}`} />
              </div>
            </div>
          );
        } else {
          const meta = LEVEL_META[group.level] ?? { color: "#a78bfa", desc: "" };
          const totalTracks = group.tracks.length;

          return (
            <div key={`par-${gi}`}>
              {showDivider && <LevelDivider level={groupLevel} />}

              {/* Fan-out label */}
              {gi > 0 && (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", margin: "4px 0 8px" }}>
                  <div style={{ width: 1, height: 12, background: "var(--border)" }} />
                  <div style={{
                    fontSize: 9, color: meta.color, letterSpacing: 0.8,
                    padding: "2px 12px",
                    border: `1px solid ${meta.color}45`,
                    borderRadius: 8,
                    background: meta.color + "10",
                  }}>
                    {totalTracks} PARALLEL TRACK{totalTracks !== 1 ? "S" : ""} — study simultaneously
                  </div>
                </div>
              )}

              {/* Horizontal scroll track grid */}
              <div style={{ overflowX: "auto", paddingBottom: 8 }}>
                <div style={{ display: "flex", gap: 10, minWidth: "fit-content", paddingLeft: 2 }}>
                  {group.tracks.map((track, ti) => (
                    <TrackColumn key={ti} track={track} levelColor={meta.color} />
                  ))}
                </div>
              </div>
            </div>
          );
        }
      })}

      {/* Streaming pulse */}
      {streaming && (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: 6 }}>
          <div style={{ width: 1, height: 14, background: "var(--border)" }} />
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
  const cacheKey = `learning-flow-v2:${slug}`;
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

  // Level summary for header
  const levelSet = new Set(stages.map(s => s.level).filter(Boolean));
  const trackCount = stages.filter(s => s.layout === "parallel" && s.track).reduce((acc, s) => {
    acc.add(s.track!);
    return acc;
  }, new Set<string>()).size;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{
        background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)",
        padding: "12px 24px", display: "flex", gap: 12, alignItems: "center",
        flexWrap: "wrap", position: "sticky", top: 0, zIndex: 10,
      }}>
        <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>← Home</a>
        <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 18, fontWeight: "bold", flexShrink: 0 }}>◈ Learning Map</span>

        {slug && (
          <span style={{ color: "var(--text-secondary)", fontFamily: "Georgia, serif", fontSize: 15, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        )}

        <form onSubmit={navigate} style={{ display: "flex", gap: 6 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="New topic…"
            style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 12px", fontFamily: "Georgia, serif", fontSize: 13, outline: "none", width: 200 }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button type="submit" disabled={!query.trim()} style={{ background: query.trim() ? "var(--accent)" : "var(--bg-card)", color: query.trim() ? "#0d1117" : "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", cursor: query.trim() ? "pointer" : "default", flexShrink: 0 }}>
            Go →
          </button>
        </form>

        {slug && (
          isStreaming ? (
            <button onClick={stop} style={{ background: "none", color: "var(--red)", border: "1px solid var(--red)", borderRadius: 8, padding: "6px 12px", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer", flexShrink: 0 }}>■ Stop</button>
          ) : (
            <button onClick={regenerate} style={{ background: "none", color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 12px", fontFamily: "Georgia, serif", fontSize: 12, cursor: "pointer", flexShrink: 0 }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
            >↺ Regenerate</button>
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
          <div style={{ fontSize: 48 }}>◈</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 24, margin: 0 }}>Learning Map</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 520, lineHeight: 1.8, margin: 0, fontSize: 14 }}>
            Enter any subject and get a complete mastery map — from foundations to the research frontier. Sequential stages build on each other; parallel tracks show how the field genuinely branches into specializations.
          </p>
          <form onSubmit={navigate} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="e.g. Number Theory, Quantum Field Theory, Game Theory…"
              style={{ background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: 8, padding: "12px 18px", fontFamily: "Georgia, serif", fontSize: 14, width: 380, outline: "none" }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
              autoFocus
            />
            <button type="submit" disabled={!query.trim()} style={{ background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 8, padding: "12px 24px", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>
              Generate →
            </button>
          </form>

          {/* Level legend */}
          <div style={{ display: "flex", gap: 20, marginTop: 12, flexWrap: "wrap", justifyContent: "center" }}>
            {Object.entries(LEVEL_META).map(([level, { color }]) => (
              <div key={level} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{level.charAt(0) + level.slice(1).toLowerCase()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Waterfall ──────────────────────────────────────────────────── */}
      {slug && (
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 24px 48px" }}>

          {/* Status row */}
          {stages.length > 0 && (
            <div style={{ maxWidth: 720, margin: "0 auto 20px", display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {stages.length} stage{stages.length !== 1 ? "s" : ""}
                {trackCount > 0 && ` · ${trackCount} specialization track${trackCount !== 1 ? "s" : ""}`}
                {isStreaming ? " · generating…" : " · complete"}
              </span>
              <div style={{ display: "flex", gap: 14, marginLeft: "auto", flexWrap: "wrap" }}>
                {Object.entries(LEVEL_META)
                  .filter(([level]) => levelSet.has(level as Level))
                  .map(([level, { color }]) => (
                    <div key={level} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{level.charAt(0) + level.slice(1).toLowerCase()}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {status === "streaming" && stages.length === 0 && (
            <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", paddingTop: 80 }}>
              Building your learning map…
            </div>
          )}

          {status === "error" && (
            <div style={{ color: "var(--red)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", paddingTop: 40 }}>
              Something went wrong.{" "}
              <button onClick={regenerate} style={{ background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontFamily: "Georgia, serif", fontSize: 14 }}>
                Try again →
              </button>
            </div>
          )}

          <Waterfall groups={groups} streaming={isStreaming} />

          {/* Completion marker */}
          {status === "done" && stages.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginTop: 10 }}>
              <div style={{ width: 1, height: 20, background: "var(--border)" }} />
              <div style={{ border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 24px", color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 13 }}>
                ✓ Research Frontier
              </div>
            </div>
          )}
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
