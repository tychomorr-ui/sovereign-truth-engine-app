CREATE TABLE `keiraIdentityKeys` (
	`keyId` varchar(96) NOT NULL,
	`algorithm` varchar(32) NOT NULL,
	`publicKeyPem` text NOT NULL,
	`publicKeyFingerprint` varchar(128) NOT NULL,
	`encryptedPrivateKey` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`retiredAt` timestamp,
	CONSTRAINT `keiraIdentityKeys_keyId` PRIMARY KEY(`keyId`)
);
--> statement-breakpoint
CREATE TABLE `keiraIdentityReceipts` (
	`receiptId` varchar(36) NOT NULL,
	`keyId` varchar(96) NOT NULL,
	`manifestJson` text NOT NULL,
	`canonicalManifestSha256` varchar(128) NOT NULL,
	`signature` text NOT NULL,
	`verificationState` varchar(64) NOT NULL,
	`issuedAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `keiraIdentityReceipts_receiptId` PRIMARY KEY(`receiptId`)
);
