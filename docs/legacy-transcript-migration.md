# Legacy Conversation Migration Plan

## Current-State Findings

- **Single-container model:** All chat data resides in the Cosmos `history` container partitioned by `/userId`, differentiated with `type` fields (`CHAT_THREAD`, `CHAT_MESSAGE`, `CHAT_DOCUMENT`, `CHAT_CITATION`).
- **Thread shape:** Threads capture title, persona metadata, extension ids, timestamps, and `userId` (hashed email). No attachments-agent or vector store references are persisted.
- **Message shape:** Messages store `threadId`, role, content, optional `multiModalImage`, and `modelType`. Tool calls and streaming segments are flattened into plain text entries; `UpsertChatMessage` issues a fresh `id`/`createdAt` on each save, so the final transcript must be re-sorted by timestamp.
- **Documents & citations:** Uploaded files appear as separate `CHAT_DOCUMENT` rows plus AI Search index shards. Because the new portal manages attachments through Azure AI Agents, legacy document metadata cannot be replayed without re-ingesting the files.

## Migration Decision

- Treat historic conversations as **read-only transcripts** in the new portal.
- Skip recreation of attachment agent sessions, vector stores, and per-message tool telemetry.
- Preserve thread metadata, message ordering, personas, and extension references where available.

## ETL Overview

1. **Extract**
   - Query Cosmos `history` for each user partition (`SELECT * WHERE r.userId = @user AND r.isDeleted = false`).
   - Filter to `CHAT_THREAD` and `CHAT_MESSAGE` items; optionally export `CHAT_DOCUMENT` names for reference.
   - Output to intermediate JSON grouped by thread id to simplify transformation.

2. **Transform**
   - Sort each thread's messages by `createdAt` (ascending) to rebuild the conversation flow.
   - Merge multi-part assistant messages created during streaming by concatenating contiguous assistant records with the same logical turn if required.
   - Represent function-call payloads as plain text annotations (e.g., `"[function] name(args)"`) inside the message content; mark the message metadata with `displayOnly: true`.
   - Produce target thread documents adhering to the portal schema (e.g., `id`, `userId`, `name`, `createdAt`, `lastMessageAt`, `metadata: { legacyTranscript: true }`).
   - Produce target message documents with `threadId`, ordered `index`, `role`, `content`, `metadata: { legacyTranscript: true, sourceThreadId: <original> }`.

3. **Load**
   - Upsert threads into the APi AI Portal Cosmos `threads` container (partitioned by `/userId`).
   - Upsert messages into the portal `messages` container (partitioned by `/threadId`). Maintain sequential `index` to simplify ordering queries.
   - Optionally write a lightweight `legacy_documents` record per thread summarizing original `CHAT_DOCUMENT` names for reference in the UI.

## Export Endpoint

- **Route:** `GET /api/export-threads`
- **Auth:** Requires an authenticated session; relies on `userSession`/`userHashedId` to scope the Cosmos partition.
- **Payload:** Returns `{ userId, legacyUserId, threads[] }` where each thread contains the original thread document, its messages, and any associated documents. Responses stream from Cosmos with `isDeleted = false`.
- **Portal format:** Append `?format=portal` to receive data reshaped for the new portal schema with `metadata.legacyTranscript = true` and messages sorted by timestamp.
- **Download:** The route sets a `Content-Disposition` header so browsers download the JSON directly. The legacy UI exposes this via “Export legacy threads” under the chat home page.

## Validation Plan

- Spot-check one user’s migrated transcript in the portal UI to confirm read-only behavior and persona titles.
- Verify Cosmos query performance on legacy partitions by running the portal’s `/api/threads` and `/api/threads/:id/messages` endpoints.
- Confirm telemetry ignores legacy transcripts (or annotate Application Insights events with `legacyTranscript = true`).

## Next Steps

1. Draft the ETL script (e.g., Node.js using Cosmos SDK) following the above transformation rules.
2. Run the script against a staging Cosmos account and validate UI/telemetry.
3. Schedule production migration with read-only downtime to avoid overlapping thread ids.
