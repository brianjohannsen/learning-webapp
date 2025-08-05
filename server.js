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
// Global courses file to store course definitions
const COURSES_FILE = path.join(__dirname, 'data', 'courses.json');

// Ensure data directory and users file exist
function ensureDataFiles() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(USERS_FILE)) {
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
  }
  // Ensure courses file exists; if not, write default course definitions
  if (!fs.existsSync(COURSES_FILE)) {
    const defaultCourses = [
      { id: 1, title: 'Introduction to the Platform', description: 'Learn about the basics of this learning platform.', content: 'Welcome to the introduction course.' },
      { id: 2, title: 'Advanced Concepts', description: 'Dive deeper into advanced topics.', content: 'This course covers advanced concepts.' },
      { id: 3, title: 'Practical Exercises', description: 'Hands‑on exercises to practice what you have learned.', content: 'Here you will find practical exercises.' }
    ];
    fs.writeFileSync(COURSES_FILE, JSON.stringify(defaultCourses, null, 2));
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

// Read global courses from file
function readCourses() {
  try {
    const raw = fs.readFileSync(COURSES_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// Write courses to file
function writeCourses(courses) {
  fs.writeFileSync(COURSES_FILE, JSON.stringify(courses, null, 2));
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
    // Register a new user. Assign a course progress entry for each existing course.
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
      // Initialize course progress based on global courses
      const courses = readCourses();
      const userCourses = courses.map((c) => ({ id: c.id, progress: 0 }));
      const newUser = {
        id: newId,
        name,
        email,
        password,
        courses: userCourses,
        profilePicture: null,
      };
      users.push(newUser);
      writeUsers(users);
      const { password: pw, ...userWithoutPassword } = newUser;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(userWithoutPassword));
    }
    // User login
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
    // Get list of courses with progress for a specific user
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
    // Update progress for a user in a specific course
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
      const courseProgress = user.courses.find((c) => c.id === courseId);
      if (!courseProgress) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Course not found for this user.' }));
      }
      courseProgress.progress = progress;
      writeUsers(users);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true }));
    }

    // ---------------------------------------------
    // Additional API routes for admin and profiles
    //
    // Admin: list all courses
    if (req.method === 'GET' && pathname === '/api/courses') {
      const courses = readCourses();
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(courses));
    }
    // Admin: get a single course by id
    if (req.method === 'GET' && /^\/api\/courses\/\d+$/.test(pathname)) {
      const courseId = parseInt(pathname.split('/')[3], 10);
      const courses = readCourses();
      const course = courses.find((c) => c.id === courseId);
      if (!course) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Course not found.' }));
      }
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(course));
    }
    // Admin: add a new course (title, description, content). Updates all users with new course progress.
    if (req.method === 'POST' && pathname === '/api/admin/courses') {
      const body = await parseRequestBody(req);
      const { title, description = '', content = '' } = body;
      if (!title) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Title is required.' }));
      }
      const courses = readCourses();
      const newId = courses.length > 0 ? Math.max(...courses.map((c) => c.id)) + 1 : 1;
      const newCourse = { id: newId, title, description, content };
      courses.push(newCourse);
      writeCourses(courses);
      // Update each user to include this new course with progress 0
      const users = readUsers();
      users.forEach((u) => {
        if (!u.courses.some((c) => c.id === newCourse.id)) {
          u.courses.push({ id: newCourse.id, progress: 0 });
        }
      });
      writeUsers(users);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(newCourse));
    }
    // Admin: update existing course by id
    if ((req.method === 'PUT' || req.method === 'PATCH') && /^\/api\/admin\/courses\/\d+$/.test(pathname)) {
      const courseId = parseInt(pathname.split('/')[4], 10);
      const body = await parseRequestBody(req);
      const courses = readCourses();
      const courseIndex = courses.findIndex((c) => c.id === courseId);
      if (courseIndex === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'Course not found.' }));
      }
      const course = courses[courseIndex];
      // Update provided fields
      if (body.title !== undefined) course.title = body.title;
      if (body.description !== undefined) course.description = body.description;
      if (body.content !== undefined) course.content = body.content;
      courses[courseIndex] = course;
      writeCourses(courses);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(course));
    }
    // Admin: list all users
    if (req.method === 'GET' && pathname === '/api/admin/users') {
      const users = readUsers();
      const sanitized = users.map(({ password, ...rest }) => rest);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(sanitized));
    }
    // Get a user profile (without password)
    if (req.method === 'GET' && /^\/api\/user\/\d+$/.test(pathname)) {
      const userId = parseInt(pathname.split('/')[3], 10);
      const users = readUsers();
      const user = users.find((u) => u.id === userId);
      if (!user) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'User not found.' }));
      }
      const { password: pw, ...userWithoutPassword } = user;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(userWithoutPassword));
    }
    // Update a user's profile (name, email, password). Accept partial updates.
    if ((req.method === 'PUT' || req.method === 'PATCH') && /^\/api\/user\/\d+$/.test(pathname)) {
      const userId = parseInt(pathname.split('/')[3], 10);
      const body = await parseRequestBody(req);
      const users = readUsers();
      const userIndex = users.findIndex((u) => u.id === userId);
      if (userIndex === -1) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'User not found.' }));
      }
      const user = users[userIndex];
      // If email is being updated, ensure it's not taken by another user
      if (body.email && users.some((u) => u.email.toLowerCase() === body.email.toLowerCase() && u.id !== userId)) {
        res.statusCode = 409;
        return res.end(JSON.stringify({ error: 'Email is already in use by another account.' }));
      }
      if (body.name !== undefined) user.name = body.name;
      if (body.email !== undefined) user.email = body.email;
      if (body.password !== undefined) user.password = body.password;
      users[userIndex] = user;
      writeUsers(users);
      const { password: pw, ...userWithoutPassword } = user;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify(userWithoutPassword));
    }
    // Upload a profile picture as base64 data URI { imageData: 'data:image/png;base64,...' }
    if (req.method === 'POST' && /^\/api\/user\/\d+\/profile-picture$/.test(pathname)) {
      const userId = parseInt(pathname.split('/')[3], 10);
      const body = await parseRequestBody(req);
      const { imageData } = body;
      if (!imageData || typeof imageData !== 'string' || !imageData.startsWith('data:image')) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid image data.' }));
      }
      // Extract the base64 part and the mime type
      const matches = imageData.match(/^data:(image\/[^;]+);base64,(.+)$/);
      if (!matches) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: 'Invalid image data.' }));
      }
      const mimeType = matches[1];
      const base64Data = matches[2];
      const buffer = Buffer.from(base64Data, 'base64');
      // Determine extension based on mime
      const ext = mimeType.split('/')[1] || 'png';
      const uploadsDir = path.join(PUBLIC_DIR, 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const fileName = `user-${userId}-${Date.now()}.${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, buffer);
      const users = readUsers();
      const user = users.find((u) => u.id === userId);
      if (!user) {
        res.statusCode = 404;
        return res.end(JSON.stringify({ error: 'User not found.' }));
      }
      user.profilePicture = `/uploads/${fileName}`;
      writeUsers(users);
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ success: true, url: user.profilePicture }));
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