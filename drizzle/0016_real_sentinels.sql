ALTER TABLE `keiraIntelligenceReceipts` ADD `attestationAlgorithm` varchar(32);--> statement-breakpoint
ALTER TABLE `keiraIntelligenceReceipts` ADD `attestationTrajectoryRootCid` varchar(128);--> statement-breakpoint
ALTER TABLE `keiraIntelligenceReceipts` ADD `attestationSignatureHex` text;--> statement-breakpoint
ALTER TABLE `keiraIntelligenceReceipts` ADD `attestationPubkeyHex` varchar(128);--> statement-breakpoint
ALTER TABLE `keiraIntelligenceReceipts` ADD `attestationSignedAt` timestamp;