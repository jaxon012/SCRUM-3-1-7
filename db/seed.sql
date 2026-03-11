-- /db/seed.sql
-- Seed data for Language Learning Adventure (PostgreSQL)

BEGIN;

-- USERS
INSERT INTO "user" (user_id, email, display_name, created_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 'jaxon@example.com', 'Jaxon', NOW() - INTERVAL '10 days'),
  (2, 'emma@example.com',  'Emma',  NOW() - INTERVAL '8 days');

-- STREAKS (optional 1:1)
INSERT INTO user_streak (user_id, streak_count, last_activity_date) VALUES
  (1, 4, CURRENT_DATE),
  (2, 1, CURRENT_DATE - INTERVAL '1 day');

-- WORDS
INSERT INTO word (word_id, term, definition, phonetic, audio_url) OVERRIDING SYSTEM VALUE VALUES
  (1,  'application',  'A formal request or a software program used for a purpose.', 'ap-li-KAY-shun', NULL),
  (2,  'employee',     'A person who works for an organization in return for payment.', 'em-PLOY-ee', NULL),
  (3,  'schedule',     'A plan for carrying out a process or procedure, giving lists of intended events and times.', 'SKED-jool', NULL),
  (4,  'persist',      'To continue to exist; in data, to be saved and remain after closing an app.', 'per-SIST', NULL),
  (5,  'adventure',    'An unusual and exciting experience or activity.', 'ad-VEN-cher', NULL),
  (6,  'vocabulary',   'The body of words used in a particular language or subject.', 'voh-KAB-yoo-lair-ee', NULL),
  (7,  'fluent',       'Able to speak or write a language easily and accurately.', 'FLOO-ent', NULL),
  (8,  'translate',    'To express the sense of words in another language.', 'TRANS-layt', NULL),
  (9,  'grammar',      'The rules of a language governing the use of words and sentences.', 'GRAM-er', NULL),
  (10, 'pronunciation','The way in which a word or language is spoken.', 'pruh-nun-see-AY-shun', NULL),
  (11, 'syllable',     'A unit of pronunciation having one vowel sound.', 'SIL-uh-bul', NULL),
  (12, 'definition',   'A statement of the exact meaning of a word.', 'def-ih-NIH-shun', NULL),
  (13, 'context',      'The circumstances that form the setting for an event or idea.', 'KON-tekst', NULL),
  (14, 'comprehend',   'To understand fully the meaning of something.', 'kom-prih-HEND', NULL),
  (15, 'practice',     'Repeated exercise to improve a skill.', 'PRAK-tis', NULL),
  (16, 'memorize',     'To commit to memory; learn by heart.', 'MEM-uh-ryz', NULL),
  (17, 'fluency',      'The quality of being fluent, especially in a foreign language.', 'FLOO-en-see', NULL),
  (18, 'dialect',      'A regional variety of a language with distinct vocabulary and grammar.', 'DY-uh-lekt', NULL),
  (19, 'idiom',        'A phrase whose meaning cannot be deduced from its individual words.', 'ID-ee-um', NULL),
  (20, 'synonym',      'A word or phrase that means exactly the same as another word.', 'SIN-uh-nim', NULL),
  (21, 'antonym',      'A word opposite in meaning to another word.', 'AN-tuh-nim', NULL),
  (22, 'prefix',       'A word part added at the beginning of a word to change its meaning.', 'PREE-fiks', NULL),
  (23, 'suffix',       'A word part added at the end of a word to change its meaning.', 'SUF-iks', NULL),
  (24, 'noun',         'A word that names a person, place, thing, or idea.', 'NOWN', NULL),
  (25, 'verb',         'A word used to describe an action, state, or occurrence.', 'VERB', NULL),
  (26, 'adjective',    'A word that describes or modifies a noun.', 'AJ-ik-tiv', NULL),
  (27, 'adverb',       'A word that modifies a verb, adjective, or other adverb.', 'AD-verb', NULL),
  (28, 'conjunction',  'A word used to connect clauses, sentences, or words.', 'kun-JUNK-shun', NULL),
  (29, 'preposition',  'A word governing a noun and expressing its relation to other words.', 'prep-uh-ZIH-shun', NULL),
  (30, 'sentence',     'A set of words that expresses a complete thought.', 'SEN-tens', NULL),
  (31, 'paragraph',    'A distinct section of writing dealing with a single theme.', 'PAIR-uh-graf', NULL),
  (32, 'narrative',    'A spoken or written account of connected events; a story.', 'NAIR-uh-tiv', NULL),
  (33, 'dialogue',     'A conversation between two or more people in a book, play, or film.', 'DY-uh-log', NULL),
  (34, 'expression',   'A word or phrase used to convey an idea or a look on someone''s face.', 'ik-SPRESH-un', NULL),
  (35, 'accent',       'A distinct emphasis given to a syllable or word in speech.', 'AK-sent', NULL),
  (36, 'bilingual',    'Able to speak two languages fluently.', 'by-LING-gwul', NULL),
  (37, 'immersion',    'Deep involvement in an activity, especially to learn a language.', 'ih-MER-zhun', NULL),
  (38, 'literal',      'Taking words in their usual or most basic sense without metaphor.', 'LIT-er-ul', NULL),
  (39, 'figurative',   'Using figures of speech; not literal or exact.', 'FIG-yur-uh-tiv', NULL),
  (40, 'infer',        'To deduce from evidence and reasoning rather than explicit statements.', 'in-FER', NULL),
  (41, 'elaborate',    'To develop or present a theory or idea in detail.', 'ih-LAB-uh-rayt', NULL),
  (42, 'summarize',    'To give a brief statement of the main points of something.', 'SUM-uh-ryz', NULL),
  (43, 'evaluate',     'To form an idea of the amount or quality of; to assess.', 'ih-VAL-yoo-ayt', NULL),
  (44, 'analyze',      'To examine in detail in order to explain or interpret.', 'AN-uh-lyz', NULL),
  (45, 'sequence',     'A particular order in which related things follow each other.', 'SEE-kwens', NULL),
  (46, 'category',     'A class or division of things that share common characteristics.', 'KAT-ih-gor-ee', NULL),
  (47, 'compare',      'To examine the similarities and differences between two things.', 'kum-PAIR', NULL),
  (48, 'contrast',     'To note the differences between two or more things.', 'KON-trast', NULL),
  (49, 'evidence',     'Information indicating whether something is true or valid.', 'EV-ih-dens', NULL),
  (50, 'conclusion',   'A judgment or decision reached after consideration.', 'kun-KLOO-zhun', NULL);

