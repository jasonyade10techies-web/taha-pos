SELECT json_object('id',c.id,'sellerId',c.seller_id,'capturedAt',c.captured_at,
 'registered',EXISTS(SELECT 1 FROM cash_events e WHERE e.capture_id=c.id AND e.state IN ('REGISTERED','POSTED','REFUNDED')))
FROM cash_evidence c JOIN outbox o ON o.id=c.id
WHERE substr(c.scope,1,length(?1))=?1 AND o.status<>'SYNCED';
