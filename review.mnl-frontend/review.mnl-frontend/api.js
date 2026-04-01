// review.mnl — shared API helper
// All fetch calls go through here so only one place needs updating for the base URL.

// Uses production backend URL when deployed, falls back to localhost for development
// You can override this by setting window.BACKEND_URL in your HTML before loading this script
const API_BASE = window.BACKEND_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:5000'
        : 'https://reviewmnl-production-67eb.up.railway.app'
);

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function authHeaders() {
    const token = getActiveToken();
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                 : { 'Content-Type': 'application/json' };
}

function saveSession(data) {
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
        // create and store a session object (persisted) and set active session id for this tab
        try {
            var sid = 's_' + Math.random().toString(36).slice(2,10) + Date.now().toString(36);
            var sess = { token: token || null, user: user || null, created: Date.now() };
            try { localStorage.setItem('rmnl_session_' + sid, JSON.stringify(sess)); } catch(e) {}
            try { sessionStorage.setItem('rmnl_active_session', sid); } catch(e) {}
            if (user && user.role) {
                try { localStorage.setItem('rmnl_role', user.role); } catch(e) {}
            }
            // persist original signup values per-user (keyed) if not already present
            try {
                if (user) {
                    var uid = user.id || user._id || user.email || null;
                    if (uid) {
                        var key = 'rmnl_user_original_' + uid;
                        if (!localStorage.getItem(key)) {
                            localStorage.setItem(key, JSON.stringify(user));
                        }
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
        var active = sessionStorage.getItem('rmnl_active_session');
        if (active) sessionStorage.removeItem('rmnl_active_session');
        // optionally remove the stored persistent session object
        if (removeStoredSession && active) {
            try { localStorage.removeItem('rmnl_session_' + active); } catch(e) {}
        }
    } catch(e) {}
}

function getActiveSessionId() {
    return sessionStorage.getItem('rmnl_active_session');
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
        return s && s.user ? s.user : null;
    } catch(e) { return null; }
}

function getUser() {
    try { return getActiveUser(); } catch(e) { return null; }
}

function setSessionUser(user, overwriteOriginal) {
    try {
        if (!user) return;
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
            var key = 'rmnl_user_original_' + uid;
            if (overwriteOriginal || !localStorage.getItem(key)) {
                try { localStorage.setItem(key, JSON.stringify(user)); } catch(e) {}
            }
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

// ---------------------------------------------------------------------------
// Generic request wrapper
// ---------------------------------------------------------------------------
async function apiRequest(method, path, body, isFormData) {
    const opts = { method, credentials: 'include' };
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
    if (res.status === 401) {
        try { clearSession(); } catch(e) {}
        console.warn('API returned 401 for', path, json);
        throw new Error(json.message || 'Invalid or expired token.');
    }
    if (!res.ok) throw new Error(json.message || 'Request failed (' + res.status + ')');
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
};

// ---------------------------------------------------------------------------
// Users API
// ---------------------------------------------------------------------------
const UserAPI = {
    getMyProfile: () =>
        apiRequest('GET', '/api/users/me'),

    updateMyProfile: (data) =>
        apiRequest('PUT', '/api/users/me', data),
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
