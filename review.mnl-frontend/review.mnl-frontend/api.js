// review.mnl — shared API helper
// All fetch calls go through here so only one place needs updating for the base URL.

// Uses production backend URL when deployed, falls back to localhost for development
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:5000'
    : 'https://review-mnl-oguj.onrender.com';

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------
function authHeaders() {
    const token = localStorage.getItem('rmnl_token');
    return token ? { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' }
                 : { 'Content-Type': 'application/json' };
}

function saveSession(data) {
    localStorage.setItem('rmnl_token', data.token);
    localStorage.setItem('rmnl_user',  JSON.stringify(data.user));
    localStorage.setItem('rmnl_role',  data.user.role);
}

function clearSession() {
    localStorage.removeItem('rmnl_token');
    localStorage.removeItem('rmnl_user');
    localStorage.removeItem('rmnl_role');
}

function getUser() {
    try { return JSON.parse(localStorage.getItem('rmnl_user')); } catch(e) { return null; }
}

// ---------------------------------------------------------------------------
// Generic request wrapper
// ---------------------------------------------------------------------------
async function apiRequest(method, path, body, isFormData) {
    const opts = { method, credentials: 'include' };
    if (isFormData) {
        // Let browser set multipart boundary automatically — no Content-Type header
        const token = localStorage.getItem('rmnl_token');
        opts.headers = token ? { 'Authorization': 'Bearer ' + token } : {};
        opts.body = body;
    } else {
        opts.headers = authHeaders();
        if (body) opts.body = JSON.stringify(body);
    }
    const res = await fetch(API_BASE + path, opts);
    const json = await res.json().catch(() => ({}));
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

    verifyOTP: (session, otp) =>
        apiRequest('POST', '/api/auth/verify-otp', { session, otp }),
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
