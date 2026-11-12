CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `connections` (
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`account` text NOT NULL,
	`token` text,
	`last_sync` integer DEFAULT 0 NOT NULL,
	`attempted` integer DEFAULT 0 NOT NULL,
	`error` text,
	`cursor` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `provider`)
);
--> statement-breakpoint
CREATE TABLE `items` (
	`id` text NOT NULL,
	`owner` text NOT NULL,
	`provider` text NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`subtitle` text DEFAULT '' NOT NULL,
	`image` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`date` integer NOT NULL,
	`score` text DEFAULT '' NOT NULL,
	`pinned` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`owner`, `provider`, `id`)
);
--> statement-breakpoint
CREATE TABLE `oauth` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`verifier` text NOT NULL,
	`expires` integer NOT NULL,
	`provider` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`handle` text NOT NULL,
	`bio` text DEFAULT '' NOT NULL,
	`tags` text DEFAULT '' NOT NULL,
	`accent` text DEFAULT '#b9a0f5' NOT NULL,
	`theme` text DEFAULT 'midnight' NOT NULL,
	`css` text DEFAULT '' NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profiles_handle_unique` ON `profiles` (`handle`);