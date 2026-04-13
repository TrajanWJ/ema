/**
 * Web Audio API microphone capture module.
 * Captures audio from the user's microphone, processes it into chunks,
 * and sends PCM data via the voice store's WebSocket channel.
 *
 * Also handles TTS audio playback from incoming chunks.
 */

type AudioChunkCallback = (base64Chunk: string) => void;
type AudioLevelCallback = (level: number) => void;
type SpeechCallback = () => void;

export interface VadConfig {
  /** RMS level threshold below which audio is considered silence (0-1). Default 0.02 */
  silenceThreshold: number;
  /** Seconds of silence before utterance is considered ended. Default 1.5 */
  silenceDurationSec: number;
  /** Minimum speech duration in seconds to trigger. Default 0.3 */
  minSpeechDurationSec: number;
}

const DEFAULT_VAD: VadConfig = {
  silenceThreshold: 0.02,
  silenceDurationSec: 1.5,
  minSpeechDurationSec: 0.3,
};

interface CaptureState {
  stream: MediaStream | null;
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  recorder: MediaRecorder | null;
  rafId: number | null;
  levelCallback: AudioLevelCallback | null;
  // VAD state
  vadConfig: VadConfig;
  vadEnabled: boolean;
  isSpeech: boolean;
  speechStartTime: number;
  silenceStartTime: number;
  onSpeechStart: SpeechCallback | null;
  onSpeechEnd: SpeechCallback | null;
}

const state: CaptureState = {
  stream: null,
  audioContext: null,
  analyser: null,
  recorder: null,
  rafId: null,
  levelCallback: null,
  vadConfig: { ...DEFAULT_VAD },
  vadEnabled: false,
  isSpeech: false,
  speechStartTime: 0,
  silenceStartTime: 0,
  onSpeechStart: null,
  onSpeechEnd: null,
};

/**
 * Request microphone access and set up the audio processing pipeline.
 */
export async function initCapture(
  onChunk: AudioChunkCallback,
  onLevel: AudioLevelCallback,
): Promise<void> {
  if (state.stream) return; // Already initialized

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      sampleRate: 16000,
    },
  });

  const audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 256;
  analyser.smoothingTimeConstant = 0.8;
  source.connect(analyser);

  // Set up MediaRecorder for chunk-based capture
  const recorder = new MediaRecorder(stream, {
    mimeType: getSupportedMimeType(),
  });

  recorder.ondataavailable = async (event) => {
    if (event.data.size > 0) {
      const buffer = await event.data.arrayBuffer();
      const base64 = arrayBufferToBase64(buffer);
      onChunk(base64);
    }
  };

  state.stream = stream;
  state.audioContext = audioContext;
  state.analyser = analyser;
  state.recorder = recorder;
  state.levelCallback = onLevel;

  // Start the audio level monitoring loop
  startLevelMonitoring();
}

/**
 * Start recording audio from the microphone.
 * Sends audio chunks at the specified interval.
 */
export function startRecording(chunkIntervalMs = 250): void {
  if (!state.recorder || state.recorder.state === "recording") return;
  state.recorder.start(chunkIntervalMs);
}

/**
 * Stop recording audio from the microphone.
 */
export function stopRecording(): void {
  if (!state.recorder || state.recorder.state !== "recording") return;
  state.recorder.stop();
}

/**
 * Check if currently recording.
 */
export function isRecording(): boolean {
  return state.recorder?.state === "recording";
}

/**
 * Get the current audio analyser for waveform visualization.
 */
export function getAnalyser(): AnalyserNode | null {
  return state.analyser;
}

/**
 * Enable Voice Activity Detection (VAD).
 * When enabled, monitors audio levels and fires callbacks when speech starts/stops.
 */
export function enableVad(
  config: Partial<VadConfig>,
  onSpeechStart: SpeechCallback,
  onSpeechEnd: SpeechCallback,
): void {
  state.vadConfig = { ...DEFAULT_VAD, ...config };
  state.vadEnabled = true;
  state.onSpeechStart = onSpeechStart;
  state.onSpeechEnd = onSpeechEnd;
  state.isSpeech = false;
  state.silenceStartTime = 0;
  state.speechStartTime = 0;
}

/**
 * Disable Voice Activity Detection.
 */
