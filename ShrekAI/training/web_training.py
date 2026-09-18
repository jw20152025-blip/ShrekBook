import json
import re
import time
from pathlib import Path
from urllib.parse import quote, urljoin, urlparse
from urllib.request import Request, urlopen

from bs4 import BeautifulSoup


# ============================================================
# PATHS
# ============================================================

BASE_DIR = Path(__file__).resolve().parent.parent

TRAINING_DIR = BASE_DIR / "training"
DATASET_DIR = BASE_DIR / "datasets"

APPROVED_SOURCES_FILE = (
    TRAINING_DIR / "approved_sources.json"
)

WEB_DATASET_FILE = (
    DATASET_DIR / "web.jsonl"
)


# ============================================================
# SETTINGS
# ============================================================

USER_AGENT = (
    "ShrekAI-WebTrainer/1.0 "
    "(ShrekBook educational AI training system)"
)

REQUEST_TIMEOUT = 15
REQUEST_DELAY = 0.75

MAX_PAGE_CHARS = 12000
MIN_PAGE_CHARS = 300

MAX_DISCOVERY_RESULTS = 1000


# ============================================================
# TOPICS
# ============================================================

TOPICS = {
    "1": "general",
    "2": "science",
    "3": "history",
    "4": "geography",
    "5": "mathematics",
    "6": "computer_science",
}


TOPIC_SEARCHES = {
    "general": [
        "science",
        "history",
        "geography",
        "mathematics",
        "technology",
        "culture",
    ],

    "science": [
        "science",
        "physics",
        "chemistry",
        "biology",
        "astronomy",
        "earth science",
    ],

    "history": [
        "history",
        "ancient history",
        "medieval history",
        "modern history",
        "world history",
    ],

    "geography": [
        "geography",
        "countries",
        "continents",
        "rivers",
        "mountains",
        "climate",
    ],

    "mathematics": [
        "mathematics",
        "algebra",
        "geometry",
        "calculus",
        "statistics",
        "number theory",
    ],

    "computer_science": [
        "computer science",
        "programming",
        "algorithms",
        "data structures",
        "operating systems",
        "computer networking",
    ],
}


# ============================================================
# SOURCE REGISTRY
# ============================================================

def load_approved_sources():

    if not APPROVED_SOURCES_FILE.exists():

        print(
            "[web-training] Approved source registry "
            "does not exist."
        )

        return []

    try:

        with open(
            APPROVED_SOURCES_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            registry = json.load(file)

    except Exception as error:

        print(
            "[web-training] Failed to load "
            "approved source registry."
        )

        print(
            f"[web-training] {error}"
        )

        return []

    sources = registry.get(
        "sources",
        [],
    )

    approved = []

    for source in sources:

        if not isinstance(
            source,
            dict,
        ):
            continue

        if not source.get(
            "enabled",
            False,
        ):
            continue

        approved.append(source)

    return approved


# ============================================================
# DOMAIN CHECK
# ============================================================

def domain_is_allowed(
    url,
    approved_domain,
):

    try:

        parsed = urlparse(
            url
        )

        hostname = (
            parsed.hostname
            or ""
        ).lower()

        approved_domain = (
            approved_domain
            .lower()
            .strip()
        )

        return (
            hostname == approved_domain
            or hostname.endswith(
                "." + approved_domain
            )
        )

    except Exception:

        return False


# ============================================================
# FETCH PAGE
# ============================================================

def fetch_page(url):

    request = Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": (
                "text/html,"
                "application/xhtml+xml"
            ),
        },
    )

    try:

        with urlopen(
            request,
            timeout=REQUEST_TIMEOUT,
        ) as response:

            content_type = (
                response.headers.get(
                    "Content-Type",
                    "",
                )
            )

            if (
                "text/html"
                not in content_type
            ):
                return None

            raw = response.read()

    except Exception as error:

        print(
            f"[web-training] Failed: "
            f"{url}"
        )

        print(
            f"                 {error}"
        )

        return None

    try:

        html = raw.decode(
            "utf-8",
            errors="ignore",
        )

    except Exception:

        return None

    soup = BeautifulSoup(
        html,
        "html.parser",
    )

    for element in soup(
        [
            "script",
            "style",
            "noscript",
            "nav",
            "footer",
            "header",
            "form",
            "aside",
            "svg",
        ]
    ):

        element.decompose()

    text = soup.get_text(
        "\n",
        strip=True,
    )

    # Normalize whitespace.

    text = re.sub(
        r"[ \t]+",
        " ",
        text,
    )

    text = re.sub(
        r"\n{3,}",
        "\n\n",
        text,
    )

    text = text.strip()

    if len(text) < MIN_PAGE_CHARS:
        return None

    return text[
        :MAX_PAGE_CHARS
    ]


