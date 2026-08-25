CREATE TABLE `jira_market_assignments` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`assignee` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_market_assignments_market_person_idx` ON `jira_market_assignments` (`market_id`,`assignee`);--> statement-breakpoint
CREATE INDEX `jira_market_assignments_market_idx` ON `jira_market_assignments` (`market_id`);--> statement-breakpoint
CREATE TABLE `jira_weekly_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`raw_text` text NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_weekly_snapshots_year_week_idx` ON `jira_weekly_snapshots` (`year`,`week`);--> statement-breakpoint
ALTER TABLE `market_definitions` ADD `color_hex` text DEFAULT '' NOT NULL;