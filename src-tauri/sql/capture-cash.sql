INSERT INTO cash_evidence
 SELECT o.id,o.scope,r.invoice,json_extract(r.value,'$.employeeId'),json_extract(r.value,'$.employeeName'),
 json_extract(o.payload,'$.terminalId'),json_extract(o.payload,'$.createdAt'),
 CAST(round(json_extract(r.value,'$.cashReceived')*100) AS INTEGER),CAST(round(json_extract(r.value,'$.change')*100) AS INTEGER),
 CAST(round((json_extract(r.value,'$.cashReceived')-json_extract(r.value,'$.change'))*100) AS INTEGER),r.value,o.payload
 FROM outbox o JOIN receipts r ON r.id=o.id WHERE o.id=?1 AND o.type='CASH_SALE'
 ON CONFLICT(id) DO NOTHING;
