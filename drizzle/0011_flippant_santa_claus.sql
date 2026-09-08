CREATE TABLE `point_drafts` (
	`editor` text NOT NULL,
	`scope` text NOT NULL,
	`owner_id` text NOT NULL,
	`year` integer NOT NULL,
	`week` integer NOT NULL,
	`meeting_date` text NOT NULL,
	`payload` text NOT NULL,
	`revision` text NOT NULL,
	`base_point_id` text,
	`base_point_revision` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_drafts_editor_owner_week_idx` ON `point_drafts` (`editor`,`scope`,`owner_id`,`year`,`week`);--> statement-breakpoint
CREATE INDEX `point_drafts_editor_owner_updated_idx` ON `point_drafts` (`editor`,`scope`,`owner_id`,`updated_at`);--> statement-breakpoint
ALTER TABLE `analyst_weekly_points` ADD `revision` text DEFAULT 'initial' NOT NULL;--> statement-breakpoint
ALTER TABLE `weekly_points` ADD `revision` text DEFAULT 'initial' NOT NULL;