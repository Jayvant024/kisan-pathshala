# YouTube lesson playback

Published video lessons use `lessons.content_url` for a YouTube video ID or supported YouTube URL and `lessons.duration_minutes` for the configured lesson duration. The lesson must be part of an active enrollment to be returned by the learning API.

Run `database/mysql-video-progress.sql` once against `kisan_pathshala` before deploying the playback API. It adds playback-position and legacy watched-time columns to the existing `lesson_progress` table without replacing learner data. Watched time is no longer read or written by the application.

The learning page embeds videos with the YouTube IFrame Player API and saves the resume position periodically and on pause/end. Learners can manually mark any lesson complete at any time. The backend records completion only for the authenticated user with an active enrollment for the course containing that published lesson.

Playback position is for resuming only; it is not used to determine completion or certificate eligibility.

Certificates are issued transactionally only after every published lesson has a saved completion record. Existing certificates are also checked against current published lessons, saved completion records, and active enrollment when listed or publicly verified.