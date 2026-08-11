fetch("/api/users", {
    method: "POST",
    headers: {
        "Content-Type": "application/json"
    },
    body: JSON.stringify({
        username: "shrek",
        displayName: "Shrek"
    })
})
.then(response => response.json())
.then(user => {
    console.log("Created user:", user);
});