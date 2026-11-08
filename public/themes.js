/* ============================================================
   SHREKBOOK THEME SYSTEM v3.1
   16 themes, persistent palettes, random palettes and local Theme AI.
   ============================================================ */
(function () {
    "use strict";

    const STORAGE_KEY = "shrekbook-theme";
    const RANDOM_COLORS_KEY = "shrekbook-random-colors";
    const THEMES = [
        "default", "dark", "legacy", "ivory", "midnight",
        "terminal", "ocean", "sunset", "monochrome",
        "shrekbook-special", "1990s", "1980s", "1970s",
        "1960s", "random-colors", "random-selection"
    ];
    const FIXED_THEMES = THEMES.filter(t =>
        t !== "random-colors" && t !== "random-selection"
    );

    const PALETTES = {
        ivory: { bg:"#f7f1df", surface:"#fffdf5", text:"#403727", muted:"#82745e", border:"#e3d5b9", accent:"#a66d28", accentText:"#ffffff" },
        midnight: { bg:"#101525", surface:"#1b2540", text:"#e9efff", muted:"#9eaccb", border:"#344365", accent:"#6e9cff", accentText:"#071326" },
        terminal: { bg:"#050b07", surface:"#0d1910", text:"#9cffad", muted:"#58a96c", border:"#245b34", accent:"#31ed72", accentText:"#031008" },
        ocean: { bg:"#061e2a", surface:"#0c3443", text:"#e0fbff", muted:"#8dbdca", border:"#246174", accent:"#22c5c7", accentText:"#032629" },
        sunset: { bg:"#2b1722", surface:"#482536", text:"#fff0e6", muted:"#d7a5a1", border:"#70404c", accent:"#ff815b", accentText:"#32130e" },
        monochrome: { bg:"#101010", surface:"#242424", text:"#f4f4f4", muted:"#aaaaaa", border:"#4b4b4b", accent:"#ffffff", accentText:"#111111" },
        "shrekbook-special": { bg:"#14200c", surface:"#263719", text:"#f0f7d9", muted:"#b3c88c", border:"#526d35", accent:"#b1d84c", accentText:"#17200b" }
    };

    const LABELS = {
        default:"☀️ Default", dark:"🌑 Dark", legacy:"🕰️ Legacy",
        ivory:"🤍 Ivory", midnight:"🌌 Midnight", terminal:"💻 Terminal",
        ocean:"🌊 Ocean", sunset:"🌅 Sunset", monochrome:"⚫ Monochrome",
        "shrekbook-special":"🧅 ShrekBook Special",
        "1990s":"💾 1990s — Pre-Web Test",
        "1980s":"📼 1980s — VHS Prototype",
        "1970s":"📻 1970s — Experimental Mainframe",
        "1960s":"⌨️ 1960s — Binary Research Prototype",
        "random-colors":"🌈 Random Colors",
        "random-selection":"🎲 Random Selection"
    };

    const THEME_AI_DATA = {
        default: { description:"Bright, clean and familiar white-and-green ShrekBook styling.", keywords:["clean","simple","bright","light","normal","minimal","familiar"], swatches:["#ffffff","#f5f5f5","#398b52"] },
        dark: { description:"Comfortable charcoal and dark-grey styling for low-light browsing.", keywords:["dark","night","charcoal","grey","gray","dim","low light"], swatches:["#17191c","#22252a","#343941"] },
        legacy: { description:"Classic early World Wide Web styling inspired by 1990–1995 websites.", keywords:["legacy","classic web","early internet","old website","nostalgic","windows 95"], swatches:["#c0c0c0","#000080","#e0e0e0"] },
        ivory: { description:"Warm cream, beige and paper-like surfaces with a gentle appearance.", keywords:["cream","ivory","warm","cozy","cosy","paper","beige","elegant","soft"], swatches:["#f7f1df","#fffdf5","#a66d28"] },
        midnight: { description:"Deep navy and blue colours with a cool nighttime atmosphere.", keywords:["midnight","navy","blue","space","night sky","mysterious","cosmic"], swatches:["#101525","#1b2540","#6e9cff"] },
        terminal: { description:"Green-on-black terminal styling with phosphor lettering and a technical feel.", keywords:["terminal","computer","coding","programming","hacker","matrix","console","developer"], swatches:["#050b07","#0d1910","#31ed72"] },
        ocean: { description:"Deep water-inspired blues and turquoise with a calm aquatic atmosphere.", keywords:["ocean","sea","water","blue","teal","turquoise","marine","underwater","aquatic"], swatches:["#061e2a","#0c3443","#22c5c7"] },
        sunset: { description:"Warm orange, coral and sunset-inspired colours.", keywords:["sunset","orange","coral","peach","pink","evening","golden","warm"], swatches:["#2b1722","#482536","#ff815b"] },
        monochrome: { description:"Minimal black-and-white styling without colourful distractions.", keywords:["monochrome","black and white","black","white","grayscale","greyscale","minimalist","neutral"], swatches:["#101010","#242424","#ffffff"] },
        "shrekbook-special": { description:"Distinctive ShrekBook greens and onion-inspired personality.", keywords:["shrek","shrekbook","onion","meme","absurd","quirky","playful","chaotic","weird"], swatches:["#14200c","#263719","#b1d84c"] },
        "1990s": { description:"An unfinished early-web experiment with grey surfaces, primitive controls and simple typography.", keywords:["1990s","90s","early web","pre web","unfinished","prototype","old internet","primitive website","retro web"], swatches:["#c8c8c8","#dedede","#000080"] },
        "1980s": { description:"A monochrome VHS prototype with scanlines, pixelation and slight visual instability.", keywords:["1980s","80s","vhs","cassette","tape","television","crt","scanlines","pixelated","glitchy","analog"], swatches:["#080808","#151515","#aaaaaa"] },
        "1970s": { description:"A barely feasible experimental mainframe with olive tones, amber phosphor and heavy jitter.", keywords:["1970s","70s","mainframe","amber","olive","analog","research computer","primitive computer","unstable","heavy jitter"], swatches:["#17180f","#29291c","#c0a04e"] },
        "1960s": { description:"An almost incomprehensible binary research prototype with green phosphor and extreme jitter.", keywords:["1960s","60s","binary","zeros and ones","0101","ancient computer","research machine","unreadable","extremely old"], swatches:["#020704","#06130a","#a5e6a5"] },
        "random-colors": { description:"A randomly generated colour palette with changing backgrounds, surfaces and accents.", keywords:["random colours","random colors","random palette","colourful","colorful","surprise colours","surprise colors","custom palette"], swatches:["#493c83","#173d45","#d3a447"] },
        "random-selection": { description:"A surprise selection from the fixed ShrekBook theme collection.", keywords:["surprise me","random theme","choose for me","pick for me","unpredictable","anything"], swatches:["#398b52","#596ca8","#c85c50"] }
    };

    let selector = null;
    let shuffleButton = null;

    function readStorage(key) {
        try { return localStorage.getItem(key); } catch { return null; }
    }

    function writeStorage(key, value) {
        try { localStorage.setItem(key, value); } catch { /* Current-page theme still works. */ }
    }

    function getSavedTheme() {
        const saved = readStorage(STORAGE_KEY);
        return THEMES.includes(saved) ? saved : "default";
    }

    function generateRandomPalette() {
        const hue = Math.floor(Math.random() * 360);
        const accentHue = (hue + 70 + Math.floor(Math.random() * 180)) % 360;
        const saturation = 28 + Math.floor(Math.random() * 38);
        const accentSaturation = 65 + Math.floor(Math.random() * 25);

        return {
            bg:"hsl(" + hue + ", " + saturation + "%, 9%)",
            surface:"hsl(" + hue + ", " + saturation + "%, 15%)",
            text:"hsl(" + hue + ", 18%, 96%)",
            muted:"hsl(" + hue + ", 15%, 68%)",
            border:"hsl(" + hue + ", " + saturation + "%, 28%)",
            accent:"hsl(" + accentHue + ", " + accentSaturation + "%, 65%)",
            accentText:"#101010"
        };
    }

    function saveRandomPalette(palette) {
        writeStorage(RANDOM_COLORS_KEY, JSON.stringify(palette));
    }

    function getRandomPalette() {
        try {
            const saved = JSON.parse(readStorage(RANDOM_COLORS_KEY));
            if (saved && ["bg","surface","text","muted","border","accent","accentText"]
                .every(key => typeof saved[key] === "string")) return saved;
        } catch { /* Generate a replacement palette. */ }

        const palette = generateRandomPalette();
        saveRandomPalette(palette);
        return palette;
    }

    function applyPalette(palette) {
        const root = document.documentElement;
        root.style.setProperty("--sb-bg", palette.bg);
        root.style.setProperty("--sb-surface", palette.surface);
        root.style.setProperty("--sb-text", palette.text);
        root.style.setProperty("--sb-muted", palette.muted);
        root.style.setProperty("--sb-border", palette.border);
        root.style.setProperty("--sb-accent", palette.accent);
        root.style.setProperty("--sb-accent-text", palette.accentText);
    }

    function clearPalette() {
        [
            "--sb-bg","--sb-surface","--sb-text","--sb-muted",
            "--sb-border","--sb-accent","--sb-accent-text","--sb-random-text"
        ].forEach(name => document.documentElement.style.removeProperty(name));
    }

    function updateSelector(theme) {
        if (selector) selector.value = theme;
        if (shuffleButton) shuffleButton.hidden = theme !== "random-colors";
    }

    function dispatchThemeChange(theme) {
        window.dispatchEvent(new CustomEvent("shrekbook:themechange", {
            detail: { theme: theme }
        }));
    }

    /* 1960s binary text conversion. */
    const binaryOriginals = new WeakMap();
    const binaryEncoder = new TextEncoder();
    let binaryModeActive = false;
    let binaryObserver = null;

    function toBinaryText(value) {
        return Array.from(binaryEncoder.encode(value),
            byte => byte.toString(2).padStart(8, "0")
        ).join(" ");
    }

    function shouldConvertTextNode(node) {
        if (!node || node.nodeType !== Node.TEXT_NODE ||
            !node.nodeValue || !node.nodeValue.trim()) return false;

        const parent = node.parentElement;
        if (!parent) return false;

        return !parent.closest("script, style, noscript, textarea, [contenteditable='true']");
    }

    function convertBinaryNode(node) {
        if (!shouldConvertTextNode(node) || binaryOriginals.has(node)) return;
        const original = node.nodeValue;
        binaryOriginals.set(node, original);
        node.nodeValue = toBinaryText(original);
    }

    function convertBinaryTree(root) {
        if (!root) return;
        if (root.nodeType === Node.TEXT_NODE) {
            convertBinaryNode(root);
            return;
        }

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;
        while ((node = walker.nextNode())) convertBinaryNode(node);
    }

    function restoreBinaryTree(root) {
        if (!root) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        let node;

        while ((node = walker.nextNode())) {
            if (!binaryOriginals.has(node)) continue;
            node.nodeValue = binaryOriginals.get(node);
            binaryOriginals.delete(node);
        }
    }

    function startBinaryMode() {
        if (!document.body || binaryModeActive) return;
        binaryModeActive = true;
        convertBinaryTree(document.body);

        binaryObserver = new MutationObserver(records => {
            records.forEach(record => {
                if (record.type === "childList") {
                    record.addedNodes.forEach(convertBinaryTree);
                } else if (record.type === "characterData") {
                    const node = record.target;
                    if (!shouldConvertTextNode(node)) return;

                    if (binaryOriginals.has(node)) {
                        const previous = binaryOriginals.get(node);
                        if (node.nodeValue !== toBinaryText(previous)) {
                            const updated = node.nodeValue;
                            binaryOriginals.set(node, updated);
                            node.nodeValue = toBinaryText(updated);
                        }
                    } else {
                        convertBinaryNode(node);
                    }
                }
            });
        });

        binaryObserver.observe(document.body, {
            childList:true, subtree:true, characterData:true
        });
    }

    function stopBinaryMode() {
        if (!binaryModeActive) return;
        binaryModeActive = false;
        if (binaryObserver) {
            binaryObserver.disconnect();
            binaryObserver = null;
        }
        restoreBinaryTree(document.body);
    }

    function applyTheme(theme) {
        if (theme === "random-selection") return selectRandomTheme();
        if (!THEMES.includes(theme)) theme = "default";

        const root = document.documentElement;
        clearPalette();

        if (theme === "default") root.removeAttribute("data-theme");
        else root.setAttribute("data-theme", theme);

        if (PALETTES[theme]) applyPalette(PALETTES[theme]);
        if (theme === "random-colors") applyPalette(getRandomPalette());

        if (theme === "1960s") startBinaryMode();
        else stopBinaryMode();

        writeStorage(STORAGE_KEY, theme);
        updateSelector(theme);
        dispatchThemeChange(theme);
        return theme;
    }

    function selectRandomTheme() {
        const choices = FIXED_THEMES.filter(theme => theme !== getSavedTheme());
        const selected = choices[Math.floor(Math.random() * choices.length)];
        return applyTheme(selected || "default");
    }

    function shuffleColors() {
        const palette = generateRandomPalette();
        saveRandomPalette(palette);

        if (getSavedTheme() !== "random-colors") {
            applyTheme("random-colors");
        } else {
            applyPalette(palette);
            dispatchThemeChange("random-colors");
        }

        updateSelector("random-colors");
        return palette;
    }

    /* Local SmolLM2-135M language model. No API key or server call. */
    const THEME_AI_MODEL = "onnx-community/SmolLM2-135M-Instruct-ONNX-MHA";
    const TRANSFORMERS_CDN = "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1";
    let themeAIPipelinePromise = null;
    const themeAIHistory = [];

    function getThemeAICatalogue() {
        return THEMES.map(theme => ({
            id:theme,
            label:LABELS[theme],
            description:THEME_AI_DATA[theme].description,
            keywords:THEME_AI_DATA[theme].keywords
        }));
    }

    async function loadThemeAI(onProgress) {
        if (!themeAIPipelinePromise) {
            themeAIPipelinePromise = (async () => {
                if (onProgress) onProgress("Loading the AI runtime...");
                const transformers = await import(TRANSFORMERS_CDN);
                transformers.env.useBrowserCache = true;
                if (onProgress) onProgress("Loading SmolLM2-135M. First download is about 137 MB.");

                return await transformers.pipeline(
                    "text-generation",
                    THEME_AI_MODEL,
                    {
                        dtype:"q8",
                        progress_callback: info => {
                            if (!onProgress || !info) return;
                            if (info.status === "progress") {
                                const amount = Number(info.progress);
                                onProgress(Number.isFinite(amount)
                                    ? "Downloading AI model: " + Math.round(amount) + "%"
                                    : "Downloading AI model files...");
                            } else if (info.status === "done") {
                                onProgress("AI model file loaded.");
                            }
                        }
                    }
                );
            })().catch(error => {
                themeAIPipelinePromise = null;
                throw error;
            });
        }
        return themeAIPipelinePromise;
    }

    function normalizeMatchText(value) {
        return String(value || "").toLowerCase()
            .replace(/[^a-z0-9\s-]/g, " ")
            .replace(/\s+/g, " ")
            .trim();
    }

    function localThemeRanking(prompt) {
        const query = normalizeMatchText(prompt);

        const ranked = THEMES.map((theme, index) => {
            const profile = THEME_AI_DATA[theme];
            let score = 0;

            profile.keywords.forEach(keyword => {
                const term = normalizeMatchText(keyword);
                if (term && query.includes(term)) score += term.includes(" ") ? 5 : 2;
            });

            const normalizedId = normalizeMatchText(theme.replace(/-/g, " "));
            if (normalizedId && query.includes(normalizedId)) score += 12;

            return { theme:theme, score:score, index:index };
        }).sort((a, b) => b.score - a.score || a.index - b.index);

        const matches = ranked.filter(item => item.score > 0)
            .slice(0, 3).map(item => item.theme);

        return matches.length ? matches : ["default", "dark", "ivory"];
    }

    function extractThemeIds(text) {
        const source = String(text || "").toLowerCase();
        const found = [];

        THEMES.forEach(theme => {
            const expression = new RegExp(
                "(^|[^a-z0-9-])" + theme + "($|[^a-z0-9-])",
                "i"
            );
            const match = expression.exec(source);
            if (match) found.push({ theme:theme, index:match.index });
        });

        return found.sort((a, b) => a.index - b.index)
            .map(item => item.theme)
            .filter((theme, index, all) => all.indexOf(theme) === index);
    }

    async function requestThemeAI(prompt, onProgress) {
        const cleanPrompt = String(prompt || "").trim();
        if (!cleanPrompt || cleanPrompt.length > 300) {
            throw new Error("Enter a description of up to 300 characters.");
        }

        const catalogueText = getThemeAICatalogue().map(item =>
            item.id + ": " + item.description +
            " Keywords: " + item.keywords.join(", ")
        ).join("\n");

        const historyText = themeAIHistory.slice(-3).map(item =>
            "Previous request: " + item.prompt +
            "\nPrevious recommendations: " + item.themes.join(", ")
        ).join("\n\n");

        const modelPrompt =
            "You recommend visual themes for ShrekBook.\n" +
            "Understand the meaning of the request, including unfamiliar references and aesthetics.\n" +
            "Choose only IDs from this catalogue.\n" +
            "Return three theme IDs separated by commas, best match first. No explanation.\n\n" +
            "CATALOGUE:\n" + catalogueText + "\n\n" +
            (historyText ? "RECENT CONVERSATION:\n" + historyText + "\n\n" : "") +
            "CURRENT REQUEST:\n" + cleanPrompt + "\n\n" +
            "THREE THEME IDS:";

        let modelIds = [];
        let modelError = null;

        try {
            const generator = await loadThemeAI(onProgress);
            if (onProgress) onProgress("SmolLM2 is considering your preferences...");

            const generated = await generator(modelPrompt, {
                max_new_tokens:48,
                do_sample:false
            });

            const fullText = generated && generated[0] &&
                typeof generated[0].generated_text === "string"
                    ? generated[0].generated_text
                    : "";

            const completion = fullText.startsWith(modelPrompt)
                ? fullText.slice(modelPrompt.length)
                : fullText;

            modelIds = extractThemeIds(completion);
        } catch (error) {
            modelError = error;
            console.warn("[ShrekBook Theme AI] Model unavailable:", error);
        }

        const fallbackIds = localThemeRanking(cleanPrompt);
        const recommendations = [];
        const seen = new Set();

        modelIds.concat(fallbackIds).forEach(theme => {
            if (recommendations.length >= 3 || !THEMES.includes(theme) || seen.has(theme)) return;
            seen.add(theme);
            recommendations.push({
                theme:theme,
                source:modelIds.includes(theme) ? "model" : "local",
                reason:THEME_AI_DATA[theme].description
            });
        });

        themeAIHistory.push({
            prompt:cleanPrompt,
            themes:recommendations.map(item => item.theme)
        });
        while (themeAIHistory.length > 4) themeAIHistory.shift();

        const modelUsed = modelIds.length > 0 && !modelError;
        const summary = modelUsed
            ? "SmolLM2 generated these suggestions using your description and the 16-theme catalogue."
            : modelError
                ? "The model could not load, so local theme matching supplied these suggestions."
                : "The model did not return valid theme IDs, so local matching completed the recommendations.";

        if (onProgress) onProgress("Recommendations ready.");

        return {
            summary:summary,
            modelUsed:modelUsed,
            recommendations:recommendations
        };
    }

    function getThemeAIColors(theme) {
        if (theme === "random-colors") {
            const palette = getRandomPalette();
            return [palette.bg, palette.surface, palette.accent];
        }
        if (PALETTES[theme]) {
            const palette = PALETTES[theme];
            return [palette.bg, palette.surface, palette.accent];
        }
        return THEME_AI_DATA[theme] ? THEME_AI_DATA[theme].swatches : [];
    }

    function createThemeAI(wrapper) {
        const root = document.createElement("div");
        root.className = "theme-ai";

        const toggle = document.createElement("button");
        toggle.type = "button";
        toggle.className = "theme-ai-toggle";
        toggle.textContent = "✨ Theme AI";
        toggle.setAttribute("aria-expanded", "false");

        const panel = document.createElement("section");
        panel.className = "theme-ai-panel";
        panel.hidden = true;
        panel.setAttribute("aria-label", "ShrekBook Theme AI");

        const header = document.createElement("div");
        header.className = "theme-ai-header";

        const title = document.createElement("strong");
        title.textContent = "🧅 ShrekBook Theme AI";

        const close = document.createElement("button");
        close.type = "button";
        close.className = "theme-ai-close";
        close.textContent = "×";
        close.setAttribute("aria-label", "Close Theme AI");
        header.append(title, close);

        const subtitle = document.createElement("p");
        subtitle.className = "theme-ai-subtitle";
        subtitle.textContent = "Describe a mood, reference, interest or visual style. I'll recommend matching themes.";

        const modelInfo = document.createElement("small");
        modelInfo.className = "theme-ai-model-info";
        modelInfo.textContent = "SmolLM2 · 135M parameters · Runs in your browser · First use downloads about 137 MB";

        const form = document.createElement("form");
        form.className = "theme-ai-form";

        const input = document.createElement("input");
        input.type = "text";
        input.maxLength = 300;
        input.placeholder = "e.g. Strange retro internet aesthetics...";
        input.setAttribute("aria-label", "Describe your preferred aesthetic");

        const submit = document.createElement("button");
        submit.type = "submit";
        submit.className = "theme-ai-submit";
        submit.textContent = "Find themes";
        form.append(input, submit);

        const status = document.createElement("p");
        status.className = "theme-ai-status";
        status.setAttribute("aria-live", "polite");

        const results = document.createElement("div");
        results.className = "theme-ai-results";

        panel.append(header, subtitle, modelInfo, form, status, results);

        toggle.addEventListener("click", () => {
            panel.hidden = !panel.hidden;
            toggle.setAttribute("aria-expanded", String(!panel.hidden));
            if (!panel.hidden) input.focus();
        });

        close.addEventListener("click", () => {
            panel.hidden = true;
            toggle.setAttribute("aria-expanded", "false");
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();
            if (!input.value.trim()) {
                status.textContent = "Describe what you like first.";
                return;
            }

            submit.disabled = true;
            submit.textContent = "Thinking...";
            results.replaceChildren();

            try {
                const data = await requestThemeAI(input.value, message => {
                    status.textContent = message;
                });

                status.textContent = data.summary;

                data.recommendations.forEach((recommendation, index) => {
                    const theme = recommendation.theme;
                    const card = document.createElement("article");
                    card.className = "theme-ai-card";

                    const name = document.createElement("strong");
                    name.className = "theme-ai-name";
                    name.textContent = (index + 1) + ". " + LABELS[theme];

                    const description = document.createElement("p");
                    description.className = "theme-ai-description";
                    description.textContent = THEME_AI_DATA[theme].description;

                    const source = document.createElement("small");
                    source.className = "theme-ai-source";
                    source.textContent = recommendation.source === "model"
                        ? "SmolLM2 recommendation"
                        : "Local matching fallback";

                    card.append(name, description, source);

                    const swatches = document.createElement("div");
                    swatches.className = "theme-ai-swatches";

                    getThemeAIColors(theme).forEach(color => {
                        const swatch = document.createElement("span");
                        swatch.className = "theme-ai-swatch";
                        swatch.style.backgroundColor = color;
                        swatch.setAttribute("aria-label", color);
                        swatches.appendChild(swatch);
                    });

                    if (swatches.childElementCount) card.appendChild(swatches);

                    const apply = document.createElement("button");
                    apply.type = "button";
                    apply.className = "theme-ai-apply";
                    apply.textContent = theme === "random-selection" ? "Surprise me" : "Apply theme";

                    apply.addEventListener("click", () => {
                        applyTheme(theme);
                        status.textContent = LABELS[getSavedTheme()] + " applied.";
                    });

                    card.appendChild(apply);
                    results.appendChild(card);
                });

                if (!data.recommendations.length) {
                    status.textContent = "No usable recommendations. Try another description.";
                }
            } catch (error) {
                status.textContent = error.message || "Theme AI could not complete the request.";
            } finally {
                submit.disabled = false;
                submit.textContent = "Find themes";
            }
        });

        root.append(toggle, panel);
        wrapper.appendChild(root);
    }

    function createThemeSelector() {
        if (document.getElementById("theme-selector")) return;

        const nav = document.querySelector(".navbar nav");
        if (!nav) return;

        const controls = document.createElement("div");
        controls.className = "theme-control-group";

        const select = document.createElement("select");
        select.id = "theme-selector";
        select.className = "theme-select";
        select.setAttribute("aria-label", "Choose ShrekBook theme");

        const groups = [
            { label:"Original themes", themes:["default","dark","legacy"] },
            { label:"New themes", themes:["ivory","midnight","terminal","ocean","sunset","monochrome","shrekbook-special"] },
            { label:"Experimental eras", themes:["1990s","1980s","1970s","1960s"] },
            { label:"Random themes", themes:["random-colors","random-selection"] }
        ];

        groups.forEach(group => {
            const optgroup = document.createElement("optgroup");
            optgroup.label = group.label;

            group.themes.forEach(theme => {
                const option = document.createElement("option");
                option.value = theme;
                option.textContent = LABELS[theme];
                optgroup.appendChild(option);
            });

            select.appendChild(optgroup);
        });

        select.addEventListener("change", () => applyTheme(select.value));

        const shuffle = document.createElement("button");
        shuffle.type = "button";
        shuffle.className = "theme-shuffle";
        shuffle.textContent = "↻";
        shuffle.title = "Generate another random colour palette";
        shuffle.setAttribute("aria-label", "Shuffle random colours");
        shuffle.hidden = true;
        shuffle.addEventListener("click", shuffleColors);

        controls.append(select, shuffle);
        createThemeAI(controls);
        nav.appendChild(controls);

        selector = select;
        shuffleButton = shuffle;
        updateSelector(getSavedTheme());
    }

    function initializeThemes() {
        applyTheme(getSavedTheme());
        createThemeSelector();
    }

    window.ShrekBookThemes = {
        set:applyTheme,
        get:getSavedTheme,
        list:() => THEMES.slice(),
        shuffle:shuffleColors,
        random:selectRandomTheme,
        getPalette:() => {
            const theme = getSavedTheme();
            if (theme === "random-colors") return Object.assign({}, getRandomPalette());
            return PALETTES[theme] ? Object.assign({}, PALETTES[theme]) : null;
        },
        ai:{
            recommend:requestThemeAI,
            data:getThemeAICatalogue,
            modelInfo:{
                name:"SmolLM2-135M-Instruct",
                parameters:135000000,
                localInference:true,
                paidAPI:false,
                firstDownloadApproxMB:137
            }
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeThemes, { once:true });
    } else {
        initializeThemes();
    }
})();
