CREATE TABLE `jira_import_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`ticket_key` text NOT NULL,
	`usercode` text NOT NULL,
	`jira_user_id` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `jira_import_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_import_participants_import_ticket_usercode_idx` ON `jira_import_participants` (`import_id`,`ticket_key`,`usercode`);--> statement-breakpoint
CREATE INDEX `jira_import_participants_import_idx` ON `jira_import_participants` (`import_id`);--> statement-breakpoint
CREATE TABLE `jira_import_tickets` (
	`id` text PRIMARY KEY NOT NULL,
	`import_id` text NOT NULL,
	`ticket_key` text NOT NULL,
	`internal_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`jira_created_at` text DEFAULT '' NOT NULL,
	`assignee_usercode` text DEFAULT '' NOT NULL,
	`jira_updated_at` text DEFAULT '' NOT NULL,
	`resolution_at` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	FOREIGN KEY (`import_id`) REFERENCES `jira_import_batches`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_import_tickets_import_key_idx` ON `jira_import_tickets` (`import_id`,`ticket_key`);--> statement-breakpoint
CREATE INDEX `jira_import_tickets_import_idx` ON `jira_import_tickets` (`import_id`);