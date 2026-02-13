const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');
const { Readability } = require('@mozilla/readability');
const { JSDOM } = require('jsdom');

const app = express();
const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'TechPulse/1.0' },
});

app.use(cors());

// --- RSS Feed Sources ---
const FEEDS = [
    { url: 'https://www.heise.de/rss/heise-atom.xml', category: 'hardware' },
    { url: 'https://www.golem.de/rss.php?feed=RSS2.0', category: 'hardware' },
    { url: 'https://www.chip.de/rss/rss_topnews.xml', category: 'hardware' },
    { url: 'https://t3n.de/rss.xml', category: 'startups' },
    { url: 'https://www.computerbase.de/rss/news.xml', category: 'hardware' },
    { url: 'https://winfuture.de/rss/', category: 'hardware' },
    { url: 'https://www.stadt-bremerhaven.de/feed/', category: 'hardware' },
];

// --- Category keywords for auto-detection ---
const CATEGORY_KEYWORDS = {
    ai: ['ai', 'künstliche intelligenz', 'ki', 'machine learning', 'maschinelles lernen', 'llm', 'gpt', 'neural', 'deep learning', 'chatbot', 'openai', 'anthropic', 'gemini', 'copilot', 'sprachmodell'],
    security: ['security', 'sicherheit', 'hack', 'breach', 'sicherheitslücke', 'schwachstelle', 'malware', 'ransomware', 'cyber', 'phishing', 'verschlüsselung', 'passkey', 'zero-day', 'datenschutz', 'privacy', 'angriff'],
    webdev: ['javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'css', 'html', 'web dev', 'frontend', 'backend', 'api', 'framework', 'rust', 'go ', 'python', 'entwickler', 'developer', 'programmier'],
    hardware: ['chip', 'prozessor', 'processor', 'quantum', 'gpu', 'cpu', 'apple', 'samsung', 'nvidia', 'amd', 'intel', 'hardware', 'gerät', 'device', 'smartphone', 'handy', 'laptop', 'roboter', 'grafikkarte'],
    startups: ['startup', 'gründer', 'finanzierung', 'funding', 'venture', 'übernahme', 'acquisition', 'börsengang', 'ipo', 'bewertung', 'unicorn', 'investition'],
};

// --- Cache ---
let cachedArticles = [];
let lastFetch = 0;
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

function detectCategory(title, content, fallback) {
    const text = ((title || '') + ' ' + (content || '')).toLowerCase();
    let bestMatch = fallback;
    let bestScore = 0;

    for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
        let score = 0;
        for (const kw of keywords) {
            if (text.includes(kw)) score++;
        }
        if (score > bestScore) {
            bestScore = score;
            bestMatch = cat;
        }
    }
    return bestMatch;
}

function extractImageFromContent(content) {
    if (!content) return null;
    const match = content.match(/<img[^>]+src=["']([^"']+)["']/i);
    return match ? match[1] : null;
}

function stripHtml(html) {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').replace(/&[^;]+;/g, ' ').trim();
}

function cleanHtmlContent(html) {
    if (!html) return '';
    // Remove script/style tags and their content
    var cleaned = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
    // Remove tracking pixels and tiny images
    cleaned = cleaned.replace(/<img[^>]*(width|height)\s*=\s*["']?1["']?[^>]*>/gi, '');
    // Keep safe HTML: p, h1-h6, a, img, ul, ol, li, blockquote, em, strong, code, pre, br
    cleaned = cleaned.replace(/<(?!\/?(?:p|h[1-6]|a|img|ul|ol|li|blockquote|em|strong|code|pre|br|figure|figcaption)\b)[^>]+>/gi, '');
    return cleaned.trim();
}

async function fetchAllFeeds() {
    const now = Date.now();
    if (cachedArticles.length > 0 && now - lastFetch < CACHE_DURATION) {
        return cachedArticles;
    }

    const results = await Promise.allSettled(
        FEEDS.map(async (feed) => {
            const parsed = await parser.parseURL(feed.url);
            return parsed.items.map((item) => {
                var fullHtml = item['content:encoded'] || item.content || item.summary || '';
                return {
                    title: item.title || 'Untitled',
                    description: stripHtml(item.contentSnippet || fullHtml).slice(0, 200),
                    content: cleanHtmlContent(fullHtml),
                    link: item.link || '#',
                    image: item.enclosure?.url || extractImageFromContent(fullHtml) || null,
                    date: item.isoDate || item.pubDate || new Date().toISOString(),
                    author: item.creator || item.author || item['dc:creator'] || null,
                    source: parsed.title || 'Unknown',
                    category: detectCategory(item.title, item.contentSnippet || fullHtml, feed.category),
                };
            });
        })
    );

    const articles = [];
    for (const result of results) {
        if (result.status === 'fulfilled') {
            articles.push(...result.value);
        }
    }

    // Sort by date (newest first) and limit
    articles.sort((a, b) => new Date(b.date) - new Date(a.date));

    cachedArticles = articles.slice(0, 50);
    lastFetch = now;

    console.log(`[TechPulse] Fetched ${cachedArticles.length} articles from ${results.filter(r => r.status === 'fulfilled').length}/${FEEDS.length} feeds`);
    return cachedArticles;
}

// --- Article content extraction cache ---
const articleCache = new Map();
const ARTICLE_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

async function extractArticleContent(url) {
    // Check cache
    const cached = articleCache.get(url);
    if (cached && Date.now() - cached.timestamp < ARTICLE_CACHE_DURATION) {
        return cached.data;
    }

    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; TechPulse/1.0; +https://techpulse.local)',
            'Accept': 'text/html,application/xhtml+xml',
        },
        signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article || !article.content) {
        throw new Error('Could not extract article content');
    }

    // Clean the extracted HTML
    const cleanedContent = cleanHtmlContent(article.content);

    const data = {
        title: article.title || null,
        content: cleanedContent,
        excerpt: article.excerpt || null,
        byline: article.byline || null,
        length: article.length || 0,
    };

    // Cache the result
    articleCache.set(url, { data, timestamp: Date.now() });

    // Limit cache size to 100 entries
    if (articleCache.size > 100) {
        const oldest = articleCache.keys().next().value;
        articleCache.delete(oldest);
    }

    return data;
}

// --- API Routes ---
app.get('/api/articles', async (req, res) => {
    try {
        const articles = await fetchAllFeeds();
        res.json({ articles, updated: new Date(lastFetch).toISOString() });
    } catch (err) {
        console.error('[TechPulse] Error:', err.message);
        res.status(500).json({ error: 'Failed to fetch feeds' });
    }
});

app.get('/api/article-content', async (req, res) => {
    const url = req.query.url;
    if (!url) {
        return res.status(400).json({ error: 'Missing url parameter' });
    }

    try {
        const article = await extractArticleContent(url);
        res.json(article);
    } catch (err) {
        console.error('[TechPulse] Article extraction failed for', url, ':', err.message);
        res.status(502).json({ error: 'Could not extract article content' });
    }
});

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cached: cachedArticles.length, articleCache: articleCache.size, lastFetch: new Date(lastFetch).toISOString() });
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[TechPulse] Backend running on port ${PORT}`);
    // Pre-fetch on startup
    fetchAllFeeds().catch(err => console.error('[TechPulse] Initial fetch failed:', err.message));
});
