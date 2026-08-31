CREATE TABLE `jira_import_batches` (
	`id` text PRIMARY KEY NOT NULL,
	`source_profile` text DEFAULT 'jira-participants' NOT NULL,
	`filename` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'uploading' NOT NULL,
	`row_count` integer DEFAULT 0 NOT NULL,
	`ticket_count` integer DEFAULT 0 NOT NULL,
	`participant_count` integer DEFAULT 0 NOT NULL,
	`rejected_count` integer DEFAULT 0 NOT NULL,
	`repaired_text_count` integer DEFAULT 0 NOT NULL,
	`unknown_usercode_count` integer DEFAULT 0 NOT NULL,
	`imported_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `jira_import_batches_status_created_idx` ON `jira_import_batches` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `jira_ticket_participants` (
	`id` text PRIMARY KEY NOT NULL,
	`ticket_key` text NOT NULL,
	`usercode` text NOT NULL,
	`jira_user_id` text DEFAULT '' NOT NULL,
	`last_import_id` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`ticket_key`) REFERENCES `jira_tickets`(`ticket_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `jira_ticket_participants_ticket_usercode_idx` ON `jira_ticket_participants` (`ticket_key`,`usercode`);--> statement-breakpoint
CREATE INDEX `jira_ticket_participants_usercode_idx` ON `jira_ticket_participants` (`usercode`);--> statement-breakpoint
CREATE INDEX `jira_ticket_participants_import_idx` ON `jira_ticket_participants` (`last_import_id`);--> statement-breakpoint
CREATE TABLE `jira_tickets` (
	`ticket_key` text PRIMARY KEY NOT NULL,
	`internal_id` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`jira_created_at` text DEFAULT '' NOT NULL,
	`assignee_usercode` text DEFAULT '' NOT NULL,
	`jira_updated_at` text DEFAULT '' NOT NULL,
	`resolution_at` text DEFAULT '' NOT NULL,
	`link` text DEFAULT '' NOT NULL,
	`last_import_id` text DEFAULT '' NOT NULL,
	`imported_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jira_tickets_assignee_status_idx` ON `jira_tickets` (`assignee_usercode`,`status`);--> statement-breakpoint
CREATE INDEX `jira_tickets_updated_idx` ON `jira_tickets` (`jira_updated_at`);--> statement-breakpoint
CREATE INDEX `jira_tickets_last_import_idx` ON `jira_tickets` (`last_import_id`);