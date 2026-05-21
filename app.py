from flask import Flask, render_template, request, jsonify, session, redirect, url_for
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
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

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
                password TEXT NOT NULL
            )
        ''')
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
    # First, delete associated logs and habits
    habits = db.execute('SELECT id FROM habits WHERE user_id = ?', (user_id,)).fetchall()
    for habit in habits:
        db.execute('DELETE FROM habit_logs WHERE habit_id = ?', (habit['id'],))
        
    db.execute('DELETE FROM habits WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    
    return redirect(url_for('users_dashboard'))

if __name__ == '__main__':
    app.run(debug=True, port=5000)
