"use client";
import dynamic from "next/dynamic";
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { ConceptItem } from "@/components/ConceptGraph";

const ConceptGraph = dynamic(() => import("@/components/ConceptGraph"), { ssr: false });

// ── Types ─────────────────────────────────────────────────────────────────────

interface Work {
  _type: "essential" | "anti_library";
  id?: string;
  title: string;
  authors?: string[];
  year?: number;
  type?: string;
  difficulty?: string;
  plain_description?: string;
  why_it_matters?: string;
  prerequisites?: string;
  what_you_gain?: string;
  free_access?: string;
}

interface StudiedTopic {
  slug: string;
  label: string;
  concepts: ConceptItem[];
  works: Work[];
  firstSeen?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  TEXTBOOK: "Textbook",
  SEMINAL_PAPER: "Paper",
  POPULAR_SCIENCE: "Popular",
  SURVEY: "Survey",
  CLASSIC_ORIGINAL: "Classic",
};

const DIFF_ORDER: Record<string, number> = { BEGINNER: 0, INTERMEDIATE: 1, ADVANCED: 2 };

function estimateTime(type = "", difficulty = ""): string {
  if (type === "SEMINAL_PAPER") return "2–6 hrs";
  if (type === "POPULAR_SCIENCE") return "1–2 wks";
  if (type === "SURVEY") return "2–5 days";
  if (type === "CLASSIC_ORIGINAL") return difficulty === "BEGINNER" ? "3–6 wks" : "1–3 mo";
  const map: Record<string, string> = { BEGINNER: "2–4 mo", INTERMEDIATE: "3–6 mo", ADVANCED: "4–8 mo" };
  return map[difficulty] || "2–4 mo";
}

function phaseTime(works: Work[], difficulty: string): string {
  const subset = works.filter(w => w._type === "essential" && w.difficulty === difficulty);
  if (subset.length === 0) return "";
  const hasBook = subset.some(w => w.type === "TEXTBOOK" || w.type === "CLASSIC_ORIGINAL");
  if (difficulty === "BEGINNER") return hasBook ? "2–4 months" : "2–6 weeks";
  if (difficulty === "INTERMEDIATE") return hasBook ? "3–6 months" : "1–3 months";
  return hasBook ? "4–8 months" : "2–4 months";
}

function loadTopics(): StudiedTopic[] {
  const found: StudiedTopic[] = [];
  const seen = new Set<string>();

  // topic-meta: all visited topics
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
    } catch { /**/ }

    let concepts: ConceptItem[] = [];
    try {
      const raw = localStorage.getItem(`concepts-list-v2:${slug}`);
      if (raw) { const { data, ts } = JSON.parse(raw); if (Array.isArray(data)) concepts = data; if (ts && !firstSeen) firstSeen = ts; }
    } catch { /**/ }

    let works: Work[] = [];
    try {
      const raw = localStorage.getItem(`works-list-v3:${slug}`);
      if (raw) { const { data } = JSON.parse(raw); if (Array.isArray(data)) works = data; }
    } catch { /**/ }

    found.push({ slug, label, concepts, works, firstSeen });
  }

  // fallback: concepts-only topics (older sessions)
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith("concepts-list-v2:")) continue;
    const slug = key.slice("concepts-list-v2:".length);
    if (seen.has(slug)) continue;
    seen.add(slug);
    let label = slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
    let concepts: ConceptItem[] = [];
    let firstSeen: number | undefined;
    try { const { data, ts } = JSON.parse(localStorage.getItem(key)!); if (Array.isArray(data)) concepts = data; firstSeen = ts; } catch { /**/ }
    let works: Work[] = [];
    try { const raw = localStorage.getItem(`works-list-v3:${slug}`); if (raw) { const { data } = JSON.parse(raw); if (Array.isArray(data)) works = data; } } catch { /**/ }
    found.push({ slug, label, concepts, works, firstSeen });
  }

  return found.sort((a, b) => (b.firstSeen ?? 0) - (a.firstSeen ?? 0));
}

// ── Work card ──────────────────────────────────────────────────────────────────

