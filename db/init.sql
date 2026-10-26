CREATE TABLE courses (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) UNIQUE NOT NULL,
    title VARCHAR(100) NOT NULL,
    seats INT NOT NULL CHECK (seats > 0)
);

CREATE TABLE students (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL
);

CREATE TABLE registrations (
    student_id INT REFERENCES students(id) ON DELETE CASCADE,
    course_id INT REFERENCES courses(id) ON DELETE CASCADE,
    PRIMARY KEY (student_id, course_id)
);

-- Sample Data
INSERT INTO courses (code, title, seats) VALUES ('CC101', 'Cloud Computing', 2), ('CS102', 'Data Structures', 30);
INSERT INTO students (name, email) VALUES ('Alice', 'alice@test.com'), ('Bob', 'bob@test.com');
