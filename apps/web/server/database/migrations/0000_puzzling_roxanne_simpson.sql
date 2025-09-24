CREATE TABLE `benchmark_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`benchmark_id` text NOT NULL,
	`region` text NOT NULL,
	`result` text,
	`error` text,
	`status` text,
	`progress` integer,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `benchmarks` (
	`id` text PRIMARY KEY NOT NULL,
	`status` text NOT NULL,
	`regions` text NOT NULL,
	`runs` integer NOT NULL,
	`label` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`completed_at` text
);
