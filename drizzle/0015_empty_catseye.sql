CREATE TABLE `keiraMistTrajectories` (
	`trajectoryId` varchar(36) NOT NULL,
	`userId` int NOT NULL,
	`schemaVersion` varchar(32) NOT NULL,
	`status` varchar(32) NOT NULL,
	`queryHash` varchar(128) NOT NULL,
	`queryNormalized` text NOT NULL,
	`documentId` varchar(255),
	`indexingJson` text,
	`layerSummaryJson` text NOT NULL,
	`merkleRoot` varchar(128) NOT NULL,
	`leafCount` int NOT NULL,
	`rrfConstant` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraMistTrajectories_trajectoryId` PRIMARY KEY(`trajectoryId`)
);
--> statement-breakpoint
CREATE TABLE `keiraMistTrajectoryArtifacts` (
	`artifactId` varchar(36) NOT NULL,
	`trajectoryId` varchar(36) NOT NULL,
	`leafIndex` int NOT NULL,
	`artifactCid` varchar(128) NOT NULL,
	`leafHash` varchar(128) NOT NULL,
	`payloadJson` text NOT NULL,
	`fusionRank` int NOT NULL,
	`rrfScore` text NOT NULL,
	`layerMembershipsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraMistTrajectoryArtifacts_artifactId` PRIMARY KEY(`artifactId`)
);
