CREATE UNIQUE INDEX "Quote_one_pending_per_scrap_request"
  ON "Quote"("scrapRequestId")
  WHERE "status" = 'PENDING';
