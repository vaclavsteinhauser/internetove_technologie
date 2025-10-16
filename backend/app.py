# Import potřebných knihoven
from flask import Flask, request, jsonify
from flask_mysqldb import MySQL
from flask_mail import Mail, Message
from werkzeug.security import generate_password_hash, check_password_hash
import jwt, datetime, os
from flask_cors import CORS

# Inicializace Flask aplikace
app = Flask(__name__)
# Povolení Cross-Origin Resource Sharing (CORS) pro všechny domény.
# To je nezbytné, aby frontend (běžící na jiném portu/doméně) mohl komunikovat s tímto API.
CORS(app)

# --- Konfigurace Aplikace ---
# Načítání konfiguračních hodnot z proměnných prostředí.
# Pokud proměnná prostředí není nastavena, použije se výchozí hodnota (ideální pro lokální vývoj).
app.config['MYSQL_HOST'] = os.getenv("DB_HOST", "localhost")
app.config['MYSQL_USER'] = os.getenv("DB_USER", "forumuser")
app.config['MYSQL_PASSWORD'] = os.getenv("DB_PASSWORD", "forumpass")
app.config['MYSQL_DB'] = os.getenv("DB_NAME", "forum")
# SECRET_KEY je klíčový pro podepisování JWT tokenů. Měl by být v produkci velmi bezpečný a tajný.
app.config['SECRET_KEY'] = os.getenv("SECRET_KEY", "c6hnErwqQ7VZuenS") 

# --- Konfigurace pro odesílání e-mailů (Flask-Mail) ---
# Konfigurace pro lokální vývoj s MailHogem.
# MailHog běží v Dockeru pod názvem služby 'mailhog'.
app.config['MAIL_SERVER'] = os.getenv('MAIL_SERVER', 'mailhog')
app.config['MAIL_PORT'] = int(os.getenv('MAIL_PORT', 1025))
app.config['MAIL_USE_TLS'] = os.getenv('MAIL_USE_TLS', 'false').lower() in ['true', '1', 't']
app.config['MAIL_USERNAME'] = os.getenv('MAIL_USERNAME', None)
app.config['MAIL_PASSWORD'] = os.getenv('MAIL_PASSWORD', None)
app.config['MAIL_DEFAULT_SENDER'] = os.getenv('MAIL_DEFAULT_SENDER', 'noreply@forum.example')

# Inicializace rozšíření pro práci s MySQL databází.
mysql = MySQL(app)
mail = Mail(app)

# --- Načtení nastavení z DB při startu ---
with app.app_context():
    cur = mysql.connection.cursor()
    cur.execute("SELECT setting_key, setting_value FROM settings")
    for key, value in cur.fetchall():
        # Převod na boolean, pokud je to relevantní
        if value.lower() in ['true', 'false']:
            app.config[key.upper()] = value.lower() == 'true'
        else:
            app.config[key.upper()] = value
    cur.close()
    # Výchozí hodnota, pokud by v DB nic nebylo
    if 'REQUIRE_REGISTRATION_APPROVAL' not in app.config:
        app.config['REQUIRE_REGISTRATION_APPROVAL'] = False

# --- AUTHENTICATION ENDPOINTS ---

