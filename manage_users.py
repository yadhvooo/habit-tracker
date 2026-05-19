import sqlite3

DATABASE = 'habit_tracker.db'

def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn

def list_users():
    db = get_db()
    users = db.execute('SELECT id, username FROM users').fetchall()
    if not users:
        print("No users found.")
    else:
        print("\n--- Current Users ---")
        for user in users:
            print(f"ID: {user['id']} | Username: {user['username']}")
        print("---------------------\n")

def delete_user(user_id):
    db = get_db()
    # First, delete associated logs and habits to maintain database integrity
    habits = db.execute('SELECT id FROM habits WHERE user_id = ?', (user_id,)).fetchall()
    for habit in habits:
        db.execute('DELETE FROM habit_logs WHERE habit_id = ?', (habit['id'],))
    
    db.execute('DELETE FROM habits WHERE user_id = ?', (user_id,))
    db.execute('DELETE FROM users WHERE id = ?', (user_id,))
    db.commit()
    print(f"User with ID {user_id} and all their habits have been deleted.")

if __name__ == '__main__':
    while True:
        print("1. List Users")
        print("2. Delete User")
        print("3. Exit")
        choice = input("Enter your choice (1/2/3): ")
        
        if choice == '1':
            list_users()
        elif choice == '2':
            list_users()
            try:
                uid = int(input("Enter the ID of the user you want to delete: "))
                confirm = input(f"Are you sure you want to delete user {uid}? (y/n): ")
                if confirm.lower() == 'y':
                    delete_user(uid)
                else:
                    print("Deletion cancelled.")
            except ValueError:
                print("Invalid ID.")
        elif choice == '3':
            print("Exiting...")
            break
        else:
            print("Invalid choice. Try again.")
