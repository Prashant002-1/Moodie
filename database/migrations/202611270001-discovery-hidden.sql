-- Films a person has said are not for them. Discovery never offers these again.
-- Private to the person; nobody else can read it.
CREATE TABLE IF NOT EXISTS discovery_hidden (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, movie_id)
);
