const API_URL = "/api";

let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

async function refreshToken() {
    try {
        const localRefreshToken = localStorage.getItem("refreshToken");
        if (!localRefreshToken) {
            return Promise.reject(new Error("No refresh token available."));
        }

        const res = await fetch(`${API_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken: localRefreshToken }),
        });

        if (!res.ok) {
            // Pokud refresh selže, odhlásíme uživatele
            logout();
            return Promise.reject(new Error("Session expired. Please log in again."));
        }

        const data = await res.json();
        localStorage.setItem("accessToken", data.accessToken);
        return data.accessToken;
    } catch (error) {
        logout();
        return Promise.reject(error);
    }
}


/**
 * Univerzální funkce pro komunikaci s backendovým API.
 * Zpracovává odesílání požadavků, přidávání autorizačního tokenu a základní chybové stavy.
 * @param {string} endpoint - Cesta k API endpointu (např. "/threads").
 * @param {string} [method="GET"] - HTTP metoda (GET, POST, PUT, DELETE, ...).
 * @param {object|null} [data=null] - Data k odeslání v těle požadavku (pro POST, PUT).
 * @param {boolean} [auth=true] - Zda se má k požadavku přidat autorizační token.
 * @returns {Promise<any>} - Promise, která se v případě úspěchu resolvuje s JSON odpovědí od serveru.
 * @throws {Error} - V případě neúspěšného požadavku (status není 2xx) vyhodí chybu s hláškou ze serveru.
 */
async function apiRequest(endpoint, method = "GET", data = null, auth = true) {
    // Základní hlavičky pro všechny požadavky.
    const headers = { "Content-Type": "application/json" };
    
    // Pokud je vyžadována autorizace, pokusí se načíst token z localStorage.
    if (auth) { 
        const token = localStorage.getItem("accessToken");
        // Pokud token existuje, přidá ho do hlavičky 'Authorization' ve formátu 'Bearer'.
        if (token) headers["Authorization"] = "Bearer " + token;
    }

    // Sestavení a odeslání požadavku pomocí `fetch`.
    const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        // Tělo požadavku se přidá pouze pokud jsou poskytnuta data. Data se převedou na JSON řetězec.
        body: data ? JSON.stringify(data) : null,
    });

    // Kontrola, zda byl požadavek úspěšný (HTTP status v rozsahu 200-299).
    if (!res.ok) {
        const errorData = await res.json().catch(() => ({})); // Zkusíme parsovat chybu
        const originalRequest = { endpoint, method, data, auth };

        // Pokud je chyba 401 (Unauthorized) a nejedná se o pokus o přihlášení/refresh
        if (res.status === 401 && !originalRequest.endpoint.includes('/auth/')) {
            if (isRefreshing) {
                // Pokud už probíhá refresh, zařadíme požadavek do fronty a počkáme na nový token
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    // Zkusíme to znovu s novým tokenem
                    return apiRequest(endpoint, method, data, auth);
                });
            }

            isRefreshing = true;

            return new Promise((resolve, reject) => {
                refreshToken().then(newAccessToken => {
                    processQueue(null, newAccessToken); // Zpracujeme frontu čekajících požadavků
                    resolve(apiRequest(endpoint, method, data, auth)); // Zopakujeme původní požadavek
                }).catch(err => {
                    processQueue(err, null);
                    reject(err);
                }).finally(() => {
                    isRefreshing = false;
                });
            });
        }

        // Pro ostatní chyby vyhodíme standardní error
        const error = new Error(errorData.message || errorData.error || `API chyba: ${res.status}`);
        // Přidáme k chybě i detaily, pokud je server poslal (např. u validace hesla)
        if (errorData.details) {
            error.details = errorData.details;
        }
        throw error;
    }
    // Pokud byl požadavek úspěšný, vrátí odpověď převedenou z JSONu.
    return await res.json();
}

// Tato funkce musí být dostupná globálně, aby ji mohla volat i funkce refreshToken
function logout() {
    localStorage.clear();
    window.location.href = "index.html";
}