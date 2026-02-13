-- Migration: add partial unique index to prevent duplicate active/pending/accepted calls between same user pair
-- Creates an index on the unordered pair (min(callerId, calleeId), max(callerId, calleeId)) for active statuses

CREATE UNIQUE INDEX IF NOT EXISTS unique_active_call_pair
ON "Call" (LEAST("callerId", "calleeId"), GREATEST("callerId", "calleeId"))
WHERE status IN ('pending', 'accepted', 'active');

-- Rollback: DROP INDEX IF EXISTS unique_active_call_pair;
