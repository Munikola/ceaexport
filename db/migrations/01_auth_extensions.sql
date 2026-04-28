-- =============================================================================
-- AUTH EXTENSIONS
-- =============================================================================
-- Añade a la tabla `users` (ya creada en schema.sql) las columnas necesarias
-- para reset de password, y crea la tabla `user_invitations` para registro
-- por invitación del admin.
-- =============================================================================

-- Reset de password (token temporal generado por admin)
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS reset_token              VARCHAR(100) UNIQUE,
    ADD COLUMN IF NOT EXISTS reset_token_expires_at   TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_users_reset_token ON users (reset_token);

-- Invitaciones (registro solo por invitación)
CREATE TABLE IF NOT EXISTS user_invitations (
    invitation_id   SERIAL PRIMARY KEY,
    email           VARCHAR(150) NOT NULL,
    full_name       VARCHAR(150),
    role_id         INT REFERENCES roles(role_id) NOT NULL,
    token           VARCHAR(100) UNIQUE NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    created_by      INT REFERENCES users(user_id),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    used_at         TIMESTAMP,
    used_by         INT REFERENCES users(user_id),
    is_cancelled    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_invitations_token ON user_invitations (token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON user_invitations (email);
