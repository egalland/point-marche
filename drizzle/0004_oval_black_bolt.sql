ALTER TABLE `market_definitions` ADD `jira_warning_days` integer DEFAULT 10 NOT NULL;--> statement-breakpoint
ALTER TABLE `market_definitions` ADD `jira_critical_days` integer DEFAULT 20 NOT NULL;