-- USER WORD PROGRESS
-- (This table is great for your “one working button”)
INSERT INTO user_word_progress (user_word_id, user_id, word_id, status, times_seen, last_seen_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 'learning', 2, NOW() - INTERVAL '2 days'),
  (2, 1, 2, 'new',      0, NULL),
  (3, 1, 3, 'mastered', 6, NOW() - INTERVAL '1 day'),
  (4, 2, 1, 'new',      0, NULL),
  (5, 2, 5, 'learning', 1, NOW() - INTERVAL '3 days');

-- PASSAGES
INSERT INTO passage (passage_id, title, body_text, reading_level, audio_url) OVERRIDING SYSTEM VALUE VALUES
  (1, 'A Busy Day', 
   'Today I have a busy schedule. I open my application and review my tasks. I want my progress to persist after I close the app.',
   1,
   NULL),
  (2, 'At Work',
   'An employee works with a team. They finish a project and celebrate. Learning new words makes work easier.',
   2,
   NULL);

-- PASSAGE WORD (junction)
INSERT INTO passage_word (passage_word_id, passage_id, word_id) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1), -- application
  (2, 1, 3), -- schedule
  (3, 1, 4), -- persist
  (4, 2, 2), -- employee
  (5, 2, 5); -- adventure (just to link it somewhere)

-- USER READING PROGRESS
INSERT INTO user_reading_progress (user_reading_id, user_id, passage_id, percent_complete, completed_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 80, NULL),
  (2, 1, 2, 100, NOW() - INTERVAL '5 days'),
  (3, 2, 1, 20, NULL);

-- ADVENTURE
INSERT INTO adventure (adventure_id, name, description) OVERRIDING SYSTEM VALUE VALUES
  (1, 'The Market Quest', 'Practice simple choices and vocabulary in a short text adventure.');

-- SCENES
INSERT INTO scene (scene_id, adventure_id, prompt_text, image_url, is_end) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'You enter a lively market. A vendor greets you and offers two items. What do you do?', NULL, FALSE),
  (2, 1, 'You choose the fruit. The vendor smiles and teaches you a new word: "employee".', NULL, FALSE),
  (3, 1, 'You choose the bread. You learn the word "application" from a sign at the stall.', NULL, FALSE),
  (4, 1, 'You thank the vendor and continue your adventure another day.', NULL, TRUE);

-- CHOICES (branching)
INSERT INTO choice (choice_id, scene_id, choice_text, next_scene_id) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 'Buy fruit', 2),
  (2, 1, 'Buy bread', 3),
  (3, 2, 'Continue walking', 4),
  (4, 3, 'Continue walking', 4);

-- USER ADVENTURE STATE
INSERT INTO user_adventure_state (user_adventure_id, user_id, adventure_id, current_scene_id, last_updated_at) OVERRIDING SYSTEM VALUE VALUES
  (1, 1, 1, 1, NOW() - INTERVAL '1 day'),
  (2, 2, 1, 2, NOW() - INTERVAL '2 days');

COMMIT;