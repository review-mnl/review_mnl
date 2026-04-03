// Search and filter functionality for review.mnl

const FILTER_STORAGE_KEY = 'rmnl_applied_filters';

let _searchQuery = '';
let _allCenters = [];
let _selectedCategories = [];
let _selectedRating = null;
let _appliedCategories = [];
let _appliedRating = null;

function escHtml(str) {
    return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function starString(rating) {
    const r = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
    return '★'.repeat(r) + '☆'.repeat(5 - r);
}

function parsePrograms(raw) {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) {
                return parsed.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
            }
        } catch (e) {
            return trimmed.split(',').map(function(x){ return x.trim(); }).filter(Boolean);
        }
    }
    return [];
}

function normalizeCategory(text) {
    return String(text || '').trim().toLowerCase();
}

function centerSearchText(center) {
    return [
        center.business_name || center.name || '',
        center.address || '',
        center.description || '',
        parsePrograms(center.programs).join(' ')
    ].join(' ').toLowerCase();
}

function centerMatchesCategories(center) {
    if (_appliedCategories.length === 0) return true;
    const haystack = centerSearchText(center);
    return _appliedCategories.some(function(category) {
        return haystack.includes(normalizeCategory(category));
    });
}

function centerMatchesRating(center) {
    if (!_appliedRating) return true;
    const m = String(_appliedRating).match(/^(\d+)/);
    const minRating = m ? parseInt(m[1], 10) : 0;
    const rating = Number(center.avg_rating !== undefined ? center.avg_rating : center.average_rating) || 0;
    return rating >= minRating;
}

function centerMatchesSearch(center) {
    const q = (_searchQuery || '').trim().toLowerCase();
    if (!q) return true;
    return centerSearchText(center).includes(q);
}

function buildCard(center) {
    const div = document.createElement('div');
    div.className = 'result-card';
    div._centerData = center;

    const rating = Number(center.avg_rating !== undefined ? center.avg_rating : center.average_rating) || 0;
    const centerName = center.business_name || center.name || 'Unnamed Center';
    const centerDesc = center.description || '';

    div.innerHTML =
        '<div class="result-image"></div>' +
        '<div class="result-content">' +
            '<h3>' + escHtml(centerName) + '</h3>' +
            '<p class="result-location">' + escHtml(center.address || '') + '</p>' +
            '<p class="result-description">' + escHtml(centerDesc) + '</p>' +
            '<div class="result-rating">' + starString(rating) +
                ' <span style="font-size:0.8em;color:#555;">' +
                (rating ? rating.toFixed(1) : 'No ratings') +
                '</span>' +
            '</div>' +
        '</div>';

    div.addEventListener('click', function() {
        window.location.href = 'viewcenter.html?id=' + center.id;
    });

    return div;
}

function ensureNoResultsMessage() {
    let noResults = document.getElementById('noResultsMsg');
    if (!noResults) {
        noResults = document.createElement('p');
        noResults.id = 'noResultsMsg';
        noResults.style.cssText = 'color:#6b7280;font-size:0.95rem;padding:24px 0;text-align:center;width:100%;';
        noResults.textContent = 'No review centers found.';
        const container = document.querySelector('.results-container');
        if (container) container.appendChild(noResults);
    }
    return noResults;
}

function applyAllFilters() {
    const cards = Array.from(document.querySelectorAll('.result-card'));
    let visibleCount = 0;

    cards.forEach(function(card) {
        const center = card._centerData || {};
        const visible = centerMatchesSearch(center) && centerMatchesCategories(center) && centerMatchesRating(center);
        card.style.display = visible ? '' : 'none';
        if (visible) visibleCount += 1;
    });

    const noResults = ensureNoResultsMessage();
    noResults.style.display = visibleCount === 0 ? 'block' : 'none';
}

function saveFilterState() {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
            categories: _appliedCategories,
            rating: _appliedRating,
            savedAt: new Date().toISOString()
        }));
    } catch (e) {
        console.warn('Failed to save filter state:', e);
    }
}

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return false;
        const parsed = JSON.parse(raw);
        _selectedCategories = Array.isArray(parsed.categories) ? parsed.categories : [];
        _selectedRating = parsed.rating || null;
        _appliedCategories = _selectedCategories.slice();
        _appliedRating = _selectedRating;
        return true;
    } catch (e) {
        console.warn('Failed to load filter state:', e);
        return false;
    }
}

