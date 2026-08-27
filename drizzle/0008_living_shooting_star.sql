CREATE TABLE `jira_analyst_weekly_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`analyst_id` text NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`raw_text` text NOT NULL,
	`payload` text NOT NULL,
	`updated_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`analyst_id`) REFERENCES `global_users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_analyst_weekly_snapshots_analyst_period_idx` ON `jira_analyst_weekly_snapshots` (`analyst_id`,`year`,`week`);--> statement-breakpoint
CREATE INDEX `jira_analyst_weekly_snapshots_analyst_updated_idx` ON `jira_analyst_weekly_snapshots` (`analyst_id`,`updated_at`);