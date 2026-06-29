from flask import Flask, render_template, request, jsonify, session, redirect, url_for, g
from werkzeug.security import generate_password_hash, check_password_hash
import sqlite3
import os
import datetime

app = Flask(__name__)
app.secret_key = 'super_secret_key_for_habit_tracker' # In production use os.urandom(24)

# Use absolute path for database so it works on PythonAnywhere
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE = os.path.join(BASE_DIR, 'habit_tracker.db')

def get_db():
    if 'db' not in g:
        g.db = sqlite3.connect(DATABASE, timeout=20)
        g.db.row_factory = sqlite3.Row
    return g.db

@app.teardown_appcontext
def close_db(error):
    db = g.pop('db', None)
    if db is not None:
        db.close()

ADMIN_USERNAMES = ['yadhu', 'yadhukrishna']

@app.context_processor
def inject_admin_status():
    is_admin = session.get('username') in ADMIN_USERNAMES
    return dict(is_admin=is_admin)

def init_db():
    with app.app_context():
        db = get_db()
        db.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                bg_animation INTEGER DEFAULT 0,
                bg_music INTEGER DEFAULT 0
            )
        ''')
        
        # Attempt to add columns for existing databases
        try:
            db.execute('ALTER TABLE users ADD COLUMN bg_animation INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass
            
        try:
            db.execute('ALTER TABLE users ADD COLUMN bg_music INTEGER DEFAULT 0')
        except sqlite3.OperationalError:
            pass
            
        db.execute('''
            CREATE TABLE IF NOT EXISTS habits (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                position INTEGER DEFAULT 0,
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
        db.execute('''
            CREATE TABLE IF NOT EXISTS journals (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(user_id, date)
            )
        ''')
        db.execute('''
            CREATE TABLE IF NOT EXISTS notes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                content TEXT NOT NULL,
                start_date TEXT,
                expires_at TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        try:
            db.execute('ALTER TABLE notes ADD COLUMN start_date TEXT')
        except sqlite3.OperationalError:
            pass
        db.commit()

init_db()

@app.route('/')
def index():
    if 'user_id' not in session:
        return redirect(url_for('login'))
    is_admin = session.get('username') in ADMIN_USERNAMES
    return render_template('index.html', username=session.get('username'), is_admin=is_admin)

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
            cursor = db.execute('INSERT INTO users (username, password) VALUES (?, ?)', 
                       (username, generate_password_hash(password)))
            user_id = cursor.lastrowid
            
            default_habits = [
                "Drink 2L Water", "Read 10 Pages", "Exercise 30 Mins", "Meditate",
                "Sleep 8 Hours", "Wake Up Early", "Eat Healthy", "Journal",
                "No Social Media", "1 Hour Skill Building"
            ]
            for i, habit in enumerate(default_habits):
                db.execute('INSERT INTO habits (user_id, name, position) VALUES (?, ?, ?)', (user_id, habit, i))
                
            db.commit()
            return redirect(url_for('login'))
        except sqlite3.IntegrityError:
            return render_template('register.html', error='Username already exists')
            
    return render_template('register.html')

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('login'))

@app.route('/api/settings', methods=['GET', 'PUT'])
def api_settings():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    if request.method == 'GET':
        user = db.execute('SELECT bg_animation, bg_music FROM users WHERE id = ?', (session['user_id'],)).fetchone()
        if user:
            return jsonify({
                'bg_animation': user['bg_animation'] if user['bg_animation'] is not None else 0,
                'bg_music': bool(user['bg_music'])
            })
        return jsonify({'error': 'User not found'}), 404
        
    elif request.method == 'PUT':
        data = request.json
        bg_animation = data.get('bg_animation', 0)
        bg_music = 1 if data.get('bg_music') else 0
        
        db.execute('UPDATE users SET bg_animation = ?, bg_music = ? WHERE id = ?', 
                   (bg_animation, bg_music, session['user_id']))
        db.commit()
        return jsonify({'success': True})

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
            
        max_pos = db.execute('SELECT MAX(position) as m FROM habits WHERE user_id = ?', (session['user_id'],)).fetchone()['m']
        pos = (max_pos + 1) if max_pos is not None else 0
        cursor = db.execute('INSERT INTO habits (user_id, name, position) VALUES (?, ?, ?)', (session['user_id'], name, pos))
        db.commit()
        return jsonify({'id': cursor.lastrowid, 'name': name, 'position': pos}), 201
        
    else: # GET
        month = request.args.get('month') # Format YYYY-MM
        if not month:
            month = datetime.date.today().strftime('%Y-%m')
            
        habits = db.execute('SELECT * FROM habits WHERE user_id = ? ORDER BY position ASC, id ASC', (session['user_id'],)).fetchall()
        habits_list = [{'id': h['id'], 'name': h['name'], 'position': h['position']} for h in habits]
        
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

@app.route('/api/habits/<int:habit_id>', methods=['DELETE', 'PUT'])
def api_edit_habit(habit_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    # Ensure habit belongs to user
    habit = db.execute('SELECT * FROM habits WHERE id = ? AND user_id = ?', (habit_id, session['user_id'])).fetchone()
    if not habit:
        return jsonify({'error': 'Not found'}), 404
        
    if request.method == 'DELETE':
        db.execute('DELETE FROM habit_logs WHERE habit_id = ?', (habit_id,))
        db.execute('DELETE FROM habits WHERE id = ?', (habit_id,))
        db.commit()
        return jsonify({'success': True})
        
    elif request.method == 'PUT':
        data = request.json
        new_name = data.get('name')
        if not new_name:
            return jsonify({'error': 'Name is required'}), 400
            
        db.execute('UPDATE habits SET name = ? WHERE id = ?', (new_name, habit_id))
        db.commit()
        return jsonify({'success': True, 'name': new_name})

@app.route('/api/habits/reorder', methods=['PUT'])
def api_reorder_habits():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    data = request.json
    db = get_db()
    for item in data:
        db.execute('UPDATE habits SET position = ? WHERE id = ? AND user_id = ?', 
                   (item['position'], item['id'], session['user_id']))
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

@app.route('/api/stats', methods=['GET'])
def api_stats():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    user_id = session['user_id']
    
    query = '''
        SELECT SUBSTR(hl.date, 1, 7) as month, SUM(hl.completed) as score 
        FROM habit_logs hl
        JOIN habits h ON hl.habit_id = h.id
        WHERE h.user_id = ? AND hl.completed = 1
        GROUP BY month
    '''
    monthly_scores = db.execute(query, (user_id,)).fetchall()
    
    total_active_habits = db.execute('SELECT COUNT(*) as count FROM habits WHERE user_id = ?', (user_id,)).fetchone()['count']
    
    if not monthly_scores:
        return jsonify({
            'best_month_score': 0,
            'avg_month_score': 0,
            'total_completions': 0,
            'total_active_habits': total_active_habits
        })
        
    scores = [row['score'] for row in monthly_scores]
    best_month_score = max(scores)
    total_completions = sum(scores)
    avg_month_score = round(total_completions / len(scores), 1)
    
    return jsonify({
        'best_month_score': best_month_score,
        'avg_month_score': avg_month_score,
        'total_completions': total_completions,
        'total_active_habits': total_active_habits
    })

@app.route('/users')
def users_dashboard():
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    if session.get('username') not in ADMIN_USERNAMES:
        return "Access Denied: You do not have permission to view this page.", 403
        
    db = get_db()
    users = db.execute('''
        SELECT u.id, u.username, COUNT(h.id) as habit_count
        FROM users u
        LEFT JOIN habits h ON u.id = h.user_id
        GROUP BY u.id
    ''').fetchall()
    
    return render_template('users.html', username=session.get('username'), users=users)

@app.route('/users/delete/<int:user_id>', methods=['POST'])
def delete_user_route(user_id):
    if 'user_id' not in session:
        return redirect(url_for('login'))
        
    if session.get('username') not in ADMIN_USERNAMES:
        return "Access Denied: You do not have permission to perform this action.", 403
        
    if user_id == session.get('user_id'):
        # Just return an error or handle it. Let's just flash or return string for simplicity.
        return "Cannot delete your own account from the dashboard.", 400
        
    db = get_db()
    # Delete associated logs and habits efficiently
    db.execute('DELETE FROM habit_logs WHERE habit_id IN (SELECT id FROM habits WHERE user_id = ?)', (user_id,))
    db.execute('DELETE FROM habits WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    
    return redirect(url_for('users_dashboard'))

@app.route('/api/journal', methods=['GET', 'POST'])
def api_journal():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        date = data.get('date')
        content = data.get('content', '')
        
        if not date:
            return jsonify({'error': 'Date is required'}), 400
            
        existing = db.execute('SELECT id FROM journals WHERE user_id = ? AND date = ?', (user_id, date)).fetchone()
        if existing:
            db.execute('UPDATE journals SET content = ? WHERE id = ?', (content, existing['id']))
        else:
            db.execute('INSERT INTO journals (user_id, date, content) VALUES (?, ?, ?)', (user_id, date, content))
        db.commit()
        return jsonify({'success': True})
        
    else: # GET
        date = request.args.get('date')
        if not date:
            return jsonify({'error': 'Date is required'}), 400
            
        journal = db.execute('SELECT content FROM journals WHERE user_id = ? AND date = ?', (user_id, date)).fetchone()
        return jsonify({'content': journal['content'] if journal else ''})

@app.route('/api/journals', methods=['GET'])
def api_journals_list():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    user_id = session['user_id']
    
    search_query = request.args.get('search', '').lower()
    date_query = request.args.get('date', '')
    
    query = "SELECT date, content FROM journals WHERE user_id = ? AND TRIM(content) != '' AND content IS NOT NULL"
    params = [user_id]
    
    if date_query:
        query += ' AND date = ?'
        params.append(date_query)
        
    if search_query:
        query += ' AND LOWER(content) LIKE ?'
        params.append(f'%{search_query}%')
        
    query += ' ORDER BY date DESC'
    
    journals = db.execute(query, params).fetchall()
    return jsonify([{'date': j['date'], 'content': j['content']} for j in journals])

@app.route('/api/notes', methods=['GET', 'POST'])
def api_notes():
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    
    db = get_db()
    user_id = session['user_id']
    
    if request.method == 'POST':
        data = request.json
        content = data.get('content', '')
        start_date = data.get('start_date', '')
        expires_at = data.get('expires_at', '')
        
        cursor = db.execute('INSERT INTO notes (user_id, content, start_date, expires_at) VALUES (?, ?, ?, ?)', (user_id, content, start_date, expires_at))
        db.commit()
        return jsonify({'id': cursor.lastrowid})
        
    else: # GET
        today = datetime.date.today().strftime('%Y-%m-%d')
        db.execute("DELETE FROM notes WHERE user_id = ? AND expires_at != '' AND expires_at IS NOT NULL AND expires_at < ?", (user_id, today))
        db.commit()
        
        notes = db.execute('SELECT * FROM notes WHERE user_id = ? ORDER BY id DESC', (user_id,)).fetchall()
        return jsonify([{'id': n['id'], 'content': n['content'], 'start_date': n['start_date'] if n['start_date'] else '', 'expires_at': n['expires_at'] if n['expires_at'] else ''} for n in notes])

@app.route('/api/notes/<int:note_id>', methods=['PUT', 'DELETE'])
def api_note_detail(note_id):
    if 'user_id' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
        
    db = get_db()
    user_id = session['user_id']
    
    note = db.execute('SELECT * FROM notes WHERE id = ? AND user_id = ?', (note_id, user_id)).fetchone()
    if not note:
        return jsonify({'error': 'Not found'}), 404
        
    if request.method == 'PUT':
        data = request.json
        content = data.get('content', note['content'])
        start_date = data.get('start_date', note['start_date'])
        expires_at = data.get('expires_at', note['expires_at'])
        db.execute('UPDATE notes SET content = ?, start_date = ?, expires_at = ? WHERE id = ?', (content, start_date, expires_at, note_id))
        db.commit()
        return jsonify({'success': True})
        
    elif request.method == 'DELETE':
        db.execute('DELETE FROM notes WHERE id = ?', (note_id,))
        db.commit()
        return jsonify({'success': True})

if __name__ == '__main__':
    app.run(debug=True, port=5000)
