// review.mnl — shared API helper
// All fetch calls go through here so only one place needs updating for the base URL.

// Production-only API routing: all requests go to Railway unless explicitly overridden.
const API_BASE = window.BACKEND_URL || 'https://reviewmnl-production-67eb.up.railway.app';

// Redirect any duplicated consecutive path segments (e.g. "/review.mnl-frontend/review.mnl-frontend/..." )
// to the site root to avoid exposing duplicated copies of the site.
(function(){
    try {
        var p = window.location.pathname || '';
        var parts = p.split('/').filter(Boolean);
        for (var i = 0; i < parts.length - 1; i++) {
            if (parts[i] === parts[i+1]) {
                try { window.location.replace(window.location.origin + '/index.html'); } catch(e) { window.location.replace('/index.html'); }
                return;
            }
        }
    } catch(e) {}
})();

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function authHeaders() {
    const token = getActiveToken();
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                 : { 'Content-Type': 'application/json' };
}

function normalizeSessionUser(user) {
    if (!user || typeof user !== 'object') return user;
    var first = (user.first_name || '').toString().trim();
    var last = (user.last_name || '').toString().trim();
    var derived = (first + ' ' + last).trim();
    var fallback = (user.business_name || user.email || '').toString().trim();
    var name = (user.name || '').toString().trim() || derived || fallback;
    return Object.assign({}, user, { name: name });
}

function saveSession(data, rememberMe) {
    // Accept a few possible shapes for the login response to be defensive:
    // - { token, user }
    // - { accessToken, user }
    // - { data: { token, user } }
    // - raw token string
    try {
        let token = null;
        let user = null;
        if (!data) {
            return;
        }
        if (typeof data === 'string') {
            token = data;
        } else {
            token = data.token || data.accessToken || (data.data && (data.data.token || data.data.accessToken)) || null;
            user  = data.user || (data.data && data.data.user) || null;
        }
        user = normalizeSessionUser(user);
        // create and store a session object (persisted) and set active session id for this tab
        try {
            var sid = 's_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
            var sess = { token: token || null, user: user || null, created: Date.now() };
            try { localStorage.setItem('rmnl_session_' + sid, JSON.stringify(sess)); } catch(e) {}
            if (rememberMe) {
                try { localStorage.setItem('rmnl_active_session', sid); } catch(e) {}
            } else {
                try { sessionStorage.setItem('rmnl_active_session', sid); } catch(e) {}
            }
            if (user && user.role) {
                // role is available on the session's user object; avoid storing a global rmnl_role key
                try { /* noop - role stored on session user */ } catch(e) {}
            }
            // persist original signup values per-user (keyed) if not already present
            try {
                if (user) {
                    var uid = user.id || user._id || user.email || null;
                    if (uid) {
                        try { setOriginalUser(uid, user); } catch(e) {}
                        try { if (user && user.role === 'superadmin' && user.email) setLastSuperadminEmail(user.email); } catch(e) {}
                    }
                }
            } catch(e) {}
        } catch(e) {}
        // (no debug logging) 
    } catch (e) {
        console.warn('saveSession failed', e);
    }
}

function clearSession(removeStoredSession) {
    try {
        // remove active session id from this tab
        var active = sessionStorage.getItem('rmnl_active_session') || localStorage.getItem('rmnl_active_session');
        if (active) {
            sessionStorage.removeItem('rmnl_active_session');
            localStorage.removeItem('rmnl_active_session');
        }
        // optionally remove the stored persistent session object
        if (removeStoredSession && active) {
            try { localStorage.removeItem('rmnl_session_' + active); } catch(e) {}
        }
    } catch(e) {}
}

function getActiveSessionId() {
    return sessionStorage.getItem('rmnl_active_session') || localStorage.getItem('rmnl_active_session');
}

function getActiveToken() {
    try {
        var sid = getActiveSessionId();
        if (!sid) return null;
        var s = JSON.parse(localStorage.getItem('rmnl_session_' + sid) || 'null');
        return s && s.token ? s.token : null;
    } catch(e) { return null; }
}

