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

-- Additional tables to support users, levels, submissions and knowledge base.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS levels (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  -- Optionally link levels to courses if needed in future
  course_id INTEGER,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  level_id INTEGER REFERENCES levels(id) ON DELETE CASCADE,
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id SERIAL PRIMARY KEY,
  title TEXT,
  content TEXT
);

-- Example insertion of a default course. When deploying you may
-- execute this or seed the database via application code.
-- INSERT INTO courses (title, description, content)
-- VALUES ('Introduction to the Platform',
--         'Learn about the basics of this learning platform.',
--         'Welcome to the introduction course.');