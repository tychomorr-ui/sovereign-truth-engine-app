ALTER TABLE `keiraMemoryRecords` ADD `subject` varchar(255);
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `provenanceType` varchar(32) DEFAULT 'USER' NOT NULL;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `informationState` varchar(32) DEFAULT 'KNOWN' NOT NULL;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `confidence` int DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `visibility` varchar(32) DEFAULT 'private' NOT NULL;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `expirationAt` timestamp;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `relatedReceipts` text;
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `supersedes` varchar(36);
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `supersededBy` varchar(36);
--> statement-breakpoint
ALTER TABLE `keiraMemoryRecords` ADD `scope` varchar(64) DEFAULT 'operator' NOT NULL;
