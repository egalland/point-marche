CREATE TABLE `weekly_points` (
	`id` text PRIMARY KEY NOT NULL,
	`market_id` text NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`version` integer NOT NULL,
	`meeting_date` text NOT NULL,
	`point_name` text NOT NULL,
	`theme_color` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `weekly_points_market_week_version_idx` ON `weekly_points` (`market_id`,`year`,`week`,`version`);--> statement-breakpoint
CREATE INDEX `weekly_points_market_created_idx` ON `weekly_points` (`market_id`,`created_at`);