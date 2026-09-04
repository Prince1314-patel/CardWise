CREATE TABLE `card_rule_versions` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`label` text NOT NULL,
	`rate_basis_points` integer NOT NULL,
	`cap_paise` integer,
	`used_paise` integer DEFAULT 0 NOT NULL,
	`cap_period` text,
	`min_spend_paise` integer,
	`categories_json` text,
	`channels_json` text,
	`confidence` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text,
	`checked_at` text NOT NULL,
	`valid_until` text,
	`version` integer DEFAULT 1 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `user_cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `card_rule_versions_card_id_id_idx` ON `card_rule_versions` (`card_id`,`id`);--> statement-breakpoint
CREATE TABLE `recommendation_requests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`merchant` text NOT NULL,
	`category` text NOT NULL,
	`channel` text NOT NULL,
	`amount_paise` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recommendation_requests_user_id_created_at_idx` ON `recommendation_requests` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `research_rate_windows` (
	`user_id` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `research_rate_windows_user_window_idx` ON `research_rate_windows` (`user_id`,`window_start`);--> statement-breakpoint
CREATE TABLE `user_cards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`issuer` text NOT NULL,
	`product_name` text NOT NULL,
	`network` text NOT NULL,
	`nickname` text,
	`last_four` text NOT NULL,
	`statement_day` integer NOT NULL,
	`due_day` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_cards_user_id_id_idx` ON `user_cards` (`user_id`,`id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
