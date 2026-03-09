CREATE TABLE IF NOT EXISTS `chatSessions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `userId` integer NOT NULL,
  `title` text DEFAULT 'Untitled Chat',
  `createdAt` integer NOT NULL DEFAULT (unixepoch()),
  `updatedAt` integer NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS `chatMessages` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `sessionId` integer NOT NULL,
  `userId` integer NOT NULL,
  `role` text NOT NULL CHECK(`role` IN ('user', 'assistant')),
  `content` text NOT NULL,
  `relatedCourseIds` text,
  `createdAt` integer NOT NULL DEFAULT (unixepoch()),
  FOREIGN KEY (`sessionId`) REFERENCES `chatSessions`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS `chatSessions_userId_idx` ON `chatSessions`(`userId`);
CREATE INDEX IF NOT EXISTS `chatMessages_sessionId_idx` ON `chatMessages`(`sessionId`);
CREATE INDEX IF NOT EXISTS `chatMessages_userId_idx` ON `chatMessages`(`userId`);
