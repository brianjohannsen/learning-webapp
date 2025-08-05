-- Schema for the PostgreSQL database used by the learning webapp
-- This schema defines a simple `courses` table that stores
-- course metadata. Additional tables such as users, levels,
-- submissions and knowledge can be added following a similar
-- pattern.

-- Enable extensions if needed (not required for basic usage)
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS courses (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  image TEXT
);

-- Example insertion of a default course. When deploying you may
-- execute this or seed the database via application code.
-- INSERT INTO courses (title, description, content)
-- VALUES ('Introduction to the Platform',
--         'Learn about the basics of this learning platform.',
--         'Welcome to the introduction course.');
