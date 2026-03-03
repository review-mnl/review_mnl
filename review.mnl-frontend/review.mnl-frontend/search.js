// Search functionality for Review.Mnl

// Handle search form submission
function handleSearch(event) {
    event.preventDefault(); // Prevent default form submission
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    // On the public homepage, require login before searching
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = event.target.querySelector('input[name="search"]');
    const searchQuery = searchInput.value.trim();
    if (searchQuery) {
        window.location.href = `search.html?q=${encodeURIComponent(searchQuery)}`;
    }
}

// Handle search icon click
function handleSearchIconClick(searchForm) {
    const path = window.location.pathname;
    const isIndexPage = path.endsWith('index.html') || path === '/' || path.endsWith('/');
    if (isIndexPage) {
        window.location.href = 'login.html';
        return;
    }
    const searchInput = searchForm.querySelector('input[name="search"]');
    const searchQuery = searchInput.value.trim();
    if (searchQuery) {
        window.location.href = `search.html?q=${encodeURIComponent(searchQuery)}`;
    }
}

// Display search results if on search page
function displaySearchResults() {
    const urlParams = new URLSearchParams(window.location.search);
    const searchQuery = urlParams.get('q');
    if (searchQuery) {
        const searchInput = document.querySelector('input[name="search"]');
        if (searchInput) searchInput.value = searchQuery;
        console.log('Searching for:', searchQuery);
    }
}

// Initialize filter interactions
function initFilters() {
    const filterSections = document.querySelectorAll('.filter-section');

    filterSections.forEach(section => {
        const titleEl = section.querySelector('h2, p');
        if (!titleEl) return;
        const title = titleEl.textContent.trim().toLowerCase();
        const buttons = Array.from(section.querySelectorAll('.filter-btn'));

        if (title.includes('category')) {
            buttons.forEach(btn => btn.addEventListener('click', () => { btn.classList.toggle('active'); updateClearState(); }));
        }

        if (title.includes('ratings')) {
            buttons.forEach(btn => btn.addEventListener('click', () => { buttons.forEach(b=>b.classList.remove('active')); btn.classList.add('active'); updateClearState(); }));
        }
    });

    // Helper to enable/disable Clear
    function updateClearState() {
        const clearBtnLocal = document.getElementById('clearFiltersBtn');
        if (!clearBtnLocal) return;
        const anyActive = !!document.querySelector('.filter-btn.active');
        clearBtnLocal.disabled = !anyActive;
    }

    // Elements
    const applyBtn = document.getElementById('applyFiltersBtn');
    const popup = document.getElementById('filterPopup');
    const popupContent = document.getElementById('filterPopupContent');
    const closeBtn = document.getElementById('filterPopupClose');

    if (applyBtn) {
        applyBtn.addEventListener('click', () => {
            const selectedCategories = Array.from(document.querySelectorAll('.filter-section'))
                .filter(s => { const h = s.querySelector('h2, p'); return h && h.textContent.trim().toLowerCase().includes('category'); })
                .flatMap(s => Array.from(s.querySelectorAll('.filter-btn.active')).map(b => b.textContent.trim()));

            const selectedCategoriesLower = selectedCategories.map(c => c.toLowerCase());

            const ratingSection = Array.from(document.querySelectorAll('.filter-section'))
                .find(s => { const h = s.querySelector('h2, p'); return h && h.textContent.trim().toLowerCase().includes('ratings'); });
            let selectedRating = null;
            if (ratingSection) {
                const active = ratingSection.querySelector('.filter-btn.active');
                if (active) selectedRating = active.textContent.trim();
            }

            // Build popup
            if (selectedCategories.length === 0 && !selectedRating) {
                popupContent.innerHTML = '<p class="popup-no-filters">No filters selected. Please choose at least one category or rating.</p>';
            } else {
                let html = '';
                if (selectedCategories.length > 0) {
                    html += '<p style="color:#555;font-size:13px;margin-bottom:8px;"><strong>Categories:</strong></p>';
                    html += selectedCategories.map(c => `<span class="filter-tag">${c}</span>`).join('');
                }
                if (selectedRating) {
                    html += '<p style="color:#555;font-size:13px;margin:14px 0 8px;"><strong>Rating:</strong></p>';
                    html += `<span class="filter-tag rating-tag">${selectedRating}</span>`;
                }
                popupContent.innerHTML = html;
            }

            popup.style.display = 'flex';

            // Apply to results
            const resultCards = Array.from(document.querySelectorAll('.result-card'));
            resultCards.forEach(card => {
                const cardCategory = (card.getAttribute('data-category') || '').trim();
                const cardRating = parseInt(card.getAttribute('data-rating') || '0', 10);

                const categoryMatch = selectedCategories.length === 0 || selectedCategoriesLower.includes(cardCategory.toLowerCase());

                let ratingMatch = true;
                if (selectedRating) {
                    const m = selectedRating.match(/^(\d+)/);
                    const minRating = m ? parseInt(m[1], 10) : 0;
                    ratingMatch = cardRating >= minRating;
                }

                card.style.display = (categoryMatch && ratingMatch) ? '' : 'none';
            });
        });
    }

    // Clear
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            document.querySelectorAll('.filter-btn.active').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.result-card').forEach(card => card.style.display = '');
            if (popup) popup.style.display = 'none';
            updateClearState();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', () => { if (popup) popup.style.display = 'none'; });
    if (popup) popup.addEventListener('click', (e) => { if (e.target === popup) popup.style.display = 'none'; });

    // initialize clear button state
    updateClearState();
}

// Init on DOM ready
document.addEventListener('DOMContentLoaded', function() {
    // wire search forms
    const searchForms = document.querySelectorAll('.search-form');
    searchForms.forEach(form => {
        form.addEventListener('submit', handleSearch);
        const searchIcon = form.querySelector('.search-icon');
        if (searchIcon) searchIcon.addEventListener('click', () => handleSearchIconClick(form));
        const searchInput = form.querySelector('input[name="search"]');
        if (searchInput) {
            searchInput.addEventListener('keypress', function(e){ if (e.key === 'Enter') { e.preventDefault(); handleSearch({ target: form, preventDefault: ()=>{} }); }});
        }
    });

    if (window.location.pathname.includes('search.html')) displaySearchResults();
    initFilters();
});
