
// ============================================================
// SHREKSEARCH - JAVASCRIPT POST-GENERATION PROCESSOR
// ============================================================

function cleanText(text) {
    if (!text) return "";

    return text
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}


// ------------------------------------------------------------
// Split text into sentences
// ------------------------------------------------------------

function splitSentences(text) {
    return text
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+/)
        .map(s => s.trim())
        .filter(s => s.length > 30);
}


// ------------------------------------------------------------
// Score sentences based on search query
// ------------------------------------------------------------

function scoreSentence(sentence, query) {
    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2);

    const lowerSentence = sentence.toLowerCase();

    let score = 0;

    for (const word of words) {
        if (lowerSentence.includes(word)) {
            score += 2;
        }
    }

    // Prefer reasonable-length sentences
    if (sentence.length >= 50 && sentence.length <= 250) {
        score += 1;
    }

    // Avoid obvious garbage
    if (
        lowerSentence.includes("cookie") ||
        lowerSentence.includes("javascript required") ||
        lowerSentence.includes("sign in")
    ) {
        score -= 3;
    }

    return score;
}


// ------------------------------------------------------------
// Generate a summary from page text
// ------------------------------------------------------------

function generateSummary(text, query, sentenceCount = 2) {
    text = cleanText(text);

    if (!text) {
        return "No summary available.";
    }

    const sentences = splitSentences(text);

    if (sentences.length === 0) {
        return "No summary available.";
    }

    const scored = sentences
        .map(sentence => ({
            sentence,
            score: scoreSentence(sentence, query)
        }))
        .sort((a, b) => b.score - a.score);

    return scored
        .slice(0, sentenceCount)
        .map(item => item.sentence)
        .join(" ");
}


// ------------------------------------------------------------
// Generate a search-result snippet
// ------------------------------------------------------------

function generateSnippet(text, query, maxLength = 220) {
    text = cleanText(text);

    if (!text) {
        return "";
    }

    const sentences = splitSentences(text);

    if (!sentences.length) {
        return text.slice(0, maxLength) + "...";
    }

    const best = sentences
        .map(sentence => ({
            sentence,
            score: scoreSentence(sentence, query)
        }))
        .sort((a, b) => b.score - a.score)[0];

    let result = best.sentence;

    if (result.length > maxLength) {
        result = result.slice(0, maxLength);

        const lastSpace = result.lastIndexOf(" ");

        if (lastSpace > 0) {
            result = result.slice(0, lastSpace);
        }

        result += "...";
    }

    return result;
}


// ------------------------------------------------------------
// Highlight search terms
// ------------------------------------------------------------

function highlightText(text, query) {
    if (!text || !query) return text;

    const words = query
        .split(/\s+/)
        .filter(word => word.length > 2)
        .map(word =>
            word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
        );

    if (!words.length) return text;

    const regex = new RegExp(
        `(${words.join("|")})`,
        "gi"
    );

    return text.replace(regex, "<mark>$1</mark>");
}


// ------------------------------------------------------------
// Rank a search result
// ------------------------------------------------------------

function rankResult(result, query) {
    const title = (result.title || "").toLowerCase();
    const description = (result.description || "").toLowerCase();
    const url = (result.url || "").toLowerCase();

    const words = query
        .toLowerCase()
        .split(/\s+/)
        .filter(word => word.length > 2);

    let score = 0;

    for (const word of words) {

        if (title.includes(word)) {
            score += 10;
        }

        if (description.includes(word)) {
            score += 4;
        }

        if (url.includes(word)) {
            score += 2;
        }
    }

    return score;
}


// ------------------------------------------------------------
// Process complete search results
// ------------------------------------------------------------

function processResults(results, query) {
    return results
        .map(result => {

            const pageText =
                result.text ||
                result.content ||
                result.description ||
                "";

            return {
                ...result,

                score: rankResult(result, query),

                snippet: generateSnippet(
                    pageText,
                    query
                ),

                summary: generateSummary(
                    pageText,
                    query
                ),

                highlightedTitle:
                    highlightText(
                        result.title || "",
                        query
                    )
            };
        })
        .sort((a, b) => b.score - a.score);
}


// ------------------------------------------------------------
// Exports
// ------------------------------------------------------------

module.exports = {
    cleanText,
    generateSummary,
    generateSnippet,
    highlightText,
    rankResult,
    processResults
};

