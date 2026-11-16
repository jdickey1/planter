-- Server-side session revocation.
--
-- Each session token carries the session_version it was issued with. Every
-- request compares it with this column; logout and password reset increment
-- it, so older tokens stop working.
--
-- Additive and idempotent: safe to run more than once. Apply it BEFORE
-- deploying the code that reads the column. Existing sessions are signed out
-- once by that deploy (their tokens carry no version) and users log in again.
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
