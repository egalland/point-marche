CREATE TABLE `market_definitions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`short_code` text NOT NULL,
	`tone` text DEFAULT 'mint' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `market_definitions_name_idx` ON `market_definitions` (`name`);--> statement-breakpoint
CREATE INDEX `market_definitions_active_position_idx` ON `market_definitions` (`is_active`,`position`);--> statement-breakpoint
INSERT INTO `market_definitions` (`id`, `name`, `short_code`, `tone`, `position`) VALUES ('revetements-menuiserie', 'Revêtements & Menuiserie', 'REV–MEN', 'mint', 0);--> statement-breakpoint
INSERT INTO `market_definitions` (`id`, `name`, `short_code`, `tone`, `position`) VALUES ('bois-amex', 'Bois amin / AMEX', 'BOIS', 'peach', 1);--> statement-breakpoint
INSERT INTO `market_definitions` (`id`, `name`, `short_code`, `tone`, `position`) VALUES ('outillage-quincaillerie', 'Outillage & Quincaillerie', 'OUT–QUIN', 'aqua', 2);--> statement-breakpoint
INSERT INTO `market_definitions` (`id`, `name`, `short_code`, `tone`, `position`) VALUES ('panneaux', 'Panneaux', 'PAN', 'violet', 3);
