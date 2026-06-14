"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";

type NotebookStatus = "idle" | "creating" | "ready" | "error";

function NotebookLMInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const [status, setStatus] = useState<NotebookStatus>("idle");
  const [notebookId, setNotebookId] = useState<string | null>(null);
  const [notebookName, setNotebookName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [setupRequired, setSetupRequired] = useState(false);

  const [generating, setGenerating] = useState<string | null>(null);
  const [genResults, setGenResults] = useState<Record<string, string>>({});

  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [querying, setQuerying] = useState(false);

  const [sourceUrls, setSourceUrls] = useState("");

  async function createNotebook() {
    setStatus("creating");
    setErrorMsg("");
    setSetupRequired(false);

    const urls = sourceUrls
      .split("\n")
      .map(s => s.trim())
      .filter(s => s.startsWith("http"));

    try {
      const res = await fetch("/api/notebooklm/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label, sources: urls }),
      });
      const data = await res.json();

      if (data.setup_required) {
        setSetupRequired(true);
        setStatus("error");
        setErrorMsg(data.error);
        return;
      }
      if (data.error) {
        setStatus("error");
        setErrorMsg(data.error);
        return;
      }

      setNotebookId(data.notebookId);
      setNotebookName(data.notebookName);
      setStatus("ready");
    } catch (e: unknown) {
      setStatus("error");
      setErrorMsg((e as Error).message);
    }
  }

  async function generate(action: string) {
    if (!notebookId) return;
    setGenerating(action);
    // NotebookLM generation is handled client-side via CLI; show instructions
    await new Promise(r => setTimeout(r, 1000));
    const instructions: Record<string, string> = {
      podcast: `In your terminal, run:\n\nnlm generate-podcast --notebook "${notebookId}"\n\nThis will create an AI audio overview of all your sources. It usually takes 1–2 minutes. The podcast will appear in your NotebookLM notebook.`,
      flashcards: `In your terminal, run:\n\nnlm generate-flashcards --notebook "${notebookId}"\n\nThis will generate a set of study flashcards from your sources. They will appear in your NotebookLM notebook.`,
      mindmap: `In your terminal, run:\n\nnlm generate-mindmap --notebook "${notebookId}"\n\nThis creates a visual mind map connecting the key ideas in your sources. It will appear in your NotebookLM notebook.`,
      report: `In your terminal, run:\n\nnlm generate-report --notebook "${notebookId}"\n\nThis generates a comprehensive study guide summarising all your sources. It will appear in your NotebookLM notebook.`,
    };
    setGenResults(prev => ({ ...prev, [action]: instructions[action] || "Command generated." }));
    setGenerating(null);
  }

  async function queryNotebook() {
    if (!notebookId || !question.trim()) return;
    setQuerying(true);
    setAnswer("");
    try {
      const res = await fetch("/api/notebooklm/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notebookId, question }),
      });
      const data = await res.json();
      setAnswer(data.answer || data.error || "No answer returned.");
    } catch (e: unknown) {
      setAnswer("Error: " + (e as Error).message);
    } finally {
      setQuerying(false);
    }
  }

  const GENERATE_ACTIONS = [
    { id: "podcast", icon: "🎙️", label: "Audio Podcast", desc: "NotebookLM's famous feature — two AI hosts discuss your topic based on your sources. Great for listening while commuting." },
    { id: "flashcards", icon: "🃏", label: "Flashcards", desc: "Automatically generate study flashcards from your sources. Perfect for spaced repetition." },
    { id: "mindmap", icon: "🗺️", label: "Mind Map", desc: "A visual map connecting all the key ideas in your sources. Helps you see how everything fits together." },
    { id: "report", icon: "📄", label: "Study Guide", desc: "A comprehensive written summary of all your sources, organised for study." },
  ];

  return (
    <div className="max-w-3xl">
      {/* What is NotebookLM */}
      <div className="mb-8 p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>
        <h2 className="text-lg font-bold mb-3" style={{ color: 'var(--accent)', fontFamily: 'Georgia, serif' }}>🎙️ What is NotebookLM?</h2>
        <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>
          NotebookLM is a free AI tool by Google that lets you upload documents and then ask it questions — and it answers using only what&apos;s actually in those documents (so it doesn&apos;t make things up). It can also generate audio podcasts, flashcards, and mind maps from your sources.
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)', lineHeight: '1.8' }}>
          Academy Master connects directly to NotebookLM via the <code style={{ background: 'var(--bg-secondary)', padding: '0.1rem 0.3rem', borderRadius: '3px', color: 'var(--accent)' }}>notebooklm-mcp-cli</code> tool. Once set up, you can create a dedicated workspace for {label} and push all the key sources into it with one click.
        </p>
      </div>

      {/* Setup instructions */}
      {setupRequired && (
        <div className="mb-8 p-5 rounded-lg" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid var(--blue)' }}>
          <h3 className="font-bold mb-3" style={{ color: 'var(--blue)', fontFamily: 'Georgia, serif' }}>⚙️ One-Time Setup Required</h3>
          <p className="text-sm mb-4" style={{ color: 'var(--text-primary)', lineHeight: '1.8' }}>
            The NotebookLM CLI needs to be installed and connected to your Google account once. Here&apos;s how:
          </p>
          <div className="space-y-3">
            {[
              { step: "1", label: "Install the CLI", cmd: "npm install -g notebooklm-mcp-cli" },
              { step: "2", label: "Log in with your Google account", cmd: "nlm login" },
              { step: "3", label: "Verify it works", cmd: "nlm --version" },
            ].map(s => (
              <div key={s.step} className="p-3 rounded" style={{ background: 'var(--bg-secondary)' }}>
                <div className="text-xs font-semibold mb-1" style={{ color: 'var(--blue)' }}>Step {s.step}: {s.label}</div>
                <code className="text-sm block" style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{s.cmd}</code>
              </div>
            ))}
          </div>
          <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
            Note: This uses unofficial NotebookLM APIs (~50 requests/day free). Login cookies expire every 2–4 weeks.
          </p>
        </div>
      )}

      {/* Step 1: Create notebook */}
      <div className="mb-6 p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: `1px solid ${status === 'ready' ? 'var(--green)' : 'var(--border-subtle)'}` }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: status === 'ready' ? 'var(--green)' : 'var(--accent)', color: '#0d1117' }}>
            {status === 'ready' ? '✓' : '1'}
          </div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
            Create a NotebookLM workspace for {label}
          </h3>
        </div>

        {status !== 'ready' && (
          <>
            <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
              Optionally paste URLs of sources to automatically add (one per line). These could be arXiv links, free PDFs, or websites. You can also add sources manually in NotebookLM later.
            </p>
            <textarea
              value={sourceUrls}
              onChange={e => setSourceUrls(e.target.value)}
              placeholder={"https://arxiv.org/abs/...\nhttps://example.com/paper.pdf\n(optional — leave blank to create empty notebook)"}
              rows={4}
              className="w-full px-4 py-3 rounded-lg text-sm outline-none mb-4 resize-none"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                fontFamily: 'monospace',
              }}
            />
            <button
              onClick={createNotebook}
              disabled={status === 'creating'}
              className="px-5 py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
              style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia, serif' }}
            >
              {status === 'creating' ? (
                <>
                  <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0d1117', borderTopColor: 'transparent' }} />
                  Creating notebook…
                </>
              ) : (
                '🎙️ Create NotebookLM Workspace'
              )}
            </button>
            {errorMsg && !setupRequired && (
              <div className="mt-3 p-3 rounded text-sm" style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid var(--red)', color: 'var(--red)' }}>
                {errorMsg}
              </div>
            )}
          </>
        )}

        {status === 'ready' && (
          <div className="p-3 rounded" style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid var(--green)30' }}>
            <div className="text-sm font-semibold mb-0.5" style={{ color: 'var(--green)' }}>✓ Notebook created successfully</div>
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Name: {notebookName}<br />ID: {notebookId}
            </div>
          </div>
        )}
      </div>

      {/* Step 2: Generate */}
      <div className="mb-6 p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', opacity: status === 'ready' ? 1 : 0.5 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent)', color: '#0d1117' }}>2</div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>Generate from your sources</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Once your notebook has sources, you can generate any of these. Each takes 1–2 minutes and appears directly in your NotebookLM notebook.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {GENERATE_ACTIONS.map(action => (
            <div key={action.id} className="p-4 rounded-lg" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <div className="font-semibold text-sm" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>
                    {action.icon} {action.label}
                  </div>
                  <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{action.desc}</p>
                </div>
              </div>
              <button
                onClick={() => generate(action.id)}
                disabled={status !== 'ready' || generating === action.id}
                className="mt-2 px-3 py-1.5 rounded text-xs font-semibold transition-all disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia, serif' }}
              >
                {generating === action.id ? 'Generating…' : 'Generate →'}
              </button>
              {genResults[action.id] && (
                <pre className="mt-3 p-3 rounded text-xs overflow-auto" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                  {genResults[action.id]}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 3: Query */}
      <div className="p-5 rounded-lg" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', opacity: status === 'ready' ? 1 : 0.5 }}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'var(--accent)', color: '#0d1117' }}>3</div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Georgia, serif' }}>Ask questions about your sources</h3>
        </div>
        <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)', lineHeight: '1.7' }}>
          Ask any question and NotebookLM will answer using only the actual content of your sources — no hallucination. It&apos;ll cite exactly which source the answer comes from.
        </p>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && queryNotebook()}
            placeholder={`Ask anything about ${label}…`}
            disabled={status !== 'ready'}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              fontFamily: 'Georgia, serif',
            }}
          />
          <button
            onClick={queryNotebook}
            disabled={status !== 'ready' || querying || !question.trim()}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold transition-all disabled:opacity-40"
            style={{ background: 'var(--accent)', color: '#0d1117', fontFamily: 'Georgia, serif' }}
          >
            {querying ? '…' : 'Ask →'}
          </button>
        </div>
        {answer && (
          <div className="p-4 rounded-lg text-sm leading-relaxed" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-primary)', lineHeight: '1.8' }}>
            {answer}
          </div>
        )}
        {/* Example questions */}
        <div className="mt-3">
          <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>Example questions:</p>
          <div className="flex flex-wrap gap-2">
            {[
              `What is the most important concept in ${label}?`,
              `How do the sources disagree with each other?`,
              `What should a complete beginner focus on first?`,
              `What are the key unsolved problems?`,
            ].map(q => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                disabled={status !== 'ready'}
                className="text-xs px-2 py-1 rounded transition-all disabled:opacity-40"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)', fontFamily: 'Georgia, serif' }}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Rate limit note */}
      <div className="mt-6 p-3 rounded text-xs" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
        ⚠️ NotebookLM free tier: ~50 requests/day. Uses unofficial Google APIs — may occasionally be unavailable. Google login cookies expire every 2–4 weeks (re-run <code style={{ color: 'var(--accent)' }}>nlm login</code> to refresh).
      </div>
    </div>
  );
}

export default function NotebookLMPage() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)' }}>Loading…</div>}>
      <NotebookLMInner />
    </Suspense>
  );
}
