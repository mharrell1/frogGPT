import os
import sqlite3
from flask import Flask, render_template, request, jsonify, session, g
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY', 'froggy-secret-key-12345')
app.config['SESSION_COOKIE_NAME'] = 'froggy_session'
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'

DATABASE = os.environ.get('DB_PATH', 'tasks.db')

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db_dir = os.path.dirname(DATABASE)
        if db_dir and not os.path.exists(db_dir):
            os.makedirs(db_dir, exist_ok=True)
        db = g._database = sqlite3.connect(DATABASE)
        db.row_factory = sqlite3.Row
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()

def init_db():
    db = get_db()
    # Create users table
    db.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    ''')
    # Create tasks table if not exists
    db.execute('''
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            completed INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    # Add user_id column to tasks table if not exists
    cursor = db.execute("PRAGMA table_info(tasks)")
    columns = [row['name'] for row in cursor.fetchall()]
    if 'user_id' not in columns:
        db.execute("ALTER TABLE tasks ADD COLUMN user_id INTEGER REFERENCES users(id)")
    db.commit()

with app.app_context():
    init_db()

@app.route('/')
def index():
    return render_template('index.html')

# Authentication APIs
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    db = get_db()
    try:
        # Check if user already exists
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        if user:
            return jsonify({'error': 'Username already taken'}), 400

        password_hash = generate_password_hash(password)
        cursor = db.execute('INSERT INTO users (username, password) VALUES (?, ?)', (username, password_hash))
        db.commit()
        user_id = cursor.lastrowid

        session['user_id'] = user_id
        session['username'] = username
        return jsonify({'success': True, 'username': username})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username', '').strip()
    password = data.get('password', '')

    if not username or not password:
        return jsonify({'error': 'Username and password are required'}), 400

    db = get_db()
    user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
    if not user or not check_password_hash(user['password'], password):
        return jsonify({'error': 'Invalid username or password'}), 401

    session['user_id'] = user['id']
    session['username'] = user['username']
    return jsonify({'success': True, 'username': user['username']})

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True})

@app.route('/api/user', methods=['GET'])
def get_user():
    if 'user_id' in session:
        return jsonify({'logged_in': True, 'username': session['username']})
    return jsonify({'logged_in': False})

# Task APIs
@app.route('/api/tasks', methods=['GET'])
def get_tasks():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    tasks = db.execute('SELECT * FROM tasks WHERE user_id = ? ORDER BY id DESC', (session['user_id'],)).fetchall()
    
    return jsonify([
        {
            'id': task['id'],
            'title': task['title'],
            'completed': bool(task['completed']),
            'created_at': task['created_at']
        } for task in tasks
    ])

@app.route('/api/tasks', methods=['POST'])
def add_task():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        return jsonify({'error': 'Task title is required'}), 400

    db = get_db()
    try:
        cursor = db.execute('INSERT INTO tasks (user_id, title, completed) VALUES (?, ?, 0)', (session['user_id'], title))
        db.commit()
        task_id = cursor.lastrowid
        
        task = db.execute('SELECT * FROM tasks WHERE id = ?', (task_id,)).fetchone()
        return jsonify({
            'id': task['id'],
            'title': task['title'],
            'completed': bool(task['completed']),
            'created_at': task['created_at']
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['PUT'])
def update_task(task_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    data = request.get_json() or {}
    completed = data.get('completed')
    if completed is None:
        return jsonify({'error': 'Completed status is required'}), 400

    db = get_db()
    task = db.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, session['user_id'])).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    try:
        db.execute('UPDATE tasks SET completed = ? WHERE id = ?', (1 if completed else 0, task_id))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/tasks/<int:task_id>', methods=['DELETE'])
def delete_task(task_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401

    db = get_db()
    task = db.execute('SELECT * FROM tasks WHERE id = ? AND user_id = ?', (task_id, session['user_id'])).fetchone()
    if not task:
        return jsonify({'error': 'Task not found'}), 404

    try:
        db.execute('DELETE FROM tasks WHERE id = ?', (task_id,))
        db.commit()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)
