/* ============================================
   TechPulse — App Logic
   ============================================ */

(function () {
    'use strict';

    var API_URL = '/api/articles';

    // --- DOM Elements ---
    var themeToggle = document.getElementById('themeToggle');
    var searchInput = document.getElementById('searchInput');
    var filterBtns = document.querySelectorAll('.filter-btn');
    var featuredSlot = document.getElementById('featuredSlot');
    var newsGrid = document.getElementById('newsGrid');
    var noResults = document.getElementById('noResults');
    var loadingEl = document.getElementById('loading');
    var subscribeForm = document.getElementById('subscribeForm');
    var filterBar = document.querySelector('.filter-bar');

    // Article detail view elements
    var articleView = document.getElementById('articleView');
    var articleHeader = document.getElementById('articleHeader');
    var articleBody = document.getElementById('articleBody');
    var articleSourceLink = document.getElementById('articleSourceLink');
    var backBtn = document.getElementById('backBtn');

    var articles = [];
    var activeCategory = 'all';
    var searchTerm = '';

    // --- Theme Toggle ---
    function getStoredTheme() {
        return localStorage.getItem('techpulse-theme') || 'dark';
    }

    function setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        localStorage.setItem('techpulse-theme', theme);
    }

    setTheme(getStoredTheme());

    themeToggle.addEventListener('click', function () {
        var current = document.documentElement.getAttribute('data-theme');
        setTheme(current === 'dark' ? 'light' : 'dark');
    });

    // --- Category Filter ---
    filterBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            filterBtns.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            activeCategory = btn.dataset.category;
            renderArticles();
        });
    });

    // --- Search ---
    searchInput.addEventListener('input', function () {
        searchTerm = this.value.toLowerCase().trim();
        renderArticles();
    });

    // --- Placeholder images by category ---
    var PLACEHOLDER_IMAGES = {
        ai: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?auto=format&fit=crop&w=800&q=80',
        security: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?auto=format&fit=crop&w=800&q=80',
        webdev: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=800&q=80',
        hardware: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80',
        startups: 'https://images.unsplash.com/photo-1559136555-9303baea8ebd?auto=format&fit=crop&w=800&q=80',
    };

    var CATEGORY_LABELS = {
        ai: 'AI & ML',
        security: 'Security',
        webdev: 'Web Dev',
        hardware: 'Hardware',
        startups: 'Startups',
    };

    function getImage(article) {
        return article.image || PLACEHOLDER_IMAGES[article.category] || PLACEHOLDER_IMAGES.hardware;
    }

    function formatDate(dateStr) {
        try {
            var d = new Date(dateStr);
            return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        } catch (e) {
            return '';
        }
    }

    function escapeHtml(str) {
        var div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // --- Reading progress bar ---
    var progressBar = document.getElementById('readingProgress');

    function updateReadingProgress() {
        if (articleView.hidden) {
            progressBar.style.width = '0%';
            return;
        }
        var scrollTop = window.scrollY;
        var docHeight = document.documentElement.scrollHeight - window.innerHeight;
        var progress = docHeight > 0 ? Math.min((scrollTop / docHeight) * 100, 100) : 0;
        progressBar.style.width = progress + '%';
    }

    window.addEventListener('scroll', updateReadingProgress);

    // --- Reading time estimate ---
    function estimateReadingTime(content) {
        var text = content.replace(/<[^>]*>/g, '').trim();
        var words = text.split(/\s+/).length;
        var minutes = Math.max(1, Math.round(words / 220));
        return minutes;
    }

    // --- Article Detail View ---
    function setArticleBodyLinks() {
        var bodyLinks = articleBody.querySelectorAll('a');
        for (var i = 0; i < bodyLinks.length; i++) {
            bodyLinks[i].setAttribute('target', '_blank');
            bodyLinks[i].setAttribute('rel', 'noopener');
        }
    }

    function renderArticleBody(content, readingMin) {
        articleBody.innerHTML = content;
        setArticleBodyLinks();

        // Update reading time if we got better content
        var timeEl = document.querySelector('.reading-time');
        if (timeEl) {
            var newMin = estimateReadingTime(content);
            if (newMin > readingMin) {
                timeEl.innerHTML =
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
                    newMin + ' min read';
            }
        }
    }

    function openArticle(index) {
        var a = articles[index];
        if (!a) return;

        // Calculate initial reading time from RSS content
        var rssContent = a.content && a.content.trim().length > 0 ? a.content : '';
        var readingMin = estimateReadingTime(rssContent || a.description);

        // Build header
        articleHeader.innerHTML =
            '<img class="article-hero" src="' + escapeHtml(getImage(a)) + '" alt="' + escapeHtml(a.title) + '"' +
            ' onerror="this.src=\'' + PLACEHOLDER_IMAGES[a.category] + '\'">' +
            '<span class="tag">' + escapeHtml(CATEGORY_LABELS[a.category] || a.category) + '</span>' +
            '<h1>' + escapeHtml(a.title) + '</h1>' +
            '<div class="meta">' +
                (a.author ? '<span class="author">' + escapeHtml(a.author) + '</span>' : '') +
                (a.source ? '<span class="author">' + escapeHtml(a.source) + '</span>' : '') +
                '<span class="date">' + formatDate(a.date) + '</span>' +
                '<span class="reading-time">' +
                    '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>' +
                    readingMin + ' min read' +
                '</span>' +
            '</div>';

        // Show loading state in body while fetching full content
        articleBody.innerHTML =
            '<div class="article-loading">' +
                '<div class="loading-spinner"></div>' +
                '<p>Loading full article...</p>' +
            '</div>';

        // Source link
        articleSourceLink.href = a.link;

        // Show article view, hide feed
        featuredSlot.hidden = true;
        newsGrid.hidden = true;
        noResults.hidden = true;
        filterBar.hidden = true;
        articleView.hidden = false;

        // Push browser history state for back button
        history.pushState({ article: index }, '', '#article-' + index);

        // Reset progress bar and scroll to top
        progressBar.style.width = '0%';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Fetch full article content from the backend
        fetch('/api/article-content?url=' + encodeURIComponent(a.link))
            .then(function (res) {
                if (!res.ok) throw new Error('Failed');
                return res.json();
            })
            .then(function (data) {
                if (articleView.hidden) return; // user navigated away
                if (data.content && data.content.trim().length > 100) {
                    renderArticleBody(data.content, readingMin);
                } else {
                    // Extraction returned too little, fall back to RSS content
                    renderArticleBody(rssContent || '<p>' + escapeHtml(a.description) + '</p>', readingMin);
                }
            })
            .catch(function () {
                if (articleView.hidden) return;
                // Fall back to RSS content on error
                if (rssContent) {
                    renderArticleBody(rssContent, readingMin);
                } else {
                    articleBody.innerHTML = '<p>' + escapeHtml(a.description) + '</p>';
                }
            });
    }

    function closeArticle() {
        articleView.hidden = true;
        filterBar.hidden = false;
        progressBar.style.width = '0%';
        renderArticles();
    }

    backBtn.addEventListener('click', function () {
        closeArticle();
        // Only go back if we pushed a state
        if (window.location.hash.startsWith('#article-')) {
            history.back();
        }
    });

    // --- Click handler for articles (event delegation) ---
    document.querySelector('.container').addEventListener('click', function (e) {
        // Find the closest card or featured article
        var card = e.target.closest('.card, .featured');
        if (!card || !articleView.hidden) return;

        e.preventDefault();

        // Find article index from the data attribute
        var idx = card.dataset.index;
        if (idx !== undefined) {
            openArticle(parseInt(idx, 10));
        }
    });

    // --- Render ---
    function renderArticles() {
        var filtered = [];
        // Build filtered list with original indices
        for (var i = 0; i < articles.length; i++) {
            var a = articles[i];
            var matchCat = activeCategory === 'all' || a.category === activeCategory;
            var matchSearch = !searchTerm || (a.title + ' ' + a.description).toLowerCase().includes(searchTerm);
            if (matchCat && matchSearch) {
                filtered.push({ article: a, index: i });
            }
        }

        // Featured = first article
        if (filtered.length > 0) {
            var f = filtered[0];
            var a = f.article;
            featuredSlot.innerHTML =
                '<article class="featured" data-category="' + escapeHtml(a.category) + '" data-index="' + f.index + '">' +
                    '<div class="featured-image">' +
                        '<img src="' + escapeHtml(getImage(a)) + '" alt="' + escapeHtml(a.title) + '" loading="eager"' +
                        ' onerror="this.src=\'' + PLACEHOLDER_IMAGES[a.category] + '\'">' +
                        '<span class="badge">Latest</span>' +
                    '</div>' +
                    '<div class="featured-content">' +
                        '<span class="tag">' + escapeHtml(CATEGORY_LABELS[a.category] || a.category) + '</span>' +
                        '<h2>' + escapeHtml(a.title) + '</h2>' +
                        '<p>' + escapeHtml(a.description) + '</p>' +
                        '<div class="meta">' +
                            (a.source ? '<span class="author">' + escapeHtml(a.source) + '</span>' : '') +
                            '<span class="date">' + formatDate(a.date) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</article>';
            featuredSlot.hidden = false;
        } else {
            featuredSlot.innerHTML = '';
            featuredSlot.hidden = true;
        }

        // Grid = rest of articles
        var gridHtml = '';
        for (var j = 1; j < filtered.length; j++) {
            var item = filtered[j];
            var ar = item.article;
            gridHtml +=
                '<article class="card" data-category="' + escapeHtml(ar.category) + '" data-index="' + item.index + '">' +
                    '<div class="card-image">' +
                        '<img src="' + escapeHtml(getImage(ar)) + '" alt="' + escapeHtml(ar.title) + '" loading="lazy"' +
                        ' onerror="this.src=\'' + PLACEHOLDER_IMAGES[ar.category] + '\'">' +
                    '</div>' +
                    '<div class="card-content">' +
                        '<span class="tag">' + escapeHtml(CATEGORY_LABELS[ar.category] || ar.category) + '</span>' +
                        '<h3>' + escapeHtml(ar.title) + '</h3>' +
                        '<p>' + escapeHtml(ar.description) + '</p>' +
                        '<div class="meta">' +
                            (ar.source ? '<span class="author">' + escapeHtml(ar.source) + '</span>' : '') +
                            '<span class="date">' + formatDate(ar.date) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</article>';
        }
        newsGrid.innerHTML = gridHtml;
        newsGrid.hidden = false;

        noResults.hidden = filtered.length > 0;
    }

    // --- Fetch Articles ---
    function fetchArticles() {
        loadingEl.hidden = false;
        noResults.hidden = true;

        fetch(API_URL)
            .then(function (res) { return res.json(); })
            .then(function (data) {
                articles = data.articles || [];
                loadingEl.hidden = true;
                renderArticles();
            })
            .catch(function (err) {
                console.error('[TechPulse] Failed to load articles:', err);
                loadingEl.hidden = true;
                noResults.hidden = false;
            });
    }

    // --- Subscribe Form ---
    subscribeForm.addEventListener('submit', function (e) {
        e.preventDefault();

        var emailInput = document.getElementById('emailInput');
        var btnText = subscribeForm.querySelector('.btn-text');
        var btnSuccess = subscribeForm.querySelector('.btn-success');
        var submitBtn = subscribeForm.querySelector('.subscribe-btn');

        if (!emailInput.value) return;

        btnText.hidden = true;
        btnSuccess.hidden = false;
        submitBtn.style.background = 'transparent';
        emailInput.disabled = true;
        submitBtn.disabled = true;

        setTimeout(function () {
            btnText.hidden = false;
            btnSuccess.hidden = true;
            submitBtn.style.background = '';
            emailInput.value = '';
            emailInput.disabled = false;
            submitBtn.disabled = false;
        }, 3000);
    });

    // --- Keyboard shortcuts ---
    document.addEventListener('keydown', function (e) {
        if (e.key === '/' && document.activeElement !== searchInput) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === 'Escape') {
            if (!articleView.hidden) {
                closeArticle();
            } else if (document.activeElement === searchInput) {
                searchInput.blur();
                searchInput.value = '';
                searchTerm = '';
                renderArticles();
            }
        }
    });

    // --- Browser back button support ---
    window.addEventListener('popstate', function () {
        if (!articleView.hidden) {
            closeArticle();
        }
    });

    // --- Auto-refresh every 10 minutes ---
    fetchArticles();
    setInterval(fetchArticles, 10 * 60 * 1000);

})();
