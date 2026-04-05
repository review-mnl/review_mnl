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

    updateMyProfile: (data) =>
        apiRequest('PUT', '/api/users/me', data),
    uploadProfilePhoto: (formData) =>
        apiRequest('PUT', '/api/users/me/photo', formData, true),
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
