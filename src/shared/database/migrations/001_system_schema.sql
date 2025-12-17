-- PostgreSQL: System Administration Database Schema
-- This database contains system-level data: API keys, audit logs, sessions, system config

-- API Keys table (System data - stays in PostgreSQL)
CREATE TABLE IF NOT EXISTS api_keys (
    id VARCHAR(255) PRIMARY KEY,
    hashed_key TEXT NOT NULL,
    user_id VARCHAR(255) NOT NULL,  -- References user in MySQL
    name VARCHAR(255) NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_is_active ON api_keys(is_active);
CREATE INDEX idx_api_keys_expires_at ON api_keys(expires_at);

-- OAuth2 Tokens table (System data)
CREATE TABLE IF NOT EXISTS oauth2_tokens (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- References user in MySQL
    provider VARCHAR(50) NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_oauth2_user_id ON oauth2_tokens(user_id);
CREATE INDEX idx_oauth2_provider ON oauth2_tokens(provider);

-- Sessions table (System data)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,  -- References user in MySQL
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- Audit Log table (System data - critical for compliance)
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),  -- References user in MySQL
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id VARCHAR(255),
    metadata JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_action ON audit_logs(action);
CREATE INDEX idx_audit_created_at ON audit_logs(created_at);
CREATE INDEX idx_audit_resource ON audit_logs(resource_type, resource_id);

-- System Configuration table (System data)
CREATE TABLE IF NOT EXISTS system_config (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    is_encrypted BOOLEAN DEFAULT FALSE,
    updated_by VARCHAR(255),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Rate Limit Overrides (System data)
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255),
    api_key_id VARCHAR(255),
    max_requests INTEGER NOT NULL,
    window_ms INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_rate_limit_user ON rate_limit_overrides(user_id);
CREATE INDEX idx_rate_limit_apikey ON rate_limit_overrides(api_key_id);

COMMENT ON TABLE api_keys IS 'API keys for programmatic access';
COMMENT ON TABLE oauth2_tokens IS 'OAuth2 tokens from external providers';
COMMENT ON TABLE sessions IS 'User sessions tracking';
COMMENT ON TABLE audit_logs IS 'Complete audit trail of all actions';
COMMENT ON TABLE system_config IS 'System-wide configuration';
COMMENT ON TABLE rate_limit_overrides IS 'Custom rate limits per user/API key';
