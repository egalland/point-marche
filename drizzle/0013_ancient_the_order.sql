ALTER TABLE `jira_import_tickets` ADD `issue_type` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jira_tickets` ADD `issue_type` text DEFAULT '' NOT NULL;