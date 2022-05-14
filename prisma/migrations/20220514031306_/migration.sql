/*
  Warnings:

  - Added the required column `firebaseUserId` to the `VideoNotification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firebaseUserId" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "alreadyProcessed" BOOLEAN NOT NULL,
    "hash" TEXT NOT NULL,
    "finalVideoName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VideoNotification" ("alreadyProcessed", "contactEmail", "createdAt", "finalVideoName", "hash", "id") SELECT "alreadyProcessed", "contactEmail", "createdAt", "finalVideoName", "hash", "id" FROM "VideoNotification";
DROP TABLE "VideoNotification";
ALTER TABLE "new_VideoNotification" RENAME TO "VideoNotification";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
