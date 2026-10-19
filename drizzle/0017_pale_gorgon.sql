CREATE TABLE `keiraBoomerangTrajectories` (
	`trajectoryId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`schemaVersion` varchar(48) NOT NULL,
	`queryHash` varchar(128) NOT NULL,
	`merkleRoot` varchar(128) NOT NULL,
	`resultJson` text NOT NULL,
	`attestationAlgorithm` varchar(32),
	`signatureHex` text,
	`pubkeyHex` varchar(128),
	`keyId` varchar(96),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraBoomerangTrajectories_trajectoryId` PRIMARY KEY(`trajectoryId`)
);
