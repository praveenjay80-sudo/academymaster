"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TAXONOMY } from "@/lib/taxonomy";

interface Theme {
  id: string;
  name: string;
  description: string;
  big_question?: string;
  domain?: string;
  field?: string;
}

const CACHE_TTL = 14 * 24 * 60 * 60 * 1000;

function cacheKey(domain: string, field: string) {
  return `themes-v3:${domain}:${field}`;
}

function loadCached(domain: string, field: string): Theme[] | null {
  try {
    const raw = localStorage.getItem(cacheKey(domain, field));
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as Theme[];
  } catch { return null; }
}

function saveCache(domain: string, field: string, themes: Theme[]) {
  try {
    localStorage.setItem(cacheKey(domain, field), JSON.stringify({ data: themes, ts: Date.now() }));
  } catch { /* ignore */ }
}

function extractThemes(text: string): { themes: Theme[]; remaining: string } {
  const themes: Theme[] = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("{", i);
    if (start === -1) break;
    let depth = 0, inStr = false, escaped = false, end = -1;
    for (let j = start; j < text.length; j++) {
      const ch = text[j];
      if (escaped) { escaped = false; continue; }
      if (ch === "\\" && inStr) { escaped = true; continue; }
      if (ch === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { end = j; break; } }
    }
    if (end === -1) break;
    try {
      const t: Theme = JSON.parse(text.slice(start, end + 1));
      if (t.id && t.name && t.description) themes.push(t);
    } catch { /* skip */ }
    i = end + 1;
  }
  return { themes, remaining: i < text.length ? text.slice(i) : "" };
}

/* ── Theme card ── */
function ThemeCard({ theme, index, onClick }: { theme: Theme; index: number; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? "var(--bg-card-hover)" : "var(--bg-card)",
        border: `1px solid ${hovered ? "var(--accent)" : "var(--border)"}`,
        borderRadius: 10,
        padding: "20px 22px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s, transform 0.15s",
        transform: hovered ? "translateY(-2px)" : "none",
        animation: `fadeSlideIn 0.3s ease-out ${Math.min(index * 0.04, 0.5)}s both`,
      }}
    >
      <div style={{
        color: hovered ? "var(--accent)" : "var(--text-primary)",
        fontFamily: "Georgia, serif",
        fontSize: 15,
        fontWeight: "bold",
        marginBottom: 10,
        lineHeight: 1.3,
        transition: "color 0.15s",
      }}>
        {theme.name}
      </div>
      <div style={{
        color: "var(--text-secondary)",
        fontSize: 13,
        lineHeight: 1.7,
        fontFamily: "Georgia, serif",
      }}>
        {theme.description}
      </div>
      {theme.domain && theme.field && (
        <div style={{ marginTop: 12, fontSize: 11, color: "var(--text-muted)" }}>
          {theme.domain} › {theme.field}
        </div>
      )}
      <div style={{
        marginTop: 12,
        fontSize: 12,
        color: "var(--accent)",
        opacity: hovered ? 1 : 0,
        transition: "opacity 0.15s",
      }}>
        Generate mastery guide →
      </div>
    </div>
  );
}

