/* ============================================================
   SHREKBOOK THEME SYSTEM
   ============================================================ */

(function () {

    "use strict";


    /* ========================================================
       THEME STORAGE
       ======================================================== */

    const STORAGE_KEY = "shrekbook-theme";

    const THEMES = [
        "default",
        "dark",
        "legacy"
    ];


    /* ========================================================
       GET SAVED THEME
       ======================================================== */

    function getSavedTheme() {

        const saved = localStorage.getItem(STORAGE_KEY);

        if (THEMES.includes(saved)) {
            return saved;
        }

        return "default";
    }


    /* ========================================================
       APPLY THEME
       ======================================================== */

    function applyTheme(theme) {

        if (!THEMES.includes(theme)) {
            theme = "default";
        }


        if (theme === "default") {

            document.documentElement.removeAttribute("data-theme");

        } else {

            document.documentElement.setAttribute(
                "data-theme",
                theme
            );

        }


        localStorage.setItem(
            STORAGE_KEY,
            theme
        );


        updateThemeButtons(theme);
    }


    /* ========================================================
       UPDATE BUTTON STATES
       ======================================================== */

    function updateThemeButtons(theme) {

        document
            .querySelectorAll(".theme-option")
            .forEach(button => {

                button.classList.toggle(
                    "active",
                    button.dataset.theme === theme
                );

            });

    }


    /* ========================================================
       CREATE THEME SELECTOR
       ======================================================== */

    function createThemeSelector() {

        const nav = document.querySelector(".navbar nav");

        if (!nav) {
            return;
        }


        /*
         * Don't create it twice.
         */

        if (document.getElementById("theme-selector")) {
            return;
        }


        const wrapper = document.createElement("div");

        wrapper.className = "theme-selector";
        wrapper.id = "theme-selector";


        const button = document.createElement("button");

        button.type = "button";
        button.className = "theme-button";
        button.textContent = "🎨 Theme";


        const menu = document.createElement("div");

        menu.className = "theme-menu hidden";


        const options = [
            {
                theme: "default",
                label: "☀️ Default"
            },
            {
                theme: "dark",
                label: "🌑 Dark"
            },
            {
                theme: "legacy",
                label: "🕰️ Legacy"
            }
        ];


        options.forEach(option => {

            const optionButton =
                document.createElement("button");


            optionButton.type = "button";

            optionButton.className = "theme-option";

            optionButton.dataset.theme =
                option.theme;

            optionButton.textContent =
                option.label;


            optionButton.addEventListener(
                "click",
                function () {

                    applyTheme(option.theme);

                    menu.classList.add("hidden");

                }
            );


            menu.appendChild(optionButton);

        });


        button.addEventListener(
            "click",
            function (event) {

                event.stopPropagation();

                menu.classList.toggle("hidden");

            }
        );


        document.addEventListener(
            "click",
            function () {

                menu.classList.add("hidden");

            }
        );


        wrapper.appendChild(button);

        wrapper.appendChild(menu);


        nav.appendChild(wrapper);


        updateThemeButtons(
            getSavedTheme()
        );

    }


    /* ========================================================
       INITIALIZE
       ======================================================== */

    function initializeThemes() {

        const theme = getSavedTheme();

        applyTheme(theme);

        createThemeSelector();

    }


    /*
     * Expose this in case another ShrekBook script
     * wants to change the theme.
     */

    window.ShrekBookThemes = {

        set: applyTheme,

        get: getSavedTheme

    };


    /*
     * Wait until the DOM exists.
     */

    if (document.readyState === "loading") {

        document.addEventListener(
            "DOMContentLoaded",
            initializeThemes
        );

    } else {

        initializeThemes();

    }

})();