export function disableVad(): void {
  state.vadEnabled = false;
  state.onSpeechStart = null;
  state.onSpeechEnd = null;
}

/**
 * Update VAD configuration without toggling it off.
 */
export function updateVadConfig(config: Partial<VadConfig>): void {
  state.vadConfig = { ...state.vadConfig, ...config };
}

/**
 * Get raw Float32Array PCM samples from the current audio stream.
 * Useful for feeding directly to Whisper.
 */
export function getRawAudioData(): Float32Array | null {
  if (!state.audioContext || !state.analyser) return null;
  const data = new Float32Array(state.analyser.fftSize);
  state.analyser.getFloatTimeDomainData(data);
  return data;
}

/**
 * Clean up all audio resources.
 */
export function destroyCapture(): void {
  if (state.rafId !== null) {
    cancelAnimationFrame(state.rafId);
    state.rafId = null;
  }

  if (state.recorder && state.recorder.state === "recording") {
    state.recorder.stop();
  }

  state.stream?.getTracks().forEach((track) => track.stop());
  state.audioContext?.close();

  state.stream = null;
  state.audioContext = null;
  state.analyser = null;
  state.recorder = null;
  state.levelCallback = null;
}

// ── TTS Playback ──

let ttsContext: AudioContext | null = null;
const ttsChunks: ArrayBuffer[] = [];
let ttsPlaying = false;

/**
 * Initialize TTS audio playback.
 * Listens for ema:tts-chunk custom events from the voice store.
 */
export function initTtsPlayback(): () => void {
  const handler = async (event: Event) => {
    const detail = (event as CustomEvent<{ data: string; final: boolean }>).detail;
    const buffer = base64ToArrayBuffer(detail.data);
    ttsChunks.push(buffer);

    if (!ttsPlaying) {
      ttsPlaying = true;
      await playTtsQueue();
    }
  };

  window.addEventListener("ema:tts-chunk", handler);
  return () => window.removeEventListener("ema:tts-chunk", handler);
}

async function playTtsQueue(): Promise<void> {
  if (!ttsContext) {
    ttsContext = new AudioContext();
  }

  while (ttsChunks.length > 0) {
    const chunk = ttsChunks.shift();
    if (!chunk) break;

    try {
      const audioBuffer = await ttsContext.decodeAudioData(chunk.slice(0));
      const source = ttsContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ttsContext.destination);
      source.start();

      // Wait for the chunk to finish playing
      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });
    } catch {
      // Individual chunk decode failure — skip and continue
      console.warn("Failed to decode TTS audio chunk");
    }
  }

  ttsPlaying = false;
}

// ── Level Monitoring ──

function startLevelMonitoring(): void {
  if (!state.analyser || !state.levelCallback) return;

  const dataArray = new Uint8Array(state.analyser.frequencyBinCount);

  function tick() {
    if (!state.analyser || !state.levelCallback) return;

    state.analyser.getByteFrequencyData(dataArray);

    // Calculate RMS level normalized to 0-1
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = dataArray[i] / 255;
      sum += normalized * normalized;
    }
    const rms = Math.sqrt(sum / dataArray.length);
    state.levelCallback(rms);

    // Voice Activity Detection
    if (state.vadEnabled) {
      const now = performance.now() / 1000;
      const { silenceThreshold, silenceDurationSec, minSpeechDurationSec } = state.vadConfig;

      if (rms > silenceThreshold) {
        // Audio above threshold — speech detected
        state.silenceStartTime = 0;
        if (!state.isSpeech) {
          state.isSpeech = true;
          state.speechStartTime = now;
          state.onSpeechStart?.();
        }
      } else if (state.isSpeech) {
        // Audio below threshold while in speech — potential silence
        if (state.silenceStartTime === 0) {
          state.silenceStartTime = now;
        }
        const silenceDuration = now - state.silenceStartTime;
        const speechDuration = now - state.speechStartTime;
        if (silenceDuration >= silenceDurationSec && speechDuration >= minSpeechDurationSec) {
          state.isSpeech = false;
          state.silenceStartTime = 0;
          state.onSpeechEnd?.();
        }
      }
    }

    state.rafId = requestAnimationFrame(tick);
  }

  tick();
}

// ── Utilities ──

function getSupportedMimeType(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "audio/webm";
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
