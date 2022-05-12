/*
  Warnings:

  - Added the required column `alreadyProcessed` to the `VideoNotification` table without a default value. This is not possible if the table is not empty.
  - Added the required column `hash` to the `VideoNotification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactEmail" TEXT NOT NULL,
    "alreadyProcessed" BOOLEAN NOT NULL,
    "hash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VideoNotification" ("contactEmail", "createdAt", "id") SELECT "contactEmail", "createdAt", "id" FROM "VideoNotification";
DROP TABLE "VideoNotification";
ALTER TABLE "new_VideoNotification" RENAME TO "VideoNotification";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
