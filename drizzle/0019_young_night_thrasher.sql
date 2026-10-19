CREATE TABLE `keiraResponseCache` (
	`cacheKey` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`queryHash` varchar(64) NOT NULL,
	`trajectoryRootCid` varchar(128),
	`response` longtext NOT NULL,
	`model` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraResponseCache_cacheKey` PRIMARY KEY(`cacheKey`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `fastMode` int DEFAULT 0 NOT NULL;