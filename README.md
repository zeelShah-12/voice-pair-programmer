<div align="center">

# Voice Pair Programmer

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&duration=2600&pause=900&color=6699FF&center=true&vCenter=true&width=560&lines=Say+the+problem.+Watch+the+code+write+itself.;Groq+Whisper+%2B+streaming+chat+%2B+TTS;Talk+like+you+would+to+a+teammate)](https://git.io/typing-svg)

[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tests](https://img.shields.io/badge/tests-10%20passing-34d399)](./src/lib/parseMessage.test.ts)
[![Groq](https://img.shields.io/badge/Voice%20%2B%20LLM-Groq-F55036)](https://console.groq.com/)

</div>

Describe a coding problem out loud, the way you'd explain it to a teammate sitting next to
you. It transcribes what you said, thinks through it, writes real code, and reads the
explanation back to you — a voice-first pair-programming session instead of a typing one.

## Demo

A real run: type (or speak) a problem, the model asks a clarifying question if something's
ambiguous — it doesn't guess — then once it has enough, writes working code with a short
spoken-style explanation, streamed into the code panel on the right.

![Demo](.github/assets/demo.gif)

<details>
<summary>Full page screenshot</summary>

![Screenshot](.github/assets/screenshot.png)

</details>

## How it works

```
mic press  ──►  MediaRecorder captures audio
                        │
                        ▼
              Groq Whisper (whisper-large-v3-turbo) transcribes it
                        │
                        ▼
              Groq chat model reasons about the problem —
              asks ONE clarifying question if something's missing,
              otherwise writes the code
                        │
                        ▼
              Code streams into the right-hand panel;
              the spoken-style explanation is read back
              with the browser's SpeechSynthesis API
```

- **Speech in**: `MediaRecorder` + `getUserMedia` capture the mic, sent to `/api/transcribe`
  which forwards to Groq's Whisper endpoint. No client-side speech recognition — the actual
  audio is transcribed server-side.
- **Speech out**: the browser's native `SpeechSynthesis` API reads the explanation back
  (toggleable via "Speak responses") — no extra TTS service or API cost.
- **Text fallback**: typing works identically to speaking — same `/api/chat` pipeline, useful
  when you'd rather not use a mic (or for this demo, since it's screenshot-friendly).
- **Model resilience**: `src/lib/groq.ts` defines a primary chat model and a separate
  fallback model with its own daily quota, so a 429 on the primary doesn't end the session.

## Setup

```bash
npm install
cp .env.local.example .env.local   # add your GROQ_API_KEY
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

Unit tests cover `parseMessage.ts` — the logic that splits a model response into the
fenced code block (routed to the code panel) and the surrounding spoken-style explanation
(routed to the chat + TTS).

## Project structure

```
src/app/
  page.tsx                main UI: chat pane, code panel, mic/text input
  api/chat/route.ts        Groq chat completion (system prompt: ask-then-code)
  api/transcribe/route.ts  Groq Whisper transcription endpoint
src/components/
  CodePanel.tsx            syntax-highlighted code panel with copy button
  MessageBubble.tsx         chat message rendering
src/lib/
  groq.ts                   Groq API base, model config, API key handling
  parseMessage.ts            splits a response into code block + explanation
  parseMessage.test.ts        vitest suite for the above
```
