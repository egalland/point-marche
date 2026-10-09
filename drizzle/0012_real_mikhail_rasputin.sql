ALTER TABLE `jira_import_tickets` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jira_import_tickets` ADD `subcategory` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jira_tickets` ADD `category` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `jira_tickets` ADD `subcategory` text DEFAULT '' NOT NULL;