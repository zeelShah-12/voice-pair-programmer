import { NextRequest, NextResponse } from "next/server";
import { CHAT_FALLBACK_MODEL, CHAT_MODEL, GROQ_API_BASE, SYSTEM_PROMPT, requireGroqKey } from "@/lib/groq";

type ChatMessage = { role: "user" | "assistant"; content: string };

async function callGroqChat(apiKey: string, model: string, messages: ChatMessage[]) {
  return fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      stream: true,
      temperature: 0.4,
      messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
    }),
  });
}

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

  const { messages } = (await req.json()) as { messages: ChatMessage[] };
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }

  let groqRes = await callGroqChat(apiKey, CHAT_MODEL, messages);

  // 429 on the primary model -- retry once against a model with a separate
  // quota on the same account instead of failing the whole request.
  if (groqRes.status === 429 && CHAT_FALLBACK_MODEL !== CHAT_MODEL) {
    groqRes = await callGroqChat(apiKey, CHAT_FALLBACK_MODEL, messages);
  }

  if (!groqRes.ok || !groqRes.body) {
    const text = await groqRes.text();
    return NextResponse.json(
      { error: `Groq chat failed: ${text}` },
      { status: groqRes.status || 500 }
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = groqRes.body!.getReader();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(payload);
            const delta: string | undefined = json.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            // ignore malformed SSE fragments
          }
        }
      }
      controller.close();
    },
  });

  return new NextResponse(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
