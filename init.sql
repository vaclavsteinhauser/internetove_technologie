-- Vytvoření databáze 'forum', pokud ještě neexistuje.
-- Nastavení znakové sady na utf8mb4 a porovnávání (collation) na utf8mb4_unicode_ci
-- pro správnou podporu všech znaků Unicode, včetně emoji.
CREATE DATABASE IF NOT EXISTS forum CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Přepnutí do kontextu nově vytvořené databáze pro následující příkazy.
USE forum;

-- Tabulka pro ukládání informací o uživatelích.
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,          -- Unikátní identifikátor uživatele.
    full_name VARCHAR(50),                      -- Celé jméno uživatele.
    username VARCHAR(50) UNIQUE NOT NULL,       -- Unikátní přihlašovací jméno.
    email VARCHAR(120) UNIQUE NOT NULL,         -- E-mailová adresa, klíčová pro obnovu hesla.
    password_hash VARCHAR(255) NOT NULL,        -- Bezpečně uložený hash hesla (např. pomocí Scrypt, Bcrypt).
    role VARCHAR(20) NOT NULL DEFAULT 'user',   -- Role uživatele ('user', 'politician', 'admin') pro řízení oprávnění.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Časové razítko vytvoření účtu.
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,  -- Příznak, zda je účet zablokován administrátorem.
    is_approved BOOLEAN NOT NULL DEFAULT TRUE   -- Příznak, zda byla registrace schválena administrátorem.
);

-- Tabulka pro diskuzní vlákna.
CREATE TABLE threads (
    id INT AUTO_INCREMENT PRIMARY KEY,          -- Unikátní identifikátor vlákna.
    title VARCHAR(255) NOT NULL,                -- Název vlákna.
    user_id INT NOT NULL,                       -- ID autora vlákna (cizí klíč do tabulky users).
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Časové razítko vytvoření vlákna.
    is_closed BOOLEAN NOT NULL DEFAULT FALSE,   -- Příznak, zda je vlákno uzavřené pro další příspěvky.
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,  -- Příznak pro "měkké" smazání (soft delete). Vlákno zůstává v DB, ale není viditelné.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE -- Pokud je smazán uživatel, smažou se i všechna jeho vlákna.
);

-- Tabulka pro jednotlivé příspěvky ve vláknech.
CREATE TABLE posts (
    id INT AUTO_INCREMENT PRIMARY KEY,          -- Unikátní identifikátor příspěvku.
    thread_id INT NOT NULL,                     -- ID vlákna, do kterého příspěvek patří (cizí klíč).
    user_id INT NOT NULL,                       -- ID autora příspěvku (cizí klíč).
    content TEXT NOT NULL,                      -- Textový obsah příspěvku.
    parent_post_id INT NULL DEFAULT NULL,       -- ID rodičovského příspěvku, pokud se jedná o odpověď. Umožňuje vnořené komentáře.
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,-- Příznak, zda má být příspěvek zobrazen jako anonymní.
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,  -- Příznak pro "měkké" smazání příspěvku.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Časové razítko vytvoření příspěvku.
    FOREIGN KEY (thread_id) REFERENCES threads(id) ON DELETE CASCADE, -- Pokud je smazáno vlákno, smažou se i všechny jeho příspěvky.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,     -- Pokud je smazán uživatel, smažou se i všechny jeho příspěvky.
    FOREIGN KEY (parent_post_id) REFERENCES posts(id) ON DELETE SET NULL -- Pokud je smazán rodičovský příspěvek, odpovědi na něj zůstanou, ale ztratí vazbu na rodiče.
);

-- Tabulka pro auditní záznamy požadavků na API.
CREATE TABLE audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,                           -- ID uživatele, který požadavek provedl (pokud byl přihlášen). NULL pro veřejné endpointy.
    ip_address VARCHAR(45),                     -- IP adresa klienta.
    endpoint VARCHAR(255) NOT NULL,             -- Cílový endpoint API (např. /api/threads/1).
    method VARCHAR(10) NOT NULL,                -- HTTP metoda (GET, POST, atd.).
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- Časové razítko požadavku.
    -- Pokud je uživatel smazán, jeho záznamy v logu zůstanou, ale bez vazby na něj.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Tabulka pro ukládání refresh tokenů pro perzistentní přihlášení.
CREATE TABLE refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,    -- Bezpečně uložený hash refresh tokenu.
    expires_at TIMESTAMP NOT NULL,              -- Čas expirace tokenu.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Pokud je uživatel smazán, smažou se i jeho refresh tokeny.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabulka pro jednorázové tokeny pro obnovu hesla.
CREATE TABLE password_reset_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token_hash VARCHAR(255) NOT NULL UNIQUE,    -- Bezpečně uložený hash tokenu pro obnovu.
    expires_at TIMESTAMP NOT NULL,              -- Čas expirace tokenu (např. 1 hodina).
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Pokud je uživatel smazán, smažou se i jeho tokeny.
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tabulka pro globální nastavení aplikace.
CREATE TABLE settings (
    setting_key VARCHAR(50) PRIMARY KEY,
    setting_value VARCHAR(255) NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Vložení výchozího nastavení pro schvalování registrací. 'false' znamená, že schvalování je vypnuté.
INSERT INTO settings (setting_key, setting_value) VALUES ('require_registration_approval', 'false');

-- Vytvoření defaultního admina: admin/admin
-- Heslo 'admin' je zahashováno pomocí Scrypt. Tento hash je pak použit pro ověření při přihlášení.
INSERT INTO users (full_name, username, email, password_hash, role, is_approved) VALUES ('Admin User', 'admin', 'admin@example.com', 'scrypt:32768:8:1$VVvJHyXJa7gPnxjF$2ccc405caf0c24efbc94cc76426771f2bb6e45a97e93504bd3257a127e32be2fc8089ea8c434f86e1c713ae14f0a66beb9db2e38585ed55a7875ddbcf99a5674', 'admin', TRUE);
