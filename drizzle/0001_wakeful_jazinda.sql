CREATE TABLE `follows` (
	`follower` text NOT NULL,
	`following` text NOT NULL,
	`created` integer NOT NULL,
	PRIMARY KEY(`follower`, `following`)
);
--> statement-breakpoint
ALTER TABLE `connections` ADD `simulated` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `avatar` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `profiles` ADD `is_demo` integer DEFAULT 0 NOT NULL;