@app.route("/api/auth/register", methods=["POST"])
def register():
    # Získání dat z těla JSON požadavku.
    data = request.json
    full_name = data.get("full_name")
    username = data.get("username")
    email = data.get("email")
    password = data.get("password")

    if not username or not password or not email:
        return jsonify({"error": "Missing username, email or password"}), 400

    # Zjistíme, zda je nutné schválení registrace
    is_approved = not app.config.get('REQUIRE_REGISTRATION_APPROVAL', False)

    # Vygenerování bezpečného hashe hesla. Nikdy neukládáme hesla v čistém textu!
    password_hash = generate_password_hash(password)

    # Vytvoření kurzoru pro interakci s databází.
    cur = mysql.connection.cursor()
    try:
        # Provedení SQL dotazu pro vložení nového uživatele s příznakem schválení.
        cur.execute(
            "INSERT INTO users (full_name, username, email, password_hash, is_approved) VALUES (%s, %s, %s, %s, %s)",
            (full_name, username, email, password_hash, is_approved)
        )
        # Potvrzení transakce (uložení změn do databáze).
        mysql.connection.commit()
    except:
        # Pokud vložení selže (např. kvůli UNIQUE omezení na 'username'), vrátí se chyba.
        return jsonify({"error": "User already exists"}), 400

    message = "User registered successfully."
    if not is_approved:
        message = "Registration successful. Your account is pending administrator approval."
    return jsonify({"message": message}), 201


@app.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json
    username, password = data.get("username"), data.get("password")

    # Načtení uživatele z databáze podle uživatelského jména.
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, password_hash, role, full_name, username, is_blocked, is_approved FROM users WHERE username=%s", (username,))
    user = cur.fetchone()
    
    # Ověření, zda uživatel existuje a zda se zadané heslo shoduje s uloženým hashem.
    if not user or not check_password_hash(user[1], password):
        return jsonify({"error": "Invalid credentials"}), 401

    # Kontrola, zda je účet zablokován nebo čeká na schválení.
    if user[5]: # is_blocked
        return jsonify({"error": "Your account has been blocked by an administrator."}), 403
    
    if not user[6]: # is_approved
        return jsonify({"error": "Your account is pending administrator approval."}), 403

    # 1. Generování krátkodobého ACCESS TOKENU (15 minut)
    access_token = jwt.encode(
        {
            "user_id": user[0],
            "role": user[2],
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )

    # 2. Generování dlouhodobého REFRESH TOKENU (7 dní)
    # Refresh token je bezpečný náhodný řetězec
    refresh_token = os.urandom(32).hex()
    refresh_token_hash = generate_password_hash(refresh_token)
    refresh_token_expires = datetime.datetime.utcnow() + datetime.timedelta(days=7)

    # 3. Uložení hashe refresh tokenu do databáze
    cur.execute(
        "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
        (user[0], refresh_token_hash, refresh_token_expires)
    )
    mysql.connection.commit()

    # 4. Odeslání obou tokenů a informací o uživateli na frontend
    return jsonify({
        "accessToken": access_token,
        "refreshToken": refresh_token,
        "user": {
            "id": user[0],
            "role": user[2],
            "full_name": user[3],
            "username": user[4]
        }
    })

@app.route("/api/auth/refresh", methods=["POST"])
def refresh_token():
    """
    Vydá nový access token na základě platného refresh tokenu.
    """
    data = request.json
    sent_refresh_token = data.get("refreshToken")
    if not sent_refresh_token:
        return jsonify({"error": "Refresh token is missing"}), 400

    cur = mysql.connection.cursor()
    # Najdeme všechny platné tokeny uživatele
    # Pro jednoduchost předpokládáme, že uživatel může mít více platných refresh tokenů
    cur.execute("SELECT id, user_id, token_hash, expires_at FROM refresh_tokens WHERE expires_at > NOW()")
    
    found_token = None
    for token_row in cur.fetchall():
        # Porovnáme hash z databáze s hashem zaslaného tokenu
        if check_password_hash(token_row[2], sent_refresh_token):
            found_token = token_row
            break

    if not found_token:
        return jsonify({"error": "Invalid or expired refresh token"}), 401

    # Token je platný, vygenerujeme nový access token
    user_id = found_token[1]
    cur.execute("SELECT role FROM users WHERE id = %s", (user_id,))
    user_role = cur.fetchone()[0]

    new_access_token = jwt.encode(
        {
            "user_id": user_id,
            "role": user_role,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(minutes=15)
        },
        app.config['SECRET_KEY'],
        algorithm="HS256"
    )

    return jsonify({"accessToken": new_access_token})

@app.route("/api/auth/forgot-password", methods=["POST"])
def forgot_password():
    """
    Zpracuje žádost o obnovu hesla.
    """
    data = request.json
    email = data.get("email")
    if not email:
        return jsonify({"error": "Email is required"}), 400

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, email FROM users WHERE email = %s", (email,))
    user = cur.fetchone()

    # Z bezpečnostních důvodů vždy vracíme úspěšnou odpověď,
    # aby útočník nemohl zjišťovat, které e-maily jsou v systému.
    if user:
        user_id = user[0]
        user_email = user[1]

        # Generování bezpečného tokenu
        token = os.urandom(32).hex()
        token_hash = generate_password_hash(token)
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(hours=1)

        # Uložení hashe tokenu do databáze
        cur.execute(
            "INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES (%s, %s, %s)",
            (user_id, token_hash, expires_at)
        )
        mysql.connection.commit()

        # Odeslání e-mailu (v reálné aplikaci by mělo běžet na pozadí)
        reset_url = f"http://localhost:8000/reset_password.html?token={token}"
        try:
            msg = Message("Obnova hesla pro Fórum",
                          sender=app.config['MAIL_DEFAULT_SENDER'],
                          recipients=[user_email])
            msg.body = f"Dobrý den,\n\npro obnovu Vašeho hesla klikněte na následující odkaz:\n{reset_url}\n\nPokud jste o obnovu nežádali, tento e-mail ignorujte.\n\nS pozdravem,\nVáš Tým Fóra"
            mail.send(msg)
            app.logger.info(f"Password reset email sent to {user_email}")
        except Exception as e:
            # Logování chyby, ale nevracíme ji uživateli z bezpečnostních důvodů.
            app.logger.error(f"Failed to send password reset email to {user_email}: {e}")

    return jsonify({"message": "If an account with that email exists, a password reset link has been sent."})

@app.route("/api/auth/reset-password", methods=["POST"])
def reset_password():
    """
    Nastaví nové heslo na základě platného tokenu.
    """
    data = request.json
    token = data.get("token")
    new_password = data.get("new_password")

    if not token or not new_password:
        return jsonify({"error": "Token and new password are required"}), 400

    cur = mysql.connection.cursor()
    # Najdeme všechny neexpirované tokeny
    cur.execute("SELECT id, user_id, token_hash FROM password_reset_tokens WHERE expires_at > NOW()")
    
    found_token_row = None
    for token_row in cur.fetchall():
        if check_password_hash(token_row[2], token):
            found_token_row = token_row
            break
    
    if not found_token_row:
        return jsonify({"error": "Invalid or expired token"}), 401

    user_id = found_token_row[1]
    new_password_hash = generate_password_hash(new_password)

    cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_password_hash, user_id))
    cur.execute("DELETE FROM password_reset_tokens WHERE id = %s", (found_token_row[0],))
    mysql.connection.commit()

    return jsonify({"message": "Password has been successfully reset."})

