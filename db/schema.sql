-- /db/schema.sql
-- Language Learning Adventure - ERD-aligned schema (PostgreSQL)

BEGIN;

-- Drop in dependency-safe order
DROP TABLE IF EXISTS choice CASCADE;
DROP TABLE IF EXISTS user_adventure_state CASCADE;
DROP TABLE IF EXISTS scene CASCADE;
DROP TABLE IF EXISTS adventure CASCADE;

DROP TABLE IF EXISTS user_reading_progress CASCADE;
DROP TABLE IF EXISTS passage_word CASCADE;
DROP TABLE IF EXISTS passage CASCADE;

DROP TABLE IF EXISTS user_word_progress CASCADE;
DROP TABLE IF EXISTS word CASCADE;

DROP TABLE IF EXISTS user_streak CASCADE;
DROP TABLE IF EXISTS "user" CASCADE;

-- -------------------------
-- Core user tables
-- -------------------------

CREATE TABLE "user" (
  user_id       INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(100) NOT NULL,
  username      VARCHAR(100) NOT NULL,
  password      VARCHAR(255) NOT NULL,
  created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_email UNIQUE (email),
  CONSTRAINT uq_user_username UNIQUE (username)
);

-- 1:1 optional table (user may have 0 or 1 streak record)
CREATE TABLE user_streak (
  user_id            INT PRIMARY KEY,
  streak_count       INT NOT NULL DEFAULT 0,
  last_activity_date DATE,
  CONSTRAINT fk_user_streak_user
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
    ON DELETE CASCADE,
  CONSTRAINT ck_user_streak_nonneg
    CHECK (streak_count >= 0)
);

-- -------------------------
-- Vocab tables
-- -------------------------

CREATE TABLE word (
  word_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  term        VARCHAR(120) NOT NULL,
  definition  TEXT NOT NULL,
  phonetic    VARCHAR(120),
  audio_url   VARCHAR(500),
  CONSTRAINT uq_word_term UNIQUE (term)
);

CREATE TABLE user_word_progress (
  user_word_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id      INT NOT NULL,
  word_id      INT NOT NULL,
  status       VARCHAR(30) NOT NULL DEFAULT 'new',
  times_seen   INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMP,
  CONSTRAINT fk_uwp_user
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_uwp_word
    FOREIGN KEY (word_id) REFERENCES word(word_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_uwp_user_word UNIQUE (user_id, word_id),
  CONSTRAINT ck_uwp_times_seen_nonneg CHECK (times_seen >= 0)
);

CREATE INDEX idx_uwp_user_id ON user_word_progress(user_id);
CREATE INDEX idx_uwp_word_id ON user_word_progress(word_id);

-- -------------------------
-- Reading tables
-- -------------------------

CREATE TABLE passage (
  passage_id     INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  body_text      TEXT NOT NULL,
  reading_level  INT NOT NULL,
  audio_url      VARCHAR(500),
  CONSTRAINT ck_passage_level_nonneg CHECK (reading_level >= 0)
);

CREATE TABLE passage_word (
  passage_word_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  passage_id      INT NOT NULL,
  word_id         INT NOT NULL,
  CONSTRAINT fk_pw_passage
    FOREIGN KEY (passage_id) REFERENCES passage(passage_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_pw_word
    FOREIGN KEY (word_id) REFERENCES word(word_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_pw_passage_word UNIQUE (passage_id, word_id)
);

CREATE INDEX idx_pw_passage_id ON passage_word(passage_id);
CREATE INDEX idx_pw_word_id ON passage_word(word_id);

CREATE TABLE user_reading_progress (
  user_reading_id   INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           INT NOT NULL,
  passage_id        INT NOT NULL,
  percent_complete  INT NOT NULL DEFAULT 0,
  completed_at      TIMESTAMP,
  CONSTRAINT fk_urp_user
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_urp_passage
    FOREIGN KEY (passage_id) REFERENCES passage(passage_id)
    ON DELETE CASCADE,
  CONSTRAINT uq_urp_user_passage UNIQUE (user_id, passage_id),
  CONSTRAINT ck_urp_percent_range CHECK (percent_complete BETWEEN 0 AND 100)
);

CREATE INDEX idx_urp_user_id ON user_reading_progress(user_id);
CREATE INDEX idx_urp_passage_id ON user_reading_progress(passage_id);

-- -------------------------
-- Adventure tables
-- -------------------------

CREATE TABLE adventure (
  adventure_id  INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          VARCHAR(200) NOT NULL,
  description   TEXT
);

CREATE TABLE scene (
  scene_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  adventure_id  INT NOT NULL,
  prompt_text   TEXT NOT NULL,
  image_url     VARCHAR(500),
  is_end        BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT fk_scene_adventure
    FOREIGN KEY (adventure_id) REFERENCES adventure(adventure_id)
    ON DELETE CASCADE
);

CREATE INDEX idx_scene_adventure_id ON scene(adventure_id);

CREATE TABLE choice (
  choice_id      INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  scene_id       INT NOT NULL,
  choice_text    VARCHAR(255) NOT NULL,
  next_scene_id  INT,
  CONSTRAINT fk_choice_scene
    FOREIGN KEY (scene_id) REFERENCES scene(scene_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_choice_next_scene
    FOREIGN KEY (next_scene_id) REFERENCES scene(scene_id)
    ON DELETE SET NULL
);

CREATE INDEX idx_choice_scene_id ON choice(scene_id);
CREATE INDEX idx_choice_next_scene_id ON choice(next_scene_id);

CREATE TABLE user_adventure_state (
  user_adventure_id INT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           INT NOT NULL,
  adventure_id      INT NOT NULL,
  current_scene_id  INT,
  last_updated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_uas_user
    FOREIGN KEY (user_id) REFERENCES "user"(user_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_uas_adventure
    FOREIGN KEY (adventure_id) REFERENCES adventure(adventure_id)
    ON DELETE CASCADE,
  CONSTRAINT fk_uas_scene
    FOREIGN KEY (current_scene_id) REFERENCES scene(scene_id)
    ON DELETE SET NULL,
  CONSTRAINT uq_uas_user_adventure UNIQUE (user_id, adventure_id)
);

CREATE INDEX idx_uas_user_id ON user_adventure_state(user_id);
CREATE INDEX idx_uas_adventure_id ON user_adventure_state(adventure_id);

COMMIT;