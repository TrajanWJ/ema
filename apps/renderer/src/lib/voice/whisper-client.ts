import { pipeline, type Pipeline } from "@xenova/transformers";

export type WhisperResult = {
  text: string;
  confidence: number;
  language: string;
};

type ModelSize = "tiny" | "base";

const MODEL_MAP: Record<ModelSize, string> = {
  tiny: "Xenova/whisper-tiny.en",
  base: "Xenova/whisper-base.en",
} as const;

let transcriber: Pipeline | null = null;
let loaded = false;
let loading: Promise<void> | null = null;

export function isModelLoaded(): boolean {
  return loaded;
}

export async function loadModel(modelSize: ModelSize = "tiny"): Promise<void> {
  if (loaded) return;
  if (loading) return loading;

  loading = (async () => {
    try {
      transcriber = await pipeline(
        "automatic-speech-recognition",
        MODEL_MAP[modelSize],
      );
      loaded = true;
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Unknown error loading model";
      console.error("[whisper-client] Failed to load model:", message);
      transcriber = null;
      loaded = false;
      throw new Error(`Whisper model load failed: ${message}`);
    } finally {
      loading = null;
    }
  })();

  return loading;
}

const EMPTY_RESULT: WhisperResult = {
  text: "",
  confidence: 0,
  language: "en",
};

export async function transcribe(
  audioData: Float32Array,
  modelSize: ModelSize = "tiny",
): Promise<WhisperResult> {
  try {
    if (!loaded || !transcriber) {
      await loadModel(modelSize);
    }

    if (!transcriber) {
      return EMPTY_RESULT;
    }

    const result = (await transcriber(audioData, {
      return_timestamps: false,
    })) as { text?: string };

    const text = (result.text ?? "").trim();

    return {
      text,
      confidence: text.length > 0 ? 0.85 : 0,
      language: "en",
    };
  } catch (err: unknown) {
    const message =
      err instanceof Error ? err.message : "Unknown transcription error";
    console.error("[whisper-client] Transcription failed:", message);
    return EMPTY_RESULT;
  }
}
