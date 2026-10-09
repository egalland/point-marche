CREATE TABLE `jira_market_weekly_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`raw_text` text NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`market_id`) REFERENCES `market_definitions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_market_weekly_snapshots_market_period_idx` ON `jira_market_weekly_snapshots` (`market_id`,`year`,`week`);--> statement-breakpoint
CREATE INDEX `jira_market_weekly_snapshots_market_updated_idx` ON `jira_market_weekly_snapshots` (`market_id`,`updated_at`);