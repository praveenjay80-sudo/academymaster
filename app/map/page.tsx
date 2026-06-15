"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import type { TopicNodeData } from "@/components/MapGraph";

const MapGraph = dynamic(() => import("@/components/MapGraph"), { ssr: false });

interface StoredConcept {
  id: string;
  name: string;
  difficulty?: string;
}

interface TopicInfo {
  slug: string;
  label: string;
  concepts: StoredConcept[];
  workCount: number;
  firstSeen?: number;
}

function DetailPanel({
  topic,
  onClose,
  onNavigate,
}: {
  topic: TopicInfo;
  onClose: () => void;
  onNavigate: (slug: string, label: string) => void;
}) {
  const foundational = topic.concepts.filter(c => c.difficulty === "FOUNDATIONAL");
  const intermediate = topic.concepts.filter(c => c.difficulty === "INTERMEDIATE");
  const advanced = topic.concepts.filter(c => c.difficulty === "ADVANCED");

  return (
    <div style={{
      width: 340, flexShrink: 0,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, display: "flex", flexDirection: "column", overflow: "hidden",
    }}>
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
        <button onClick={onClose} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 4px" }}>×</button>
      </div>

      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {[
          { label: "Found.", count: foundational.length, color: "#4ade80" },
          { label: "Inter.", count: intermediate.length, color: "#c9a84c" },
          { label: "Adv.", count: advanced.length, color: "#f87171" },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, padding: "10px 8px", textAlign: "center", borderRight: i < 2 ? "1px solid var(--border)" : "none" }}>
            <div style={{ color: s.color, fontSize: 20, fontWeight: "bold", fontFamily: "Georgia, serif" }}>{s.count}</div>
            <div style={{ color: "var(--text-muted)", fontSize: 10 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 18px" }}>
        {topic.concepts.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, textAlign: "center", paddingTop: 16, lineHeight: 1.6 }}>
            No concepts generated yet.<br />Visit the Concepts tab to build the map.
          </div>
        ) : (
          [
            { group: foundational, label: "Foundational", color: "#4ade80" },
            { group: intermediate, label: "Intermediate", color: "#c9a84c" },
            { group: advanced, label: "Advanced", color: "#f87171" },
          ].map(({ group, label, color }) =>
            group.length > 0 ? (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ color, fontSize: 10, fontWeight: "bold", letterSpacing: 1.2, marginBottom: 5 }}>
                  {label.toUpperCase()} ({group.length})
                </div>
                {group.map(c => (
                  <a
                    key={c.id}
                    href={`/topic/${topic.slug}/concepts?label=${encodeURIComponent(topic.label)}`}
                    style={{ display: "block", color: "var(--text-secondary)", fontSize: 13, paddingLeft: 8, marginBottom: 3, lineHeight: 1.4, textDecoration: "none" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
                  >
                    {c.name}
                  </a>
                ))}
              </div>
            ) : null
          )
        )}
      </div>

      {/* Tab shortcuts */}
      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)", display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[
          { label: "◈ Concepts", tab: "concepts" },
          { label: "📚 Works", tab: "works" },
          { label: "🎓 Tutor", tab: "tutor" },
          { label: "🗺️ Roadmap", tab: "roadmap" },
        ].map(({ label, tab }) => (
          <a
            key={tab}
            href={`/topic/${topic.slug}/${tab}?label=${encodeURIComponent(topic.label)}`}
            style={{
              flex: 1,
              textAlign: "center",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "6px 8px",
              fontFamily: "Georgia, serif",
              fontSize: 11,
              color: "var(--text-secondary)",
              textDecoration: "none",
              transition: "border-color 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
          >
            {label}
          </a>
        ))}
      </div>

      <div style={{ padding: "10px 18px", borderTop: "1px solid var(--border)" }}>
        <button
          onClick={() => onNavigate(topic.slug, topic.label)}
          style={{
            width: "100%", background: "var(--accent)", color: "#0d1117",
            border: "none", borderRadius: 8, padding: "9px 16px",
            fontFamily: "Georgia, serif", fontSize: 14, cursor: "pointer", fontWeight: "bold",
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

function buildEdges(topics: TopicInfo[]) {
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
          edges.push({ source: topics[i].slug, target: topics[j].slug, label: `${shared.length} shared` });
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
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const found: TopicInfo[] = [];
    const seen = new Set<string>();

    // Scan all localStorage keys — prefer topic-meta (all visited topics)
    // then enrich with concepts/works data
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("topic-meta:")) continue;
      const slug = key.slice("topic-meta:".length);
      if (seen.has(slug)) continue;
      seen.add(slug);

      let label = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      let firstSeen: number | undefined;

      try {
        const meta = JSON.parse(localStorage.getItem(key)!);
        if (meta.label) label = meta.label;
        if (meta.firstSeen) firstSeen = meta.firstSeen;
      } catch { /* use derived */ }

      let concepts: StoredConcept[] = [];
      try {
        const raw = localStorage.getItem(`concepts-list-v2:${slug}`);
        if (raw) {
          const { data, ts } = JSON.parse(raw);
          if (Array.isArray(data)) concepts = data;
          if (ts && !firstSeen) firstSeen = ts;
        }
      } catch { /* no concepts */ }

      let workCount = 0;
      try {
        const worksRaw = localStorage.getItem(`works-list-v3:${slug}`);
        if (worksRaw) {
          const { data } = JSON.parse(worksRaw);
          if (Array.isArray(data)) workCount = data.filter((w: { _type?: string }) => w._type === "essential").length;
        }
      } catch { /* no works */ }

      found.push({ slug, label, concepts, workCount, firstSeen });
    }

    // Also catch topics that have concepts but no topic-meta (older sessions)
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key?.startsWith("concepts-list-v2:")) continue;
      const slug = key.slice("concepts-list-v2:".length);
      if (seen.has(slug)) continue;
      seen.add(slug);

      let label = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
      let concepts: StoredConcept[] = [];
      let firstSeen: number | undefined;

      try {
        const { data, ts } = JSON.parse(localStorage.getItem(key)!);
        if (Array.isArray(data)) concepts = data;
        firstSeen = ts;
      } catch { /* skip */ }

      let workCount = 0;
      try {
        const worksRaw = localStorage.getItem(`works-list-v3:${slug}`);
        if (worksRaw) {
          const { data } = JSON.parse(worksRaw);
          if (Array.isArray(data)) workCount = data.filter((w: { _type?: string }) => w._type === "essential").length;
        }
      } catch { /* no works */ }

      found.push({ slug, label, concepts, workCount, firstSeen });
    }

    found.sort((a, b) => (b.firstSeen ?? 0) - (a.firstSeen ?? 0));
    setTopics(found);
    setEdges(buildEdges(found));
    setLoading(false);
  }, []);

  const handleSelect = useCallback((slug: string) => {
    setSelectedSlug(prev => (prev === slug ? null : slug));
  }, []);

  function navigateToTopic(slug: string, label: string) {
    router.push(`/topic/${slug}?label=${encodeURIComponent(label)}`);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = search.trim();
    if (!q) return;
    // If it matches an existing topic, select it; otherwise navigate to it
    const match = topics.find(t => t.label.toLowerCase() === q.toLowerCase());
    if (match) {
      setSelectedSlug(match.slug);
    } else {
      const slug = q.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
      router.push(`/topic/${slug}?label=${encodeURIComponent(q)}`);
    }
  }

  const q = search.trim().toLowerCase();
  const filteredTopics = q
    ? topics.filter(t =>
        t.label.toLowerCase().includes(q) ||
        t.concepts.some(c => c.name.toLowerCase().includes(q))
      )
    : topics;

  const filteredSlugs = new Set(filteredTopics.map(t => t.slug));
  const filteredEdges = edges.filter(e => filteredSlugs.has(e.source) && filteredSlugs.has(e.target));
  const selectedTopic = filteredTopics.find(t => t.slug === selectedSlug) ?? null;

  const topicNodes: TopicNodeData[] = filteredTopics.map(t => ({
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
      <header style={{ padding: "16px 32px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 14 }}>
          <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>← Home</a>
          <a href="/browse" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 10px", flexShrink: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
          >◈ Browse Themes</a>
          <h1 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 22, margin: 0, flex: 1 }}>
            ◈ Learning Map
          </h1>
          <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
            {filteredTopics.length}{q ? ` of ${topics.length}` : ""} topic{topics.length !== 1 ? "s" : ""}
          </span>

          {/* View toggle */}
          <div style={{ display: "flex", gap: 4, background: "var(--bg-card)", borderRadius: 8, padding: 3, border: "1px solid var(--border)", flexShrink: 0 }}>
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
        </div>

        {/* Search bar */}
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8 }}>
          <input
            ref={searchRef}
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setSelectedSlug(null); }}
            placeholder="Search topics or concepts… or type a new topic to explore it"
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "9px 16px",
              color: "var(--text-primary)",
              fontFamily: "Georgia, serif",
              fontSize: 14,
              outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          {search.trim() && (
            <button
              type="button"
              onClick={() => { setSearch(""); setSelectedSlug(null); searchRef.current?.focus(); }}
              style={{
                background: "var(--bg-card)", color: "var(--text-muted)",
                border: "1px solid var(--border)", borderRadius: 8,
                padding: "9px 14px", fontFamily: "Georgia, serif", fontSize: 13, cursor: "pointer",
              }}
            >
              ✕ Clear
            </button>
          )}
          <button
            type="submit"
            style={{
              background: "var(--accent)", color: "#0d1117",
              border: "none", borderRadius: 8,
              padding: "9px 20px", fontFamily: "Georgia, serif", fontSize: 14,
              fontWeight: "bold", cursor: "pointer", flexShrink: 0,
              opacity: search.trim() ? 1 : 0.5,
            }}
          >
            Search →
          </button>
        </form>

        {/* Search hint: shows what will happen on submit */}
        {search.trim() && filteredTopics.length === 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
            No studied topics match — pressing Search will open "{search.trim()}" as a new topic.
          </div>
        )}
        {search.trim() && filteredTopics.length > 0 && (
          <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 8 }}>
            {filteredTopics.length} topic{filteredTopics.length !== 1 ? "s" : ""} match · press Search to explore "{search.trim()}" as a new topic
          </div>
        )}
      </header>

      {/* Empty state */}
      {topics.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 22 }}>Your learning map is empty</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 420, lineHeight: 1.7 }}>
            Every topic you study will appear here. Start by searching for a topic above, or go to the homepage to explore one.
          </p>
          <a href="/" style={{ color: "var(--accent)", fontFamily: "Georgia, serif", border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "10px 24px", textDecoration: "none" }}>
            ◈ Explore a Topic →
          </a>
        </div>
      )}

      {/* Graph view */}
      {topics.length > 0 && view === "graph" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ flex: 1, position: "relative" }}>
            {filteredTopics.length === 0 ? (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10 }}>
                <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 15 }}>No topics match your search.</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Press Search to open it as a new topic.</div>
              </div>
            ) : (
              <MapGraph topics={topicNodes} edges={filteredEdges} onSelect={handleSelect} />
            )}
          </div>
          {selectedTopic && (
            <DetailPanel topic={selectedTopic} onClose={() => setSelectedSlug(null)} onNavigate={navigateToTopic} />
          )}
        </div>
      )}

      {/* Timeline view */}
      {topics.length > 0 && view === "timeline" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "32px 40px", display: "flex", gap: 24 }}>
          <div style={{ flex: 1, maxWidth: 640 }}>
            {filteredTopics.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 15, textAlign: "center", paddingTop: 40 }}>
                No topics match your search.
              </div>
            ) : (
              <div style={{ borderLeft: "2px solid var(--border)", paddingLeft: 24, display: "flex", flexDirection: "column", gap: 24 }}>
                {filteredTopics.map((t, i) => {
                  const f = t.concepts.filter(c => c.difficulty === "FOUNDATIONAL").length;
                  const m = t.concepts.filter(c => c.difficulty === "INTERMEDIATE").length;
                  const a = t.concepts.filter(c => c.difficulty === "ADVANCED").length;
                  const isSelected = selectedSlug === t.slug;
                  return (
                    <div key={t.slug} style={{ position: "relative" }}>
                      <div style={{
                        position: "absolute", left: -32, top: 14,
                        width: 12, height: 12, borderRadius: "50%",
                        background: isSelected ? "var(--accent)" : "var(--border)",
                        border: "2px solid var(--bg-primary)", transition: "background 0.15s",
                      }} />
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
                          borderRadius: 10, padding: "16px 20px", cursor: "pointer",
                          transition: "background 0.15s, border-color 0.15s",
                        }}
                        onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--accent-dim)"; }}
                        onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; }}
                      >
                        <div style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 16, fontWeight: "bold", marginBottom: 10 }}>
                          {t.label}
                        </div>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {Array(Math.min(f, 12)).fill(0).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#4ade80" }} />)}
                          {Array(Math.min(m, 12)).fill(0).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#c9a84c" }} />)}
                          {Array(Math.min(a, 12)).fill(0).map((_, i) => <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "#f87171" }} />)}
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
            )}
          </div>

          {selectedTopic && (
            <div style={{ width: 320, flexShrink: 0, position: "sticky", top: 0, alignSelf: "flex-start" }}>
              <DetailPanel topic={selectedTopic} onClose={() => setSelectedSlug(null)} onNavigate={navigateToTopic} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
