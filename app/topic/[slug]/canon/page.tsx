"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type {
  KSConcept, KSNodeData, KSLevel,
  KnowledgeSpaceGraphHandle,
} from "@/components/KnowledgeSpaceGraph";
import { LEVEL_COLOR, buildLayout } from "@/components/KnowledgeSpaceGraph";
import type { Node, Edge } from "@xyflow/react";

// ReactFlow must be client-only (no SSR)
const KnowledgeSpaceGraph = dynamic(
  () => import("@/components/KnowledgeSpaceGraph"),
  { ssr: false }
);

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

// ── Types ──────────────────────────────────────────────────────────────────────

type StreamStatus = "idle" | "streaming" | "done" | "error";

const CAT_COLOR: Record<string, string> = {
  PEDAGOGICAL:  "#60a5fa",
  SEMINAL:      "#a78bfa",
  BREAKTHROUGH: "#fb923c",
};

// ── Detail Panel ──────────────────────────────────────────────────────────────

function ConceptDetailPanel({
  concept,
  onClose,
  onNavigate,
  allConcepts,
}: {
  concept: KSConcept;
  onClose: () => void;
  onNavigate: (id: string) => void;
  allConcepts: KSConcept[];
}) {
  const lc = LEVEL_COLOR[concept.level] ?? "#c9a84c";
  const knownIds = new Set(allConcepts.map(c => c.id));

  function NavChip({ id, label }: { id: string; label?: string }) {
    const target = allConcepts.find(c => c.id === id);
    const known = knownIds.has(id);
    const tc = target ? LEVEL_COLOR[target.level] : "#6b7280";
    return (
      <button
        onClick={() => known && onNavigate(id)}
        style={{
          padding: "3px 10px", borderRadius: 10, fontSize: 10,
          border: `1px solid ${known ? tc + "60" : "#2d3748"}`,
          background: known ? tc + "12" : "transparent",
          color: known ? tc : "#4b5563",
          cursor: known ? "pointer" : "default",
          fontFamily: "Georgia, serif",
          transition: "border-color 0.15s",
        }}
      >
        {label ?? (target?.name ?? id)}
      </button>
    );
  }

  return (
    <div style={{
      position: "fixed",
      right: 0,
      top: 56,
      width: 380,
      height: "calc(100vh - 56px)",
      overflowY: "auto",
      background: "var(--bg-secondary)",
      borderLeft: "1px solid var(--border)",
      zIndex: 40,
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: lc + "18", color: lc, fontWeight: "bold", letterSpacing: 0.5 }}>
                {concept.level}
              </span>
              <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{concept.category}</span>
            </div>
            <h2 style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 18, fontWeight: "bold", lineHeight: 1.2, margin: 0 }}>
              {concept.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{ flexShrink: 0, width: 28, height: 28, borderRadius: 6, background: "none", border: "1px solid var(--border)", color: "var(--text-muted)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
          >×</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>

        {/* Description */}
        <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.8, margin: "0 0 12px" }}>
          {concept.description}
        </p>

        {/* Analogy */}
        {concept.analogy && (
          <div style={{ margin: "0 0 12px", padding: "9px 12px", borderLeft: `3px solid ${lc}50`, background: lc + "09", borderRadius: "0 6px 6px 0" }}>
            <p style={{ color: lc, fontSize: 12, lineHeight: 1.65, fontStyle: "italic", margin: 0, fontFamily: "Georgia, serif" }}>
              "{concept.analogy}"
            </p>
          </div>
        )}

        {/* Milestone */}
        {concept.milestone && (
          <div style={{ margin: "0 0 16px", padding: "7px 12px", borderRadius: 6, background: lc + "10", border: `1px solid ${lc}25` }}>
            <span style={{ fontSize: 9, color: lc, fontWeight: "bold" }}>✓ MILESTONE  </span>
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{concept.milestone}</span>
          </div>
        )}

        {/* Figures */}
        {concept.figures?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1.2, marginBottom: 8 }}>
              DISCOVERED / DEVELOPED BY
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {concept.figures.map((f, i) => (
                <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)" }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 5 }}>
                    <span style={{ color: "#c9a84c", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold" }}>{f.name}</span>
                    <span style={{ color: "var(--text-muted)", fontSize: 10 }}>{f.years}</span>
                  </div>
                  <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.7, margin: "0 0 5px" }}>{f.contribution}</p>
                  {f.surprising_fact && (
                    <p style={{ color: "var(--text-muted)", fontSize: 10, fontStyle: "italic", margin: 0 }}>✦ {f.surprising_fact}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Works */}
        {concept.works?.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1.2, marginBottom: 8 }}>
              READ TO MASTER THIS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {concept.works.map((w, i) => {
                const wc = CAT_COLOR[w.category] ?? "#60a5fa";
                return (
                  <div key={i} style={{ padding: "10px 12px", borderRadius: 8, background: wc + "0c", border: `1px solid ${wc}30` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 9, color: wc, fontWeight: "bold" }}>{w.category}</span>
                      <span style={{ fontSize: 9, color: "var(--text-muted)" }}>⏱ {w.reading_time}</span>
                      {w.year > 0 && <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{w.year}</span>}
                    </div>
                    <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold", marginBottom: 2 }}>
                      📚 {w.title}
                    </div>
                    <div style={{ color: "var(--text-muted)", fontSize: 10, marginBottom: 6 }}>{w.authors.join(", ")}</div>
                    <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.65, margin: "0 0 4px" }}>{w.why_essential}</p>
                    {w.what_you_gain && (
                      <p style={{ color: wc, fontSize: 10, lineHeight: 1.55, margin: 0, fontStyle: "italic" }}>After this: {w.what_you_gain}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Historical Moment */}
        {concept.historical_moment && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1.2, marginBottom: 8 }}>
              HISTORICAL MOMENT
            </div>
            <div style={{ padding: "10px 12px", borderRadius: 8, background: "var(--bg-card)", border: "1px solid var(--border)", display: "flex", gap: 12 }}>
              <div style={{ flexShrink: 0, textAlign: "center", minWidth: 44 }}>
                <div style={{ color: lc, fontFamily: "Georgia, serif", fontSize: 15, fontWeight: "bold" }}>{concept.historical_moment.year}</div>
              </div>
              <div>
                <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 12, fontWeight: "bold", marginBottom: 3 }}>
                  {concept.historical_moment.title}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 11, lineHeight: 1.65, margin: "0 0 4px" }}>
                  {concept.historical_moment.description}
                </p>
                {concept.historical_moment.significance && (
                  <p style={{ color: "var(--text-muted)", fontSize: 10, fontStyle: "italic", margin: 0 }}>
                    {concept.historical_moment.significance}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Prerequisites */}
        {concept.prerequisites?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1.2, marginBottom: 6 }}>
              REQUIRES
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {concept.prerequisites.map(id => <NavChip key={id} id={id} />)}
            </div>
          </div>
        )}

        {/* Unlocks */}
        {concept.unlocks?.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: "bold", letterSpacing: 1.2, marginBottom: 6 }}>
              UNLOCKS
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {concept.unlocks.map(id => <NavChip key={id} id={id} />)}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Level legend ───────────────────────────────────────────────────────────────

