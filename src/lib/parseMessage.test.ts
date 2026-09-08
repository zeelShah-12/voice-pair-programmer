import { describe, expect, it } from "vitest";
import { lastCodeBlock, parseSegments, speakableText } from "./parseMessage";

describe("parseSegments", () => {
  it("splits plain text with no code fences into a single text segment", () => {
    expect(parseSegments("just some text")).toEqual([
      { type: "text", content: "just some text" },
    ]);
  });

  it("extracts a fenced code block with its language tag", () => {
    const raw = "Here you go:\n```python\nprint('hi')\n```\nThat's it.";
    const segments = parseSegments(raw);
    expect(segments).toEqual([
      { type: "text", content: "Here you go:\n" },
      { type: "code", language: "python", content: "print('hi')\n" },
      { type: "text", content: "\nThat's it." },
    ]);
  });

  it("defaults to language 'text' when no language tag is given", () => {
    const segments = parseSegments("```\nplain\n```");
    expect(segments).toEqual([{ type: "code", language: "text", content: "plain\n" }]);
  });

  it("handles an unterminated fence while streaming (no closing ``` yet)", () => {
    const segments = parseSegments("```python\ndef f():\n    pass");
    expect(segments).toEqual([{ type: "code", language: "python", content: "def f():\n    pass" }]);
  });

  it("drops whitespace-only text segments between code blocks", () => {
    const raw = "```js\na\n```\n\n```js\nb\n```";
    const segments = parseSegments(raw);
    expect(segments.every((s) => s.type === "code")).toBe(true);
    expect(segments).toHaveLength(2);
  });
});

describe("lastCodeBlock", () => {
  it("returns null when the message has no code", () => {
    expect(lastCodeBlock("no code here")).toBeNull();
  });

  it("returns the most recent code block when a message has several", () => {
    const raw = "```python\nfirst()\n```\nthen\n```python\nsecond()\n```";
    expect(lastCodeBlock(raw)).toEqual({ type: "code", language: "python", content: "second()\n" });
  });
});

describe("speakableText", () => {
  it("replaces code fences with a spoken placeholder instead of reading code aloud", () => {
    const raw = "Try this:\n```python\nprint(1)\n```\nDone.";
    expect(speakableText(raw)).toContain("Here is the code, shown on screen.");
    expect(speakableText(raw)).not.toContain("print(1)");
  });

  it("strips markdown punctuation that would otherwise be read out loud", () => {
    expect(speakableText("**bold** _italic_ `code` #heading > quote")).toBe(
      "bold italic code heading quote"
    );
  });

  it("collapses blank lines and extra whitespace into single spaces/periods", () => {
    expect(speakableText("line one\n\n\nline two")).toBe("line one. line two");
  });
});
