"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TopicNodeData } from "@/components/MapGraph";

const MapGraph = dynamic(() => import("@/components/MapGraph"), { ssr: false });

interface StoredConcept {
  id: string;
  name: string;
  difficulty?: string;
}

interface StoredWork {
  _type?: string;
  title?: string;
}

interface TopicInfo {
  slug: string;
  label: string;
  concepts: StoredConcept[];
  workCount: number;
  firstSeen?: number;
}

interface DetailPanelProps {
  topic: TopicInfo;
  onClose: () => void;
  onNavigate: (slug: string, label: string) => void;
}

function DetailPanel({ topic, onClose, onNavigate }: DetailPanelProps) {
  const foundational = topic.concepts.filter(c => c.difficulty === "FOUNDATIONAL");
  const intermediate = topic.concepts.filter(c => c.difficulty === "INTERMEDIATE");
  const advanced = topic.concepts.filter(c => c.difficulty === "ADVANCED");

  return (
    <div style={{
      width: 340,
      flexShrink: 0,
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 10,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
    }}>
      {/* Panel header */}
      <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 16, fontWeight: "bold", marginBottom: 2 }}>
            {topic.label}
          </div>
          {topic.firstSeen && (
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>
              Studied {new Date(topic.firstSeen).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18, lineHeight: 1, padding: "0 4px" }}
        >
          ×
        </button>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "Foundational", count: foundational.length, color: "#4ade80" },
          { label: "Intermediate", count: intermediate.length, color: "#c9a84c" },
          { label: "Advanced", count: advanced.length, color: "#f87171" },
        ].map(s => (
          <div key={s.label} style={{ flex: 1, padding: "10px 8px", textAlign: "center", borderRight: "1px solid var(--border)" }}>
            <div style={{ color: s.color, fontSize: 20, fontWeight: "bold", fontFamily: "Georgia, serif" }}>{s.count}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Concept list */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
        {topic.concepts.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: 20 }}>
            No concepts loaded yet. Visit the Concepts tab to generate them.
          </div>
        ) : (
          <>
            {[
              { group: foundational, label: "Foundational", color: "#4ade80" },
              { group: intermediate, label: "Intermediate", color: "#c9a84c" },
              { group: advanced, label: "Advanced", color: "#f87171" },
            ].map(({ group, label, color }) =>
              group.length > 0 ? (
                <div key={label} style={{ marginBottom: 16 }}>
                  <div style={{ color, fontSize: 11, fontWeight: "bold", letterSpacing: 1, marginBottom: 6 }}>
                    {label.toUpperCase()} ({group.length})
                  </div>
                  {group.map(c => (
                    <div key={c.id} style={{ color: "var(--text-secondary)", fontSize: 13, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4 }}>
                      {c.name}
                    </div>
                  ))}
                </div>
              ) : null
            )}
          </>
        )}
      </div>

      {/* Navigate button */}
      <div style={{ padding: "12px 18px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => onNavigate(topic.slug, topic.label)}
          style={{
            width: "100%",
            background: "var(--accent)",
            color: "#0d1117",
            border: "none",
            borderRadius: 8,
            padding: "10px 16px",
            fontFamily: "Georgia, serif",
            fontSize: 14,
            cursor: "pointer",
            fontWeight: "bold",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Open {topic.label} →
        </button>
      </div>
    </div>
  );
}

function buildEdges(topics: TopicInfo[]): { source: string; target: string; label: string }[] {
  const edges: { source: string; target: string; label: string }[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < topics.length; i++) {
    const namesA = new Set(topics[i].concepts.map(c => c.name.toLowerCase()));
    for (let j = i + 1; j < topics.length; j++) {
      const shared = topics[j].concepts.filter(c => namesA.has(c.name.toLowerCase()));
      if (shared.length >= 2) {
        const key = [topics[i].slug, topics[j].slug].sort().join("|");
        if (!seen.has(key)) {
          seen.add(key);
          edges.push({
            source: topics[i].slug,
            target: topics[j].slug,
            label: `${shared.length} shared`,
          });
        }
      }
    }
  }

  return edges;
}

export default function MapPage() {
  const router = useRouter();
  const [topics, setTopics] = useState<TopicInfo[]>([]);
  const [edges, setEdges] = useState<{ source: string; target: string; label: string }[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"graph" | "timeline">("graph");

  useEffect(() => {
    const found: TopicInfo[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("concepts-list-v2:")) continue;

      const slug = key.slice("concepts-list-v2:".length);
      let concepts: StoredConcept[] = [];
      let firstSeen: number | undefined;

      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const { data, ts } = JSON.parse(raw);
          if (Array.isArray(data)) concepts = data;
          firstSeen = typeof ts === "number" ? ts : undefined;
        }
      } catch { /* skip */ }

      // Get label from topic-meta if available
      let label = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      try {
        const meta = localStorage.getItem(`topic-meta:${slug}`);
        if (meta) {
          const { label: storedLabel, firstSeen: storedFirst } = JSON.parse(meta);
          if (storedLabel) label = storedLabel;
          if (storedFirst && !firstSeen) firstSeen = storedFirst;
        }
      } catch { /* use derived label */ }

      // Count works
      let workCount = 0;
      try {
        const worksRaw = localStorage.getItem(`works-list-v3:${slug}`);
        if (worksRaw) {
          const { data } = JSON.parse(worksRaw);
          if (Array.isArray(data)) {
            workCount = (data as StoredWork[]).filter(w => w._type === "essential").length;
          }
        }
      } catch { /* no works */ }

      found.push({ slug, label, concepts, workCount, firstSeen });
    }

    // Sort by firstSeen (newest first if undefined)
    found.sort((a, b) => (b.firstSeen ?? 0) - (a.firstSeen ?? 0));
    setTopics(found);
    setEdges(buildEdges(found));
    setLoading(false);
  }, []);

  const handleSelect = useCallback((slug: string) => {
    setSelectedSlug(prev => prev === slug ? null : slug);
  }, []);

  function navigateToTopic(slug: string, label: string) {
    router.push(`/topic/${slug}?label=${encodeURIComponent(label)}`);
  }

  const selectedTopic = topics.find(t => t.slug === selectedSlug) ?? null;

  const topicNodes: TopicNodeData[] = topics.map(t => ({
    slug: t.slug,
    label: t.label,
    foundational: t.concepts.filter(c => c.difficulty === "FOUNDATIONAL").length,
    intermediate: t.concepts.filter(c => c.difficulty === "INTERMEDIATE").length,
    advanced: t.concepts.filter(c => c.difficulty === "ADVANCED").length,
    workCount: t.workCount,
    firstSeen: t.firstSeen,
    onClick: () => handleSelect(t.slug),
  }));

  if (loading) {
    return (
      <main style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>Loading your learning map…</div>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", display: "flex", alignItems: "center", gap: 16 }}>
        <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none" }}>← Home</a>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 22, margin: 0 }}>
            ◈ Learning Map
          </h1>
          <p style={{ color: "var(--text-muted)", fontSize: 12, margin: "2px 0 0" }}>
            {topics.length} topic{topics.length !== 1 ? "s" : ""} studied · edges = shared concepts
          </p>
        </div>

        {/* View toggle */}
        <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 8, padding: 3, border: "1px solid var(--border)" }}>
          {(["graph", "timeline"] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              style={{
                background: view === v ? "var(--accent)" : "transparent",
                color: view === v ? "#0d1117" : "var(--text-muted)",
                border: "none", borderRadius: 6, padding: "5px 14px",
                fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {v === "graph" ? "◉ Graph" : "≡ Timeline"}
            </button>
          ))}
        </div>
      </header>

      {/* Empty state */}
      {topics.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 22 }}>Your learning map is empty</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 400, lineHeight: 1.7 }}>
            Start exploring topics and generating concept maps. Each topic you study will appear here, connected to others by shared concepts.
          </p>
          <a
            href="/"
            style={{ color: "var(--accent)", fontFamily: "Georgia, serif", border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "10px 24px", textDecoration: "none" }}
          >
            ◈ Explore a Topic →
          </a>
        </div>
      )}

      {/* Graph view */}
      {topics.length > 0 && view === "graph" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative" }}>
            <MapGraph topics={topicNodes} edges={edges} onSelect={handleSelect} />
          </div>

          {selectedTopic && (
            <DetailPanel
              topic={selectedTopic}
              onClose={() => setSelectedSlug(null)}
              onNavigate={navigateToTopic}
            />
          )}
        </div>
      )}

      {/* Timeline view */}
      {topics.length > 0 && view === "timeline" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", display: "flex", gap: 24 }}>
          {/* Timeline column */}
          <div style={{ flex: 1, maxWidth: 640 }}>
            <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              {topics.map((t, i) => {
                const foundational = t.concepts.filter(c => c.difficulty === "FOUNDATIONAL").length;
                const intermediate = t.concepts.filter(c => c.difficulty === "INTERMEDIATE").length;
                const advanced = t.concepts.filter(c => c.difficulty === "ADVANCED").length;
                const isSelected = selectedSlug === t.slug;

                return (
                  <div key={t.slug} style={{ position: "relative" }}>
                    {/* Timeline dot */}
                    <div style={{
                      position: "absolute", left: -32, top: 12,
                      width: 12, height: 12, borderRadius: "50%",
                      background: isSelected ? "var(--accent)" : "var(--border)",
                      border: "2px solid var(--bg-primary)",
                      transition: "background 0.15s",
                    }} />

                    {/* Date label */}
                    {t.firstSeen && (
                      <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6 }}>
                        {new Date(t.firstSeen).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                        {i === 0 && <span style={{ color: "var(--accent)", marginLeft: 8 }}>Most Recent</span>}
                      </div>
                    )}

                    <div
                      onClick={() => setSelectedSlug(isSelected ? null : t.slug)}
                      style={{
                        background: isSelected ? "#222940" : "var(--bg-card)",
                        border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                        borderRadius: 10,
                        padding: "16px 20px",
                        cursor: "pointer",
                        transition: "background 0.15s, border-color 0.15s",
                      }}
                      onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-dim)"; }}
                      onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                    >
                      <div style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
                        {t.label}
                      </div>

                      {/* Difficulty dots */}
                      <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                        {Array(Math.min(foundational, 12)).fill(0).map((_, i) => (
                          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />
                        ))}
                        {Array(Math.min(intermediate, 12)).fill(0).map((_, i) => (
                          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a84c" }} />
                        ))}
                        {Array(Math.min(advanced, 12)).fill(0).map((_, i) => (
                          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />
                        ))}
                      </div>

                      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--text-muted)" }}>
                        <span>{t.concepts.length} concepts</span>
                        {t.workCount > 0 && <span>{t.workCount} works</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Detail panel for timeline view */}
          {selectedTopic && (
            <div style={{ width: 320, flexShrink: 0, position: "sticky", top: 0, alignSelf: "flex-start" }}>
              <DetailPanel
                topic={selectedTopic}
                onClose={() => setSelectedSlug(null)}
                onNavigate={navigateToTopic}
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
