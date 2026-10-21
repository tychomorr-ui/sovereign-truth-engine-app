CREATE TABLE `keiraCorpusVectors` (
	`id` varchar(220) NOT NULL,
	`userId` int NOT NULL,
	`documentId` varchar(160) NOT NULL,
	`artifactCid` varchar(160) NOT NULL,
	`filename` varchar(255) NOT NULL,
	`content` longtext NOT NULL,
	`vectorJson` longtext NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraCorpusVectors_id` PRIMARY KEY(`id`)
);