function getActiveUser() {
    try {
        var sid = getActiveSessionId();
        if (!sid) return null;
        var s = JSON.parse(localStorage.getItem('rmnl_session_' + sid) || 'null');
        return s && s.user ? normalizeSessionUser(s.user) : null;
    } catch(e) { return null; }
}

function getUser() {
    try { return getActiveUser(); } catch(e) { return null; }
}

function setSessionUser(user, overwriteOriginal) {
    try {
        if (!user) return;
        user = normalizeSessionUser(user);
        // update active session object with new user data
        try {
            var sid = getActiveSessionId();
            if (sid) {
                var s = JSON.parse(localStorage.getItem('rmnl_session_' + sid) || 'null') || {};
                s.user = user;
                try { localStorage.setItem('rmnl_session_' + sid, JSON.stringify(s)); } catch(e) {}
            }
        } catch(e) {}
        var uid = user.id || user._id || user.email || null;
        if (uid) {
            try { setOriginalUser(uid, user, overwriteOriginal); } catch(e) {}
        }
    } catch(e) { console.warn('setSessionUser failed', e); }
}

function getOriginalUser(userIdentifier) {
    try {
        if (!userIdentifier) return null;
        var key = 'rmnl_user_original_' + userIdentifier;
        return JSON.parse(localStorage.getItem(key));
    } catch(e) { return null; }
}

function isAuthenticated() {
    return Boolean(getActiveToken());
}

function getActiveRole() {
    try {
        var u = getActiveUser();
        return u && u.role ? u.role : null;
    } catch(e) { return null; }
}

function setOriginalUser(userIdentifier, userObj, overwrite) {
    try {
        if (!userIdentifier || !userObj) return;
        var key = 'rmnl_user_original_' + userIdentifier;
        if (overwrite || !localStorage.getItem(key)) {
            try { localStorage.setItem(key, JSON.stringify(userObj)); } catch(e) {}
        }
    } catch(e) {}
}

function setLastSuperadminEmail(email) {
    try {
        if (!email) return;
        try { localStorage.setItem('rmnl_last_superadmin_email', String(email)); } catch(e) {}
    } catch(e) {}
}

function getLastSuperadminEmail() {
    try { return localStorage.getItem('rmnl_last_superadmin_email') || null; } catch(e) { return null; }
}

// ---------------------------------------------------------------------------
// Generic request wrapper
// ---------------------------------------------------------------------------
async function apiRequest(method, path, body, isFormData) {
    const opts = { method, credentials: 'include' };
    if (String(method || '').toUpperCase() === 'GET') {
        opts.cache = 'no-store';
    }
    if (isFormData) {
        // Let browser set multipart boundary automatically — no Content-Type header
        const token = getActiveToken();
        opts.headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        opts.body = body;
    } else {
        opts.headers = authHeaders();
        if (body) opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, opts);
    const text = await res.text().catch(() => '');
    var json = {};
    try { json = text ? JSON.parse(text) : {}; } catch(e) { json = {}; }
    
    // Handle authentication errors
    if (res.status === 401) {
        try { clearSession(); } catch(e) {}
        const errorMsg = json.message || 'Session expired. Please login again.';
        console.warn('API returned 401 for', path, json);
        // Redirect to login if not already there
        if (!window.location.pathname.includes('login.html') && !window.location.pathname === '/') {
            setTimeout(function() { window.location.href = 'login.html'; }, 500);
        }
        throw new Error(errorMsg);
    }
    
    // Handle authorization errors
    if (res.status === 403) {
        const errorMsg = json.message || 'You do not have permission to access this resource.';
        console.warn('API returned 403 for', path, json);
        throw new Error(errorMsg);
    }
    
    // Handle validation/bad request errors
    if (res.status === 400) {
        const errorMsg = json.message || json.error || 'Invalid request. Please check your input.';
        throw new Error(errorMsg);
    }
    
    // Handle conflict errors (duplicates, etc)
    if (res.status === 409) {
        const errorMsg = json.message || 'This resource already exists.';
        throw new Error(errorMsg);
    }
    
    // Handle other errors
    if (!res.ok) {
        const errorMsg = json.message || json.error || ('Request failed (' + res.status + '. Please try again later.');
        console.error('API error for', path, res.status, json);
        throw new Error(errorMsg);
    }
    
    return json;
}

