CREATE TABLE migrations (
    id SERIAL PRIMARY KEY,
    migration VARCHAR(255) NOT NULL,
    batch INTEGER NOT NULL
);

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    nickname VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    email_verified_at TIMESTAMP,
    password VARCHAR(255) NOT NULL,
    github_id VARCHAR(255),
    auth_type VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100),
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT users_email_unique UNIQUE (email)
);

CREATE TABLE password_reset_tokens (
    email VARCHAR(255) PRIMARY KEY,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP
);

CREATE TABLE failed_jobs (
    id BIGSERIAL PRIMARY KEY,
    uuid VARCHAR(255) NOT NULL,
    connection TEXT NOT NULL,
    queue TEXT NOT NULL,
    payload TEXT NOT NULL,
    exception TEXT NOT NULL,
    failed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT failed_jobs_uuid_unique UNIQUE (uuid)
);

CREATE TABLE monitor_user (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    monitor_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL
);

CREATE TABLE personal_access_tokens (
    id BIGSERIAL PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT NOT NULL,
    name VARCHAR(255) NOT NULL,
    token VARCHAR(64) NOT NULL,
    abilities TEXT,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    CONSTRAINT personal_access_tokens_token_unique UNIQUE (token),
    CONSTRAINT tokenable_type_tokenable_id_idx UNIQUE (tokenable_type, tokenable_id)
);

CREATE TABLE monitors (
    id BIGSERIAL PRIMARY KEY,
    type VARCHAR(255) NOT NULL,
    login_name VARCHAR(255),
    project_url VARCHAR(255),
    organization_name VARCHAR(255),
    pat_token VARCHAR(255),
    readme VARCHAR(255),
    public BOOLEAN,
    title VARCHAR(255),
    short_description VARCHAR(255),
    project_identification INTEGER NOT NULL,
    monitor_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE milestones (
    id BIGSERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    url VARCHAR(255) NOT NULL,
    state VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    due_on TIMESTAMP,
    milestone_id INTEGER NOT NULL,
    open_issues_count INTEGER,
    closed_issues_count INTEGER,
    progress DOUBLE PRECISION NOT NULL,
    repository_id BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE tasks (
    id BIGSERIAL PRIMARY KEY,
    is_active BOOLEAN,
    body_url VARCHAR(255),
    created_at DATE,
    updated_at DATE,
    last_edited_at DATE,
    closed_at DATE,
    body VARCHAR(255),
    title VARCHAR(255),
    url VARCHAR(255),
    milestone_id BIGINT NOT NULL
);

CREATE TABLE assignees (
    id BIGSERIAL PRIMARY KEY,
    avatar_url VARCHAR(255),
    email VARCHAR(255),
    login VARCHAR(255),
    name VARCHAR(255),
    pronouns VARCHAR(255),
    url VARCHAR(255),
    website_url VARCHAR(255),
    task_id BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

CREATE TABLE labels (
    id BIGSERIAL PRIMARY KEY,
    url VARCHAR(255),
    name VARCHAR(255),
    color VARCHAR(255),
    created_at DATE,
    updated_at DATE,
    description VARCHAR(255),
    is_default BOOLEAN,
    task_id BIGINT NOT NULL
);

CREATE TABLE repositories (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    monitor_id BIGINT NOT NULL,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);

INSERT INTO users (name, email, password, auth_type)
VALUES ('John Doe', 'j.froe@gmx.at', 'password', 'local');

INSERT INTO monitors (type, monitor_hash, project_identification)
VALUES ('ORGANIZATION', 'w32tgse', 12345);

INSERT INTO monitor_user (user_id, monitor_id)
VALUES ((SELECT id FROM users WHERE email = 'j.froe@gmx.at'), (SELECT id FROM monitors WHERE monitor_hash = 'w32tgse'));

SELECT user_id FROM monitor_user mu
      LEFT JOIN users u ON mu.user_id = u.id
      LEFT JOIN monitors m ON mu.monitor_id = m.id
      WHERE u.email = 'j.froe@gmx.at'
      AND u.password = 'password'
      AND m.monitor_hash = 'w32tgse';

INSERT INTO users (name, email, password, auth_type)
VALUES ('New User', 'newuser@example.com', 'newpassword', 'local');

INSERT INTO monitor_user (user_id, monitor_id)
VALUES ((SELECT id FROM users WHERE email = 'newuser@example.com'), (SELECT id FROM monitors WHERE monitor_hash = 'w32tgse'));

SELECT user_id FROM monitor_user mu
      LEFT JOIN users u ON mu.user_id = u.id
      LEFT JOIN monitors m ON mu.monitor_id = m.id
      WHERE u.email = 'newuser@example.com'
      AND u.password = 'newpassword'
      AND m.monitor_hash = 'w32tgse';
