# Intent

Session detection already built: SessionMonitor (polls /proc), SessionWatcher (scans JSONL), SessionParser, SessionHarvester, SessionOrchestrator (spawns+controls). Missing: Cursor/Aider/Continue.dev detection. Schema ready for expansion (source_type enum). Key gap: switch from polling to inotify/fswatch for real-time detection.
