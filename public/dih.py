from pathlib import Path

# ============================================================

# CONFIGURATION

# ============================================================

PUBLIC = Path("public")

CSS_LINE = '<link rel="stylesheet" href="/themes.css">'
SCRIPT_LINE = '<script src="/themes.js"></script>'

EARLY_THEME_SCRIPT = """    
<script>
(function () {
const theme = localStorage.getItem("shrekbook-theme");


        if (theme === "dark" || theme === "legacy") {
            document.documentElement.setAttribute(
                "data-theme",
                theme
            );
        }
    })();
</script>"""


# ============================================================

# CHECK PUBLIC FOLDER

# ============================================================

if not PUBLIC.exists():
    print("[ERROR] public folder was not found.")
    print("Make sure add_themes.py is in your ShrekBook project root.")
    raise SystemExit(1)


# ============================================================

# PROCESS EVERY HTML FILE

# ============================================================

html_files = list(PUBLIC.glob("*.html"))

print(f"Found {len(html_files)} HTML files.")
print()

for html_file in html_files:
    text = html_file.read_text(
        encoding="utf-8"
    )

    original = text


# ========================================================
# ADD THEMES CSS
# ========================================================

    if 'href="/themes.css"' not in text:

        styles_marker = '<link rel="stylesheet" href="/styles.css">'

        if styles_marker in text:

            text = text.replace(
                styles_marker,
                styles_marker
                + "\n    "
                + CSS_LINE,
                1
            )

        elif "</head>" in text:

            text = text.replace(
                "</head>",
                "    "
                + CSS_LINE
                + "\n\n</head>",
                1
            )


# ========================================================
# ADD EARLY THEME LOADER
# ========================================================

    if "localStorage.getItem(\"shrekbook-theme\")" not in text:

        if "</head>" in text:

            text = text.replace(
                "</head>",
                "\n"
                + EARLY_THEME_SCRIPT
                + "\n\n</head>",
                1
            )


# ========================================================
# ADD THEMES JS
# ========================================================

    if 'src="/themes.js"' not in text:

        script_marker = '<script src="/script.js"></script>'

        if script_marker in text:

            text = text.replace(
                script_marker,
                SCRIPT_LINE
                + "\n"
                + script_marker,
                1
            )

        elif "</body>" in text:

            text = text.replace(
                "</body>",
                "    "
                + SCRIPT_LINE
                + "\n\n</body>",
                1
            )


# ========================================================
# SAVE
# ========================================================

    if text != original:

        html_file.write_text(
            text,
            encoding="utf-8"
        )

        print(f"[UPDATED] {html_file.name}")

    else:

        print(f"[SKIPPED] {html_file.name}")

# ============================================================

# FINISHED

# ============================================================

print()
print("========================================")
print(" ShrekBook theme installation complete!")
print("========================================")