function WorkCard({ work, index }: { work: Work; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const time = estimateTime(work.type, work.difficulty);
  const typeLabel = TYPE_LABELS[work.type ?? ""] ?? work.type ?? "";
  const diffColor = work.difficulty === "BEGINNER" ? "#4ade80"
    : work.difficulty === "INTERMEDIATE" ? "#c9a84c" : "#f87171";

  return (
    <div style={{ marginBottom: 10 }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8,
          padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s",
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent-dim)")}
        onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
      >
        {/* Row 1: index + title */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <div style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "Georgia, serif", flexShrink: 0, marginTop: 2, minWidth: 20 }}>
            {index}.
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ color: "var(--text-primary)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", lineHeight: 1.3 }}>
              {work.title}
            </div>
            {work.authors && work.authors.length > 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 2 }}>
                {work.authors.join(", ")}{work.year ? ` (${work.year})` : ""}
              </div>
            )}
          </div>
        </div>

        {/* Row 2: badges */}
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: diffColor + "22", color: diffColor, fontWeight: "bold" }}>
            {work.difficulty}
          </span>
          {typeLabel && (
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "var(--bg-secondary)", color: "var(--text-muted)" }}>
              {typeLabel}
            </span>
          )}
          <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "var(--bg-secondary)", color: "var(--accent)", marginLeft: "auto" }}>
            ⏱ {time}
          </span>
        </div>

        {/* Expand hint */}
        <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, textAlign: "right" }}>
          {expanded ? "▲ less" : "▼ more"}
        </div>
      </div>

      {expanded && (
        <div style={{ background: "var(--bg-secondary)", border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "12px 14px 14px" }}>
          {work.plain_description && (
            <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.7, margin: "0 0 8px" }}>
              {work.plain_description}
            </p>
          )}
          {work.prerequisites && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: "bold" }}>Before reading: </span>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{work.prerequisites}</span>
            </div>
          )}
          {work.what_you_gain && (
            <div style={{ marginBottom: 6 }}>
              <span style={{ color: "var(--accent)", fontSize: 11, fontWeight: "bold" }}>What you gain: </span>
              <span style={{ color: "var(--text-secondary)", fontSize: 12 }}>{work.what_you_gain}</span>
            </div>
          )}
          {work.free_access && work.free_access !== "Not freely available" && (
            <div style={{ fontSize: 11, color: "#4ade80", marginTop: 4 }}>🔓 {work.free_access}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

function MapPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [topics, setTopics] = useState<StudiedTopic[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [selectedConcept, setSelectedConcept] = useState<ConceptItem | null>(null);
  const [addQuery, setAddQuery] = useState("");
  const [diffFilter, setDiffFilter] = useState<"ALL" | "FOUNDATIONAL" | "INTERMEDIATE" | "ADVANCED">("ALL");

  useEffect(() => {
    const list = loadTopics();
    setTopics(list);
    const paramSlug = searchParams.get("topic");
    if (paramSlug && list.find(t => t.slug === paramSlug)) {
      setSelectedSlug(paramSlug);
    } else if (list.length > 0) {
      setSelectedSlug(list[0].slug);
    }
    setLoading(false);
  }, [searchParams]);

  function selectTopic(slug: string) {
    setSelectedSlug(slug);
    setSelectedConcept(null);
    setDiffFilter("ALL");
    router.replace(`/map?topic=${slug}`, { scroll: false });
  }

  function addTopic(e: React.FormEvent) {
    e.preventDefault();
    const q = addQuery.trim();
    if (!q) return;
    const slug = q.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    router.push(`/topic/${slug}?label=${encodeURIComponent(q)}`);
  }

  const topic = topics.find(t => t.slug === selectedSlug) ?? null;

  const essentialWorks = (topic?.works ?? [])
    .filter(w => w._type === "essential")
    .sort((a, b) => (DIFF_ORDER[a.difficulty ?? ""] ?? 0) - (DIFF_ORDER[b.difficulty ?? ""] ?? 0));

  const antiWorks = (topic?.works ?? []).filter(w => w._type === "anti_library");

  const workGroups = [
    { label: "Phase 1 — Foundation", diff: "BEGINNER", color: "#4ade80" },
    { label: "Phase 2 — Core", diff: "INTERMEDIATE", color: "#c9a84c" },
    { label: "Phase 3 — Advanced", diff: "ADVANCED", color: "#f87171" },
  ];

  const displayedConcepts = topic
    ? (diffFilter === "ALL" ? topic.concepts : topic.concepts.filter(c => c.difficulty === diffFilter))
    : [];

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>Loading…</span>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", flexDirection: "column" }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header style={{ background: "var(--bg-secondary)", borderBottom: "1px solid var(--border)", padding: "14px 24px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <a href="/" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", flexShrink: 0 }}>← Home</a>

        <h1 style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 20, margin: 0, flexShrink: 0 }}>◈ Learning Map</h1>

        {/* Topic selector */}
        {topics.length > 0 && (
          <select
            value={selectedSlug}
            onChange={e => selectTopic(e.target.value)}
            style={{
              background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "7px 12px", fontFamily: "Georgia, serif", fontSize: 14,
              flex: 1, maxWidth: 340, cursor: "pointer",
            }}
          >
            {topics.map(t => (
              <option key={t.slug} value={t.slug}>{t.label}</option>
            ))}
          </select>
        )}

        {/* Add / search topic */}
        <form onSubmit={addTopic} style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <input
            value={addQuery}
            onChange={e => setAddQuery(e.target.value)}
            placeholder="Add a topic…"
            style={{
              background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "7px 12px", fontFamily: "Georgia, serif", fontSize: 13, width: 180, outline: "none",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            type="submit"
            disabled={!addQuery.trim()}
            style={{
              background: addQuery.trim() ? "var(--accent)" : "var(--bg-card)",
              color: addQuery.trim() ? "#0d1117" : "var(--text-muted)",
              border: "1px solid var(--border)", borderRadius: 8,
              padding: "7px 16px", fontFamily: "Georgia, serif", fontSize: 13,
              fontWeight: "bold", cursor: addQuery.trim() ? "pointer" : "default", flexShrink: 0,
            }}
          >
            Explore →
          </button>
        </form>

        <a href="/browse" style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, textDecoration: "none", border: "1px solid var(--border)", borderRadius: 6, padding: "6px 12px", flexShrink: 0 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--accent)"; (e.currentTarget as HTMLElement).style.color = "var(--accent)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "var(--border)"; (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
        >
          ◈ Browse Themes
        </a>
      </header>

      {/* ── Empty state ────────────────────────────────────────────────── */}
      {topics.length === 0 && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 40 }}>
          <div style={{ fontSize: 48 }}>🗺️</div>
          <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 22, margin: 0 }}>No topics studied yet</h2>
          <p style={{ color: "var(--text-secondary)", textAlign: "center", maxWidth: 400, lineHeight: 1.7, margin: 0 }}>
            Enter any academic topic to generate its concept map and reading list. Everything will appear here.
          </p>
          <form onSubmit={addTopic} style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <input
              value={addQuery}
              onChange={e => setAddQuery(e.target.value)}
              placeholder="e.g. Game Theory, Quantum Mechanics…"
              style={{
                background: "var(--bg-card)", color: "var(--text-primary)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "10px 16px", fontFamily: "Georgia, serif", fontSize: 14, width: 280, outline: "none",
              }}
              onFocus={e => (e.target.style.borderColor = "var(--accent)")}
              onBlur={e => (e.target.style.borderColor = "var(--border)")}
              autoFocus
            />
            <button type="submit" disabled={!addQuery.trim()} style={{ background: "var(--accent)", color: "#0d1117", border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold", cursor: "pointer" }}>
              Explore →
            </button>
          </form>
        </div>
      )}

      {/* ── Main split view ────────────────────────────────────────────── */}
      {topic && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0 }}>

          {/* LEFT: Concept graph */}
          <div style={{ flex: "0 0 55%", display: "flex", flexDirection: "column", borderRight: "1px solid var(--border)", overflow: "hidden" }}>
            {/* Panel header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 12, background: "var(--bg-secondary)", flexShrink: 0 }}>
              <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>
                Concept Map
              </span>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                {topic.concepts.length} concepts
              </span>

              {/* Difficulty filter */}
              <div style={{ display: "flex", gap: 4, marginLeft: "auto" }}>
                {(["ALL", "FOUNDATIONAL", "INTERMEDIATE", "ADVANCED"] as const).map(d => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    style={{
                      background: diffFilter === d ? (d === "FOUNDATIONAL" ? "#4ade80" : d === "INTERMEDIATE" ? "#c9a84c" : d === "ADVANCED" ? "#f87171" : "var(--accent)") : "var(--bg-card)",
                      color: diffFilter === d ? "#0d1117" : "var(--text-muted)",
                      border: "1px solid var(--border)", borderRadius: 6,
                      padding: "3px 10px", fontSize: 11, cursor: "pointer",
                      fontFamily: "Georgia, serif",
                    }}
                  >
                    {d === "ALL" ? "All" : d === "FOUNDATIONAL" ? "Found." : d === "INTERMEDIATE" ? "Inter." : "Adv."}
                  </button>
                ))}
              </div>
            </div>

            {/* Graph or placeholder */}
            <div style={{ flex: 1, position: "relative" }}>
              {topic.concepts.length === 0 ? (
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, padding: 32 }}>
                  <div style={{ fontSize: 36 }}>◈</div>
                  <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", lineHeight: 1.7 }}>
                    No concepts generated yet.
                  </div>
                  <a
                    href={`/topic/${topic.slug}/concepts?label=${encodeURIComponent(topic.label)}`}
                    style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 13, border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 18px", textDecoration: "none" }}
                  >
                    Generate Concept Map →
                  </a>
                </div>
              ) : (
                <ConceptGraph
                  concepts={displayedConcepts}
                  onSelect={c => setSelectedConcept(prev => prev?.id === c.id ? null : c)}
                />
              )}
            </div>

            {/* Selected concept detail */}
            {selectedConcept && (
              <div style={{
                flexShrink: 0, borderTop: "1px solid var(--accent-dim)",
                background: "#222940", padding: "14px 20px", maxHeight: 200, overflowY: "auto",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>{selectedConcept.name}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 11, marginBottom: 6 }}>{selectedConcept.difficulty} · {selectedConcept.category}</div>
                  </div>
                  <button onClick={() => setSelectedConcept(null)} style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>×</button>
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: 13, lineHeight: 1.65, margin: 0 }}>{selectedConcept.description}</p>
                {selectedConcept.key_works && selectedConcept.key_works.length > 0 && (
                  <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 8 }}>📚 {selectedConcept.key_works.join(" · ")}</div>
                )}
                <a
                  href={`/topic/${topic.slug}/concepts?label=${encodeURIComponent(topic.label)}`}
                  style={{ display: "inline-block", marginTop: 10, fontSize: 12, color: "var(--accent)", textDecoration: "none", border: "1px solid var(--accent-dim)", borderRadius: 6, padding: "4px 10px" }}
                >
                  Deep dive →
                </a>
              </div>
            )}
          </div>

          {/* RIGHT: Reading order */}
          <div style={{ flex: "0 0 45%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Panel header */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "var(--bg-secondary)", flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14, fontWeight: "bold" }}>
                  Reading Order — Zero to Mastery
                </span>
                <span style={{ color: "var(--text-muted)", fontSize: 12 }}>
                  {essentialWorks.length} works
                </span>
              </div>

              {/* Timeline summary */}
              {essentialWorks.length > 0 && (
                <div style={{ display: "flex", gap: 12, marginTop: 8, flexWrap: "wrap" }}>
                  {workGroups.map(g => {
                    const t = phaseTime(topic.works, g.diff);
                    const count = essentialWorks.filter(w => w.difficulty === g.diff).length;
                    if (!t || count === 0) return null;
                    return (
                      <div key={g.diff} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: g.color }} />
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{g.label.split("—")[1].trim()}: <span style={{ color: g.color }}>{t}</span></span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Works list */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
              {essentialWorks.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, paddingTop: 40 }}>
                  <div style={{ fontSize: 32 }}>📚</div>
                  <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14, textAlign: "center", lineHeight: 1.7 }}>
                    No works generated yet.
                  </div>
                  <a
                    href={`/topic/${topic.slug}/works?label=${encodeURIComponent(topic.label)}`}
                    style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 13, border: "1px solid var(--accent-dim)", borderRadius: 8, padding: "8px 18px", textDecoration: "none" }}
                  >
                    Generate Works List →
                  </a>
                </div>
              ) : (
                <>
                  {workGroups.map(g => {
                    const group = essentialWorks.filter(w => w.difficulty === g.diff);
                    if (group.length === 0) return null;
                    const startIdx = essentialWorks.filter(w => (DIFF_ORDER[w.difficulty ?? ""] ?? 0) < (DIFF_ORDER[g.diff] ?? 0)).length;
                    return (
                      <div key={g.diff} style={{ marginBottom: 24 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                          <div style={{ height: 1, flex: 1, background: g.color + "40" }} />
                          <span style={{ color: g.color, fontSize: 11, fontWeight: "bold", letterSpacing: 1.2, whiteSpace: "nowrap" }}>
                            {g.label.toUpperCase()} · {phaseTime(topic.works, g.diff)}
                          </span>
                          <div style={{ height: 1, flex: 1, background: g.color + "40" }} />
                        </div>
                        {group.map((w, i) => (
                          <WorkCard key={w.id ?? w.title} work={w} index={startIdx + i + 1} />
                        ))}
                      </div>
                    );
                  })}

                  {antiWorks.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                        <span style={{ color: "var(--text-muted)", fontSize: 11, fontWeight: "bold", letterSpacing: 1.2, whiteSpace: "nowrap" }}>
                          AVOID FOR NOW
                        </span>
                        <div style={{ height: 1, flex: 1, background: "var(--border)" }} />
                      </div>
                      {antiWorks.map(w => (
                        <div key={w.title} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", marginBottom: 8, opacity: 0.7 }}>
                          <div style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13, fontWeight: "bold" }}>🚫 {w.title}</div>
                          {(w as unknown as { reason?: string }).reason && (
                            <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 4, lineHeight: 1.5 }}>
                              {(w as unknown as { reason?: string }).reason}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "var(--bg-primary)", display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>Loading…</span></div>}>
      <MapPageInner />
    </Suspense>
  );
}
