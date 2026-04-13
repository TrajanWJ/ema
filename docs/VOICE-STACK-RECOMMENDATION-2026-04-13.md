# Voice Stack Recommendation

Date: 2026-04-13

## Decision

For EMA's local-first Jarvis voice path:

- Immediate path in the renderer:
  - STT: local Whisper in the renderer via `@xenova/transformers`
  - TTS: local OS/browser voices via `speechSynthesis`
- Recommended production local runtime:
  - STT: `whisper.cpp`
  - TTS: `Piper`

## Why

`@xenova/transformers` and `speechSynthesis` are already present in the renderer, so they are the fastest way to get a working local voice loop now without waiting on a native daemon.

For a stronger cross-platform local runtime, `whisper.cpp` and `Piper` are the better backend pair:

- `whisper.cpp` is the practical default for offline local STT across macOS, Linux, and Windows.
- `Piper` is the practical default for offline local TTS with predictable latency and no cloud dependency.
- Both are cheap to run locally on CPU, and both can be wrapped as desktop services behind EMA's existing local daemon.

## Follow-up

The current implementation keeps transcription and speech local in the renderer and adds a phone-to-desktop mic relay through the EMA local daemon.

The next upgrade should move the final STT/TTS execution into the services runtime so:

- phone and desktop audio use the same transcription backend
- TTS quality is stable regardless of browser voice inventory
- the voice path keeps working even when the renderer is thinner or partially offline