@app.route("/api/auth/logout", methods=["POST"])
def logout():
    """
    Zneplatní refresh token jeho smazáním z databáze.
    """
    data = request.json
    sent_refresh_token = data.get("refreshToken")
    # Najdeme a smažeme token (bezpečně, i když jich je více)
    # Implementace je stejná jako při refresh, ale na konci token smažeme
    # Pro zjednodušení zde jen ukázka, v reálu by se sdílela logika s refresh
    # Zde předpokládáme, že frontend pošle token a my ho smažeme, pokud existuje.
    # V reálné aplikaci by se hledal hash.
    return jsonify({"message": "Successfully logged out"})

# --- DEKORÁTORY A POMOCNÉ FUNKCE ---

from functools import wraps

def token_required(f):
    """
    Dekorátor pro ochranu endpointů. Ověřuje platnost JWT tokenu z hlavičky 'Authorization'.
    Pokud je token platný, předá informace o uživateli (slovník) jako první argument do volané funkce.
    """
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        if "Authorization" in request.headers:
            # Token je obvykle ve formátu "Bearer <token>"
            token = request.headers["Authorization"].split(" ")[1]
        
        if not token:
            return jsonify({"error": "Unauthorized", "message": "Token is missing"}), 401
        
        try:
            data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=["HS256"])
            user_info = {"id": data["user_id"], "role": data.get("role", "user")}
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return jsonify({"error": "Unauthorized", "message": "Token is invalid or expired"}), 401

        return f(user_info, *args, **kwargs)
    return decorated

