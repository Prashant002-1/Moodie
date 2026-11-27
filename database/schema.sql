-- Moodie Database Schema
-- A film diary whose emotional record drives personal and social discovery.

-- Movies table for caching TMDB movie data
CREATE TABLE IF NOT EXISTS movies (
    id INTEGER PRIMARY KEY, -- TMDB movie ID
    title VARCHAR(500) NOT NULL,
    overview TEXT,
    release_date DATE,
    poster_path VARCHAR(255),
    backdrop_path VARCHAR(255),
    vote_average DECIMAL(3,1) DEFAULT 0.0,
    vote_count INTEGER DEFAULT 0,
    popularity DECIMAL(8,3) DEFAULT 0.0,
    runtime INTEGER,
    tmdb_data JSONB, -- Store full TMDB response
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Genres table for movie genres
CREATE TABLE IF NOT EXISTS genres (
    id INTEGER PRIMARY KEY, -- TMDB genre ID
    name VARCHAR(100) NOT NULL
);

-- Users table for storing user profiles and preferences
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(240) DEFAULT '';
ALTER TABLE users ADD COLUMN IF NOT EXISTS recovery_hash VARCHAR(255);
-- NULL means the person has not chosen yet. 'off' keeps every language-model
-- feature and external assistant connection away from the account.
ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_mode VARCHAR(8) CHECK (ai_mode IN ('on', 'off'));
-- The person's choice about email. On by default; nothing is queued for them when off.
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_notifications BOOLEAN NOT NULL DEFAULT TRUE;

CREATE TABLE IF NOT EXISTS sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_attempts (
    key CHAR(64) PRIMARY KEY,
    attempts INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL
);

-- Legacy emotion-session table retained only as a migration source.
CREATE TABLE IF NOT EXISTS emotions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    session_id UUID DEFAULT gen_random_uuid(),
    neutral DECIMAL(3,2) DEFAULT 0.00,
    happy DECIMAL(3,2) DEFAULT 0.00,
    sad DECIMAL(3,2) DEFAULT 0.00,
    angry DECIMAL(3,2) DEFAULT 0.00,
    fearful DECIMAL(3,2) DEFAULT 0.00,
    disgusted DECIMAL(3,2) DEFAULT 0.00,
    surprised DECIMAL(3,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id, created_at) -- Composite key for unique emotion sessions per movie viewing
);

-- Movie-Genre junction table
CREATE TABLE IF NOT EXISTS movie_genres (
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    PRIMARY KEY (movie_id, genre_id)
);

-- Recommendations table for storing user recommendations
CREATE TABLE IF NOT EXISTS recommendations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emotion_id INTEGER REFERENCES emotions(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    recommendation_score DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User watchlist and watched movies
CREATE TABLE IF NOT EXISTS user_movies (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER REFERENCES movies(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'watchlist', -- 'watchlist', 'watched'
    rating INTEGER CHECK (rating >= 1 AND rating <= 10),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id, status)
);

-- Legacy user-maintained emotion-to-genre mappings retained for migration compatibility.
CREATE TABLE IF NOT EXISTS user_emotion_mappings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    emotion VARCHAR(20) NOT NULL,
    genre_id INTEGER REFERENCES genres(id) ON DELETE CASCADE,
    weight DECIMAL(5,4) DEFAULT 0.0000,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, emotion, genre_id)
);

-- Legacy current-state profile retained for migration compatibility.
CREATE TABLE IF NOT EXISTS user_emotion_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    neutral DECIMAL(3,2) DEFAULT 0.00,
    happy DECIMAL(3,2) DEFAULT 0.00,
    sad DECIMAL(3,2) DEFAULT 0.00,
    angry DECIMAL(3,2) DEFAULT 0.00,
    fearful DECIMAL(3,2) DEFAULT 0.00,
    disgusted DECIMAL(3,2) DEFAULT 0.00,
    surprised DECIMAL(3,2) DEFAULT 0.00,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- The diary is the current source of truth. A viewing, the viewer's response,
