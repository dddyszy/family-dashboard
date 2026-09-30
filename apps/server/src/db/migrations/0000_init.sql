CREATE TABLE `dashboards` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`layouts` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dashboards_user_id_unique` ON `dashboards` (`user_id`);--> statement-breakpoint
CREATE TABLE `devices` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_seen_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `devices_token_hash_unique` ON `devices` (`token_hash`);--> statement-breakpoint
CREATE TABLE `event_participants` (
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`event_id`, `user_id`),
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `participants_user_idx` ON `event_participants` (`user_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`location` text,
	`note` text,
	`color` text,
	`start_at` integer NOT NULL,
	`end_at` integer NOT NULL,
	`all_day` integer DEFAULT false NOT NULL,
	`rrule` text,
	`exdates` text DEFAULT '[]' NOT NULL,
	`parent_id` text,
	`recurrence_id` integer,
	`remind_offsets` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `events_start_idx` ON `events` (`start_at`);--> statement-breakpoint
CREATE INDEX `events_parent_idx` ON `events` (`parent_id`);--> statement-breakpoint
CREATE TABLE `pairing_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`occurrence_at` integer NOT NULL,
	`user_id` text NOT NULL,
	`fire_at` integer NOT NULL,
	`status` text NOT NULL,
	`fired_at` integer,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_due_idx` ON `reminders` (`status`,`fire_at`);--> statement-breakpoint
CREATE INDEX `reminders_source_idx` ON `reminders` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `reminders_user_idx` ON `reminders` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`user_agent` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_token_hash_unique` ON `sessions` (`token_hash`);--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_history` (
	`key` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`last_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `shopping_items` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`name` text NOT NULL,
	`qty` real,
	`unit` text,
	`category` text NOT NULL,
	`note` text,
	`added_by` text NOT NULL,
	`checked` integer DEFAULT false NOT NULL,
	`checked_by` text,
	`checked_at` integer,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `shopping_lists`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `items_list_idx` ON `shopping_items` (`list_id`,`archived_at`);--> statement-breakpoint
CREATE TABLE `shopping_lists` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`visibility` text NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`color` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`visibility` text NOT NULL,
	`title` text NOT NULL,
	`note` text,
	`due_at` integer,
	`rrule` text,
	`assignee_ids` text DEFAULT '[]' NOT NULL,
	`remind_offsets` text DEFAULT '[]' NOT NULL,
	`done_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`username` text NOT NULL,
	`name` text NOT NULL,
	`avatar` text,
	`color` text NOT NULL,
	`role` text NOT NULL,
	`password_hash` text NOT NULL,
	`prefs` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE TABLE `widgets` (
	`id` text PRIMARY KEY NOT NULL,
	`dashboard_id` text NOT NULL,
	`type` text NOT NULL,
	`config` text DEFAULT '{}' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`dashboard_id`) REFERENCES `dashboards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `widgets_dashboard_idx` ON `widgets` (`dashboard_id`);