# ============================================================
# WIKIPEDIA DISCOVERY
# ============================================================

def discover_wikipedia_pages(
    topic,
    amount,
):

    discovered = []

    seen = set()

    searches = TOPIC_SEARCHES.get(
        topic,
        TOPIC_SEARCHES["general"],
    )

    print()

    print(
        "[web-training] Discovering "
        "Wikipedia pages..."
    )

    for search_term in searches:

        if len(discovered) >= amount:
            break

        encoded = quote(
            search_term
        )

        search_url = (
            "https://en.wikipedia.org/"
            "w/api.php?"
            "action=query"
            "&list=search"
            "&format=json"
            "&srlimit=50"
            f"&srsearch={encoded}"
        )

        request = Request(
            search_url,
            headers={
                "User-Agent": USER_AGENT,
            },
        )

        try:

            with urlopen(
                request,
                timeout=REQUEST_TIMEOUT,
            ) as response:

                payload = json.loads(
                    response.read().decode(
                        "utf-8"
                    )
                )

        except Exception as error:

            print(
                "[web-training] "
                "Wikipedia search failed:"
            )

            print(
                f"                 {error}"
            )

            continue

        results = (
            payload
            .get("query", {})
            .get("search", [])
        )

        for result in results:

            title = result.get(
                "title"
            )

            if not title:
                continue

            article_url = (
                "https://en.wikipedia.org/wiki/"
                + quote(
                    title.replace(
                        " ",
                        "_",
                    ),
                    safe="_()/:,-",
                )
            )

            if not domain_is_allowed(
                article_url,
                "wikipedia.org",
            ):
                continue

            if article_url in seen:
                continue

            seen.add(
                article_url
            )

            discovered.append(
                article_url
            )

            if len(discovered) >= amount:
                break

        time.sleep(
            REQUEST_DELAY
        )

    return discovered


# ============================================================
# GENERIC APPROVED-SOURCE DISCOVERY
# ============================================================

def discover_from_training_urls(
    source,
    amount,
):

    urls = source.get(
        "training_urls",
        [],
    )

    results = []

    for url in urls:

        if len(results) >= amount:
            break

        if not domain_is_allowed(
            url,
            source.get(
                "domain",
                "",
            ),
        ):
            continue

        results.append(
            url
        )

    return results


# ============================================================
# DISCOVER PAGES
# ============================================================

def discover_pages(
    source,
    topic,
    amount,
):

    domain = (
        source.get(
            "domain",
            "",
        )
        .lower()
        .strip()
    )

    name = source.get(
        "name",
        domain,
    )

    # --------------------------------------------------------
    # WIKIPEDIA
    # --------------------------------------------------------

    if domain == "wikipedia.org":

        print(
            f"[web-training] Source: "
            f"{name}"
        )

        return (
            discover_wikipedia_pages(
                topic,
                amount,
            )
        )

    # --------------------------------------------------------
    # GENERIC APPROVED SOURCE
    # --------------------------------------------------------

    print(
        f"[web-training] Source: "
        f"{name}"
    )

    return (
        discover_from_training_urls(
            source,
            amount,
        )
    )


# ============================================================
# CREATE TRAINING RECORD
# ============================================================

def create_record(
    text,
    source,
    url,
    topic,
):

    source_name = source.get(
        "name",
        source.get(
            "domain",
            "Unknown",
        ),
    )

    return {
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are ShrekAI. "
                    "Use the following approved "
                    "educational source material "
                    "to answer questions accurately. "
                    "Do not invent facts."
                ),
            },
            {
                "role": "user",
                "content": (
                    "Learn the following "
                    "educational material:\n\n"
                    + text
                ),
            },
            {
                "role": "assistant",
                "content": (
                    "Understood. I will use "
                    "this information as "
                    "training knowledge."
                ),
            },
        ],
        "source": source_name,
        "source_domain": source.get(
            "domain",
            "",
        ),
        "url": url,
        "topic": topic,
        "training_source": (
            "shrekbook_approved"
        ),
    }


# ============================================================
# EXISTING URLS
# ============================================================

def load_existing_urls():

    urls = set()

    if not WEB_DATASET_FILE.exists():

        return urls

    try:

        with open(
            WEB_DATASET_FILE,
            "r",
            encoding="utf-8",
        ) as file:

            for line in file:

                line = line.strip()

                if not line:
                    continue

                try:

                    record = json.loads(
                        line
                    )

                except json.JSONDecodeError:

                    continue

                url = record.get(
                    "url"
                )

                if url:
                    urls.add(
                        url
                    )

    except Exception as error:

        print(
            "[web-training] Could not "
            "read existing dataset."
        )

        print(
            f"[web-training] {error}"
        )

    return urls


