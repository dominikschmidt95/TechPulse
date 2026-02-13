const express = require('express');
const Parser = require('rss-parser');
const cors = require('cors');

const app = express();
const parser = new Parser({
    timeout: 10000,
    headers: { 'User-Agent': 'TechPulse/1.0' },
});

app.use(cors());

// --- RSS Feed Sources ---
const FEEDS = [
    { url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', category: 'hardware' },
    { url: 'https://www.theverge.com/rss/index.xml', category: 'hardware' },
    { url: 'https://techcrunch.com/feed/', category: 'startups' },
    { url: 'https://feeds.feedburner.com/TheHackersNews', category: 'security' },
    { url: 'https://www.wired.com/feed/tag/ai/latest/rss', category: 'ai' },
    { url: 'https://dev.to/feed', category: 'webdev' },
    { url: 'https://hnrss.org/frontpage', category: 'webdev' },
];

// --- Category keywords for auto-detection ---
const CATEGORY_KEYWORDS = {
    ai: ['ai', 'artificial intelligence', 'machine learning', 'llm', 'gpt', 'neural', 'deep learning', 'chatbot', 'openai', 'anthropic', 'gemini', 'copilot'],
    security: ['security', 'hack', 'breach', 'vulnerability', 'malware', 'ransomware', 'cyber', 'phishing', 'encryption', 'passkey', 'zero-day', 'privacy'],
    webdev: ['javascript', 'typescript', 'react', 'vue', 'angular', 'node', 'css', 'html', 'web dev', 'frontend', 'backend', 'api', 'framework', 'rust', 'go ', 'python', 'developer'],
    hardware: ['chip', 'processor', 'quantum', 'gpu', 'cpu', 'apple', 'samsung', 'nvidia', 'amd', 'intel', 'hardware', 'device', 'phone', 'laptop', 'robot'],
    startups: ['startup', 'funding', 'venture', 'vc', 'acquisition', 'ipo', 'valuation', 'series a', 'seed round', 'unicorn'],
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

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', cached: cachedArticles.length, lastFetch: new Date(lastFetch).toISOString() });
});

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[TechPulse] Backend running on port ${PORT}`);
    // Pre-fetch on startup
    fetchAllFeeds().catch(err => console.error('[TechPulse] Initial fetch failed:', err.message));
});
