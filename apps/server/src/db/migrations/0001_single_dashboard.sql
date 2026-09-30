PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`layouts` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
DELETE FROM `widgets` WHERE `dashboard_id` <> 'family';--> statement-breakpoint
INSERT INTO `__new_dashboards`("id", "layouts", "created_at", "updated_at") SELECT "id", "layouts", "created_at", "updated_at" FROM `dashboards` WHERE `id` = 'family';--> statement-breakpoint
DROP TABLE `dashboards`;--> statement-breakpoint
ALTER TABLE `__new_dashboards` RENAME TO `dashboards`;--> statement-breakpoint
PRAGMA foreign_keys=ON;