# ============================================================
# SAVE RECORD
# ============================================================

def save_record(
    record
):

    DATASET_DIR.mkdir(
        parents=True,
        exist_ok=True,
    )

    with open(
        WEB_DATASET_FILE,
        "a",
        encoding="utf-8",
    ) as file:

        file.write(
            json.dumps(
                record,
                ensure_ascii=False,
            )
            + "\n"
        )


# ============================================================
# TOPIC MENU
# ============================================================

def choose_topic():

    print()
    print(
        "================================"
    )
    print(
        "        WEB TRAINING TOPIC"
    )
    print(
        "================================"
    )

    print(
        "1. General Knowledge"
    )
    print(
        "2. Science"
    )
    print(
        "3. History"
    )
    print(
        "4. Geography"
    )
    print(
        "5. Mathematics"
    )
    print(
        "6. Computer Science"
    )
    print(
        "7. Everything"
    )

    print(
        "================================"
    )

    choice = input(
        "Select: "
    ).strip()

    if choice == "7":

        return "general"

    return TOPICS.get(
        choice,
        "general",
    )


# ============================================================
# MAIN WEB TRAINING
# ============================================================

def run_web_training():

    print()
    print("=" * 64)
    print(
        "                 SHREKAI WEB TRAINING"
    )
    print("=" * 64)
    print()

    sources = (
        load_approved_sources()
    )

    if not sources:

        print(
            "No approved training "
            "sources are enabled."
        )

        print()

        return

    print(
        "Approved sources:"
    )

    for source in sources:

        print(
            f"  ✓ "
            f"{source.get('name', 'Unknown')} "
            f"({source.get('domain', '')})"
        )

    topic = choose_topic()

    print()

    amount_text = input(
        "How many pages? "
    ).strip()

    try:

        amount = int(
            amount_text
        )

    except ValueError:

        print(
            "[web-training] Invalid "
            "page count."
        )

        return

    amount = max(
        1,
        min(
            amount,
            MAX_DISCOVERY_RESULTS,
        ),
    )

    existing_urls = (
        load_existing_urls()
    )

    total_added = 0
    total_skipped = 0

    print()

    print(
        f"[web-training] Topic: "
        f"{topic}"
    )

    print(
        f"[web-training] Target pages: "
        f"{amount}"
    )

    print()

    # --------------------------------------------------------
    # COLLECT FROM APPROVED SOURCES
    # --------------------------------------------------------

    for source in sources:

        if total_added >= amount:
            break

        remaining = (
            amount
            - total_added
        )

        urls = discover_pages(
            source,
            topic,
            remaining,
        )

        if not urls:

            print(
                "[web-training] "
                "No pages discovered "
                "from this source."
            )

            continue

        print(
            f"[web-training] Found "
            f"{len(urls)} approved pages."
        )

        for index, url in enumerate(
            urls,
            start=1,
        ):

            if total_added >= amount:
                break

            if url in existing_urls:

                total_skipped += 1

                continue

            print(
                f"[web-training] "
                f"{index}/{len(urls)} "
                f"Downloading..."
            )

            text = fetch_page(
                url
            )

            if not text:

                total_skipped += 1

                time.sleep(
                    REQUEST_DELAY
                )

                continue

            record = create_record(
                text,
                source,
                url,
                topic,
            )

            save_record(
                record
            )

            existing_urls.add(
                url
            )

            total_added += 1

            print(
                f"[web-training] Added "
                f"{total_added}/{amount}"
            )

            time.sleep(
                REQUEST_DELAY
            )

    # --------------------------------------------------------
    # SUMMARY
    # --------------------------------------------------------

    print()
    print("=" * 64)
    print(
        "              WEB TRAINING COMPLETE"
    )
    print("=" * 64)

    print(
        f"Pages added:       "
        f"{total_added}"
    )

    print(
        f"Pages skipped:     "
        f"{total_skipped}"
    )

    print(
        f"Dataset:           "
        f"{WEB_DATASET_FILE}"
    )

    print("=" * 64)
    print()

    if total_added == 0:

        print(
            "[web-training] No new training "
            "examples were added."
        )

    else:

        print(
            "[web-training] Web data is now "
            "available to the normal trainer."
        )

    print()


if __name__ == "__main__":

    run_web_training()