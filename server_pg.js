/*
 * Express server with PostgreSQL integration for the learning webapp
 *
 * This server demonstrates how you might connect the learning
 * application to a PostgreSQL database. It uses the `pg` module to
 * connect to a database defined by the `DATABASE_URL` environment
 * variable and exposes a small REST API for courses. The server
 * also serves static files from the `public` directory so that the
 * existing frontend continues to work. Note that this file is
 * separate from the original server.js (which uses plain Node and
 * JSON storage). You can run this server with `node server_pg.js`
 * after installing dependencies defined in package.json.
 */

const path = require('path');
const express = require('express');
const { Pool } = require('pg');
const crypto = require('crypto');

// Environment variable DATABASE_URL should be set to a full
// PostgreSQL connection string, e.g.:
// postgres://username:password@host:port/database
const connectionString = process.env.DATABASE_URL || '';

// Create a new pool only if a connection string is provided. This
// allows the server to start even when the DATABASE_URL is not set.
let pool = null;
if (connectionString) {
  pool = new Pool({ connectionString });
}

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(express.json({ limit: '1mb' }));

// Serve static files from the public directory
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));

// In-memory session store for demonstration. Keys are tokens and
// values are user IDs. In a real application you would use a
// persistent session store or JWT library.
const sessions = {};

// Simple password hashing using SHA-256. This is not as secure as
// bcrypt but works without external dependencies. In production,
// always use a well-tested hashing library like bcrypt.
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Authentication middleware. Checks the Authorization header for a
// bearer token and maps it to a user ID using the sessions store.
function authenticate(req, res, next) {
  const header = req.headers['authorization'] || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (token && sessions[token]) {
    req.userId = sessions[token];
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized' });
}

/*
 * Authentication endpoints
 */

// Register a new user
app.post('/auth/register', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    // Check if email already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'User already exists' });
    }
    const passwordHash = hashPassword(password);
    const insert = await pool.query(
      'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email',
      [email, passwordHash]
    );
    return res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('Error registering user', err);
    return res.status(500).json({ error: 'Failed to register user' });
  }
});

// Log in a user and generate a session token
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const result = await pool.query('SELECT id, password_hash FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const user = result.rows[0];
    const passwordHash = hashPassword(password);
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = crypto.randomBytes(16).toString('hex');
    sessions[token] = user.id;
    return res.json({ token, userId: user.id });
  } catch (err) {
    console.error('Error logging in', err);
    return res.status(500).json({ error: 'Failed to login' });
  }
});

/*
 * Level, submission and knowledge endpoints
 */

// List all levels
app.get('/api/levels', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const result = await pool.query('SELECT * FROM levels ORDER BY id');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching levels', err);
    return res.status(500).json({ error: 'Failed to fetch levels' });
  }
});

// Get a single level by ID
app.get('/api/levels/:id', async (req, res) => {
  const levelId = parseInt(req.params.id, 10);
  if (Number.isNaN(levelId)) {
    return res.status(400).json({ error: 'Invalid level ID' });
  }
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const result = await pool.query('SELECT * FROM levels WHERE id = $1', [levelId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Level not found' });
    }
    return res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching level', err);
    return res.status(500).json({ error: 'Failed to fetch level' });
  }
});

// Submit content for a level. Requires authentication.
app.post('/api/submissions', authenticate, async (req, res) => {
  const { levelId, content } = req.body;
  const levelIdInt = parseInt(levelId, 10);
  if (Number.isNaN(levelIdInt) || !content) {
    return res.status(400).json({ error: 'Invalid level ID or content missing' });
  }
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const insert = await pool.query(
      'INSERT INTO submissions (user_id, level_id, content) VALUES ($1, $2, $3) RETURNING *',
      [req.userId, levelIdInt, content]
    );
    return res.status(201).json(insert.rows[0]);
  } catch (err) {
    console.error('Error creating submission', err);
    return res.status(500).json({ error: 'Failed to create submission' });
  }
});

// List all knowledge base entries
app.get('/api/knowledge', async (req, res) => {
  try {
    if (!pool) return res.status(500).json({ error: 'Database not configured' });
    const result = await pool.query('SELECT * FROM knowledge_base ORDER BY id');
    return res.json(result.rows);
  } catch (err) {
    console.error('Error fetching knowledge', err);
    return res.status(500).json({ error: 'Failed to fetch knowledge' });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', dbConnected: !!pool });
});

/*
 * Course endpoints using PostgreSQL
 */

// GET /api/courses - list all courses
app.get('/api/courses', async (req, res) => {
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const result = await pool.query('SELECT * FROM courses ORDER BY id');
    res.json(result.rows);
  } catch (err) {
    console.error('Error querying courses', err);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
});

// GET /api/courses/:id - get a single course by ID
app.get('/api/courses/:id', async (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const result = await pool.query('SELECT * FROM courses WHERE id = $1', [courseId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error querying course', err);
    res.status(500).json({ error: 'Failed to fetch course' });
  }
});

// POST /api/admin/courses - create a new course
app.post('/api/admin/courses', async (req, res) => {
  const { title, description, content, image } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const insertQuery =
      'INSERT INTO courses (title, description, content, image) VALUES ($1, $2, $3, $4) RETURNING *';
    const values = [title, description || null, content || null, image || null];
    const result = await pool.query(insertQuery, values);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error inserting course', err);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// PUT /api/admin/courses/:id - update an existing course
app.put('/api/admin/courses/:id', async (req, res) => {
  const courseId = parseInt(req.params.id, 10);
  if (Number.isNaN(courseId)) {
    return res.status(400).json({ error: 'Invalid course ID' });
  }
  const { title, description, content, image } = req.body;
  if (!title) {
    return res.status(400).json({ error: 'Title is required' });
  }
  try {
    if (!pool) {
      return res.status(500).json({ error: 'Database not configured' });
    }
    const updateQuery =
      'UPDATE courses SET title = $1, description = $2, content = $3, image = $4 WHERE id = $5 RETURNING *';
    const values = [title, description || null, content || null, image || null, courseId];
    const result = await pool.query(updateQuery, values);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error updating course', err);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// Fallback: serve index.html for any other GET requests (client-side routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});