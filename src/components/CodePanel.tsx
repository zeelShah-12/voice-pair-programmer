"use client";

import { useState } from "react";

export default function CodePanel({
  language,
  content,
}: {
  language: string;
  content: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!content) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-[var(--muted)]">
        Code will show up here once the agent writes some.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[var(--dark)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <span className="text-xs font-mono uppercase tracking-wide text-[var(--lime)]">
          {language}
        </span>
        <button
          onClick={copy}
          className="rounded-full bg-white/10 px-3 py-1 text-xs text-white hover:bg-white/20"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-white whitespace-pre">{content}</code>
      </pre>
    </div>
  );
}
