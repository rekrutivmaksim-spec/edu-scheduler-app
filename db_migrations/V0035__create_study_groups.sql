CREATE TABLE study_groups (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    invite_code VARCHAR(8) UNIQUE NOT NULL,
    owner_id INTEGER NOT NULL REFERENCES users(id),
    university VARCHAR(300),
    faculty VARCHAR(300),
    course INTEGER,
    max_members INTEGER DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE study_group_members (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES study_groups(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    role VARCHAR(20) DEFAULT 'member' NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(group_id, user_id)
);

CREATE TABLE group_schedule (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES study_groups(id),
    subject VARCHAR(200) NOT NULL,
    type VARCHAR(50) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    day_of_week INTEGER NOT NULL,
    week_type VARCHAR(10) DEFAULT 'every' NOT NULL,
    room VARCHAR(100),
    teacher VARCHAR(200),
    color VARCHAR(50) DEFAULT 'bg-blue-500',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_tasks (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES study_groups(id),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    subject VARCHAR(200),
    deadline TIMESTAMP,
    priority VARCHAR(20) DEFAULT 'medium',
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_study_groups_owner ON study_groups(owner_id);
CREATE INDEX idx_study_groups_invite ON study_groups(invite_code);
CREATE INDEX idx_group_members_group ON study_group_members(group_id);
CREATE INDEX idx_group_members_user ON study_group_members(user_id);
CREATE INDEX idx_group_schedule_group ON group_schedule(group_id);
CREATE INDEX idx_group_tasks_group ON group_tasks(group_id);

COMMENT ON TABLE study_groups IS 'Учебные группы одногруппников';
COMMENT ON COLUMN study_group_members.role IS 'Роль: owner, admin, member';