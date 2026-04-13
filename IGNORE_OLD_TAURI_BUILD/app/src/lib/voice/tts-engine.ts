export type TtsState = "idle" | "speaking" | "paused";

type StateChangeCallback = (state: TtsState) => void;

let currentVoice: SpeechSynthesisVoice | null = null;
let currentRate = 1.0;
let currentState: TtsState = "idle";
let amplitude = 0;

const queue: string[] = [];
const subscribers = new Set<StateChangeCallback>();

function getSynth(): SpeechSynthesis | null {
  if (typeof window === "undefined") return null;
  return window.speechSynthesis ?? null;
}

function setState(next: TtsState): void {
  if (next === currentState) return;
  currentState = next;
  for (const cb of subscribers) {
    try {
      cb(next);
    } catch {
      // subscriber threw — ignore
    }
  }
}

function scoreVoice(voice: SpeechSynthesisVoice): number {
  let score = 0;
  const lang = voice.lang.toLowerCase();
  const name = voice.name.toLowerCase();

  if (!lang.startsWith("en")) return -1;

  if (lang === "en-gb" || lang.startsWith("en-gb")) score += 10;
  if (name.includes("british") || name.includes("daniel")) score += 5;
  if (voice.localService) score += 3;
  if (voice.default) score += 1;

  return score;
}

function pickBestVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const english = voices.filter((v) => scoreVoice(v) >= 0);
  if (english.length === 0) return voices[0] ?? null;

  english.sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return english[0] ?? null;
}

function initVoice(): void {
  const synth = getSynth();
  if (!synth) return;

  const voices = synth.getVoices();
  if (voices.length > 0 && !currentVoice) {
    currentVoice = pickBestVoice(voices);
  }

  // Chrome loads voices async
  synth.onvoiceschanged = () => {
    if (!currentVoice) {
      currentVoice = pickBestVoice(synth.getVoices());
    }
  };
}

// Auto-init when module loads in browser
initVoice();

function processQueue(): void {
  const synth = getSynth();
  if (!synth || synth.speaking || queue.length === 0) return;

  const text = queue.shift();
  if (!text) return;

  const utterance = new SpeechSynthesisUtterance(text);
  if (currentVoice) utterance.voice = currentVoice;
  utterance.rate = currentRate;

  utterance.onstart = () => {
    amplitude = 0.6;
    setState("speaking");
  };

  utterance.onpause = () => {
    amplitude = 0;
    setState("paused");
  };

  utterance.onresume = () => {
    amplitude = 0.6;
    setState("speaking");
  };

  utterance.onboundary = () => {
    // Approximate amplitude variation on word boundaries
    amplitude = 0.4 + Math.random() * 0.5;
  };

  utterance.onend = () => {
    amplitude = 0;
    if (queue.length > 0) {
      processQueue();
    } else {
      setState("idle");
    }
  };

  utterance.onerror = (ev) => {
    // "interrupted" and "canceled" are expected when stop() is called
    if (ev.error !== "interrupted" && ev.error !== "canceled") {
      console.error("[tts-engine] Speech error:", ev.error);
    }
    amplitude = 0;
    if (queue.length > 0) {
      processQueue();
    } else {
      setState("idle");
    }
  };

  synth.speak(utterance);
}

export function speak(text: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const synth = getSynth();
    if (!synth) {
      reject(new Error("Speech synthesis not available"));
      return;
    }

    // Ensure voices are loaded
    if (!currentVoice) {
      currentVoice = pickBestVoice(synth.getVoices());
    }

    queue.push(text);

    // If not currently speaking, start processing
    if (!synth.speaking) {
      processQueue();
    }

    // Resolve when this specific text finishes.
    // For simplicity, resolve immediately after queuing —
    // callers that need completion can subscribe to state changes.
    resolve();
  });
}

export function stop(): void {
  const synth = getSynth();
  if (!synth) return;

  queue.length = 0;
  synth.cancel();
  amplitude = 0;
  setState("idle");
}

export function isSpeaking(): boolean {
  return currentState === "speaking";
}

export function getVoices(): SpeechSynthesisVoice[] {
  const synth = getSynth();
  if (!synth) return [];
  return synth.getVoices();
}

export function setVoice(voiceName: string): void {
  const synth = getSynth();
  if (!synth) return;

  const match = synth.getVoices().find((v) => v.name === voiceName);
  if (match) {
    currentVoice = match;
  }
}

export function setRate(rate: number): void {
  currentRate = Math.max(0.1, Math.min(10, rate));
}

export function getAmplitude(): number {
  return amplitude;
}

export function getState(): TtsState {
  return currentState;
}

export function onStateChange(cb: StateChangeCallback): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
}
