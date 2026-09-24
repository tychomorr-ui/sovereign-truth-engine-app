CREATE TABLE `keiraIntelligenceReceipts` (
	`receiptId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`operation` varchar(160) NOT NULL,
	`intelligenceMode` varchar(32) NOT NULL,
	`provider` varchar(160),
	`model` varchar(255),
	`contextSources` text NOT NULL,
	`externalServiceUsed` int NOT NULL DEFAULT 0,
	`dataLeftLocalNode` int NOT NULL DEFAULT 0,
	`policy` text NOT NULL,
	`verification` text NOT NULL,
	`resultState` varchar(64) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraIntelligenceReceipts_receiptId` PRIMARY KEY(`receiptId`)
);
--> statement-breakpoint
CREATE TABLE `keiraMemoryRecords` (
	`id` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`memoryClass` varchar(64) NOT NULL,
	`content` text NOT NULL,
	`source` varchar(255) NOT NULL,
	`authority` varchar(32) NOT NULL,
	`sensitivity` varchar(32) NOT NULL,
	`retention` varchar(32) NOT NULL,
	`provenance` text NOT NULL,
	`revoked` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`revokedAt` timestamp,
	CONSTRAINT `keiraMemoryRecords_id` PRIMARY KEY(`id`)
);
