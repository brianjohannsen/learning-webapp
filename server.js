const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');

/*
 * Lightweight HTTP server for the learning web application
 *
 * This server uses Node's built‑in http module to avoid external
 * dependencies. It serves static files from the `public` directory and
 * exposes a small JSON API under the `/api` path to handle user
 * registration, login and course progress. Data is persisted to disk
 * using JSON files stored in the `data` directory.
 */

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR = path.join(__dirname, 'public');
const USERS_FILE = path.join(__dirname, 'data', 'users.json');

// Ensure data directory and users file exist
function ensureDataFiles() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
}
ensureDataFiles();

function readUsers() {
  const raw = fs.readFileSync(USERS_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

const DEFAULT_COURSES = [
  { id: 1, title: 'Introduction to the Platform', progress: 0 },
  { id: 2, title: 'Advanced Concepts', progress: 0 },
  { id: 3, title: 'Practical Exercises', progress: 0 },
];

// Simple MIME type lookup
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

// Serve static files
function serveStaticFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.end('404 Not Found');
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.end(data);
  });
}

// Parse JSON body from request
function parseRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      // Limit body size to prevent abuse
      if (body.length > 1e6) req.connection.destroy();
    });
    req.on('end', () => {
      try {
        const parsed = body ? JSON.parse(body) : {};
        resolve(parsed);
      } catch {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // Handle API routes
  if (pathname.startsWith('/api')) {
    if (req.method === 'POST' && pathname === '/api/register') {
      const body = await parseRequestBody(req);
      const { name, email, password } = body;
      if (!name || !email || !password) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Name, email and password are required.' }));
      }
      const users = readUsers();
      if (users.some((u) => u.email.toLowerCase() === email.toLowerCase())) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: 'A user with this email already exists.' }));
      }
      const newId = users.length > 0 ? Math.max(...users.map((u) => u.id)) + 1 : 1;
      const newUser = {
        id: newId,
        name,
        email,
        password,
        courses: DEFAULT_COURSES.map((c) => ({ ...c })),
      };
      users.push(newUser);
      writeUsers(users);
      const { password: pw, ...userWithoutPassword } = newUser;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(userWithoutPassword));
    }
    if (req.method === 'POST' && pathname === '/api/login') {
      const body = await parseRequestBody(req);
      const { email, password } = body;
      if (!email || !password) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Email and password are required.' }));
      }
      const users = readUsers();
      const user = users.find((u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
      if (!user) {
        res.statusCode = 401;
        return res.end(JSON.stringify({ error: 'Invalid email or password.' }));
      }
      const { password: pw, ...userWithoutPassword } = user;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(userWithoutPassword));
    }
    if (req.method === 'GET' && /^\/api\/user\/\d+\/courses$/.test(pathname)) {
      const userId = parseInt(pathname.split('/')[3], 10);
      const users = readUsers();
      const user = users.find((u) => u.id === userId);
      if (!user) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'User not found.' }));
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(user.courses));
    }
    if (req.method === 'PUT' && /^\/api\/user\/\d+\/course\/\d+\/progress$/.test(pathname)) {
      const parts = pathname.split('/');
      const userId = parseInt(parts[3], 10);
      const courseId = parseInt(parts[5], 10);
      const body = await parseRequestBody(req);
      const progress = body.progress;
      if (typeof progress !== 'number' || progress < 0 || progress > 100) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Progress must be a number between 0 and 100.' }));
      }
      const users = readUsers();
      const user = users.find((u) => u.id === userId);
      if (!user) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'User not found.' }));
      }
      const course = user.courses.find((c) => c.id === courseId);
      if (!course) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Course not found.' }));
      }
      course.progress = progress;
      writeUsers(users);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true }));
    }
    // Unknown API route
    res.statusCode = 404;
    return res.end(JSON.stringify({ error: 'Not found' }));
  }

  // Handle static files
  let filePath = path.join(PUBLIC_DIR, pathname);
  // If root path, serve index.html
  if (pathname === '/' || pathname === '') {
    filePath = path.join(PUBLIC_DIR, 'index.html');
  }
  // Prevent directory traversal
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    return res.end('403 Forbidden');
  }
  // Check if file exists
  fs.stat(filePath, (err, stats) => {
  if (err || !stats.isFile()) {
      // Fallback to index.html for client-side routing
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      return serveStaticFile(indexPath, res);
    }
    serveStaticFile(filePath, res);
  });
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
