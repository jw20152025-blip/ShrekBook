async function loadPreferences() {
    const status = document.getElementById("status");
    try {
        const response = await fetch("/api/email/preferences", { credentials: "include", cache: "no-store" });
        const data = await response.json();
        if (response.status === 401) {
            location.href = "/login.html";
            return;
        }
        if (!response.ok) throw new Error(data.error || "Could not load preferences.");
        document.getElementById("social").checked = data.preferences.social;
        document.getElementById("announcements").checked = data.preferences.announcements;
        document.getElementById("security").checked = true;
    } catch (error) {
        status.textContent = "Could not load settings: " + error.message;
    }
}

document.getElementById("save").addEventListener("click", async () => {
    const status = document.getElementById("status");
    const button = document.getElementById("save");
    button.disabled = true;
    status.textContent = "Saving…";
    try {
        const response = await fetch("/api/email/preferences", {
            method: "PUT",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                social: document.getElementById("social").checked,
                announcements: document.getElementById("announcements").checked
            })
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not save preferences.");
        status.textContent = "✓ Email preferences saved.";
    } catch (error) {
        status.textContent = "Could not save: " + error.message;
    } finally {
        button.disabled = false;
    }
});

loadPreferences();