const LEVELS: KSLevel[] = ["FOUNDATIONAL", "INTERMEDIATE", "ADVANCED", "SPECIALIZATION", "RESEARCH"];

function LevelLegend() {
  return (
    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
      {LEVELS.map(lvl => (
        <div key={lvl} style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: LEVEL_COLOR[lvl] }} />
          <span style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: 0.3 }}>{lvl}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────

function CanonInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") ?? slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [concepts,   setConcepts]   = useState<KSConcept[]>([]);
  const [status,     setStatus]     = useState<StreamStatus>("idle");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [gen,        setGen]        = useState(0);
  const [layoutKey,  setLayoutKey]  = useState(0);

  const abortRef     = useRef<AbortController | null>(null);
  const conceptsRef  = useRef<KSConcept[]>([]);
  const layoutTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const graphRef     = useRef<KnowledgeSpaceGraphHandle>(null);

  const cacheKey = `knowledge-space-v1:${slug}`;
  const TTL = 14 * 24 * 60 * 60 * 1000;

  function scheduleRelayout() {
    if (layoutTimer.current) clearTimeout(layoutTimer.current);
    layoutTimer.current = setTimeout(() => setLayoutKey(k => k + 1), 300);
  }

  useEffect(() => {
    if (!slug) return;

    // Cache check
    try {
      const raw = localStorage.getItem(cacheKey);
      if (raw) {
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts < TTL && Array.isArray(data) && data.length > 0) {
          conceptsRef.current = data;
          setConcepts(data);
          setStatus("done");
          setLayoutKey(k => k + 1);
          return;
        }
      }
    } catch { /**/ }

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    conceptsRef.current = [];
    setConcepts([]);
    setSelectedId(null);
    setStatus("streaming");

    (async () => {
      try {
        const res = await fetch("/api/canon", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topic: label }),
          signal: abortRef.current!.signal,
        });
        if (!res.ok) { setStatus("error"); return; }

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const [objs, rem] = extractObjects(buf);
          buf = rem;

          for (const obj of objs) {
            const o = obj as Record<string, unknown>;
            if (o._type !== "concept") continue;
            const v = o as unknown as KSConcept;
            conceptsRef.current = [...conceptsRef.current, v];
            setConcepts([...conceptsRef.current]);
            scheduleRelayout();
          }
        }

        localStorage.setItem(cacheKey, JSON.stringify({ data: conceptsRef.current, ts: Date.now() }));
        setStatus("done");
        setLayoutKey(k => k + 1);
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
    conceptsRef.current = [];
    setConcepts([]);
    setSelectedId(null);
    setStatus("idle");
    setGen(g => g + 1);
  }

  function handleSelect(id: string) {
    setSelectedId(prev => prev === id ? null : id);
    // Pan graph to the selected node
    setTimeout(() => graphRef.current?.focusNode(id), 50);
  }

  function handleNavigate(id: string) {
    setSelectedId(id);
    setTimeout(() => graphRef.current?.focusNode(id), 50);
  }

  const selectedConcept = concepts.find(c => c.id === selectedId) ?? null;
  const isStreaming = status === "streaming";

  // Build layout for the graph
  const { nodes, edges } = concepts.length > 0
    ? buildLayout(concepts)
    : { nodes: [] as Node<KSNodeData>[], edges: [] as Edge[] };

  // Apply isSelected to nodes
  const nodesWithSelection = nodes.map(n => ({
    ...n,
    data: { ...n.data, isSelected: n.id === selectedId },
  }));

  return (
    <div style={{ margin: "-2rem -1rem", height: "calc(100vh - 56px)", display: "flex", flexDirection: "column", background: "#0d1117" }}>

      {/* Status bar */}
      <div style={{ height: 36, flexShrink: 0, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", borderBottom: "1px solid #1e2a3a", background: "rgba(13,17,23,0.95)" }}>
        {/* Left: count + legend */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 11, color: "#4b5563" }}>
            {concepts.length > 0
              ? `◉ ${concepts.length} concept${concepts.length !== 1 ? "s" : ""}${isStreaming ? " · mapping…" : " · complete"}`
              : isStreaming ? "◉ mapping field…" : "◉ Knowledge Space"}
          </span>
          {concepts.length > 0 && <LevelLegend />}
        </div>

        {/* Right: controls */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          {isStreaming && (
            <button onClick={() => { abortRef.current?.abort(); setStatus("done"); }}
              style={{ padding: "3px 10px", background: "none", border: "1px solid #f871711a", borderRadius: 5, color: "#f87171", fontSize: 10, cursor: "pointer" }}>
              ■ Stop
            </button>
          )}
          {status === "done" && (
            <button onClick={regenerate}
              style={{ padding: "3px 10px", background: "none", border: "1px solid #2d3748", borderRadius: 5, color: "#4b5563", fontSize: 10, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2d3748"}>
              ↺ Regenerate
            </button>
          )}
          {status === "error" && (
            <button onClick={regenerate}
              style={{ padding: "3px 10px", background: "none", border: "1px solid #c9a84c", borderRadius: 5, color: "#c9a84c", fontSize: 10, cursor: "pointer" }}>
              Error — retry
            </button>
          )}
          {selectedConcept && (
            <button onClick={() => graphRef.current?.fitAll()}
              style={{ padding: "3px 10px", background: "none", border: "1px solid #2d3748", borderRadius: 5, color: "#4b5563", fontSize: 10, cursor: "pointer" }}
              onMouseEnter={e => e.currentTarget.style.borderColor = "#c9a84c"}
              onMouseLeave={e => e.currentTarget.style.borderColor = "#2d3748"}>
              ⊕ Fit
            </button>
          )}
        </div>
      </div>

      {/* Main area: graph + optional detail panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Graph */}
        <div style={{
          flex: 1,
          minWidth: 0,
          marginRight: selectedConcept ? 380 : 0,
          transition: "margin-right 0.25s ease",
        }}>
          {concepts.length === 0 && !isStreaming && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#4b5563", fontFamily: "Georgia, serif", fontSize: 14 }}>
              {status === "idle" ? "Initializing…" : "No concepts found — try regenerating."}
            </div>
          )}
          {concepts.length === 0 && isStreaming && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#4b5563", fontFamily: "Georgia, serif", fontSize: 14 }}>
              Mapping the field…
            </div>
          )}
          {concepts.length > 0 && (
            <KnowledgeSpaceGraph
              key={layoutKey}
              ref={graphRef}
              nodes={nodesWithSelection}
              edges={edges}
              selectedId={selectedId}
              onSelect={handleSelect}
            />
          )}
        </div>

        {/* Detail panel */}
        {selectedConcept && (
          <ConceptDetailPanel
            concept={selectedConcept}
            onClose={() => setSelectedId(null)}
            onNavigate={handleNavigate}
            allConcepts={concepts}
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
