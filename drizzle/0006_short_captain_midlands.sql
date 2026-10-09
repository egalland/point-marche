CREATE TABLE `planner_tasks` (
	`external_id` text PRIMARY KEY NOT NULL,
	`task_name` text NOT NULL,
	`effective_month` text DEFAULT '' NOT NULL,
	`planner_status` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '' NOT NULL,
	`simulation_date` text DEFAULT '' NOT NULL,
	`control_date` text DEFAULT '' NOT NULL,
	`labels` text DEFAULT '[]' NOT NULL,
	`payload` text NOT NULL,
	`imported_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `planner_tasks_effective_month_idx` ON `planner_tasks` (`effective_month`);--> statement-breakpoint
CREATE INDEX `planner_tasks_simulation_date_idx` ON `planner_tasks` (`simulation_date`);--> statement-breakpoint
CREATE INDEX `planner_tasks_control_date_idx` ON `planner_tasks` (`control_date`);--> statement-breakpoint
ALTER TABLE `global_users` ADD `planner_alias` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `market_definitions` ADD `planner_tags` text DEFAULT '[]' NOT NULL;