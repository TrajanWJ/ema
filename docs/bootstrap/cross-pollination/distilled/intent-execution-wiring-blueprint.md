# Distilled: Intent Execution Wiring Blueprint

Source: /home/trajan/vault/wiki/Architecture/Intent-Execution-Wiring-Blueprint.md
Target subsystem: intent engine, execution linkage, workspace orchestration
Import posture: durable-bootstrap

## Top takeaways
- EMA needs explicit intent-to-execution lineage rather than loose task association.
- Intent state should shape execution routing, status transitions, and operator visibility.
- This source should influence packet fields for intent_id, execution_id, and lineage display.