// ---------------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------------
const AuthAPI = {
    login: (email, password) =>
        apiRequest('POST', '/api/auth/login', { email, password }),

    registerStudent: (name, email, password) =>
        apiRequest('POST', '/api/auth/register/student', { fullname: name, email, password }),

    registerCenter: (formData) =>
        apiRequest('POST', '/api/auth/register/center', formData, true),

    forgotPassword: (email) =>
        apiRequest('POST', '/api/auth/forgot-password', { email }),

    resetPassword: (token, password) =>
        apiRequest('POST', '/api/auth/reset-password', { token, password }),

    verifyEmail: (token) =>
        apiRequest('GET', '/api/auth/verify-email?token=' + encodeURIComponent(token)),

    resendVerification: (email) =>
        apiRequest('POST', '/api/auth/resend-verification', { email }),
};

// ---------------------------------------------------------------------------
// Centers API
// ---------------------------------------------------------------------------
const CentersAPI = {
    getAll: () =>
        apiRequest('GET', '/api/centers'),

    search: (q) =>
        apiRequest('GET', '/api/centers/search?q=' + encodeURIComponent(q)),

    getById: (id) =>
        apiRequest('GET', '/api/centers/' + id),

    postTestimonial: (centerId, content, rating) =>
        apiRequest('POST', '/api/centers/' + centerId + '/testimonials', { content, rating }),

    getMyProfile: () =>
        apiRequest('GET', '/api/centers/me'),
    getMyTestimonials: (sort) =>
        apiRequest('GET', '/api/centers/me/testimonials' + (sort ? ('?sort=' + encodeURIComponent(sort)) : '')),
    updateMyProfile: (data) =>
        apiRequest('PUT', '/api/centers/me', data),
    uploadLogo: (formData) =>
        apiRequest('PUT', '/api/centers/me/logo', formData, true),
    getMyEnrollments: (status, sort) => {
        var qs = [];
        if (status) qs.push('status=' + encodeURIComponent(status));
        if (sort) qs.push('sort=' + encodeURIComponent(sort));
        return apiRequest('GET', '/api/centers/me/enrollments' + (qs.length ? ('?' + qs.join('&')) : ''));
    },
    verifyEnrollmentPayment: (enrollmentId, paymentStatus) =>
        apiRequest('PUT', '/api/centers/me/enrollments/' + enrollmentId + '/payment/verify', paymentStatus ? { payment_status: paymentStatus } : {}),
    updateEnrollmentStatus: (enrollmentId, status) =>
        apiRequest('PUT', '/api/centers/me/enrollments/' + enrollmentId + '/status', { status }),
    
    enrollWithGcash: (centerId, payload) =>
        apiRequest('POST', '/api/centers/' + centerId + '/enroll/gcash', payload),
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------
const UserAPI = {
    getMyProfile: () =>
        apiRequest('GET', '/api/users/me'),

    getMyEnrollments: () =>
        apiRequest('GET', '/api/users/me/enrollments'),

    getMyRatings: () =>
        apiRequest('GET', '/api/users/me/ratings'),

    upsertMyRating: (centerId, rating) =>
        apiRequest('PUT', '/api/users/me/ratings/' + centerId, { rating }),

    updateMyProfile: (data) =>
        apiRequest('PUT', '/api/users/me', data),
    uploadProfilePhoto: (formData) =>
        apiRequest('PUT', '/api/users/me/photo', formData, true),
};

// ---------------------------------------------------------------------------
// Payments API
// ---------------------------------------------------------------------------
const PaymentsAPI = {
    createGcashEnrollment: async (centerId, payload) => {
        var resolvedCenterId = encodeURIComponent(String(centerId || '').trim());
        var body = {
            amount: Number((payload && payload.amount) || 1550),
            gcash_number: String((payload && payload.gcash_number) || '').trim(),
            gcash_name: String((payload && payload.gcash_name) || '').trim(),
            reference_number: String((payload && payload.reference_number) || '').trim(),
            program_enrolled: String((payload && payload.program_enrolled) || '').trim(),
            enrollment_date: String((payload && payload.enrollment_date) || '').trim(),
        };
        try {
            return await apiRequest('POST', '/api/payments/gcash/' + resolvedCenterId, body);
        } catch (err) {
            var msg = String((err && err.message) || '');
            var is404 = /404/.test(msg) || /not found/i.test(msg);
            if (!is404) throw err;

            // Fallback for deployments still exposing the older centers enrollment route.
            console.warn('[PaymentsAPI] Primary GCash endpoint returned 404. Falling back to /api/centers/:id/enroll/gcash');
            return apiRequest('POST', '/api/centers/' + resolvedCenterId + '/enroll/gcash', body);
        }
    },
};

// ---------------------------------------------------------------------------
// Enrollments API
// ---------------------------------------------------------------------------
const EnrollmentsAPI = {
    getCenterEnrollments: (centerId) =>
        apiRequest('GET', '/api/enrollments/center/' + encodeURIComponent(centerId)),
};

// ---------------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------------
const NotificationAPI = {
    create: (payload) =>
        apiRequest('POST', '/api/notifications', payload),

    getMy: () =>
        apiRequest('GET', '/api/notifications/me'),

    markAsRead: (id) =>
        apiRequest('PUT', '/api/notifications/' + id + '/read'),
};

// ---------------------------------------------------------------------------
// Global notification bell (shared navbar behavior)
// ---------------------------------------------------------------------------
function initGlobalNotificationBell(options) {
    try {
        options = options || {};
        if (!isAuthenticated()) return;

        var nav = options.navElement || document.querySelector(options.navSelector || 'nav');
        if (!nav) return;

        // Prevent duplicate mount on pages that already provide custom bell logic.
        if (nav.querySelector('.rmnl-global-bell')) return;

        var profileWrapper = nav.querySelector(options.profileWrapperSelector || '.profile-wrapper');
        if (!profileWrapper) return;

        if (!document.getElementById('rmnlNotifStyle')) {
            var style = document.createElement('style');
            style.id = 'rmnlNotifStyle';
            style.textContent = [
                '.rmnl-global-bell{position:relative;margin-right:8px;z-index:12000;}',
                '.rmnl-global-bell-btn{position:relative;background:none;border:none;color:#fff;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;}',
                '.rmnl-global-bell-badge{display:none;position:absolute;top:-2px;right:-2px;min-width:18px;height:18px;padding:0 5px;border-radius:999px;background:#d32f2f;color:#fff;font-size:10px;font-weight:700;line-height:18px;text-align:center;}',
                '.rmnl-global-drop{display:none;position:absolute;right:0;top:40px;width:360px;max-width:86vw;background:#fff;border-radius:12px;box-shadow:0 12px 30px rgba(0,0,0,0.2);overflow:hidden;z-index:12010;}',
                '.rmnl-global-drop-head{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid #eef2ff;}',
                '.rmnl-global-drop-list{max-height:360px;overflow-y:auto;padding:10px 12px;}',
                '.rmnl-global-drop-foot{padding:10px 12px;border-top:1px solid #eef2ff;background:#f8faff;}',
            ].join('');
            document.head.appendChild(style);
        }

        var wrapper = document.createElement('div');
        wrapper.className = 'rmnl-global-bell';
        wrapper.innerHTML = ''
            + '<button type="button" class="rmnl-global-bell-btn" aria-label="Open notifications" aria-expanded="false">'
            + '  <span class="material-symbols-outlined" style="font-size:28px;">notifications</span>'
            + '  <span class="rmnl-global-bell-badge">0</span>'
            + '</button>'
            + '<div class="rmnl-global-drop">'
            + '  <div class="rmnl-global-drop-head">'
            + '    <strong style="font-size:14px;color:#0d1b4b;">Enrollment Notifications</strong>'
            + '    <span class="rmnl-global-unread" style="display:none;background:#d32f2f;color:#fff;border-radius:999px;padding:2px 8px;font-size:10px;font-weight:700;">0 Unread</span>'
            + '  </div>'
            + '  <div class="rmnl-global-drop-list"></div>'
            + '  <div class="rmnl-global-drop-foot"><a href="notifications.html" style="font-size:12px;font-weight:600;color:#1d4ed8;text-decoration:none;">View All Notifications</a></div>'
            + '</div>';

        // Keep the bell in the right-side nav cluster (next to profile icon)
        // so it does not appear in the middle menu area.
        profileWrapper.style.display = 'flex';
        profileWrapper.style.alignItems = 'center';
        profileWrapper.style.gap = '8px';
        profileWrapper.style.zIndex = '12000';
        profileWrapper.insertBefore(wrapper, profileWrapper.firstChild);

        var btn = wrapper.querySelector('.rmnl-global-bell-btn');
        var badge = wrapper.querySelector('.rmnl-global-bell-badge');
        var drop = wrapper.querySelector('.rmnl-global-drop');
        var dropList = wrapper.querySelector('.rmnl-global-drop-list');
        var unreadEl = wrapper.querySelector('.rmnl-global-unread');

        // Render dropdown at document level so page-specific stacking contexts
        // (e.g., map panes) can never overlap it.
        if (drop && drop.parentElement !== document.body) {
            document.body.appendChild(drop);
        }
        if (drop) {
            drop.style.position = 'fixed';
            drop.style.zIndex = '2147483000';
        }

        function placeDropNearButton() {
            if (!drop || !btn) return;
            var rect = btn.getBoundingClientRect();
            var viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
            var dropWidth = drop.offsetWidth || 360;
            var margin = 10;

            var left = rect.right - dropWidth;
            if (left < margin) left = margin;
            if (left + dropWidth > viewportWidth - margin) {
                left = Math.max(margin, viewportWidth - dropWidth - margin);
            }

            drop.style.left = left + 'px';
            drop.style.top = (rect.bottom + 8) + 'px';
            drop.style.right = 'auto';
        }

        function closeProfileDropdowns() {
            var profileDropdowns = document.querySelectorAll('#profileDropdown, #contactProfileDropdown, .profile-dropdown');
            profileDropdowns.forEach(function(el) {
                el.style.display = 'none';
            });
            var profileButtons = document.querySelectorAll('#profileBtn, #contactProfileBtn');
            profileButtons.forEach(function(el) {
                el.setAttribute('aria-expanded', 'false');
            });
        }

        window.closeGlobalNotificationBell = function() {
            drop.style.display = 'none';
            btn.setAttribute('aria-expanded', 'false');
        };

        function bindProfileMutexButtons() {
            var profileButtons = document.querySelectorAll('#profileBtn, #contactProfileBtn, .profile-icon');
            profileButtons.forEach(function(el) {
                if (el.__rmnlNotifMutexBound) return;
                el.__rmnlNotifMutexBound = true;
                // Capture phase ensures this runs even if page scripts stop propagation.
                el.addEventListener('click', function() {
                    if (typeof window.closeGlobalNotificationBell === 'function') {
                        window.closeGlobalNotificationBell();
                    }
                }, true);
            });
        }

        bindProfileMutexButtons();

        function statusStyle(status) {
            var s = String(status || 'pending').toLowerCase();
            return {
                s: s,
                bg: s === 'approved' ? '#e8f5e9' : (s === 'rejected' ? '#ffebee' : '#e3f2fd'),
                color: s === 'approved' ? '#1b5e20' : (s === 'rejected' ? '#b71c1c' : '#0d47a1')
            };
        }

        async function markRead(notificationId) {
            try { await NotificationAPI.markAsRead(notificationId); } catch (e) {}
        }

        function render(notifications) {
            var data = Array.isArray(notifications) ? notifications : [];
            var unreadCount = data.filter(function(n){ return !n.is_read; }).length;

            if (badge) {
                badge.style.display = unreadCount > 0 ? 'block' : 'none';
                badge.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
            }
            if (unreadEl) {
                unreadEl.style.display = unreadCount > 0 ? 'inline-block' : 'none';
                unreadEl.textContent = unreadCount + ' Unread';
            }

            if (!data.length) {
                dropList.innerHTML = '<p style="font-size:12px;color:#6b7280;margin:4px 2px;">No notifications yet.</p>';
                return;
            }

            dropList.innerHTML = data.slice(0, 8).map(function(item) {
                var st = statusStyle(item.status);
                var isUnread = !item.is_read;
                return '<div class="rmnl-global-item" data-id="' + Number(item.notification_id || 0) + '" style="cursor:pointer;border:1px solid ' + (isUnread ? '#b9d0ff' : '#e5e7eb') + ';background:' + (isUnread ? '#f5f9ff' : '#fff') + ';border-radius:10px;padding:10px 11px;margin-bottom:9px;">'
                    + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">'
                    + '<p style="margin:0;font-size:12px;color:#111827;font-weight:' + (isUnread ? '700' : '500') + ';line-height:1.45;">' + (String(item.message || '').replace(/[&<>"']/g, function(ch){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]); })) + '</p>'
                    + '<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;color:' + st.color + ';background:' + st.bg + ';">' + (st.s.charAt(0).toUpperCase() + st.s.slice(1)) + '</span>'
                    + '</div>'
                    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">'
                    + '<span style="font-size:11px;color:#6b7280;">' + new Date(item.created_at).toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' }) + '</span>'
                    + (item.center_user_id
                        ? '<button type="button" class="rmnl-global-open-chat" data-id="' + Number(item.notification_id || 0) + '" style="padding:5px 9px;border:1px solid #d0dcff;background:#fff;color:#1d4ed8;border-radius:7px;font-size:11px;font-weight:600;cursor:pointer;">Open Chat</button>'
                        : '<span style="font-size:10px;color:' + (isUnread ? '#b45309' : '#6b7280') + ';font-weight:600;">' + (isUnread ? 'Unread' : 'Read') + '</span>')
                    + '</div>'
                    + '</div>';
            }).join('');

            dropList.querySelectorAll('.rmnl-global-item').forEach(function(el) {
                el.addEventListener('click', async function() {
                    var id = Number(el.getAttribute('data-id'));
                    if (id > 0) {
                        await markRead(id);
                        await refresh();
                    }
                });
            });

            dropList.querySelectorAll('.rmnl-global-open-chat').forEach(function(el) {
                el.addEventListener('click', async function(ev) {
                    ev.stopPropagation();
                    var id = Number(el.getAttribute('data-id'));
                    if (id > 0) {
                        await markRead(id);
                        window.location.href = 'userdashboard.html?openChatNotification=' + id;
                    }
                });
            });
        }

        async function refresh() {
            try {
                var res = await NotificationAPI.getMy();
                render((res && res.notifications) ? res.notifications : []);
            } catch (e) {
                render([]);
            }
        }

        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            var isOpen = drop.style.display === 'block';
            if (!isOpen) {
                closeProfileDropdowns();
                placeDropNearButton();
            }
            drop.style.display = isOpen ? 'none' : 'block';
            btn.setAttribute('aria-expanded', String(!isOpen));
        });

        drop.addEventListener('click', function(e) {
            e.stopPropagation();
        });

        document.addEventListener('click', function() {
            drop.style.display = 'none';
            btn.setAttribute('aria-expanded', 'false');
        });

        window.addEventListener('resize', function() {
            if (drop.style.display === 'block') placeDropNearButton();
        });

        window.addEventListener('scroll', function() {
            if (drop.style.display === 'block') placeDropNearButton();
        }, true);

        if (window.__rmnlGlobalNotifTimer) {
            clearInterval(window.__rmnlGlobalNotifTimer);
        }

        if (window.__rmnlGlobalNotifStream) {
            try { window.__rmnlGlobalNotifStream.close(); } catch (e) {}
            window.__rmnlGlobalNotifStream = null;
        }

        refresh();

        function ensurePollingFallback() {
            if (window.__rmnlGlobalNotifTimer) return;
            window.__rmnlGlobalNotifTimer = setInterval(refresh, 8000);
        }

        function stopPollingFallback() {
            if (!window.__rmnlGlobalNotifTimer) return;
            clearInterval(window.__rmnlGlobalNotifTimer);
            window.__rmnlGlobalNotifTimer = null;
        }

        function setupRealtime() {
            if (typeof window.EventSource === 'undefined') {
                ensurePollingFallback();
                return;
            }

            var token = localStorage.getItem('token') || '';
            if (!token) {
                ensurePollingFallback();
                return;
            }

            var streamUrl = API_BASE_URL + '/api/notifications/stream?token=' + encodeURIComponent(token);
            var es = new EventSource(streamUrl);
            window.__rmnlGlobalNotifStream = es;

            es.onopen = function() {
                stopPollingFallback();
            };

            es.onmessage = function(event) {
                if (!event || !event.data) return;
                try {
                    var payload = JSON.parse(event.data);
                    if (!payload || payload.type === 'connected') return;
                    refresh();
                } catch (e) {
                    refresh();
                }
            };

            es.onerror = function() {
                ensurePollingFallback();
                try { es.close(); } catch (e) {}
                if (window.__rmnlGlobalNotifStream === es) {
                    window.__rmnlGlobalNotifStream = null;
                }
                setTimeout(function() {
                    if (!window.__rmnlGlobalNotifStream) {
                        setupRealtime();
                    }
                }, 3000);
            };
        }

        setupRealtime();

        if (!window.__rmnlNotifUnloadBound) {
            window.__rmnlNotifUnloadBound = true;
            window.addEventListener('beforeunload', function() {
                if (window.__rmnlGlobalNotifStream) {
                    try { window.__rmnlGlobalNotifStream.close(); } catch (e) {}
                    window.__rmnlGlobalNotifStream = null;
                }
                if (window.__rmnlGlobalNotifTimer) {
                    clearInterval(window.__rmnlGlobalNotifTimer);
                    window.__rmnlGlobalNotifTimer = null;
                }
            });
        }
    } catch (e) {
        console.warn('initGlobalNotificationBell failed', e);
    }
}

// ---------------------------------------------------------------------------
// Messages API
// ---------------------------------------------------------------------------
const MessageAPI = {
    getConversations: () =>
        apiRequest('GET', '/api/messages/conversations'),

    getThread: (withUserId, centerId) => {
        var qs = ['withUserId=' + encodeURIComponent(withUserId)];
        if (centerId) qs.push('centerId=' + encodeURIComponent(centerId));
        return apiRequest('GET', '/api/messages/thread?' + qs.join('&'));
    },

    send: (payload) =>
        apiRequest('POST', '/api/messages', payload),

    markThreadAsRead: (withUserId, centerId) =>
        apiRequest('PUT', '/api/messages/thread/read', {
            with_user_id: withUserId,
            center_id: centerId || null,
        }),
};

// ---------------------------------------------------------------------------
// Admin API
// ---------------------------------------------------------------------------
const AdminAPI = {
    getPendingCenters: () =>
        apiRequest('GET', '/api/admin/centers/pending'),

    getAllCenters: () =>
        apiRequest('GET', '/api/admin/centers'),

    updateCenterStatus: (id, status) =>
        apiRequest('PUT', '/api/admin/centers/' + id + '/status', { status }),

    deleteCenter: (id) =>
        apiRequest('DELETE', '/api/admin/centers/' + id),

    getCenterDocuments: (id) =>
        apiRequest('GET', '/api/admin/centers/' + id + '/documents'),

    getStudents: () =>
        apiRequest('GET', '/api/admin/students'),

    deleteUser: (id) =>
        apiRequest('DELETE', '/api/admin/users/' + id),

    getPendingTestimonials: () =>
        apiRequest('GET', '/api/admin/testimonials/pending'),

    approveTestimonial: (id) =>
        apiRequest('PUT', '/api/admin/testimonials/' + id + '/approve'),

    deleteTestimonial: (id) =>
        apiRequest('DELETE', '/api/admin/testimonials/' + id),
};
