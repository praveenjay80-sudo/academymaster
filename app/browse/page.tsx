"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { TAXONOMY } from "@/lib/taxonomy";

export default function BrowsePage() {
  const router = useRouter();
  const domains = Object.keys(TAXONOMY);

  const [domain, setDomain] = useState(domains[0]);
  const [field, setField] = useState(Object.keys(TAXONOMY[domains[0]])[0]);
  const [search, setSearch] = useState("");

  const fields = Object.keys(TAXONOMY[domain] ?? {});
  const currentThemes = TAXONOMY[domain]?.[field] ?? [];

  function handleDomain(d: string) {
    setDomain(d);
    setField(Object.keys(TAXONOMY[d])[0]);
  }

  function goToTopic(theme: string) {
    const slug = theme.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    router.push(`/topic/${slug}?label=${encodeURIComponent(theme)}`);
  }

  // Global search across all domains and fields
  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    const results: { theme: string; domain: string; field: string }[] = [];
    for (const d of Object.keys(TAXONOMY)) {
      for (const f of Object.keys(TAXONOMY[d])) {
        for (const t of TAXONOMY[d][f]) {
          if (t.toLowerCase().includes(q)) results.push({ theme: t, domain: d, field: f });
        }
      }
    }
    return results;
  }, [search]);

  const isSearching = search.trim().length > 0;

  const selectStyle = {
    background: "var(--bg-card)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 14px",
    fontFamily: "Georgia, serif",
    fontSize: 14,
    minWidth: 190,
    outline: "none",
    cursor: "pointer",
  } as const;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-primary)", padding: "48px 24px" }}>
      <div style={{ maxWidth: 940, margin: "0 auto" }}>

        {/* Back */}
        <a href="/" style={{ color: "var(--text-muted)", fontSize: 13, textDecoration: "none", fontFamily: "Georgia, serif" }}>
          ← Home
        </a>

        {/* Header */}
        <h1 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 30, margin: "20px 0 6px", fontWeight: "bold" }}>
          ◈ Browse by Theme
        </h1>
        <p style={{ color: "var(--text-secondary)", fontSize: 14, fontFamily: "Georgia, serif", marginBottom: 32 }}>
          Explore the central ideas of any field. Click a theme to generate a full mastery guide — concept map, essential works, roadmap, and more.
        </p>

        {/* Search bar */}
        <div style={{ marginBottom: 32 }}>
          <input
            type="text"
            placeholder="Search all themes across every domain…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "12px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              color: "var(--text-primary)",
              fontFamily: "Georgia, serif",
              fontSize: 15,
              outline: "none",
              boxSizing: "border-box",
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
            autoFocus
          />
        </div>

        {/* Search results */}
        {isSearching && (
          <div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 16, textTransform: "uppercase" }}>
              {searchResults.length} result{searchResults.length !== 1 ? "s" : ""} for &ldquo;{search}&rdquo;
            </div>
            {searchResults.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {searchResults.map(({ theme, domain: d, field: f }) => (
                  <ThemeChip key={`${d}:${f}:${theme}`} theme={theme} subtitle={`${d} › ${f}`} onClick={() => goToTopic(theme)} />
                ))}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 14 }}>
                No themes match &ldquo;{search}&rdquo;.
              </p>
            )}
          </div>
        )}

        {/* Browse by domain/field */}
        {!isSearching && (
          <>
            {/* 2 Dropdowns */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
              {([
                { label: "Domain", value: domain, opts: domains, onChange: handleDomain },
                { label: "Field",  value: field,  opts: fields,  onChange: setField     },
              ] as const).map(({ label, value, opts, onChange }) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    {label}
                  </div>
                  <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
                    {opts.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {/* Themes */}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 28 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.15em", marginBottom: 20, textTransform: "uppercase" }}>
                Themes in {field}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
                {currentThemes.map(theme => (
                  <ThemeChip key={theme} theme={theme} onClick={() => goToTopic(theme)} />
                ))}
              </div>
            </div>
          </>
        )}

      </div>
    </main>
  );
}

function ThemeChip({ theme, subtitle, onClick }: { theme: string; subtitle?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "14px 16px",
        color: "var(--text-primary)",
        fontFamily: "Georgia, serif",
        fontSize: 14,
        cursor: "pointer",
        textAlign: "left",
        transition: "border-color 0.15s, color 0.15s",
        width: "100%",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = "var(--accent)";
        e.currentTarget.style.color = "var(--accent)";
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text-primary)";
      }}
    >
      <div>{theme}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>{subtitle}</div>
      )}
    </button>
  );
}
