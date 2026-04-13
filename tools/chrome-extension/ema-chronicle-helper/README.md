# EMA Chronicle Helper

Helper Chrome extension for exporting browser conversations into Chronicle.

## Current scope

- supports ChatGPT pages on `chatgpt.com` and `chat.openai.com`
- supports Claude pages on `claude.ai`
- captures the current page conversation into a Chronicle-compatible JSON bundle
- can discover sidebar conversation history and bulk-harvest past sessions into Chronicle
- keeps saved account labels per source so imports can be tagged by source account
- prompts login by opening the relevant login page when harvest starts without an authenticated source tab
- can either:
  - download the bundle to disk
  - send it directly to `POST /api/chronicle/import`
  - optionally trigger `POST /api/chronicle/sessions/:id/extract`

## Load unpacked

1. Open `chrome://extensions`
2. Enable Developer Mode
3. Choose `Load unpacked`
4. Select this directory:
   - `tools/chrome-extension/ema-chronicle-helper`

## Notes

- This is intentionally a helper, not a polished store-ready extension.
- The DOM extraction heuristics are still heuristic and will need refinement as ChatGPT and Claude layouts drift.
- The extension uses Chronicle’s existing import surface rather than inventing a parallel browser-ingestion backend.
- Captured bundles include the current page HTML as an artifact so Chronicle keeps a raw provenance snapshot even when message parsing is incomplete.
- Multiple accounts are supported as saved account labels and per-harvest source tagging. Running two accounts at the same time still depends on separate browser profiles or swapping the authenticated session in the source tab.
