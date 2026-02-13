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

    // --- Render ---
    function renderArticles() {
        var filtered = articles.filter(function (a) {
            var matchCat = activeCategory === 'all' || a.category === activeCategory;
            var matchSearch = !searchTerm || (a.title + ' ' + a.description).toLowerCase().includes(searchTerm);
            return matchCat && matchSearch;
        });

        // Featured = first article
        if (filtered.length > 0) {
            var f = filtered[0];
            featuredSlot.innerHTML =
                '<article class="featured" data-category="' + escapeHtml(f.category) + '">' +
                    '<a href="' + escapeHtml(f.link) + '" target="_blank" rel="noopener" class="featured-image">' +
                        '<img src="' + escapeHtml(getImage(f)) + '" alt="' + escapeHtml(f.title) + '" loading="eager"' +
                        ' onerror="this.src=\'' + PLACEHOLDER_IMAGES[f.category] + '\'">' +
                        '<span class="badge">Latest</span>' +
                    '</a>' +
                    '<div class="featured-content">' +
                        '<span class="tag">' + escapeHtml(CATEGORY_LABELS[f.category] || f.category) + '</span>' +
                        '<h2><a href="' + escapeHtml(f.link) + '" target="_blank" rel="noopener">' + escapeHtml(f.title) + '</a></h2>' +
                        '<p>' + escapeHtml(f.description) + '</p>' +
                        '<div class="meta">' +
                            (f.source ? '<span class="author">' + escapeHtml(f.source) + '</span>' : '') +
                            '<span class="date">' + formatDate(f.date) + '</span>' +
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
        for (var i = 1; i < filtered.length; i++) {
            var a = filtered[i];
            gridHtml +=
                '<article class="card" data-category="' + escapeHtml(a.category) + '">' +
                    '<a href="' + escapeHtml(a.link) + '" target="_blank" rel="noopener" class="card-image">' +
                        '<img src="' + escapeHtml(getImage(a)) + '" alt="' + escapeHtml(a.title) + '" loading="lazy"' +
                        ' onerror="this.src=\'' + PLACEHOLDER_IMAGES[a.category] + '\'">' +
                    '</a>' +
                    '<div class="card-content">' +
                        '<span class="tag">' + escapeHtml(CATEGORY_LABELS[a.category] || a.category) + '</span>' +
                        '<h3><a href="' + escapeHtml(a.link) + '" target="_blank" rel="noopener">' + escapeHtml(a.title) + '</a></h3>' +
                        '<p>' + escapeHtml(a.description) + '</p>' +
                        '<div class="meta">' +
                            (a.source ? '<span class="author">' + escapeHtml(a.source) + '</span>' : '') +
                            '<span class="date">' + formatDate(a.date) + '</span>' +
                        '</div>' +
                    '</div>' +
                '</article>';
        }
        newsGrid.innerHTML = gridHtml;

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
        if (e.key === 'Escape' && document.activeElement === searchInput) {
            searchInput.blur();
            searchInput.value = '';
            searchTerm = '';
            renderArticles();
        }
    });

    // --- Auto-refresh every 10 minutes ---
    fetchArticles();
    setInterval(fetchArticles, 10 * 60 * 1000);

})();
