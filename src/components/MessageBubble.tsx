"use client";

import { parseSegments } from "@/lib/parseMessage";

export default function MessageBubble({
  role,
  content,
}: {
  role: "user" | "assistant";
  content: string;
}) {
  const isUser = role === "user";
  const segments = parseSegments(content);

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
          isUser
            ? "bg-[var(--dark)] text-[var(--lime)]"
            : "border border-[var(--border)] bg-[var(--background)] text-[var(--ink)]"
        }`}
      >
        {segments.map((seg, i) =>
          seg.type === "text" ? (
            <p key={i} className="whitespace-pre-wrap">
              {seg.content.trim()}
            </p>
          ) : (
            <pre
              key={i}
              className="my-2 overflow-x-auto rounded-lg bg-[var(--dark)] p-3 font-mono text-xs text-[var(--lime)]"
            >
              <code>{seg.content}</code>
            </pre>
          )
        )}
        {content.trim() === "" && (
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--muted)]" />
        )}
      </div>
    </div>
  );
}
