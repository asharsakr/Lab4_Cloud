const express = require('express');
const { Pool } = require('pg');
const redis = require('redis');

const app = express();
app.use(express.json());

const pool = new Pool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: 5432,
});

const redisClient = redis.createClient({ url: 'redis://redis:6379' });
redisClient.on('error', (err) => console.log('Redis Client Error', err));
redisClient.connect();

// Students API
app.get('/api/students', async (req, res) => {
    const result = await pool.query('SELECT * FROM students ORDER BY id');
    res.json(result.rows);
});

app.post('/api/students', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO students (name, email) VALUES ($1, $2) RETURNING *', [req.body.name, req.body.email]);
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(400).json({ error: 'Email must be unique' });
    }
});

// Courses API with Redis Caching
app.get('/api/courses', async (req, res) => {
    try {
        const cachedCourses = await redisClient.get('courses');
        if (cachedCourses) {
            console.log("Cache HIT: Returning courses from Redis");
            return res.json(JSON.parse(cachedCourses));
        }
        
        console.log("Cache MISS: Querying database");
        const result = await pool.query('SELECT * FROM courses ORDER BY id');
        await redisClient.setEx('courses', 60, JSON.stringify(result.rows));
        res.json(result.rows);
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/courses', async (req, res) => {
    try {
        const result = await pool.query('INSERT INTO courses (code, title, seats) VALUES ($1, $2, $3) RETURNING *', [req.body.code, req.body.title, req.body.seats]);
        await redisClient.del('courses');
        res.status(201).json(result.rows[0]);
    } catch (e) {
        res.status(400).json({ error: 'Course code must be unique' });
    }
});

app.delete('/api/courses/:id', async (req, res) => {
    await pool.query('DELETE FROM courses WHERE id = $1', [req.params.id]);
    await redisClient.del('courses');
    res.json({ message: 'Course deleted' });
});

// Registrations API
app.post('/api/registrations', async (req, res) => {
    const { student_id, course_id } = req.body;
    try {
        const checkRes = await pool.query(`
            SELECT seats, (SELECT COUNT(*) FROM registrations WHERE course_id = $1) as enrolled 
            FROM courses WHERE id = $1
        `, [course_id]);
        
        if (checkRes.rows.length === 0) return res.status(404).json({ error: 'Course not found' });
        if (parseInt(checkRes.rows[0].enrolled) >= checkRes.rows[0].seats) {
            return res.status(400).json({ error: 'Course is full' });
        }

        await pool.query('INSERT INTO registrations (student_id, course_id) VALUES ($1, $2)', [student_id, course_id]);
        res.status(201).json({ message: 'Registered successfully' });
    } catch (e) {
        if (e.code === '23505') return res.status(400).json({ error: 'Student already registered' });
        res.status(500).json({ error: 'Server error' });
    }
});

app.delete('/api/registrations', async (req, res) => {
    await pool.query('DELETE FROM registrations WHERE student_id = $1 AND course_id = $2', [req.body.student_id, req.body.course_id]);
    res.json({ message: 'Registration cancelled' });
});

app.listen(5000, '0.0.0.0', () => console.log('Backend running on port 5000'));