function clearSavedFilters() {
    try {
        localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (e) {
        console.warn('Failed to clear filter state:', e);
    }
}

function syncFilterButtonsFromState() {
    const filterSections = document.querySelectorAll('.filter-section');
    filterSections.forEach(function(section) {
        const titleEl = section.querySelector('h2, p');
        if (!titleEl) return;
        const title = titleEl.textContent.trim().toLowerCase();
        const buttons = Array.from(section.querySelectorAll('.filter-btn'));

        if (title.includes('category')) {
            buttons.forEach(function(btn) {
                const label = btn.textContent.trim();
                btn.classList.toggle('active', _selectedCategories.includes(label));
            });
        }

        if (title.includes('ratings')) {
            buttons.forEach(function(btn) {
                btn.classList.toggle('active', btn.textContent.trim() === _selectedRating);
            });
        }
    });
}

function updateClearState() {
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (!clearBtn) return;
    const hasSelection = _selectedCategories.length > 0 || !!_selectedRating;
    clearBtn.disabled = !hasSelection;
}

function bindFilterButtons() {
    const filterSections = document.querySelectorAll('.filter-section');

    filterSections.forEach(function(section) {
        const titleEl = section.querySelector('h2, p');
        if (!titleEl) return;
        const title = titleEl.textContent.trim().toLowerCase();
        const buttons = Array.from(section.querySelectorAll('.filter-btn'));

        if (title.includes('category')) {
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const label = btn.textContent.trim();
                    if (_selectedCategories.includes(label)) {
                        _selectedCategories = _selectedCategories.filter(function(c){ return c !== label; });
                    } else {
                        _selectedCategories.push(label);
                    }
                    syncFilterButtonsFromState();
                    updateClearState();
                });
            });
        }

        if (title.includes('ratings')) {
            buttons.forEach(function(btn) {
                btn.addEventListener('click', function() {
                    const label = btn.textContent.trim();
                    _selectedRating = (_selectedRating === label) ? null : label;
                    syncFilterButtonsFromState();
                    updateClearState();
                });
            });
        }
    });

    const applyBtn = document.getElementById('applyFiltersBtn');
    const clearBtn = document.getElementById('clearFiltersBtn');
    const popup = document.getElementById('filterPopup');
    const closeBtn = document.getElementById('filterPopupClose');

    if (applyBtn) {
        applyBtn.addEventListener('click', function() {
            _appliedCategories = _selectedCategories.slice();
            _appliedRating = _selectedRating;
            saveFilterState();
            applyAllFilters();
            if (popup) popup.style.display = 'none';
        });
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', function() {
            _selectedCategories = [];
            _selectedRating = null;
            _appliedCategories = [];
            _appliedRating = null;
            clearSavedFilters();
            syncFilterButtonsFromState();
            updateClearState();
            applyAllFilters();
            if (popup) popup.style.display = 'none';
        });
    }

    if (closeBtn && popup) {
        closeBtn.addEventListener('click', function(){ popup.style.display = 'none'; });
        popup.addEventListener('click', function(e){ if (e.target === popup) popup.style.display = 'none'; });
    }
}

async function loadCenters() {
    const container = document.getElementById('resultsContainer');
    const loadingMsg = document.getElementById('loadingMsg');
    if (!container) return;

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const q = urlParams.get('q') || '';
        let centers;
        if (q) centers = await CentersAPI.search(q);
        else centers = await CentersAPI.getAll();
        _allCenters = Array.isArray(centers) ? centers : (centers.centers || []);
    } catch (err) {
        if (loadingMsg) loadingMsg.textContent = 'Failed to load centers. Is the server running?';
        return;
    }

    if (loadingMsg) loadingMsg.remove();
    container.innerHTML = '';
    _allCenters.forEach(function(center) {
        container.appendChild(buildCard(center));
    });

    applyAllFilters();
}

function displaySearchResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q') || '';
    const categoryParam = urlParams.get('category') || '';

    const searchInput = document.querySelector('input[name="search"]');
    if (searchInput && searchQuery) {
        searchInput.value = searchQuery;
        _searchQuery = searchQuery;
    }

    if (categoryParam && !_selectedCategories.includes(categoryParam)) {
        _selectedCategories.push(categoryParam);
        _appliedCategories = _selectedCategories.slice();
        saveFilterState();
    }

    syncFilterButtonsFromState();
    updateClearState();
}

function handleSearch(event) {
    event.preventDefault();
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }

    const searchInput = event.target.querySelector('input[name="search"]');
    const searchQuery = searchInput ? searchInput.value.trim() : '';
    if (searchQuery) {
        window.location.href = 'search.html?q=' + encodeURIComponent(searchQuery);
    }
}

function handleSearchIconClick(searchForm) {
    const fakeEvent = {
        preventDefault: function(){},
        target: searchForm
    };
    handleSearch(fakeEvent);
}

document.addEventListener('DOMContentLoaded', function() {
    const searchForms = document.querySelectorAll('.search-form');
    searchForms.forEach(function(form) {
        form.addEventListener('submit', handleSearch);
        const searchIcon = form.querySelector('.search-icon');
        if (searchIcon) {
            searchIcon.addEventListener('click', function(){ handleSearchIconClick(form); });
        }
        const searchInput = form.querySelector('input[name="search"]');
        if (searchInput && window.location.pathname.includes('search.html')) {
            searchInput.addEventListener('input', function() {
                _searchQuery = searchInput.value;
                applyAllFilters();
            });
        }
    });

    loadFilterState();
    bindFilterButtons();
    displaySearchResults();

    if (window.location.pathname.includes('search.html')) {
        loadCenters();
    }
});

// Delegated fallback: keep the magnifying icon clickable.
document.addEventListener('click', function(event) {
    var icon = event.target.closest('.search-icon');
    if (!icon) return;
    var form = icon.closest('.search-form');
    if (!form) return;
    handleSearchIconClick(form);
});
