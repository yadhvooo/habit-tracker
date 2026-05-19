from flask import Flask, render_template, request, jsonify, session, redirect, url_for
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import datetime

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_habit_tracker' # In production use os.urandom(24)
DATABASE = 'habit_tracker.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS habit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                habit_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                completed INTEGER DEFAULT 0,
                FOREIGN KEY (habit_id) REFERENCES habits (id),
                UNIQUE(habit_id, date)
            )
        ''')
        db.commit()

init_db()

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    return render_template('index.html', username=session.get('username'))

@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        db = get_db()
        user = db.execute('SELECT * FROM users WHERE username = ?', (username,)).fetchone()
        
        if user and check_password_hash(user['password'], password):
            session['user_id'] = user['id']
            session['username'] = user['username']
            return redirect(url_for('index'))
        else:
            return render_template('login.html', error='Invalid credentials')
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        
        db = get_db()
        try:
            db.execute('INSERT INTO users (username, password) VALUES (?, ?)', 
                       (username, generate_password_hash(password)))
            db.commit()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            return render_template('register.html', error='Username already exists')
            
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/habits', methods=['GET', 'POST'])
def api_habits():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    
    if request.method == 'POST':
        data = request.json
        name = data.get('name')
        if not name:
            return jsonify({'error': 'Name is required'}), 400
            
        cursor = db.execute('INSERT INTO habits (user_id, name) VALUES (?, ?)', (session['user_id'], name))
        db.commit()
        return jsonify({'id': cursor.lastrowid, 'name': name}), 201
        
    else: # GET
        month = request.args.get('month') # Format YYYY-MM
        if not month:
            month = datetime.date.today().strftime('%Y-%m')
            
        habits = db.execute('SELECT * FROM habits WHERE user_id = ?', (session['user_id'],)).fetchall()
        habits_list = [{'id': h['id'], 'name': h['name']} for h in habits]
        
        # Get logs for this month
        habit_ids = [h['id'] for h in habits_list]
        logs = []
        if habit_ids:
            placeholders = ','.join('?' * len(habit_ids))
            query = f"SELECT * FROM habit_logs WHERE habit_id IN ({placeholders}) AND date LIKE ?"
            params = habit_ids + [f"{month}-%"]
            logs_db = db.execute(query, params).fetchall()
            logs = [{'habit_id': l['habit_id'], 'date': l['date'], 'completed': bool(l['completed'])} for l in logs_db]
            
        return jsonify({
            'habits': habits_list,
            'logs': logs
        })

@app.route('/api/habits/<int:habit_id>', methods=['DELETE'])
def api_delete_habit(habit_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    # Ensure habit belongs to user
    habit = db.execute('SELECT * FROM habits WHERE id = ? AND user_id = ?', (habit_id, session['user_id'])).fetchone()
    if not habit:
        return jsonify({'error': 'Not found'}), 404
        
    db.execute('DELETE FROM habit_logs WHERE habit_id = ?', (habit_id,))
    db.execute('DELETE FROM habits WHERE id = ?', (habit_id,))
    db.commit()
    return jsonify({'success': True})

@app.route('/api/logs', methods=['POST'])
def api_logs():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    habit_id = data.get('habit_id')
    date = data.get('date')
    completed = 1 if data.get('completed') else 0
    
    db = get_db()
    # Ensure habit belongs to user
    habit = db.execute('SELECT * FROM habits WHERE id = ? AND user_id = ?', (habit_id, session['user_id'])).fetchone()
    if not habit:
        return jsonify({'error': 'Not found'}), 404
        
    existing = db.execute('SELECT id FROM habit_logs WHERE habit_id = ? AND date = ?', (habit_id, date)).fetchone()
    if existing:
        db.execute('UPDATE habit_logs SET completed = ? WHERE id = ?', (completed, existing['id']))
    else:
        db.execute('INSERT INTO habit_logs (habit_id, date, completed) VALUES (?, ?, ?)', (habit_id, date, completed))
    db.commit()
    
    return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
