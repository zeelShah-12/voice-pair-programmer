export type Segment =
  | { type: "text"; content: string }
  | { type: "code"; language: string; content: string };

const CODE_FENCE_RE = /```(\w*)\n([\s\S]*?)(```|$)/g;

export function parseSegments(raw: string): Segment[] {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  CODE_FENCE_RE.lastIndex = 0;
  while ((match = CODE_FENCE_RE.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const text = raw.slice(lastIndex, match.index);
      if (text.trim()) segments.push({ type: "text", content: text });
    }
    segments.push({
      type: "code",
      language: match[1] || "text",
      content: match[2],
    });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    const text = raw.slice(lastIndex);
    if (text.trim()) segments.push({ type: "text", content: text });
  }

  return segments;
}

export function lastCodeBlock(raw: string): { language: string; content: string } | null {
  const segments = parseSegments(raw);
  const codeSegments = segments.filter((s): s is Extract<Segment, { type: "code" }> => s.type === "code");
  return codeSegments.length ? codeSegments[codeSegments.length - 1] : null;
}

export function speakableText(raw: string): string {
  return raw
    .replace(CODE_FENCE_RE, " Here is the code, shown on screen. ")
    .replace(/[`*_#>]/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}
