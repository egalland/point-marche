CREATE TABLE `analyst_weekly_points` (
	`id` text PRIMARY KEY NOT NULL,
	`analyst_id` text NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`meeting_date` text NOT NULL,
	`period_from` text NOT NULL,
	`period_to` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analyst_weekly_points_analyst_period_idx` ON `analyst_weekly_points` (`analyst_id`,`year`,`week`);--> statement-breakpoint
CREATE INDEX `analyst_weekly_points_analyst_updated_idx` ON `analyst_weekly_points` (`analyst_id`,`updated_at`);