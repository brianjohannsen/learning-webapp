-- Sample data to seed the learning webapp database

-- Insert example courses
INSERT INTO courses (title, description, content, image) VALUES
  ('Introduction to Programming', 'Learn basic programming concepts', 'Welcome to the Introduction to Programming course!', NULL),
  ('Web Development Basics', 'Get started with HTML, CSS and JavaScript', 'This course introduces the fundamentals of web development.', NULL);

-- Insert example levels for each course
INSERT INTO levels (title, description, course_id) VALUES
  ('Variables and Data Types', 'Understand variables and data types', 1),
  ('Control Structures', 'Learn about if statements and loops', 1),
  ('HTML & CSS Fundamentals', 'Basics of building web pages', 2),
  ('JavaScript Basics', 'Introduction to JavaScript programming', 2);

-- Insert sample knowledge base entries
INSERT INTO knowledge_base (title, content) VALUES
  ('What is a Variable?', 'A variable is a storage location for data that can change during program execution.'),
  ('HTML Tags Overview', 'HTML tags are used to structure the content of web pages.');