-- Enforce the application email normalization invariant at the database boundary.
ALTER TABLE "User"
  ADD CONSTRAINT "User_email_normalized_check"
  CHECK ("email" = lower(btrim("email")) AND "email" <> '');