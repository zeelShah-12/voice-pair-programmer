import { NextRequest, NextResponse } from "next/server";
import { GROQ_API_BASE, TRANSCRIBE_MODEL, requireGroqKey } from "@/lib/groq";

export async function POST(req: NextRequest) {
  let apiKey: string;
  try {
    apiKey = requireGroqKey();
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Missing API key" },
      { status: 500 }
    );
  }

  const incoming = await req.formData();
  const audio = incoming.get("audio");
  if (!audio || !(audio instanceof Blob)) {
    return NextResponse.json({ error: "No audio file provided" }, { status: 400 });
  }

  const outgoing = new FormData();
  outgoing.set("file", audio, "speech.webm");
  outgoing.set("model", TRANSCRIBE_MODEL);
  outgoing.set("response_format", "json");

  const res = await fetch(`${GROQ_API_BASE}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: outgoing,
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json(
      { error: `Groq transcription failed: ${text}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as { text?: string };
  return NextResponse.json({ text: data.text ?? "" });
}
