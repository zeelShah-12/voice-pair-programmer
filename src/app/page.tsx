"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import MessageBubble from "@/components/MessageBubble";
import CodePanel from "@/components/CodePanel";
import { lastCodeBlock, speakableText } from "@/lib/parseMessage";

type ChatMessage = { role: "user" | "assistant"; content: string };
type Status = "idle" | "recording" | "transcribing" | "thinking" | "speaking";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [textInput, setTextInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const latestCode = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "assistant") {
        const block = lastCodeBlock(messages[i].content);
        if (block) return block;
      }
    }
    return null;
  }, [messages]);

  function speak(text: string) {
    if (!ttsEnabled || !text.trim()) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(speakableText(text));
    utterance.rate = 1.02;
    setStatus("speaking");
    utterance.onend = () => setStatus("idle");
    utterance.onerror = () => setStatus("idle");
    window.speechSynthesis.speak(utterance);
  }

  async function sendMessage(userText: string) {
    if (!userText.trim()) return;
    setError(null);
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userText }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setStatus("thinking");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({ error: "Chat request failed" }));
        throw new Error(data.error || "Chat request failed");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: full };
          return copy;
        });
      }

      speak(full);
      if (!ttsEnabled) setStatus("idle");
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStatus("idle");
    } finally {
      abortRef.current = null;
    }
  }

  function stopGenerating() {
    abortRef.current?.abort();
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    setStatus("idle");
  }

  function newChat() {
    stopGenerating();
    mediaRecorderRef.current?.stop();
    setMessages([]);
    setError(null);
    setTextInput("");
  }

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await transcribeAndSend(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch {
      setError("Couldn't access the microphone. Check browser permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
  }

  async function transcribeAndSend(blob: Blob) {
    setStatus("transcribing");
    try {
      const form = new FormData();
      form.set("audio", blob, "speech.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      if (!data.text?.trim()) {
        setStatus("idle");
        setError("Didn't catch that — try again.");
        return;
      }
      await sendMessage(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Transcription failed");
      setStatus("idle");
    }
  }

  function handleMicClick() {
    if (status === "recording") stopRecording();
    else if (status === "idle") startRecording();
  }

  function handleTextSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!textInput.trim() || status !== "idle") return;
    const text = textInput;
    setTextInput("");
    sendMessage(text);
  }

  const statusLabel: Record<Status, string> = {
    idle: "Tap the mic and describe your problem",
    recording: "Listening…",
    transcribing: "Transcribing…",
    thinking: "Thinking…",
    speaking: "Speaking…",
  };

  const started = messages.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] text-[var(--ink)]">
      <header className="flex items-center justify-between px-6 py-5 md:px-10">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--dark)] text-xs text-[var(--lime)]">
            &gt;_
          </span>
          <span className="text-sm font-semibold tracking-tight">Voicecode</span>
        </div>
        <div className="flex items-center gap-2">
          {(status === "thinking" || status === "speaking") && (
            <button
              onClick={stopGenerating}
              className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--lime-deep)]"
            >
              Stop
            </button>
          )}
          {started && (
            <button
              onClick={newChat}
              className="rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--lime-deep)]"
            >
              New chat
            </button>
          )}
          <label className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1.5 text-xs text-[var(--muted)]">
            <input
              type="checkbox"
              checked={ttsEnabled}
              onChange={(e) => setTtsEnabled(e.target.checked)}
              className="accent-[var(--lime-deep)]"
            />
            Speak responses
          </label>
        </div>
      </header>

      {!started && (
        <section className="px-6 pb-10 pt-6 text-center md:px-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--panel)] px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--lime-deep)]" /> Voice-first coding
          </span>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-balance md:text-5xl">
            Say the problem.<br />Watch the code write itself.
          </h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-[var(--muted)]">
            Describe what you need out loud the way you&apos;d explain it to a
            teammate. It transcribes, thinks, writes the code, and reads the
            reasoning back to you.
          </p>
        </section>
      )}

      <main className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-4 overflow-hidden px-4 pb-8 md:grid-cols-2 md:px-10">
        <div className="flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <p className="text-sm text-[var(--muted)]">
                Try: &ldquo;I need a function that takes a list and removes duplicates,
                but keeps the order.&rdquo;
              </p>
            )}
            {messages.map((m, i) => (
              <MessageBubble key={i} role={m.role} content={m.content} />
            ))}
          </div>

          {error && (
            <div className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="border-t border-[var(--border)] p-4">
            <div className="mb-3 flex items-center justify-center gap-3">
              <button
                onClick={handleMicClick}
                disabled={status !== "idle" && status !== "recording"}
                className={`flex h-16 w-16 items-center justify-center rounded-full text-2xl transition ${
                  status === "recording"
                    ? "animate-pulse bg-red-500 text-white"
                    : "bg-[var(--dark)] text-[var(--lime)] hover:bg-black disabled:opacity-40"
                }`}
                aria-label="Toggle recording"
              >
                {status === "recording" ? (
                  "■"
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                    <rect x="9" y="2" width="6" height="12" rx="3" />
                    <path d="M5 10v1a7 7 0 0 0 14 0v-1" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                )}
              </button>
            </div>
            <p className="mb-3 text-center text-xs text-[var(--muted)]">{statusLabel[status]}</p>
            <form onSubmit={handleTextSubmit} className="flex gap-2">
              <input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="…or type your problem instead"
                disabled={status !== "idle"}
                className="flex-1 rounded-full border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm outline-none focus:border-[var(--lime-deep)] disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={status !== "idle" || !textInput.trim()}
                className="rounded-full bg-[var(--lime)] px-4 py-2 text-sm font-medium text-[var(--dark)] hover:bg-[var(--lime-deep)] disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        <div className="min-h-[300px] overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel)] shadow-sm">
          <CodePanel language={latestCode?.language ?? ""} content={latestCode?.content ?? ""} />
        </div>
      </main>

      {!started && (
        <section className="border-t border-[var(--border)] bg-[var(--dark)] px-6 py-10 text-[var(--background)] md:px-10">
          <p className="mb-6 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--lime)]">
            &bull; How it works
          </p>
          <div className="mx-auto grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { step: "1", title: "Talk", desc: "Tap the mic and describe the problem like you would to a teammate." },
              { step: "2", title: "Transcribe & think", desc: "Groq Whisper transcribes it, then the model reasons and writes real code." },
              { step: "3", title: "Ship", desc: "Code streams into the panel, the explanation is read back out loud." },
            ].map((s) => (
              <div key={s.step} className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <span className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--lime)] text-xs font-bold text-[var(--dark)]">
                  {s.step}
                </span>
                <h3 className="mb-1 text-sm font-semibold">{s.title}</h3>
                <p className="text-xs leading-relaxed text-white/60">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
