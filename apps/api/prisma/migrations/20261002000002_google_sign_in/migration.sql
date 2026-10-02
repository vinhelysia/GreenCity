ALTER TABLE "User" ADD COLUMN "googleSubject" TEXT;
CREATE UNIQUE INDEX "User_googleSubject_key" ON "User"("googleSubject");

CREATE TABLE "GoogleOAuthAttempt" (
  "stateHash" TEXT NOT NULL PRIMARY KEY,
  "browserHash" TEXT NOT NULL,
  "nonce" TEXT NOT NULL,
  "codeVerifier" TEXT NOT NULL,
  "returnTo" TEXT NOT NULL,
  "sessionId" TEXT,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "GoogleOAuthAttempt_expiresAt_idx" ON "GoogleOAuthAttempt"("expiresAt");
