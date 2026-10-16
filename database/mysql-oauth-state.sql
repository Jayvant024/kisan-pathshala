-- Apply once to kisan_pathshala before enabling Google OAuth.
-- OAuth state is browser-bound by an HttpOnly cookie; this table enforces expiry
-- and one-time callback consumption across server instances and restarts.

CREATE TABLE IF NOT EXISTS oauth_states (
	state_hash BINARY(32) NOT NULL,
	nonce_hash BINARY(32) NOT NULL,
	code_verifier VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
	created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
	expires_at DATETIME(6) NOT NULL,
	PRIMARY KEY (state_hash),
	KEY idx_oauth_states_expiry (expires_at),
	CONSTRAINT chk_oauth_states_expiry CHECK (expires_at > created_at)
) ENGINE=InnoDB DEFAULT CHARACTER SET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;