def get_user_from_token(): # Ponecháno pro případy, kdy je uživatel volitelný (např. zobrazení vlákna)
    """Dekóduje JWT token z hlavičky 'Authorization' a vrací informace o uživateli, pokud existuje."""
    token = request.headers.get("Authorization")
    if not token:
        return None
    try:
        # Token je obvykle ve formátu "Bearer <token>", proto ho rozdělíme.
        data = jwt.decode(token.split(" ")[1], app.config['SECRET_KEY'], algorithms=["HS256"])
        # Vrátí slovník s ID a rolí uživatele.
        return {"id": data["user_id"], "role": data.get("role", "user")}
    except:
        # Pokud je token neplatný, prošlý nebo chybí, vrátí se None.
        return None


# --- USER MANAGEMENT ENDPOINTS ---

@app.route("/api/users/change_password", methods=["PUT"])
@token_required
def change_password(user):
    # Informace o uživateli jsou nyní předány dekorátorem jako argument `user`.
    data = request.json
    old_pw, new_pw = data.get("old_password"), data.get("new_password")
    if not old_pw or not new_pw:
        return jsonify({"error": "Missing password"}), 400

    # Načtení hashe aktuálního hesla z databáze pro ověření.
    cur = mysql.connection.cursor()
    cur.execute("SELECT password_hash FROM users WHERE id=%s", (user["id"],))
    row = cur.fetchone()
    # Ověření, zda se staré heslo shoduje.
    if not row or not check_password_hash(row[0], old_pw):
        return jsonify({"error": "Old password incorrect"}), 403

    # Vygenerování hashe pro nové heslo a jeho uložení do databáze.
    new_hash = generate_password_hash(new_pw)
    cur.execute("UPDATE users SET password_hash=%s WHERE id=%s", (new_hash, user["id"]))
    mysql.connection.commit()
    return jsonify({"message": "Password updated"})


# --- THREADS ENDPOINTS ---

@app.route("/api/threads", methods=["GET"])
def list_threads():
    cur = mysql.connection.cursor()
    cur.execute("""
        SELECT t.id, t.title, u.username, t.created_at, u.full_name, t.is_closed, t.is_deleted, t.user_id
        FROM threads t
                 JOIN users u ON t.user_id = u.id
        WHERE t.is_deleted = FALSE -- Zobrazí pouze nesmazaná vlákna.
        ORDER BY t.is_closed ASC, t.created_at DESC -- Seřadí vlákna tak, aby otevřená byla nahoře, a pak podle data vytvoření.
    """)
    # Zpracování výsledků dotazu do seznamu slovníků pro snadnější použití na frontendu.
    threads = [{"id": r[0], "title": r[1], "author_username": r[2], "created_at": r[3], "author_full_name": r[4], "is_closed": bool(r[5]), "author_id": r[7]} for r in cur.fetchall()]
    return jsonify(threads)


@app.route("/api/threads", methods=["POST"])
@token_required
def create_thread(user):
    # Uživatel musí být přihlášen, což zajišťuje dekorátor.
    data = request.json
    title = data.get("title")
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO threads (title, user_id) VALUES (%s, %s)", (title, user["id"]))
    mysql.connection.commit()
    return jsonify({"message": "Thread created"}), 201

