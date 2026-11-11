SELECT json_object(
 'id',c.id,'invoice',c.invoice,'seller_id',c.seller_id,'seller_name',c.seller_name,
 'terminal_id',c.terminal_id,'captured_at',c.captured_at,
 'tendered',c.tendered_minor/100.0,'change_given',c.change_minor/100.0,'collected',c.collected_minor/100.0,
 'payload',json_set(json(c.payload),'$.receipt',json(c.receipt)),
 'state',coalesce((SELECT state FROM cash_events WHERE capture_id=c.id AND state IN ('REFUNDED','POSTED') ORDER BY sequence DESC LIMIT 1),
  CASE o.status WHEN 'SYNCED' THEN 'POSTED' WHEN 'CONFLICT' THEN 'REVIEW' ELSE o.status END),
 'reason',o.error,'local',json('true'))
FROM cash_evidence c JOIN outbox o ON o.id=c.id
WHERE c.scope=?1 OR (?2 AND substr(c.scope,1,length(?3))=?3)
ORDER BY c.captured_at DESC;
