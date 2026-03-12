-- /db/seed.sql
-- Seed data for Language Learning Adventure (PostgreSQL)

BEGIN;

-- USERS
INSERT INTO "user" (email, display_name, username, password, created_at) VALUES
  ('tom@example.com', 'Tom Sawyer', 'TomSawyer', 'cantreadyet', NOW() - INTERVAL '10 days'),
  ('xiexie@example.com', 'Xie Xie', 'XieXie', 'thankyou', NOW() - INTERVAL '8 days');

-- STREAKS
INSERT INTO user_streak (user_id, streak_count, last_activity_date) VALUES
  (1, 4, CURRENT_DATE),
  (2, 1, CURRENT_DATE - INTERVAL '1 day');

-- WORDS
INSERT INTO word (term, definition, phonetic, audio_url) VALUES
  ('application', 'A formal request or a software program used for a purpose.', 'ap-li-KAY-shun', NULL),
  ('employee',    'A person who works for an organization in return for payment.', 'em-PLOY-ee', NULL),
  ('schedule',    'A plan for carrying out a process or procedure, giving lists of intended events and times.', 'SKED-jool', NULL),
  ('persist',     'To continue to exist; in data, to be saved and remain after closing an app.', 'per-SIST', NULL),
  ('adventure',   'An unusual and exciting experience or activity.', 'ad-VEN-cher', NULL);

-- USER WORD PROGRESS
INSERT INTO user_word_progress (user_id, word_id, status, times_seen, last_seen_at) VALUES
  (1, 1, 'learning', 2, NOW() - INTERVAL '2 days'),
  (1, 2, 'new', 0, NULL),
  (1, 3, 'mastered', 6, NOW() - INTERVAL '1 day'),
  (2, 1, 'new', 0, NULL),
  (2, 5, 'learning', 1, NOW() - INTERVAL '3 days');

-- PASSAGES
INSERT INTO passage (title, body_text, reading_level, audio_url) VALUES
  (
    'A Busy Day',
    'Today I have a busy schedule. I open my application and review my tasks. I want my progress to persist after I close the app.',
    1,
    NULL
  ),
  (
    'At Work',
    'An employee works with a team. They finish a project and celebrate. Learning new words makes work easier.',
    2,
    NULL
  );

-- PASSAGE WORD
INSERT INTO passage_word (passage_id, word_id) VALUES
  (1, 1),
  (1, 3),
  (1, 4),
  (2, 2),
  (2, 5);

-- USER READING PROGRESS
INSERT INTO user_reading_progress (user_id, passage_id, percent_complete, completed_at) VALUES
  (1, 1, 80, NULL),
  (1, 2, 100, NOW() - INTERVAL '5 days'),
  (2, 1, 20, NULL);

-- ADVENTURE
INSERT INTO adventure (name, description) VALUES
  ('The Market Quest', 'Practice simple choices and vocabulary in a short text adventure.');

-- SCENES
INSERT INTO scene (adventure_id, prompt_text, image_url, is_end) VALUES
  (1, 'You enter a lively market. A vendor greets you and offers two items. What do you do?', NULL, FALSE),
  (1, 'You choose the fruit. The vendor smiles and teaches you a new word: "employee".', NULL, FALSE),
  (1, 'You choose the bread. You learn the word "application" from a sign at the stall.', NULL, FALSE),
  (1, 'You thank the vendor and continue your adventure another day.', NULL, TRUE);

-- CHOICES
INSERT INTO choice (scene_id, choice_text, next_scene_id) VALUES
  (1, 'Buy fruit', 2),
  (1, 'Buy bread', 3),
  (2, 'Continue walking', 4),
  (3, 'Continue walking', 4);

-- USER ADVENTURE STATE
INSERT INTO user_adventure_state (user_id, adventure_id, current_scene_id, last_updated_at) VALUES
  (1, 1, 1, NOW() - INTERVAL '1 day'),
  (2, 1, 2, NOW() - INTERVAL '2 days');

COMMIT;