-- and the context needed to learn from it live in one atomic record.
CREATE TABLE IF NOT EXISTS diary_entries (
    id BIGSERIAL PRIMARY KEY,
    seed_key VARCHAR(160) UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    watched_on DATE NOT NULL DEFAULT CURRENT_DATE,
    rating DECIMAL(2,1) CHECK (rating IS NULL OR (rating >= 0.5 AND rating <= 5.0)),
    note VARCHAR(2000) DEFAULT '',
    visibility VARCHAR(12) NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
    neutral DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (neutral BETWEEN 0 AND 1),
    happy DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (happy BETWEEN 0 AND 1),
    sad DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (sad BETWEEN 0 AND 1),
    angry DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (angry BETWEEN 0 AND 1),
    fearful DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (fearful BETWEEN 0 AND 1),
    disgusted DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (disgusted BETWEEN 0 AND 1),
    surprised DECIMAL(4,3) NOT NULL DEFAULT 0.000 CHECK (surprised BETWEEN 0 AND 1),
    capture_method VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (capture_method = 'manual'), -- retained for data compatibility; active input is direct
    confidence DECIMAL(4,3) NOT NULL DEFAULT 1.000 CHECK (confidence = 1), -- retained for data compatibility
    legacy_user_movie_id INTEGER UNIQUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Track emotional evidence separately from wording and attached-media edits.
-- Backfill conservatively: old schemas did not record when feelings last changed.
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS signal_updated_at TIMESTAMP;
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS published_at TIMESTAMP;
UPDATE diary_entries SET signal_updated_at = GREATEST(created_at, updated_at) WHERE signal_updated_at IS NULL;
UPDATE diary_entries SET published_at = GREATEST(created_at, updated_at) WHERE visibility = 'public' AND published_at IS NULL;

CREATE OR REPLACE FUNCTION moodie_track_signal_version() RETURNS trigger AS $signal_version$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.signal_updated_at := GREATEST(NEW.created_at, NEW.updated_at);
    NEW.published_at := CASE WHEN NEW.visibility = 'public' THEN NEW.signal_updated_at ELSE NULL END;
  ELSE
    IF ROW(NEW.neutral, NEW.happy, NEW.sad, NEW.angry, NEW.fearful, NEW.disgusted, NEW.surprised, NEW.watched_on, NEW.movie_id, NEW.user_id)
       IS DISTINCT FROM ROW(OLD.neutral, OLD.happy, OLD.sad, OLD.angry, OLD.fearful, OLD.disgusted, OLD.surprised, OLD.watched_on, OLD.movie_id, OLD.user_id) THEN
      NEW.signal_updated_at := CURRENT_TIMESTAMP;
    ELSE
      NEW.signal_updated_at := OLD.signal_updated_at;
    END IF;
    IF NEW.visibility = 'public' AND (OLD.visibility <> 'public' OR (trim(OLD.note) = '' AND trim(NEW.note) <> '')) THEN
      NEW.published_at := CURRENT_TIMESTAMP;
    ELSE
      NEW.published_at := OLD.published_at;
    END IF;
  END IF;
  RETURN NEW;
END;
$signal_version$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS diary_signal_version ON diary_entries;
CREATE TRIGGER diary_signal_version BEFORE INSERT OR UPDATE ON diary_entries
  FOR EACH ROW EXECUTE FUNCTION moodie_track_signal_version();

-- Stable seed ownership is additive and nullable so ordinary user entries are
-- never mistaken for data that the explicit seed command may reconcile.
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS seed_key VARCHAR(160);
CREATE UNIQUE INDEX IF NOT EXISTS idx_diary_entries_seed_key
    ON diary_entries(seed_key) WHERE seed_key IS NOT NULL;

-- A shared expression image is optional post media. It is deliberately
-- Optional post media stays separate from the person's saved feelings.
-- was inferred from that face.
CREATE TABLE IF NOT EXISTS entry_media (
    entry_id BIGINT NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    kind VARCHAR(24) NOT NULL CHECK (kind IN ('expression_photo')),
    asset_path TEXT NOT NULL,
    alt_text VARCHAR(240) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (entry_id, kind)
);

ALTER TABLE entry_media ALTER COLUMN asset_path TYPE TEXT;

CREATE TABLE IF NOT EXISTS saved_films (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, movie_id)
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    followed_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    CHECK (follower_id <> followed_id)
);

CREATE TABLE IF NOT EXISTS entry_reactions (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, entry_id)
);

