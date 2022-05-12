/*
  Warnings:

  - Added the required column `contactEmail` to the `VideoNotification` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_VideoNotification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactEmail" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_VideoNotification" ("createdAt", "id") SELECT "createdAt", "id" FROM "VideoNotification";
DROP TABLE "VideoNotification";
ALTER TABLE "new_VideoNotification" RENAME TO "VideoNotification";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
