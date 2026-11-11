SELECT coalesce(sum(quantity),0) FROM reservations
WHERE substr(scope,1,length(?1))=?1 AND product_id=?2;
