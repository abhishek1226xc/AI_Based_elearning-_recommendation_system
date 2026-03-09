CREATE TABLE `bookmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courseInteractions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`interactionType` text NOT NULL,
	`rating` integer,
	`timeSpent` integer,
	`completionPercentage` integer DEFAULT 0,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`category` text NOT NULL,
	`difficulty` text NOT NULL,
	`tags` text,
	`instructor` text,
	`duration` integer,
	`platform` text DEFAULT 'Udemy',
	`platformUrl` text,
	`platformPrice` text DEFAULT 'Free',
	`rating` integer DEFAULT 0,
	`platformRating` integer DEFAULT 0,
	`reviewCount` integer DEFAULT 0,
	`learnerCount` integer DEFAULT 0,
	`completionRate` integer DEFAULT 0,
	`thumbnailUrl` text,
	`contentUrl` text,
	`lastSyncedAt` integer DEFAULT (unixepoch()),
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `platformRatings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`courseId` integer NOT NULL,
	`platform` text NOT NULL,
	`rating` integer DEFAULT 0,
	`reviewCount` integer DEFAULT 0,
	`price` text DEFAULT 'Free',
	`url` text,
	`lastUpdated` integer DEFAULT (unixepoch()),
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recommendationFeedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`recommendationId` integer NOT NULL,
	`feedback` text NOT NULL,
	`timestamp` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`recommendationId`) REFERENCES `recommendations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`score` integer,
	`reason` text,
	`algorithm` text NOT NULL,
	`rank` integer,
	`generatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`expiresAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `userProfiles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`skills` text,
	`interests` text,
	`learningGoals` text,
	`preferredDifficulty` text DEFAULT 'intermediate',
	`learningStyle` text,
	`bio` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `userProfiles_userId_unique` ON `userProfiles` (`userId`);--> statement-breakpoint
CREATE TABLE `userProgress` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`courseId` integer NOT NULL,
	`enrollmentDate` integer DEFAULT (unixepoch()) NOT NULL,
	`completionDate` integer,
	`completionPercentage` integer DEFAULT 0,
	`quizScores` text,
	`lastAccessedAt` integer DEFAULT (unixepoch()),
	`status` text DEFAULT 'enrolled',
	`totalTimeSpent` integer DEFAULT 0,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`courseId`) REFERENCES `courses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`passwordHash` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);