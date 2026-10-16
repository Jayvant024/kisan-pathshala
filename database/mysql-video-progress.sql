-- Additive migration for lesson playback resume position.
-- watched_seconds is retained for compatibility but is not used for completion.
-- Run once against kisan_pathshala; existing completion and account records remain intact.
USE kisan_pathshala;

ALTER TABLE lesson_progress
	ADD COLUMN playback_seconds INT UNSIGNED NOT NULL DEFAULT 0,
	ADD COLUMN watched_seconds INT UNSIGNED NOT NULL DEFAULT 0;