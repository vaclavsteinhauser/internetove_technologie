from flask import Flask, request, jsonify
from flask_mysqldb import MySQL
from werkzeug.security import generate_password_hash, check_password_hash
import jwt, datetime, os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Config – připojení k DB
app.config['MYSQL_HOST'] = os.getenv("DB_HOST", "localhost")
app.config['MYSQL_USER'] = os.getenv("DB_USER", "forumuser")
app.config['MYSQL_PASSWORD'] = os.getenv("DB_PASSWORD", "forumpass")
app.config['MYSQL_DB'] = os.getenv("DB_NAME", "forum")
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "c6hnErwqQ7VZuenS")

mysql = MySQL(app)

# ---------------- AUTH ----------------
@app.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json
    full_name = data.get("full_name")
    username = data.get("username")
    password = data.get("password")

    if not username or not password:
        return jsonify({"error": "Missing username or password"}), 400

    password_hash = generate_password_hash(password)

    cur = mysql.connection.cursor()
    try:
        cur.execute(
            "INSERT INTO users (full_name, username, password_hash) VALUES (%s,%s,%s)",
            (full_name, username, password_hash)
        )
        mysql.connection.commit()
    except:
        return jsonify({"error": "User already exists"}), 400

    return jsonify({"message": "User registered"}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    username, password = data.get("username"), data.get("password")

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, password_hash, role, full_name, username FROM users WHERE username=%s", (username,))
    user = cur.fetchone()
    if not user or not check_password_hash(user[1], password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode(
        {
            "user_id": user[0],
            "role": user[2],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )
    return jsonify({
        "token": token,
        "user": {
            "id": user[0],
            "role": user[2],
            "full_name": user[3],
            "username": user[4]
        }
    })


# ---------------- HELPERS ----------------
def get_user_from_token():
    token = request.headers.get("Authorization")
    if not token:
        return None
    try:
        data = jwt.decode(token.split(" ")[1], app.config['SECRET_KEY'], algorithms=["HS256"])
        return {"id": data["user_id"], "role": data.get("role", "user")}
    except:
        return None


# ---------------- USER ----------------
@app.route("/api/users/change_password", methods=["PUT"])
def change_password():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    old_pw, new_pw = data.get("old_password"), data.get("new_password")
    if not old_pw or not new_pw:
        return jsonify({"error": "Missing password"}), 400

    cur = mysql.connection.cursor()
    cur.execute("SELECT password_hash FROM users WHERE id=%s", (user["id"],))
    row = cur.fetchone()
    if not row or not check_password_hash(row[0], old_pw):
        return jsonify({"error": "Old password incorrect"}), 403

    new_hash = generate_password_hash(new_pw)
    cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user["id"]))
    mysql.connection.commit()
    return jsonify({"message": "Password updated"})


# ---------------- THREADS ----------------
@app.route("/api/threads", methods=["GET"])
def list_threads():
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT t.id, t.title, u.username, t.created_at, u.full_name, t.is_closed, t.is_deleted
        FROM threads t
                 JOIN users u ON t.user_id = u.id
        WHERE t.is_deleted = FALSE
        ORDER BY t.is_closed ASC, t.created_at DESC 
    """)
    threads = [{"id": r[0], "title": r[1], "author_username": r[2], "created_at": r[3], "author_full_name": r[4], "is_closed": bool(r[5])} for r in cur.fetchall()]
    return jsonify(threads)


@app.route("/api/threads", methods=["POST"])
def create_thread():
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    title = data.get("title")
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO threads (title, user_id) VALUES (%s, %s)", (title, user["id"]))
    mysql.connection.commit()
    return jsonify({"message": "Thread created"}), 201

@app.route("/api/threads/<int:thread_id>", methods=["GET"])
def get_thread(thread_id):
    current_user = get_user_from_token()
    current_user_role = current_user['role'] if current_user else 'user'

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, title, user_id, created_at, is_closed, is_deleted FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread or thread[5]: # thread is deleted
        return jsonify({"error": "Not found"}), 404

    cur.execute("""
        SELECT p.id, u.username, p.content, p.created_at, u.role, p.is_anonymous, p.is_deleted, p.parent_post_id, p.user_id
        FROM posts p
                 JOIN users u ON p.user_id = u.id
        WHERE thread_id = %s ORDER BY p.created_at ASC
    """, (thread_id,))
    
    all_posts = {}
    for r in cur.fetchall():
        post_id = r[0]
        is_deleted = r[6]
        author_name = r[1] if not is_deleted else "Odstraněno"
        content = r[2] if not is_deleted else "Tento příspěvek byl odstraněn"
        
        if not is_deleted:
            is_anonymous = r[5]
            if is_anonymous and current_user_role != 'admin':
                author_name = "Anonymní"
            elif is_anonymous and current_user_role == 'admin':
                author_name = f"{r[1]} (anonymně)"

        all_posts[post_id] = {
            "id": post_id, "author": author_name, "content": content, 
            "created_at": r[3], "author_role": r[4], "is_deleted": is_deleted,
            "parent_post_id": r[7], "author_id": r[8], "replies": []
        }

    # Nest replies
    nested_posts = []
    for post_id, post in all_posts.items():
        if post['parent_post_id'] in all_posts:
            all_posts[post['parent_post_id']]['replies'].append(post)
        else:
            nested_posts.append(post)
    return jsonify({
        "id": thread[0],
        "title": thread[1],
        "author_id": thread[2],
        "created_at": thread[3],
        "is_closed": bool(thread[4]), "is_deleted": bool(thread[5]),
        "posts": nested_posts
    })


@app.route("/api/threads/<int:thread_id>", methods=["PUT"])
def update_thread(thread_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    title = data.get("title")

    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM threads WHERE id=%s", (thread_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Thread not found"}), 404

    if row[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE threads SET title=%s WHERE id=%s", (title, thread_id))
    mysql.connection.commit()
    return jsonify({"message": "Thread updated"})


@app.route("/api/threads/<int:thread_id>", methods=["DELETE"])
def delete_thread(thread_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread:
        return jsonify({"error": "Not found"}), 404

    is_author = thread[0] == user["id"]
    is_admin = user["role"] == 'admin'

    if not is_author and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    # Check for posts in the thread
    cur.execute("SELECT COUNT(*) FROM posts WHERE thread_id=%s", (thread_id,))
    post_count = cur.fetchone()[0]

    cur.execute("UPDATE threads SET is_deleted=TRUE WHERE id=%s", (thread_id,))
    mysql.connection.commit()
    return jsonify({"message": "Thread deleted successfully"})

@app.route("/api/threads/<int:thread_id>/close", methods=["PUT"])
def close_thread(thread_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id, is_closed FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread:
        return jsonify({"error": "Thread not found"}), 404

    # Allow author or admin to close/open
    if thread[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    new_status = not thread[1]
    cur.execute("UPDATE threads SET is_closed=%s WHERE id=%s", (new_status, thread_id))
    mysql.connection.commit()
    return jsonify({"message": f"Thread {'closed' if new_status else 'opened'}"})

# ---------------- POSTS ----------------
@app.route("/api/threads/<int:thread_id>/posts", methods=["POST"])
def add_post(thread_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    cur = mysql.connection.cursor()
    cur.execute("SELECT is_closed FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if thread and thread[0]:
        return jsonify({"error": "Thread is closed"}), 403

    data = request.json
    content = data.get("content")
    is_anonymous = data.get("is_anonymous", False)
    parent_post_id = data.get("parent_post_id")
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO posts (thread_id, user_id, content, is_anonymous, parent_post_id) VALUES (%s,%s,%s,%s,%s)", (thread_id, user["id"], content, is_anonymous, parent_post_id))
    mysql.connection.commit()
    return jsonify({"message": "Post added"}), 201


@app.route("/api/posts/<int:post_id>", methods=["PUT"])
def update_post(post_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    content = data.get("content")

    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM posts WHERE id=%s", (post_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Post not found"}), 404

    if row[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE posts SET content=%s WHERE id=%s", (content, post_id))
    mysql.connection.commit()
    return jsonify({"message": "Post updated"})


@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM posts WHERE id=%s", (post_id,))
    post = cur.fetchone()
    if not post:
        return jsonify({"error": "Post not found"}), 404

    is_author = post[0] == user["id"]
    is_admin = user["role"] == 'admin'

    if not is_author and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    # Check for replies
    cur.execute("SELECT COUNT(*) FROM posts WHERE parent_post_id=%s", (post_id,))
    reply_count = cur.fetchone()[0]

    if is_author and reply_count > 0:
        return jsonify({"error": "Cannot delete a post with replies."}), 403

    cur.execute("UPDATE posts SET is_deleted=TRUE WHERE id=%s", (post_id,))
    mysql.connection.commit()
    return jsonify({"message": "Post deleted successfully"})


# ---------------- ADMIN ENDPOINTS ----------------
@app.route("/api/admin/users", methods=["GET"])
def admin_get_users():
    user = get_user_from_token()
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, full_name, username, role FROM users")
    users = [{"id": r[0], "full_name": r[1], "username": r[2], "role": r[3]} for r in cur.fetchall()]
    return jsonify(users)


@app.route("/api/admin/users/<int:user_id>/role", methods=["PUT"])
def admin_change_user_role(user_id):
    user = get_user_from_token()
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    new_role = data.get("role")
    if new_role not in ['user', 'politician', 'admin']:
        return jsonify({"error": "Invalid role"}), 400

    cur = mysql.connection.cursor()
    cur.execute("UPDATE users SET role=%s WHERE id=%s", (new_role, user_id))
    mysql.connection.commit()

    return jsonify({"message": "User role updated"})

# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
