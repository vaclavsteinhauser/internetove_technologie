const API_URL = "http://localhost:5000/api";

async function apiRequest(endpoint, method = "GET", data = null, auth = true) {
    const headers = { "Content-Type": "application/json" };
    if (auth) {
        const token = localStorage.getItem("token");
        if (token) headers["Authorization"] = "Bearer " + token;
    }

    const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: data ? JSON.stringify(data) : null,
    });

    if (!res.ok) {
        let errorMessage = `API chyba: ${res.status}`;
        try {
            const errorData = await res.json();
            if (errorData && errorData.message) {
                errorMessage = errorData.message;
            }
        } catch (jsonError) {
            console.error("Failed to parse error response as JSON:", jsonError);
        }
        throw new Error(errorMessage);
    }
    return await res.json();
}