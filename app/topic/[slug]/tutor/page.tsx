"use client";
import { useParams, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, Suspense } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function TutorInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const label = searchParams.get("label") || slug.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  const sessionKey = `tutor-session:${slug}`;
  const conceptsKey = `concepts-list-v2:${slug}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [conceptNames, setConceptNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Load concept names for tutor context
    try {
      const raw = localStorage.getItem(conceptsKey);
      if (raw) {
        const { data } = JSON.parse(raw);
        if (Array.isArray(data)) {
          setConceptNames(data.map((c: { name: string }) => c.name).filter(Boolean));
        }
      }
    } catch { /* no concepts */ }

    // Load previous session
    try {
      const sessionRaw = localStorage.getItem(sessionKey);
      if (sessionRaw) {
        const { messages: saved } = JSON.parse(sessionRaw);
        if (Array.isArray(saved) && saved.length > 0) {
          setMessages(saved);
        }
      }
    } catch { /* no session */ }

    setLoading(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Auto-scroll on new content
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamText]);

  // Persist session
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(sessionKey, JSON.stringify({ messages, ts: Date.now() }));
    }
  }, [messages, sessionKey]);

  async function callTutor(history: Message[]) {
    setStreaming(true);
    setStreamText("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: label, conceptNames, history }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error(`API ${res.status}`);

      const reader = res.body!.getReader();
      const dec = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value);
        setStreamText(full);
      }

      setMessages(prev => [...prev, { role: "assistant", content: full }]);
      setStreamText("");
    } catch (e: unknown) {
      if ((e as Error)?.name !== "AbortError") setStreamText("");
    } finally {
      setStreaming(false);
    }
  }

  function startSession() {
    if (streaming) return;
    const opening: Message[] = [
      { role: "user", content: `I want to study "${label}" with you as my Socratic tutor. Please begin.` },
    ];
    callTutor(opening);
  }

  function sendMessage() {
    if (!input.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: input.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    callTutor(updated);
  }

  function clearSession() {
    abortRef.current?.abort();
    localStorage.removeItem(sessionKey);
    setMessages([]);
    setStreamText("");
    setStreaming(false);
  }

  if (loading) {
    return <div style={{ color: "var(--text-muted)", padding: 40 }}>Loading session…</div>;
  }

  // Welcome screen (no messages yet)
  if (messages.length === 0 && !streaming && !streamText) {
    return (
      <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center", paddingTop: 64 }}>
        <div style={{ fontSize: 52, marginBottom: 20 }}>🎓</div>
        <h2 style={{ fontFamily: "Georgia, serif", color: "var(--accent)", fontSize: 26, marginBottom: 12 }}>
          Socratic Tutor
        </h2>
        <p style={{ color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 8, maxWidth: 500, margin: "0 auto 12px" }}>
          Your tutor never gives answers directly. It asks probing questions that guide you to discover insights yourself — the method Socrates used to teach in ancient Athens.
        </p>
        <p style={{ color: "var(--text-muted)", fontSize: 13, marginBottom: 36 }}>
          {conceptNames.length > 0
            ? `${conceptNames.length} concepts from your study session are loaded as context.`
            : "Visit the Concepts tab first to give your tutor more context about " + label + "."}
        </p>
        <button
          onClick={startSession}
          style={{
            background: "var(--accent)", color: "#0d1117",
            border: "none", borderRadius: 8, padding: "14px 36px",
            fontFamily: "Georgia, serif", fontSize: 16, cursor: "pointer", fontWeight: "bold",
            transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          Begin Socratic Session →
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", display: "flex", flexDirection: "column", height: "calc(100vh - 180px)" }}>
      {/* Session header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent)", fontFamily: "Georgia, serif", fontSize: 15 }}>🎓 Socratic Tutor</span>
          <span style={{ color: "var(--text-muted)", fontSize: 11 }}>
            {Math.floor(messages.length / 2)} exchange{messages.length !== 2 ? "s" : ""}
          </span>
        </div>
        <button
          onClick={clearSession}
          style={{
            color: "var(--text-muted)", background: "none", border: "1px solid var(--border)",
            borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontFamily: "Georgia, serif",
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = "var(--accent)")}
          onMouseLeave={e => (e.currentTarget.style.borderColor = "var(--border)")}
        >
          New Session
        </button>
      </div>

      {/* Message list */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4, paddingBottom: 4 }}>
        {messages.map((msg, i) => (
          <div key={i} style={{ display: "flex", justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
            <div style={{
              maxWidth: "82%",
              padding: "12px 16px",
              borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
              background: msg.role === "user" ? "var(--accent-glow)" : "var(--bg-card)",
              border: `1px solid ${msg.role === "user" ? "var(--accent-dim)" : "var(--border)"}`,
              fontFamily: "Georgia, serif",
              fontSize: 14,
              lineHeight: 1.75,
              color: "var(--text-primary)",
              whiteSpace: "pre-wrap",
            }}>
              {msg.role === "assistant" && (
                <div style={{ color: "var(--accent)", fontSize: 10, marginBottom: 6, fontWeight: "bold", letterSpacing: 1.5 }}>
                  TUTOR
                </div>
              )}
              {msg.content}
            </div>
          </div>
        ))}

        {/* Streaming bubble */}
        {streamText && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              maxWidth: "82%", padding: "12px 16px",
              borderRadius: "4px 16px 16px 16px",
              background: "var(--bg-card)", border: "1px solid var(--accent-dim)",
              fontFamily: "Georgia, serif", fontSize: 14, lineHeight: 1.75,
              color: "var(--text-primary)", whiteSpace: "pre-wrap",
            }}>
              <div style={{ color: "var(--accent)", fontSize: 10, marginBottom: 6, fontWeight: "bold", letterSpacing: 1.5 }}>TUTOR</div>
              {streamText}
              <span style={{ color: "var(--accent)" }}>▌</span>
            </div>
          </div>
        )}

        {/* Thinking indicator */}
        {streaming && !streamText && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 16px", borderRadius: "4px 16px 16px 16px",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              color: "var(--text-muted)", fontFamily: "Georgia, serif", fontSize: 13,
            }}>
              Thinking…
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div style={{ marginTop: 14, flexShrink: 0 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
            }}
            placeholder="Answer the question, share your thinking, or ask to change topic…"
            disabled={streaming}
            rows={3}
            style={{
              flex: 1,
              background: "var(--bg-card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "10px 14px",
              color: "var(--text-primary)",
              fontFamily: "Georgia, serif",
              fontSize: 14,
              resize: "none",
              outline: "none",
              lineHeight: 1.6,
              opacity: streaming ? 0.6 : 1,
            }}
            onFocus={e => (e.target.style.borderColor = "var(--accent)")}
            onBlur={e => (e.target.style.borderColor = "var(--border)")}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
            style={{
              background: input.trim() && !streaming ? "var(--accent)" : "var(--bg-card)",
              color: input.trim() && !streaming ? "#0d1117" : "var(--text-muted)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              padding: "0 22px",
              fontFamily: "Georgia, serif",
              fontSize: 20,
              cursor: input.trim() && !streaming ? "pointer" : "not-allowed",
              transition: "background 0.15s, color 0.15s",
            }}
          >
            →
          </button>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 6, textAlign: "center" }}>
          Enter to send · Shift+Enter for new line · Session auto-saved
        </p>
      </div>
    </div>
  );
}

export default function TutorPage() {
  return (
    <Suspense fallback={<div style={{ color: "var(--text-muted)", padding: 40 }}>Loading…</div>}>
      <TutorInner />
    </Suspense>
  );
}
