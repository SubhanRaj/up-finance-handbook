CREATE TABLE `pages` (
	`slug` text PRIMARY KEY NOT NULL,
	`volume` text NOT NULL,
	`title` text NOT NULL,
	`source_url` text NOT NULL,
	`html` text NOT NULL
);