/* ── Streaming theme panel ── */
function ThemePanel({ domain, field }: { domain: string; field: string }) {
  const router = useRouter();
  const [themes, setThemes] = useState<Theme[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;
    abortRef.current?.abort();
    setThemes([]); setDone(false); setError(""); setStreaming(false);

    const cached = loadCached(domain, field);
    if (cached) { setThemes(cached); setDone(true); return; }

    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const accumulated: Theme[] = [];

    (async () => {
      try {
        const res = await fetch("/api/themes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, field }),
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let buf = "";
        while (true) {
          const { done: rdDone, value } = await reader.read();
          if (rdDone) break;
          if (cancelled) return;
          buf += dec.decode(value, { stream: true });
          const { themes: found, remaining } = extractThemes(buf);
          buf = remaining;
          if (found.length) {
            for (const t of found) accumulated.push(t);
            setThemes([...accumulated]);
          }
        }
        if (cancelled) return;
        saveCache(domain, field, accumulated);
      } catch (e: unknown) {
        if (cancelled) return;
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
      } finally {
        if (!cancelled) { setStreaming(false); setDone(true); }
      }
    })();

    return () => { cancelled = true; ctrl.abort(); };
  }, [domain, field]);

  function goToTopic(theme: Theme) {
    const slug = theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    router.push(`/topic/${slug}?label=${encodeURIComponent(theme.name)}`);
  }

  return (
    <div>
      {/* Streaming banner */}
      {streaming && themes.length === 0 && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", borderRadius: 8, background: "var(--accent-glow)", border: "1px solid var(--accent-dim)", marginBottom: 24 }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s ease-in-out infinite" }} />
          <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 14 }}>
            Discovering themes in {field}…
          </span>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: 8, background: "rgba(248,113,113,.1)", border: "1px solid var(--red)", color: "var(--red)", marginBottom: 20, fontSize: 13 }}>
          {error}
        </div>
      )}

      {themes.length > 0 && (
        <>
          {streaming && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--accent)", animation: "pulse 1s ease-in-out infinite" }} />
              <span style={{ color: "var(--text-muted)", fontSize: 12, fontFamily: "Georgia, serif" }}>
                {themes.length} themes found…
              </span>
            </div>
          )}

          {/* Group by big question */}
          {(() => {
            const groups: Record<string, Theme[]> = {};
            const order: string[] = [];
            for (const t of themes) {
              const q = t.big_question || "General";
              if (!groups[q]) { groups[q] = []; order.push(q); }
              groups[q].push(t);
            }
            let globalIndex = 0;
            return order.map(q => (
              <div key={q} style={{ marginBottom: 44 }}>
                {/* Big question header */}
                <div style={{ marginBottom: 18 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
                    <span style={{ color: "var(--accent)", fontSize: 16, lineHeight: 1 }}>◈</span>
                    <h3 style={{
                      fontFamily: "Georgia, serif",
                      fontSize: 17,
                      fontWeight: "bold",
                      color: "var(--text-primary)",
                      margin: 0,
                      lineHeight: 1.3,
                    }}>
                      {q}
                    </h3>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, paddingLeft: 28 }}>
                    <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                    <div style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{groups[q].length} themes</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14, paddingLeft: 0 }}>
                  {groups[q].map(t => {
                    const idx = globalIndex++;
                    return <ThemeCard key={t.id} theme={t} index={idx} onClick={() => goToTopic(t)} />;
                  })}
                </div>
              </div>
            ));
          })()}

          {done && (
            <div style={{ marginTop: 8, fontSize: 12, color: "var(--text-muted)", fontFamily: "Georgia, serif" }}>
              {themes.length} themes across {new Set(themes.map(t => t.big_question || "General")).size} big questions · Click any to generate a full mastery guide
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ── Main browse page ── */
export default function BrowsePage() {
  const domains = Object.keys(TAXONOMY);
  const [domain, setDomain] = useState(domains[0]);
  const [field, setField] = useState(TAXONOMY[domains[0]][0]);
  const [search, setSearch] = useState("");
  const router = useRouter();

  // Collect all cached themes for global search
  const [allCached, setAllCached] = useState<Theme[]>([]);

  useEffect(() => {
    const all: Theme[] = [];
    for (const d of domains) {
      for (const f of TAXONOMY[d]) {
        const cached = loadCached(d, f);
        if (cached) all.push(...cached.map(t => ({ ...t, domain: d, field: f })));
      }
    }
    setAllCached(all);
  }, [domain, field]); // refresh after each new field load

  function handleDomain(d: string) {
    setDomain(d);
    setField(TAXONOMY[d][0]);
  }

  const fields = TAXONOMY[domain] ?? [];

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return allCached.filter(t =>
      t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    );
  }, [search, allCached]);

  const isSearching = search.trim().length > 0;

  const selectStyle = {
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "9px 14px",
    fontFamily: "Georgia, serif",
    fontSize: 14,
    minWidth: 200,
    outline: "none",
    cursor: "pointer",
    appearance: "none" as const,
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b7280' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 12px center",
    paddingRight: 34,
  };

  function goToTopic(theme: Theme) {
    const slug = theme.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    router.push(`/topic/${slug}?label=${encodeURIComponent(theme.name)}`);
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: "48px 24px" }}>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.35; }
        }
        select option { background: #1c2333; color: #e8dcc8; }
      `}</style>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>

        {/* Back */}
        <a href="/" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none", fontFamily: "Georgia, serif" }}>
          ← Home
        </a>

        {/* Header */}
        <div style={{ margin: "24px 0 8px" }}>
          <h1 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 32, margin: 0, fontWeight: "bold" }}>
            ◈ Browse by Theme
          </h1>
        </div>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 36, lineHeight: 1.7 }}>
          Themes are the central ideas and underlying questions that define each academic field — the lenses through which scholars see the world. Pick a field to discover its themes, or search across everything you&apos;ve explored.
        </p>

        {/* Search */}
        <div style={{ position: "relative", marginBottom: 36 }}>
          <input
            type="text"
            placeholder="Search themes by name or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "13px 18px 13px 44px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              color: "var(--text-primary)",
              fontFamily: "Georgia, serif",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.15s",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <span style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", fontSize: 16, pointerEvents: "none" }}>
            ⌕
          </span>
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 16 }}>
              ✕
            </button>
          )}
        </div>

        {/* Search results */}
        {isSearching && (
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 20, textTransform: "uppercase" }}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
              {allCached.length === 0 && " — browse some fields first to build up your search index"}
            </div>
            {searchResults.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
                {searchResults.map((t, i) => (
                  <ThemeCard key={`${t.domain}:${t.field}:${t.id}`} theme={t} index={i} onClick={() => goToTopic(t)} />
                ))}
              </div>
            ) : (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>◈</div>
                <p style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14 }}>
                  No cached themes match &ldquo;{search}&rdquo;. Browse a field below to generate its themes, then search.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Browse panel */}
        {!isSearching && (
          <>
            {/* Dropdowns */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36, alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Domain</div>
                <select value={domain} onChange={e => handleDomain(e.target.value)} style={selectStyle}>
                  {domains.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>Field</div>
                <select value={field} onChange={e => setField(e.target.value)} style={selectStyle}>
                  {fields.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "Georgia, serif", paddingBottom: 10 }}>
                Themes generate automatically · cached for 14 days
              </div>
            </div>

            {/* Divider with label */}
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 28 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                Themes in {field}
              </div>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <ThemePanel domain={domain} field={field} />
          </>
        )}

      </div>
    </main>
  );
}
