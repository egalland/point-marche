CREATE TABLE `global_users` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`jira_name` text NOT NULL,
	`role` text DEFAULT 'autre' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_users_email_idx` ON `global_users` (`email`);--> statement-breakpoint
CREATE INDEX `global_users_active_name_idx` ON `global_users` (`is_active`,`name`);--> statement-breakpoint
CREATE INDEX `global_users_jira_name_idx` ON `global_users` (`jira_name`);--> statement-breakpoint
CREATE TABLE `global_user_markets` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`market_id` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `global_users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`market_id`) REFERENCES `market_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `global_user_markets_user_market_idx` ON `global_user_markets` (`user_id`,`market_id`);--> statement-breakpoint
CREATE INDEX `global_user_markets_market_idx` ON `global_user_markets` (`market_id`);--> statement-breakpoint
CREATE INDEX `global_user_markets_user_idx` ON `global_user_markets` (`user_id`);
