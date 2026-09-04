CREATE TABLE `auth_rate_windows` (
	`fingerprint` text NOT NULL,
	`window_start` integer NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `auth_rate_windows_fingerprint_window_idx` ON `auth_rate_windows` (`fingerprint`,`window_start`);