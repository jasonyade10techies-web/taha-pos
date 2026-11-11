CREATE TABLE IF NOT EXISTS cash_evidence(
 id TEXT PRIMARY KEY REFERENCES outbox(id),scope TEXT NOT NULL,invoice TEXT NOT NULL UNIQUE,
 seller_id TEXT,seller_name TEXT,terminal_id TEXT,captured_at TEXT,
 tendered_minor INTEGER,change_minor INTEGER,collected_minor INTEGER,
 receipt TEXT NOT NULL CHECK(json_valid(receipt)),payload TEXT NOT NULL CHECK(json_valid(payload)),
 CHECK(collected_minor IS NULL OR collected_minor>0),
 CHECK(collected_minor IS NULL OR collected_minor=tendered_minor-change_minor)
);
CREATE INDEX IF NOT EXISTS cash_evidence_scope ON cash_evidence(scope,captured_at);
CREATE TABLE IF NOT EXISTS cash_events(
 sequence INTEGER PRIMARY KEY AUTOINCREMENT,capture_id TEXT NOT NULL REFERENCES cash_evidence(id),
 state TEXT NOT NULL,actor_id TEXT,details TEXT NOT NULL CHECK(json_valid(details)),created_at INTEGER NOT NULL
);
CREATE TRIGGER IF NOT EXISTS cash_evidence_no_update BEFORE UPDATE ON cash_evidence BEGIN SELECT RAISE(ABORT,'Cash evidence is immutable');END;
CREATE TRIGGER IF NOT EXISTS cash_evidence_no_delete BEFORE DELETE ON cash_evidence BEGIN SELECT RAISE(ABORT,'Cash evidence is immutable');END;
CREATE TRIGGER IF NOT EXISTS cash_events_no_update BEFORE UPDATE ON cash_events BEGIN SELECT RAISE(ABORT,'Cash history is immutable');END;
CREATE TRIGGER IF NOT EXISTS cash_events_no_delete BEFORE DELETE ON cash_events BEGIN SELECT RAISE(ABORT,'Cash history is immutable');END;
-- Backfill retains the original available legacy receipt. Missing legacy fields
-- stay NULL; never invent a cash amount or seller to satisfy a migration.
INSERT INTO cash_evidence
 SELECT o.id,o.scope,r.invoice,json_extract(r.value,'$.employeeId'),json_extract(r.value,'$.employeeName'),
 json_extract(o.payload,'$.terminalId'),coalesce(json_extract(o.payload,'$.createdAt'),json_extract(r.value,'$.createdAt')),
 CAST(round(json_extract(r.value,'$.cashReceived')*100) AS INTEGER),CAST(round(json_extract(r.value,'$.change')*100) AS INTEGER),
 CASE WHEN json_extract(r.value,'$.cashReceived')-json_extract(r.value,'$.change')>0 THEN CAST(round((json_extract(r.value,'$.cashReceived')-json_extract(r.value,'$.change'))*100) AS INTEGER) ELSE NULL END,r.value,o.payload
 FROM outbox o JOIN receipts r ON r.id=o.id WHERE o.type='CASH_SALE' ON CONFLICT(id) DO NOTHING;
PRAGMA user_version=2;
