"use client";
import { useState, useEffect } from "react";

type Status = "unread" | "read" | "understood" | "mastered";

interface Props {
  itemId: string;
}

const STATUSES: { value: Status; label: string; color: string; icon: string }[] = [
  { value: "unread", label: "Not started", color: "var(--text-muted)", icon: "·" },
  { value: "read", label: "Read", color: "var(--blue)", icon: "○" },
  { value: "understood", label: "Understood", color: "var(--accent)", icon: "◆" },
  { value: "mastered", label: "Mastered", color: "var(--green)", icon: "✓" },
];

export default function ProgressTracker({ itemId }: Props) {
  const key = `progress:${itemId}`;
  const [current, setCurrent] = useState<Status>("unread");

  useEffect(() => {
    const saved = localStorage.getItem(key) as Status | null;
    if (saved) setCurrent(saved);
  }, [key]);

  function cycle(e: React.MouseEvent) {
    e.stopPropagation();
    const idx = STATUSES.findIndex(s => s.value === current);
    const next = STATUSES[(idx + 1) % STATUSES.length].value;
    setCurrent(next);
    localStorage.setItem(key, next);
  }

  const statusObj = STATUSES.find(s => s.value === current)!;

  return (
    <button
      onClick={cycle}
      title={`Progress: ${statusObj.label} — click to advance`}
      className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-all"
      style={{
        background: 'var(--bg-secondary)',
        border: `1px solid ${statusObj.color}`,
        color: statusObj.color,
        fontFamily: 'Georgia, serif',
      }}
    >
      <span>{statusObj.icon}</span>
      <span>{statusObj.label}</span>
    </button>
  );
}
