# ContextWeave Public Sandbox API — v0.4 / Moss rc.3.30

This contract is for the public portfolio demo only. It must never route into the private Moss database.

## Isolation model

- Run the same Moss recall core in a separate demo process.
- Use a separate SQLite database via `MOSS_DB_PATH`.
- Use a separate Qdrant collection/index identity.
- Seed only synthetic sample memories.
- Visitor-written memories are temporary, session-scoped, capped, and deleted by TTL.
- Do not expose private gateway/admin/bootstrap/sync/read-by-id/timeline routes.

## GET /v1/demo/health

Returns the public sandbox service/version health state. No session token is required.

## POST /v1/demo/session

Creates an opaque temporary visitor session and seeds sample memories.

```json
{"session_id":"demo_opaque_token","expires_at":"2026-10-16T02:00:00Z"}
```

## GET /v1/demo/memories?session_id=...

Returns only the current session's synthetic/sample and visitor memories.

## POST /v1/demo/memories

```json
{"session_id":"demo_opaque_token","content":"我喜欢喝咖啡"}
```

Rules: max 240 chars; max 20 memories/session; server assigns safe demo metadata; visitor cannot set sensitivity/scope/triggers/family/source/internal IDs.

## DELETE /v1/demo/memories/custom

Deletes only visitor-written memories for the session and restores sample memories.

## POST /v1/demo/recall

```json
{"session_id":"demo_opaque_token","query":"今天下午喝什么？"}
```

The backend preserves the raw query, builds a generic trusted `context_envelope`, and invokes Moss Progressive Associative Recall against the isolated demo database. Candidate admission is restricted by the current session allowlist before tiering, and the same allowlist is applied to Qdrant vector queries.

Public response whitelist:

```json
{
  "route":"RECALL",
  "answer":"你之前提到喜欢喝咖啡，可以优先考虑一杯咖啡。",
  "trace_id":"demo_trace_7f21",
  "memories":[{
    "memory_type":"preference",
    "sanitized_summary":"我喜欢喝咖啡",
    "score":0.91,
    "match_reason":"semantic-overlap",
    "candidate_sources":["vector","situation"]
  }]
}
```

Never return raw private provenance, file paths, source IDs, triggers, family keys, embeddings, prompts, credentials, hidden candidates, or system configuration.

## Abuse / privacy controls

- opaque session token; 24h TTL
- per-IP + per-session rate limits
- CORS allowlist for ContextWeave site
- request body limits
- output field whitelist
- no arbitrary memory-id lookup or export
- no private-audience override
- reject attempts to enumerate database/system data

## Deployment shape

```text
GitHub Pages
    ↓
Public API / reverse proxy
    ↓
Moss Demo Instance
    ├─ demo.sqlite
    └─ demo-only Qdrant collection

Private Moss Instance
    ├─ private SQLite
    └─ private Qdrant collection

(no database or collection shared)
```


## POST /v1/demo/expand

Expands one cue returned by the current visitor session. The client sends the opaque `public_id`, never an internal memory ID.

```json
{"session_id":"demo_opaque_token","public_id":"9fd4...","query":"今天下午喝什么？","detail":"relevant_chunk"}
```

The server resolves the ID only inside the same session allowlist, re-checks admission, and returns a synthetic-only public projection.

## v0.4 recall fields

Each returned memory keeps backward-compatible fields and adds:

```json
{
  "tier":"T1",
  "role":"supporting",
  "recall_path":["query","soft anchor / context envelope","Coffee taste preference"],
  "expandable":true,
  "source_channels":["formal","context-envelope","vector"]
}
```

The production private Moss database, private Qdrant collection, raw provenance and internal IDs are never reachable from this API.