-- Comments belong to a saved response, not to the film in the abstract.
CREATE TABLE IF NOT EXISTS entry_comments (
    id BIGSERIAL PRIMARY KEY,
    seed_key VARCHAR(200),
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 1000),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE entry_comments ADD COLUMN IF NOT EXISTS seed_key VARCHAR(200);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_emotions_user_id ON emotions(user_id);
CREATE INDEX IF NOT EXISTS idx_emotions_session_id ON emotions(session_id);
CREATE INDEX IF NOT EXISTS idx_emotions_created_at ON emotions(created_at);
CREATE INDEX IF NOT EXISTS idx_emotions_movie_id ON emotions(movie_id);
CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);
CREATE INDEX IF NOT EXISTS idx_movies_release_date ON movies(release_date);
CREATE INDEX IF NOT EXISTS idx_movies_vote_average ON movies(vote_average);
CREATE INDEX IF NOT EXISTS idx_recommendations_user_id ON recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_created_at ON recommendations(created_at);
CREATE INDEX IF NOT EXISTS idx_user_movies_user_id ON user_movies(user_id);
CREATE INDEX IF NOT EXISTS idx_user_movies_status ON user_movies(status);
CREATE INDEX IF NOT EXISTS idx_user_emotion_mappings_user_id ON user_emotion_mappings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_emotion_mappings_emotion ON user_emotion_mappings(emotion);
CREATE INDEX IF NOT EXISTS idx_user_emotion_profiles_user_id ON user_emotion_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_diary_entries_user_date ON diary_entries(user_id, watched_on DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_public ON diary_entries(visibility, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diary_entries_movie ON diary_entries(movie_id);
CREATE INDEX IF NOT EXISTS idx_entry_media_kind ON entry_media(kind);
CREATE INDEX IF NOT EXISTS idx_saved_films_user ON saved_films(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_followed ON follows(followed_id);
CREATE INDEX IF NOT EXISTS idx_entry_comments_entry ON entry_comments(entry_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_entry_comments_user ON entry_comments(user_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_comments_seed_key ON entry_comments(seed_key) WHERE seed_key IS NOT NULL;

-- Insert initial genre data (TMDB standard genres)
INSERT INTO genres (id, name) VALUES 
(28, 'Action'),
(12, 'Adventure'),
(16, 'Animation'),
(35, 'Comedy'),
(80, 'Crime'),
(99, 'Documentary'),
(18, 'Drama'),
(10751, 'Family'),
(14, 'Fantasy'),
(36, 'History'),
(27, 'Horror'),
(10402, 'Music'),
(9648, 'Mystery'),
(10749, 'Romance'),
(878, 'Science Fiction'),
(10770, 'TV Movie'),
(53, 'Thriller'),
(10752, 'War'),
(37, 'Western')
ON CONFLICT (id) DO NOTHING;

-- Preserve records from the previous list-and-emotion model when this schema is
-- applied to an existing database. The old tables remain readable as a migration
-- source, but no current API writes to them.
CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
DO $migration$
BEGIN
IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE id = 'legacy-diary-import') THEN
INSERT INTO saved_films (user_id, movie_id, created_at)
SELECT user_id, movie_id, created_at
FROM user_movies
WHERE status = 'watchlist'
ON CONFLICT (user_id, movie_id) DO NOTHING;

INSERT INTO diary_entries (
    user_id, movie_id, watched_on, rating, visibility,
    neutral, happy, sad, angry, fearful, disgusted, surprised,
    capture_method, confidence, legacy_user_movie_id, created_at, updated_at
)
SELECT
    um.user_id,
    um.movie_id,
    um.created_at::date,
    CASE WHEN um.rating IS NULL THEN NULL ELSE ROUND((um.rating::numeric / 2.0) * 2) / 2 END,
    'private',
    COALESCE(e.neutral, 0), COALESCE(e.happy, 0), COALESCE(e.sad, 0),
    COALESCE(e.angry, 0), COALESCE(e.fearful, 0), COALESCE(e.disgusted, 0), COALESCE(e.surprised, 0),
    'manual', 1, um.id, um.created_at, um.created_at
FROM user_movies um
LEFT JOIN LATERAL (
    SELECT * FROM emotions source_emotion
    WHERE source_emotion.user_id = um.user_id AND source_emotion.movie_id = um.movie_id
    ORDER BY ABS(EXTRACT(EPOCH FROM (source_emotion.created_at - um.created_at))) ASC
    LIMIT 1
) e ON TRUE
WHERE um.status = 'watched'
ON CONFLICT (legacy_user_movie_id) DO NOTHING;

INSERT INTO schema_migrations (id) VALUES ('legacy-diary-import');
END IF;
END $migration$;

-- Native community safety. These tables also protect authenticated web reads.
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_reverse ON user_blocks(blocked_id, blocker_id);
CREATE TABLE IF NOT EXISTS moderation_reports (
    id BIGSERIAL PRIMARY KEY,
    reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    target_kind TEXT NOT NULL CHECK (target_kind IN ('response', 'comment', 'person')),
    target_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    details TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'removed')),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    resolved_at TIMESTAMP,
    UNIQUE (reporter_id, target_kind, target_id)
);
CREATE INDEX IF NOT EXISTS moderation_reports_queue ON moderation_reports(status, created_at);
CREATE TABLE IF NOT EXISTS moderation_actions (
    target_kind TEXT NOT NULL CHECK (target_kind IN ('response', 'comment', 'person')),
    target_id BIGINT NOT NULL,
    reason TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (target_kind, target_id)
);

-- Human recommendation lifecycle. Additive: existing clients keep their contracts.
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS enjoyment TEXT
    CHECK (enjoyment IN ('loved', 'liked', 'mixed', 'not_for_me'));
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS highlights TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS client_request_id UUID;
ALTER TABLE diary_entries ADD COLUMN IF NOT EXISTS request_hash TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS diary_request_identity ON diary_entries(user_id, client_request_id);

CREATE TABLE IF NOT EXISTS film_suggestions (
    id BIGSERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    origin TEXT NOT NULL CHECK (origin IN ('sent', 'discovered')),
    reason VARCHAR(1000) NOT NULL DEFAULT '',
    source_entry_id BIGINT REFERENCES diary_entries(id) ON DELETE SET NULL,
    linked_entry_id BIGINT REFERENCES diary_entries(id) ON DELETE SET NULL,
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (sender_id <> recipient_id),
    UNIQUE(sender_id, recipient_id, movie_id, origin)
);
CREATE INDEX IF NOT EXISTS suggestions_recipient ON film_suggestions(recipient_id, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS suggestions_sender ON film_suggestions(sender_id, created_at DESC, id DESC);
-- Opening a conversation is explicit and survives retracting a particular reply.
ALTER TABLE film_suggestions ADD COLUMN IF NOT EXISTS shared_at TIMESTAMP;
-- The recipient's own reminder to watch a recommended film. Only they can see
-- it. It is cleared when they archive the recommendation or link a viewing.
ALTER TABLE film_suggestions ADD COLUMN IF NOT EXISTS remind_at TIMESTAMP;
CREATE INDEX IF NOT EXISTS suggestions_reminders ON film_suggestions(recipient_id, remind_at) WHERE remind_at IS NOT NULL;

-- A reply is an explicitly shared message, never an automatic copy of a diary.
-- Deleting its viewing also retracts the reply. Visibility edits do not publish
-- a diary; only the independently composed reply and opted-in feeling snapshot
-- are visible to the other participant.
CREATE TABLE IF NOT EXISTS suggestion_replies (
    suggestion_id BIGINT PRIMARY KEY REFERENCES film_suggestions(id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL REFERENCES diary_entries(id) ON DELETE CASCADE,
    enjoyment TEXT NOT NULL CHECK (enjoyment IN ('loved', 'liked', 'mixed', 'not_for_me')),
    highlights TEXT[] NOT NULL DEFAULT '{}',
    note VARCHAR(1000) NOT NULL DEFAULT '',
    feelings JSONB,
    contains_spoilers BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suggestion_messages (
    id BIGSERIAL PRIMARY KEY,
    suggestion_id BIGINT NOT NULL REFERENCES film_suggestions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_request_id UUID NOT NULL,
    body VARCHAR(1000) NOT NULL CHECK (char_length(trim(body)) > 0),
    contains_spoilers BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, client_request_id)
);
CREATE INDEX IF NOT EXISTS suggestion_messages_order ON suggestion_messages(suggestion_id, id);
UPDATE film_suggestions s SET shared_at = COALESCE(
    (SELECT r.created_at FROM suggestion_replies r WHERE r.suggestion_id=s.id),
    (SELECT MIN(m.created_at) FROM suggestion_messages m WHERE m.suggestion_id=s.id))
WHERE s.shared_at IS NULL AND (EXISTS(SELECT 1 FROM suggestion_replies r WHERE r.suggestion_id=s.id)
    OR EXISTS(SELECT 1 FROM suggestion_messages m WHERE m.suggestion_id=s.id));

-- Email waiting to go out. One row per person, kind and recommendation, so
-- nothing is queued twice. `payload` is what the email said when it was queued;
-- delivery reads the recommendation again and skips a row that no longer applies.
-- `error` holds why a row was skipped or failed. `claimed_at` is a short lease
-- so two delivery runs never hand the same row to a provider.
CREATE TABLE IF NOT EXISTS notification_outbox (
    id BIGSERIAL PRIMARY KEY,
    recipient_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('recommendation', 'reminder', 'reply')),
    suggestion_id BIGINT NOT NULL REFERENCES film_suggestions(id) ON DELETE CASCADE,
    payload JSONB NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
    error TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    claimed_at TIMESTAMP,
    sent_at TIMESTAMP,
    UNIQUE (recipient_id, kind, suggestion_id)
);
CREATE INDEX IF NOT EXISTS notification_outbox_pending ON notification_outbox(id) WHERE status = 'pending';

-- Films a person has said are not for them. Discovery never offers these again.
-- Private to the person; nobody else can read it.
CREATE TABLE IF NOT EXISTS discovery_hidden (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, movie_id)
);
