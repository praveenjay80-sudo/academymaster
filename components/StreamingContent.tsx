"use client";
import { useEffect, useRef, useState } from "react";

interface Props {
  endpoint: string;
  body: Record<string, unknown>;
  cacheKey: string;
  label?: string; // short description for the Start button
  onData?: (raw: string) => void;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/^## (.+)$/gm, '<h2 style="color:var(--accent);font-size:1.05rem;font-weight:700;margin:1.8rem 0 0.5rem;text-transform:uppercase;letter-spacing:.05em;font-family:Georgia,serif;border-bottom:1px solid var(--border);padding-bottom:.3rem">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 style="color:var(--text-primary);font-size:.95rem;font-weight:600;margin:1.2rem 0 .3rem;font-family:Georgia,serif">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--accent)">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em style="color:var(--text-secondary)">$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:var(--bg-card);border:1px solid var(--border);border-radius:3px;padding:.1rem .35rem;font-size:.85em;color:var(--accent)">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid var(--accent-dim);padding-left:1rem;margin:.6rem 0;color:var(--text-secondary);font-style:italic">$1</blockquote>')
    .replace(/^- (.+)$/gm, '<li style="padding:.25rem 0 .25rem 1.4rem;color:var(--text-primary);line-height:1.75;position:relative">◆ $1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>\n?)+/g, m => `<ul style="list-style:none;padding:0;margin:.5rem 0">${m}</ul>`)
    .replace(/\n\n+/g, '</p><p style="color:var(--text-primary);line-height:1.85;margin:.5rem 0">')
    .replace(/^(?!<[hul]|<\/[hul]|<block)(.+)$/gm, m => m.trim() ? `<p style="color:var(--text-primary);line-height:1.85;margin:.45rem 0">${m}</p>` : '');
}

export default function StreamingContent({ endpoint, body, cacheKey, label, onData }: Props) {
  const [raw, setRaw] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [started, setStarted] = useState(false);
  const [gen, setGen] = useState(0);
  const ctrlRef = useRef<AbortController | null>(null);
  const storageKey = `sc2:${cacheKey}`;

  // Reset "started" whenever the topic (cacheKey) changes
  useEffect(() => {
    setStarted(false);
  }, [cacheKey]);

  useEffect(() => {
    let cancelled = false;
    setRaw(""); setDone(false); setError(""); setLoading(false);

    // Always serve from cache if available — no Start needed
    const cached = localStorage.getItem(storageKey);
    if (cached) {
      try {
        const { data, ts } = JSON.parse(cached);
        if (Date.now() - ts < 14 * 24 * 60 * 60 * 1000) {
          setRaw(data); setDone(true);
          if (onData) onData(data);
          return;
        }
      } catch { /* stale — will refetch when started */ }
    }

    // No cache: only fetch when user clicks Start (or Regenerate)
    if (!started) return;

    setLoading(true);
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    (async () => {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (!res.ok) throw new Error(`Server error ${res.status}`);

        const reader = res.body!.getReader();
        const dec = new TextDecoder();
        let full = "";

        while (true) {
          const { done: rdDone, value } = await reader.read();
          if (rdDone) break;
          if (cancelled) return;
          full += dec.decode(value, { stream: true });
          setRaw(full);
        }

        if (cancelled) return;
        localStorage.setItem(storageKey, JSON.stringify({ data: full, ts: Date.now() }));
        if (onData) onData(full);
      } catch (e: unknown) {
        if (cancelled) return;
        if ((e as Error).name !== "AbortError") setError((e as Error).message);
        // AbortError from user clicking Stop → finally handles gracefully
      } finally {
        if (!cancelled) { setLoading(false); setDone(true); }
      }
    })();

    return () => { cancelled = true; ctrl.abort(); };
  }, [cacheKey, gen, started]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStart() { setStarted(true); }

  function handleStop() {
    // Abort the stream — finally block sets done=true so content shows as-is
    ctrlRef.current?.abort();
  }

  function handleRegenerate() {
    localStorage.removeItem(storageKey);
    setStarted(true); // ensure we start fetching even if user hadn't clicked Start
    setGen(g => g + 1);
  }

  // ── Error ──
  if (error) return (
    <div className="p-4 rounded-lg" style={{ background: 'rgba(248,113,113,.1)', border: '1px solid var(--red)', color: 'var(--red)' }}>
      <strong>Error:</strong> {error}
      <button onClick={handleRegenerate} className="ml-4 underline text-sm">Try again</button>
    </div>
  );

  // ── Not yet started (no cache) ──
  if (!started && !raw && !loading && !done) return (
    <div className="flex flex-col items-center gap-5 py-24">
      <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
        ◈
      </div>
      <div className="text-center max-w-sm">
        <p className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia,serif' }}>
          {label ?? "Ready to generate"}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Click below to start. This will take 30–60 seconds and is saved so you only pay for it once.
        </p>
      </div>
      <button
        onClick={handleStart}
        className="px-6 py-3 rounded-lg font-semibold text-sm transition-all"
        style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia,serif' }}
      >
        ▶ Generate
      </button>
    </div>
  );

  // ── Loading (before first chunk) ──
  if (!raw && loading) return (
    <div className="flex flex-col items-center gap-3 py-20" style={{ color: 'var(--text-muted)' }}>
      <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      <span style={{ fontFamily: 'Georgia,serif' }}>Generating…</span>
    </div>
  );

  if (!raw) return null;

  // ── Streaming ──
  if (!done) {
    return (
      <div>
        <style>{`
          @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
          @keyframes sc-pulse { 0%,100%{opacity:1} 50%{opacity:.35} }
          .stream-cursor { display:inline-block; width:2px; height:1.1em; background:var(--accent); margin-left:2px; vertical-align:text-bottom; animation: blink .7s step-end infinite; }
        `}</style>

        <div className="flex items-center gap-3 mb-5 px-4 py-2.5 rounded-lg" style={{ background: 'var(--accent-glow)', border: '1px solid var(--accent-dim)' }}>
          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: 'var(--accent)', animation: 'sc-pulse 1s ease-in-out infinite' }} />
          <span className="text-sm flex-1" style={{ color: 'var(--accent)', fontFamily: 'Georgia,serif' }}>
            Generating — content is appearing live as it is written…
          </span>
          <button
            onClick={handleStop}
            className="text-xs px-3 py-1 rounded shrink-0 transition-all"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
          >
            ■ Stop
          </button>
        </div>

        <div dangerouslySetInnerHTML={{ __html: renderMarkdown(raw) + '<span class="stream-cursor"></span>' }} />
      </div>
    );
  }

  // ── Done ──
  return (
    <div>
      <div dangerouslySetInnerHTML={{ __html: renderMarkdown(raw) }} />
      <div className="mt-8 pt-6 flex justify-end" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={handleRegenerate}
          className="text-xs px-3 py-1.5 rounded transition-all"
          style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
        >
          ↺ Regenerate
        </button>
      </div>
    </div>
  );
}