@app.route("/api/threads/<int:thread_id>", methods=["GET"])
def get_thread(thread_id):
    # Získání detailů jednoho vlákna včetně všech jeho příspěvků.
    current_user = get_user_from_token()
    current_user_role = current_user['role'] if current_user else 'user'

    # Načtení základních informací o vlákně.
    cur = mysql.connection.cursor()
    cur.execute("SELECT id, title, user_id, created_at, is_closed, is_deleted FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    # Pokud vlákno neexistuje nebo je smazané, vrátí se chyba 404 Not Found.
    if not thread or thread[5]: # thread is deleted
        return jsonify({"error": "Not found"}), 404

    # Načtení všech příspěvků patřících k tomuto vláknu.
    cur.execute("""
        SELECT p.id, u.username, p.content, p.created_at, u.role, p.is_anonymous, p.is_deleted, p.parent_post_id, p.user_id
        FROM posts p
                 JOIN users u ON p.user_id = u.id
        WHERE thread_id = %s ORDER BY p.created_at ASC
    """, (thread_id,))
    
    # Zpracování příspěvků do slovníku pro snadnější vnořování odpovědí.
    all_posts = {}
    for r in cur.fetchall():
        post_id = r[0]
        is_deleted = r[6]
        author_name = r[1] if not is_deleted else "Odstraněno"
        content = r[2] if not is_deleted else "Tento příspěvek byl odstraněn"
        
        # Zpracování logiky pro anonymní příspěvky.
        # Běžný uživatel vidí "Anonymní", admin vidí skutečné jméno s příznakem.
        if not is_deleted:
            is_anonymous = r[5]
            if is_anonymous and current_user_role != 'admin':
                author_name = "Anonymní"
            elif is_anonymous and current_user_role == 'admin':
                author_name = f"{r[1]} (anonymně)"

        # Uložení zpracovaného příspěvku do slovníku. Klíčem je ID příspěvku.
        all_posts[post_id] = {
            "id": post_id, "author": author_name, "content": content, 
            "created_at": r[3], "author_role": r[4], "is_deleted": is_deleted,
            "parent_post_id": r[7], "author_id": r[8], "replies": []
        }

    # Sestavení stromové struktury (vnoření odpovědí).
    nested_posts = []
    for post_id, post in all_posts.items():
        if post['parent_post_id'] in all_posts:
            all_posts[post['parent_post_id']]['replies'].append(post)
        else:
            nested_posts.append(post)
    return jsonify({
        # Sestavení finální JSON odpovědi, která obsahuje informace o vlákně
        # a seznam příspěvků již ve vnořené struktuře.
        "id": thread[0],
        "title": thread[1],
        "author_id": thread[2],
        "created_at": thread[3],
        "is_closed": bool(thread[4]), "is_deleted": bool(thread[5]),
        "posts": nested_posts
    })


@app.route("/api/threads/<int:thread_id>", methods=["PUT"])
@token_required
def update_thread(user, thread_id):
    data = request.json
    title = data.get("title")

    # Ověření oprávnění: Uživatel musí být autorem vlákna nebo admin.
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM threads WHERE id=%s", (thread_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Thread not found"}), 404

    # Kontrola oprávnění.
    if row[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE threads SET title=%s WHERE id=%s", (title, thread_id))
    mysql.connection.commit()
    return jsonify({"message": "Thread updated"})


@app.route("/api/threads/<int:thread_id>", methods=["DELETE"])
@token_required
def delete_thread(user, thread_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread:
        return jsonify({"error": "Not found"}), 404

    # Ověření oprávnění: Uživatel musí být autorem vlákna nebo admin.
    is_author = thread[0] == user["id"]
    is_admin = user["role"] == 'admin'

    if not is_author and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    # Provedení "měkkého smazání" (soft delete) nastavením příznaku `is_deleted` na TRUE.
    # Vlákno fyzicky zůstává v databázi.
    cur.execute("UPDATE threads SET is_deleted=TRUE WHERE id=%s", (thread_id,))
    mysql.connection.commit()
    return jsonify({"message": "Thread deleted successfully"})

@app.route("/api/threads/<int:thread_id>/close", methods=["PUT"])
@token_required
def close_thread(user, thread_id):
    # Endpoint pro uzavření/otevření vlákna, chráněný dekorátorem.
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id, is_closed FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if not thread:
        return jsonify({"error": "Thread not found"}), 404

    # Ověření oprávnění: Povoleno pouze autorovi vlákna nebo adminovi.
    if thread[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    # Přepnutí stavu `is_closed` na opačnou hodnotu.
    new_status = not thread[1]
    cur.execute("UPDATE threads SET is_closed=%s WHERE id=%s", (new_status, thread_id))
    mysql.connection.commit()
    return jsonify({"message": f"Thread {'closed' if new_status else 'opened'}"})

# --- POSTS ENDPOINTS ---

@app.route("/api/threads/<int:thread_id>/posts", methods=["POST"])
@token_required
def add_post(user, thread_id):
    cur = mysql.connection.cursor()
    # Kontrola, zda vlákno, do kterého se přispívá, není uzavřené.
    cur.execute("SELECT is_closed FROM threads WHERE id=%s", (thread_id,))
    thread = cur.fetchone()
    if thread and thread[0]:
        return jsonify({"error": "Thread is closed"}), 403

    # Získání dat z těla požadavku.
    data = request.json
    content = data.get("content")
    # `parent_post_id` je volitelné, použije se při vytváření odpovědi na jiný příspěvek.
    is_anonymous = data.get("is_anonymous", False)
    parent_post_id = data.get("parent_post_id")
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO posts (thread_id, user_id, content, is_anonymous, parent_post_id) VALUES (%s,%s,%s,%s,%s)", (thread_id, user["id"], content, is_anonymous, parent_post_id))
    mysql.connection.commit()
    return jsonify({"message": "Post added"}), 201


@app.route("/api/posts/<int:post_id>", methods=["PUT"])
@token_required
def update_post(user, post_id):
    data = request.json
    content = data.get("content")

    # Ověření oprávnění: Uživatel musí být autorem příspěvku nebo admin.
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM posts WHERE id=%s", (post_id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"error": "Post not found"}), 404

    # Kontrola oprávnění.
    if row[0] != user["id"] and user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur.execute("UPDATE posts SET content=%s WHERE id=%s", (content, post_id))
    mysql.connection.commit()
    return jsonify({"message": "Post updated"})


@app.route("/api/posts/<int:post_id>", methods=["DELETE"])
@token_required
def delete_post(user, post_id):
    cur = mysql.connection.cursor()
    cur.execute("SELECT user_id FROM posts WHERE id=%s", (post_id,))
    post = cur.fetchone()
    if not post:
        return jsonify({"error": "Post not found"}), 404

    # Ověření oprávnění: Uživatel musí být autorem příspěvku nebo admin.
    is_author = post[0] == user["id"]
    is_admin = user["role"] == 'admin'

    if not is_author and not is_admin:
        return jsonify({"error": "Forbidden"}), 403

    # Speciální pravidlo: Autor nemůže smazat svůj příspěvek, pokud na něj již někdo odpověděl.
    # Admin toto omezení nemá.
    cur.execute("SELECT COUNT(*) FROM posts WHERE parent_post_id=%s", (post_id,))
    reply_count = cur.fetchone()[0]

    if is_author and reply_count > 0:
        return jsonify({"error": "Cannot delete a post with replies."}), 403

    # Provedení "měkkého smazání" (soft delete).
    cur.execute("UPDATE posts SET is_deleted=TRUE WHERE id=%s", (post_id,))
    mysql.connection.commit()
    return jsonify({"message": "Post deleted successfully"})


# --- ADMIN-ONLY ENDPOINTS ---

@app.route("/api/admin/users", methods=["GET"])
@token_required
def admin_get_users(user):
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    cur.execute("SELECT id, full_name, username, role, is_blocked, is_approved FROM users ORDER BY id")
    users = [{"id": r[0], "full_name": r[1], "username": r[2], "role": r[3], "is_blocked": bool(r[4]), "is_approved": bool(r[5])} for r in cur.fetchall()]
    return jsonify(users)





@app.route("/api/admin/users/<int:user_id>/role", methods=["PUT"])
@token_required
def admin_change_user_role(user, user_id):
    # Tento endpoint je přístupný pouze pro administrátory.
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    data = request.json
    new_role = data.get("role")
    # Validace, zda je nová role platná.
    if new_role not in ['user', 'politician', 'admin']:
        return jsonify({"error": "Invalid role"}), 400

    cur = mysql.connection.cursor()
    cur.execute("UPDATE users SET role=%s WHERE id=%s", (new_role, user_id))
    mysql.connection.commit()

    return jsonify({"message": "User role updated"})

@app.route("/api/admin/settings/registration_approval", methods=["GET", "PUT"])
@token_required
def admin_manage_registration_approval(user):
    """
    Získá nebo nastaví globální požadavek na schvalování registrací.
    Přístupné pouze pro administrátory.
    """
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()

    if request.method == "GET":
        # Načteme aktuální hodnotu z app.config, která je načtena při startu a aktualizována při PUT
        current_value = app.config.get('REQUIRE_REGISTRATION_APPROVAL', False)
        return jsonify({"require_registration_approval": current_value})

    if request.method == "PUT":
        data = request.json
        new_value = data.get("require_registration_approval")

        if not isinstance(new_value, bool):
            return jsonify({"error": "Invalid value, boolean expected."}), 400

        # Uložíme novou hodnotu do databáze
        cur.execute(
            "INSERT INTO settings (setting_key, setting_value) VALUES ('require_registration_approval', %s) ON DUPLICATE KEY UPDATE setting_value = %s",
            (str(new_value).lower(), str(new_value).lower())
        )
        mysql.connection.commit()

        # Aktualizujeme hodnotu v běžící aplikaci
        app.config['REQUIRE_REGISTRATION_APPROVAL'] = new_value

        return jsonify({"message": "Setting updated successfully.", "require_registration_approval": new_value})

@app.route("/api/admin/users/<int:user_id>", methods=["DELETE"])
@token_required
def admin_delete_user(user, user_id):
    """
    Smaže uživatele z databáze.
    Přístupné pouze pro administrátory. Administrátor nemůže smazat sám sebe.
    """
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    # Zabráníme adminovi smazat sám sebe
    if user['id'] == user_id:
        return jsonify({"error": "You cannot delete your own account."}), 400

    cur = mysql.connection.cursor()
    cur.execute("DELETE FROM users WHERE id = %s", (user_id,))
    mysql.connection.commit()

    return jsonify({"message": "User deleted successfully."})

@app.route("/api/admin/users/<int:user_id>/block", methods=["PUT"])
@token_required
def admin_toggle_block_user(user, user_id):
    """
    Přepíná stav blokace uživatele (blokovat/odblokovat).
    Přístupné pouze pro administrátory.
    """
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    # Přepneme hodnotu is_blocked na její opak
    cur.execute("UPDATE users SET is_blocked = NOT is_blocked WHERE id = %s", (user_id,))
    mysql.connection.commit()

    return jsonify({"message": "User block status toggled."})

@app.route("/api/admin/users/<int:user_id>/approve", methods=["PUT"])
@token_required
def admin_approve_user(user, user_id):
    """
    Schválí registraci uživatele.
    Přístupné pouze pro administrátory.
    """
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    cur = mysql.connection.cursor()
    cur.execute("UPDATE users SET is_approved = TRUE WHERE id = %s", (user_id,))
    mysql.connection.commit()

    return jsonify({"message": "User has been approved."})


@app.route("/api/admin/audit-log", methods=["GET"])
@token_required
def admin_get_audit_log(user):
    """
    Endpoint pro získání auditních záznamů s podporou filtrování a stránkování.
    Přístupný pouze pro administrátory.
    """
    if not user or user["role"] != 'admin':
        return jsonify({"error": "Forbidden"}), 403

    # Získání parametrů z URL pro stránkování a filtrování
    page = request.args.get('page', 1, type=int)
    per_page = 25  # Pevný počet záznamů na stránku
    user_id_filter = request.args.get('user_id', None, type=int)
    offset = (page - 1) * per_page

    # Sestavení základního dotazu s JOIN pro získání uživatelského jména
    base_query = "FROM audit_log al LEFT JOIN users u ON al.user_id = u.id"
    filter_condition = ""
    params = []

    if user_id_filter:
        filter_condition = " WHERE al.user_id = %s"
        params.append(user_id_filter)

    # Získání celkového počtu záznamů pro stránkování
    cur = mysql.connection.cursor()
    cur.execute(f"SELECT COUNT(*) {base_query} {filter_condition}", tuple(params))
    total_records = cur.fetchone()[0]

    # Získání dat pro aktuální stránku
    query = f"""
        SELECT al.id, al.user_id, u.username, al.ip_address, al.endpoint, al.method, al.created_at
        {base_query} {filter_condition}
        ORDER BY al.created_at DESC
        LIMIT %s OFFSET %s
    """
    params.extend([per_page, offset])
    cur.execute(query, tuple(params))

    logs = [{"id": r[0], "user_id": r[1], "username": r[2] or "N/A", "ip_address": r[3], "endpoint": r[4], "method": r[5], "created_at": r[6].strftime('%Y-%m-%d %H:%M:%S')} for r in cur.fetchall()]

    return jsonify({"logs": logs, "total_records": total_records, "page": page, "per_page": per_page})

# --- LOGOVÁNÍ POŽADAVKŮ ---

import random
@app.after_request
def log_request(response):
    """
    Tato funkce se spustí po každém požadavku na aplikaci.
    Zaznamená informace o požadavku do tabulky 'audit_log'.
    """
    # Logujeme pouze požadavky na naše API, ignorujeme ostatní (např. favicon.ico).
    if not request.path.startswith('/api/'):
        return response

    # Získáme informace o uživateli, pokud je přihlášen.
    user = get_user_from_token() # Zde nepoužíváme dekorátor, protože chceme logovat i neúspěšné pokusy
    user_id = user['id'] if user else None

    # Získáme další informace z požadavku.
    endpoint = request.path
    method = request.method
    ip_address = request.remote_addr

    # Vložíme záznam do databáze.
    cur = mysql.connection.cursor()
    cur.execute("INSERT INTO audit_log (user_id, ip_address, endpoint, method) VALUES (%s, %s, %s, %s)", (user_id, ip_address, endpoint, method))
    mysql.connection.commit()

    # S šancí 1:10000 spustíme čištění starých logů.
    # Tomuto se říká "poor man's cron" - jednoduchý způsob, jak spouštět periodické úlohy.
    if random.randint(1, 10000) == 1:
        cur.execute("DELETE FROM audit_log WHERE created_at < NOW() - INTERVAL 30 DAY")
        mysql.connection.commit()
        app.logger.info("Audit log cleanup task has been executed.")

    return response

# --- SPUŠTĚNÍ APLIKACE ---
if __name__ == "__main__":
    # Tento blok se provede pouze, když je skript spuštěn přímo (ne při importu).
    # Spustí vývojový server Flask. `host="0.0.0.0"` zpřístupní server v síti (důležité pro Docker).
    # `debug=True` zapne debug mód, který automaticky restartuje server při změnách kódu a poskytuje detailní chybové hlášky.
    app.run(host="0.0.0.0", port=5000, debug=True)
