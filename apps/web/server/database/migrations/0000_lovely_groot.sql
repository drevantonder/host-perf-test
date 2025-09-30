CREATE TABLE `benchmarks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`benchmark_id` text NOT NULL,
	`region` text NOT NULL,
	`runs` integer NOT NULL,
	`label` text NOT NULL,
	`results` text NOT NULL,
	`meta` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
