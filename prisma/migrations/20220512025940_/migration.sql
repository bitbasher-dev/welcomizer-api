/*
  Warnings:

  - You are about to drop the column `videoUrl` on the `VideoNotification` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactEmail" TEXT NOT NULL,
    "alreadyProcessed" BOOLEAN NOT NULL,
    "hash" TEXT NOT NULL,
    "finalVideoName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VideoNotification" ("alreadyProcessed", "contactEmail", "createdAt", "hash", "id") SELECT "alreadyProcessed", "contactEmail", "createdAt", "hash", "id" FROM "VideoNotification";
DROP TABLE "VideoNotification";
ALTER TABLE "new_VideoNotification" RENAME TO "VideoNotification";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
