# Intent

BUG: Proposal pipeline generates rich content in generation_log but never populates the proposal record fields (title/body/summary stay null). All 16 queued proposals are empty shells. The Generator output is a valid JSON with title, summary, body, risks, benefits — but the Generator stage creates the proposal BEFORE calling Claude, then never updates it with the result. Fix: Generator should update_proposal after successful Claude response.
