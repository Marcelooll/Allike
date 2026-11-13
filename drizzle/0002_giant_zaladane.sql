CREATE TABLE `auth_limits` (
	`id` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`tokens` text NOT NULL,
	`expires` integer NOT NULL,
	`access_expires` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` text PRIMARY KEY NOT NULL,
	`sender` text NOT NULL,
	`recipient` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL,
	`read_at` integer
);
--> statement-breakpoint
CREATE INDEX `messages_sender_created` ON `messages` (`sender`,`created`);--> statement-breakpoint
CREATE INDEX `messages_recipient_created` ON `messages` (`recipient`,`created`);