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
    cur.execute("SELECT id, password_hash, is_admin, full_name, username FROM users WHERE username=%s", (username,))
    user = cur.fetchone()
    if not user or not check_password_hash(user[1], password):
        return jsonify({"error": "Invalid credentials"}), 401

    token = jwt.encode(
        {
            "user_id": user[0],
            "is_admin": bool(user[2]),
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=2)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )
    return jsonify({
        "token": token,
        "user": {
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
        return {"id": data["user_id"], "is_admin": data.get("is_admin", False)}
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
        SELECT t.id, t.title, u.username, t.created_at
        FROM threads t
        JOIN users u ON t.user_id=u.id
        ORDER BY t.created_at DESC
    """)
    threads = [{"id": row[0], "title": row[1], "author": row[2], "created_at": row[3]} for row in cur.fetchall()]
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
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, title, user_id, created_at FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread:
        return jsonify({"error": "Not found"}), 404

    cur.execute("""
                SELECT p.id, u.username, p.content, p.created_at
                FROM posts p
                         JOIN users u ON p.user_id=u.id
                WHERE thread_id=%s ORDER BY p.created_at ASC
                """, (thread_id,))
    posts = [{"id": row[0], "author": row[1], "content": row[2], "created_at": row[3]} for row in cur.fetchall()]

    return jsonify({
        "id": thread[0],
        "title": thread[1],
        "author_id": thread[2],
        "created_at": thread[3],
        "posts": posts
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

    if row[0] != user["id"] and not user["is_admin"]:
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE threads SET title=%s WHERE id=%s", (title, thread_id))
    mysql.connection.commit()
    return jsonify({"message": "Thread updated"})


@app.route("/api/threads/<int:thread_id>", methods=["DELETE"])
def delete_thread(thread_id):
    user = get_user_from_token()
    if not user or not user["is_admin"]:
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM threads WHERE id=%s", (thread_id,))
    mysql.connection.commit()
    return jsonify({"message": "Thread deleted"})


# ---------------- POSTS ----------------
@app.route("/api/threads/<int:thread_id>/posts", methods=["POST"])
def add_post(thread_id):
    user = get_user_from_token()
    if not user:
        return jsonify({"error": "Unauthorized"}), 401

    data = request.json
    content = data.get("content")
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO posts (thread_id, user_id, content) VALUES (%s,%s,%s)", (thread_id, user["id"], content))
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

    if row[0] != user["id"] and not user["is_admin"]:
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE posts SET content=%s WHERE id=%s", (content, post_id))
    mysql.connection.commit()
    return jsonify({"message": "Post updated"})


@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
def delete_post(post_id):
    user = get_user_from_token()
    if not user or not user["is_admin"]:
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM posts WHERE id=%s", (post_id,))
    mysql.connection.commit()
    return jsonify({"message": "Post deleted"})


# ---------------- ADMIN ENDPOINTS ----------------
@app.route("/api/users/<int:user_id>/make_admin", methods=["PUT"])
def make_admin(user_id):
    user = get_user_from_token()
    if not user or not user["is_admin"]:
        return jsonify({"error": "Forbidden"}), 403

    # nesmí admin mazat nebo měnit jiného admina
    cur = mysql.connection.cursor()
    cur.execute("SELECT is_admin FROM users WHERE id=%s", (user_id,))
    target = cur.fetchone()
    if not target:
        return jsonify({"error": "User not found"}), 404
    if target[0]:
        return jsonify({"error": "Cannot modify another admin"}), 403

    cur.execute("UPDATE users SET is_admin=TRUE WHERE id=%s", (user_id,))
    mysql.connection.commit()
    return jsonify({"message": "User promoted to admin"})


# ---------------- RUN ----------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
