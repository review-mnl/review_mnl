# Review.MNL - Frontend-Backend Integration Analysis

**Analysis Date:** April 2, 2026  
**Status:** Multiple integration issues identified requiring fixes

---

## 1. FRONTEND-BACKEND API INTEGRATION ISSUES

### 1.1 Critical API Endpoint Mismatches

#### Issue: `CentersAPI.postTestimonial()` Wrong Parameter Name
**Location:** [api.js](review_mnl/review.mnl-frontend/review.mnl-frontend/api.js#L271)
- **Frontend sends:** `{ content, rating }`
- **Backend expects:** `{ center_id, content, rating }`
- **Problem:** `center_id` is passed as URL param, but API call doesn't include it in request body when center_id is in the URL path
- **File:** [testimonialController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/testimonialController.js#L3)
- **Fix:** The API call passes centerId in URL correctly: `/api/centers/{centerId}/testimonials`, but the backend extracts it from params correctly

#### Issue: Search/Filter Response Structure Mismatch
**Location:** [search.js](review_mnl/review.mnl-frontend/review.mnl-frontend/search.js#L40-45)
- **Frontend expects:** Center object with fields `name`, `average_rating`, `description`, `category`
- **Backend returns:** `business_name`, `avg_rating`, `review_count` (no `category` field)
- **Impact:** Search results won't display correctly; fields like `center.name` are undefined
- **Backend file:** [centerController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/centerController.js#L68)

**Example frontend code expecting field mismatch:**
```javascript
div.innerHTML = '<h3>' + escHtml(center.name) + '</h3>' // expecting 'name', backend returns 'business_name'
```

#### Issue: Missing userController Routes
**Location:** [routes/users.js](review_mnl/review.mnl-backend/review.mnl-backend/routes/users.js)
- **Frontend calls:** `UserAPI.uploadProfilePhoto()` at `/api/users/me/photo`
- **Backend route variable:** Uses `profile_picture` instead of matching formData field name
- **Problem:** The upload field name mismatch could cause file not to be captured

---

### 1.2 Missing or Incomplete CRUD Endpoints

#### Missing Endpoints in Backend

| Endpoint | Frontend API | Status | Issue |
|----------|-------------|--------|-------|
| `PUT /api/centers/me/location` | Yes, called | Exists | Works correctly |
| `GET /api/admin/students` | Yes, called | Exists | Works (renamed from `getAllStudents`) |
| `DELETE /api/admin/users/:id` | Yes, called | Exists | Works correctly |
| Testimonial retrieval for center | No endpoint | ❌ Missing | Frontend needs to show testimonials on `viewcenter.html` but they're already fetched in `getCenterById` |

#### Missing Frontend Calls for Available Backend Endpoints

| Backend Endpoint | Purpose | Frontend Status |
|------------------|---------|-----------------|
| `GET /api/centers/nearby` | Nearby centers by geolocation | Only called in search.js but not used properly |
| `PUT /api/centers/me/location` | Update center location | Modal exists in editcenter.html but no save handler visible |
| `POST /api/auth/resend-verification` | Resend verification email | API method exists but no frontend form |

---

## 2. ERROR HANDLING ISSUES

### 2.1 Insufficient Error Response Handling

#### Frontend Network Error Handling
**Location:** [api.js](review_mnl/review.mnl-frontend/review.mnl-frontend/api.js#L201-212)

**Issue:** Generic error messages don't distinguish between error types
```javascript
if (!res.ok) throw new Error(json.message || 'Request failed (' + res.status + ')');
```

**Missing handlers for:**
- 400 Bad Request (validation errors) - user should see field-specific errors
- 403 Forbidden (permission denied) - different UI needed
- 404 Not Found - should redirect to 404 page
- 500 Server Error - should show retry option
- Network timeouts - no timeout handling specified

#### Example Problem in signup.html
- Form submits without specific validation feedback
- If backend returns 409 (email exists), frontend just shows generic error
- Should disable submit button and show which field caused issue

---

### 2.2 Missing Error State UI

**Location:** [viewcenter.html](review_mnl/review.mnl-frontend/review.mnl-frontend/viewcenter.html#L160)
```javascript
try{ ... }catch(e){}  // Swallows errors silently
```

**Impact:** When API calls fail:
1. User sees blank/default values, not knowing why
2. No retry mechanism
3. No error logging for debugging

---

### 2.3 Unhandled Promise Rejections

**Example locations:**
- [login.html](review_mnl/review.mnl-frontend/review.mnl-frontend/login.html) - No `.catch()` after API calls
- [admindashboard.html](review_mnl/review.mnl-frontend/review.mnl-frontend/admindashboard.html) - Missing error handling for testimonial/student fetches

---

## 3. AUTHENTICATION ISSUES

### 3.1 JWT Token Handling - WORKS CORRECTLY ✓
- Token storage: sessionStorage + localStorage (good redundancy)
- Token extraction: `getActiveToken()` checks session properly
- Authorization header: Correctly adds `Bearer` token
- Session management: `saveSession()` and `clearSession()` implemented

### 3.2 OAuth/Google Login Issues

#### Issue: Redirect URL Encoding Problem
**Location:** [auth.js routes](review_mnl/review.mnl-backend/review.mnl-backend/routes/auth.js#L44)

```javascript
const userData = encodeURIComponent(JSON.stringify({...}));
res.redirect(`${process.env.CLIENT_URL}/loggedin.html?token=${token}&user=${userData}`);
```

**Problem:** Large user objects might exceed URL length limits
**Impact:** OAuth login fails silently if redirect URL > 2000 chars

**Fix:** Store in sessionStorage on backend, pass session ID instead

#### Issue: Google OAuth Profile Picture Not Returned
**Location:** [passport.js](review_mnl/review.mnl-backend/review.mnl-backend/config/passport.js#L37)

**Current code:**
```javascript
profile_picture_url: req.user.profile_picture_url || null
```

**Problem:** Google OAuth doesn't automatically populate `profile_picture_url`  
**Fix:** Should use `profile.photos[0].value` from Google profile

---

### 3.3 Role-Based Access Control Issues

#### Issue: Admin Dashboard Not Protected for Center Users
**Location:** [admindashboard.html](review_mnl/review.mnl-frontend/review.mnl-frontend/admindashboard.html)

**Problem:** No frontend check for admin role before loading page
**Current:** Uses `isAuthenticated()` only
**Should:** Check `getActiveRole() === 'admin' || 'superadmin'`

**Same issue in:**
- [managestudents.html](review_mnl/review.mnl-frontend/review.mnl-frontend/managestudents.html)
- [superadmin.html](review_mnl/review.mnl-frontend/review.mnl-frontend/superadmin.html)

---

## 4. CRUD OPERATIONS ANALYSIS

### 4.1 Create Operations

#### Student Registration - COMPLETE ✓
- Endpoint: `POST /api/auth/register/student`
- Frontend: [signup.html](review_mnl/review.mnl-frontend/review.mnl-frontend/signup.html)
- Validation: Basic (name, email, password check frontend)
- Response handling: No visible `.catch()` for error states

#### Center Registration - COMPLETE ✓
- Endpoint: `POST /api/auth/register/center`
- File uploads: Cloudinary integration working
- Backend validation: Checks both documents present
- Frontend: No progress indicator during file upload

#### Testimonial Creation - COMPLETE ✓
- Endpoint: `POST /api/centers/:id/testimonials`
- Protection: Requires authentication
- Response: `{ message, ... }`
- Issue: No success feedback shown to user (no modal close/redirect)

---

### 4.2 Read Operations

#### Issues Found:

1. **GET /api/centers/me** - ISSUE with response structure
   - Frontend expects: `{ id, business_name, email, logo_url, ... }`
   - Backend returns: Includes `programs` and `achievements` as JSON strings
   - Frontend doesn't parse: Tries to use as arrays directly
   - **File:** [centerController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/centerController.js#L131-162) returns parsed, but `updateCenterProfile` needs verification

2. **GET /api/centers/:id** - MISSING DATA
   - Returns: `business_name, address, logo_url` but NO `description` field
   - Frontend expects: `description` for about section
   - **Fix needed:** Include `description` in SELECT clause

3. **GET /api/admin/testimonials/pending** - Response structure unclear
   - Backend returns: `t.id, t.content, t.rating, t.created_at, u.first_name, u.last_name, rc.business_name`
   - No center_id returned, so admin can't link back to center

---

### 4.3 Update Operations

#### Profile Edit Issues (KNOWN PROBLEM)
**Location:** [editcenter.html](review_mnl/review.mnl-frontend/review.mnl-frontend/editcenter.html)

**Problem:** Profile updates don't persist
- Backend endpoint works: `PUT /api/centers/me`
- But frontend save handlers not visible in provided code
- Missing modals save implementation

**Affected fields:**
- Center name/business name
- Location/address
- About/description
- Programs offered
- Achievements
- Operating schedule

#### User Profile Update - COMPLETE ✓
- Endpoint: `PUT /api/users/me`
- Includes password change with current password verification
- File upload for photo: `PUT /api/users/me/photo`

#### Center Logo Upload - Works but missing feedback
- Endpoint: `PUT /api/centers/me/logo`
- Multer/Cloudinary integration: Correct
- Issue: No loading state during upload
- Issue: No error handling if upload fails

---

### 4.4 Delete Operations

#### Issues:
1. **DELETE /api/admin/users/:id** - Works but needs confirmation
   - Frontend: No confirmation dialog before delete
   - Should show warning that testimonials will be deleted (CASCADE)

2. **DELETE /api/admin/centers/:id** - Works but cascades
   - Deletes: review_centers + associated users account
   - Frontend: Should warn admin
   - Risk: User account deleted, student testimonials orphaned (but center already cascade deletes them)

3. **DELETE /api/admin/testimonials/:id** - Works ✓

---

## 5. DATA VALIDATION ISSUES

### 5.1 Backend Validation Issues

#### Missing or Incomplete Validation

| Endpoint | Missing Validation | Issue |
|----------|-------------------|-------|
| `POST /api/auth/register/student` | Password strength, email format | Backend doesn't validate password >= 8 chars, email format |
| `POST /api/auth/register/center` | Business name length, email format | No length limits |
| `PUT /api/centers/me` | Field length limits | Can insert unlimited-length strings |
| `POST /api/centers/:id/testimonials` | Rating range (should be 1-5) | Schema has CHECK but no explicit validation |
| `PUT /api/centers/me/logo` | File size validation | Multer limits 5MB but no DB validation |

#### SQL Injection Risks - NONE FOUND ✓
- All queries use parameterized statements
- No string concatenation in WHERE clauses

---

### 5.2 Frontend Validation Issues

#### Missing Input Validation

**Location:** [signup.html](review_mnl/review.mnl-frontend/review.mnl-frontend/signup.html)

**Missing validation for:**
1. Password strength (no length check)
2. Email format verification
3. Name length limits
4. File size before upload

**Location:** Center registration form
- No validation that both documents are PDF/JPG/PNG
- No file size preview
- No duplicate center name check

**Location:** [login.html](review_mnl/review.mnl-frontend/review.mnl-frontend/login.html)

**Current state:** Form has `required` attribute but no regex validation

---

### 5.3 Data Type Mismatches

#### Schema Issue: Testimonial Rating
**Schema:** `rating TINYINT CHECK (rating BETWEEN 1 AND 5)`  
**Frontend:** Sends rating, but no frontend validation it's 1-5  
**Risk:** Backend rejects, user sees generic error

---

## 6. SPECIFIC FUNCTIONALITY ISSUES

### 6.1 Search and Filter Functionality

#### Issue: Response Field Name Mismatch
**Location:** [search.js](review_mnl/review.mnl-frontend/review.mnl-frontend/search.js#L51)

```javascript
// Frontend expects:
div.setAttribute('data-rating', Math.round(center.average_rating || 0));

// Backend returns:
{ ..., avg_rating, review_count } // from centerController.getApprovedCenters
```

**Missing field conversion in frontend:**
- Line 51: `center.average_rating` should be `center.avg_rating`
- Line 52: `center.name` should be `center.business_name`
- Line 52: `center.description` doesn't exist in response (only address returned)

#### Issue: Search Query Field Mismatch
**Line 63:** Searches on `name`, `location`, `desc` but backend only returns `business_name`, `address`

**Fix needed:** Update search.js to map properly:
```javascript
const name = center.business_name || '';
const location = center.address || '';
```

---

### 6.2 Profile Edit Persistence

#### Issue: Edit Center Profile Form Not Saving
**Location:** [editcenter.html](review_mnl/review.mnl-frontend/review.mnl-frontend/editcenter.html#L250)

**Modal exists with inputs:** `centerNameInput`, `centerLocationInput`, `centerImageInput`

**Missing implementation:**
- `saveProfile()` function not defined
- `saveAbout()` function not defined
- `savePrograms()` function not defined
- `saveSchedule()` function not defined
- `saveAchievements()` function not defined

**These modals have save buttons but handlers are missing:**
- profileModal → saveProfile()
- aboutModal → saveAbout()
- programsModal → savePrograms()
- achievementsModal → saveAchievements()
- scheduleModal → saveSchedule()

---

### 6.3 Login/Logout Flow

#### Login Flow - WORKS ✓
1. User submits email/password
2. Backend validates, returns token + user
3. Frontend saves to localStorage
4. Redirect to dashboard

#### Logout Flow - WORKS ✓
- Calls `clearSession()`
- Removes token and session ID from storage
- Redirects to login

#### Issue: Session Expiry Not Handled
- Token expires after 7 days (JWT_EXPIRES_IN)
- Frontend doesn't check expiry before API calls
- User makes request with expired token → 401 response
- Frontend clears session, but should show "Session expired, please login again"

---

### 6.4 Testimonial Submission and Approval

#### Submission - WORKS ✓
- User posts testimonial
- Backend requires authentication
- Testimonial set to `is_approved = 0`
- User sees: "Testimonial submitted! It will appear after admin review."

#### Approval - WORKS ✓
- Admin API: `PUT /api/admin/testimonials/:id/approve`
- Backend updates `is_approved = 1`
- Testimonial now visible in center details

#### Issues:
1. **No feedback after approval** - Admin doesn't see confirmation
2. **No bulk approval** - Can't approve multiple testimonials at once
3. **No rejection flow** - Can only delete, not reject with reason
4. **No user notification** - Student doesn't know when their testimonial was approved

---

### 6.5 Admin Dashboard Functions

#### Issues Found:

1. **Stats Endpoint Missing**
   - Dashboard shows: "Total Students Enrolled" with ID `statStudents`
   - Expected endpoint: Something like `GET /api/admin/stats` or count within `getStudents`
   - Backend: No dedicated stats endpoint (should query student count)
   - Fix: `AdminAPI.getStudents()` returns all students, frontend counts, but should be server-side

2. **Pending Centers Count**
   - Button exists but endpoint structure unclear
   - Backend: `GET /api/admin/centers/pending` returns all pending centers
   - Frontend should count: `AdminAPI.getPendingCenters().length`

3. **Message System Not Implemented**
   - Frontend shows message thread UI
   - Backend: No message/conversation endpoints exist
   - Risk: Entire messaging feature is broken

---

### 6.6 File Upload Handling

#### Currently Working ✓
- Cloudinary integration configured correctly
- File filter: Only JPG, PNG, PDF allowed
- File size limit: 5MB
- Fields: `logo`, `profile_picture`, `business_permit`, `dti_sec_reg`

#### Issues:
1. **No progress indicator** - Large file uploads show no progress
2. **No file validation UI** - User doesn't see file size validation before upload
3. **Upload field name mismatch:**
   - Form sends: `profile_picture` 
   - Backend expects: `profile_picture` (actually matches, but variable name in controller is unclear)
   - Location: [userController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/userController.js#L80) uses `req.file`

---

## 7. AUTHENTICATION TOKEN FLOW ANALYSIS

### 7.1 Token Generation

**Backend:** [authController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/authController.js#L141)
```javascript
const token = jwt.sign(
  { id: user.id, role: user.role, email: user.email },
  process.env.JWT_SECRET,
  { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);
```

**Good practices:**
- Includes user ID, role, email
- 7-day expiration
- Uses environment variable for secret

**Issue:** Payload doesn't include user's name/profile_picture_url, so frontend must fetch profile separately

---

### 7.2 Token Verification

**Frontend:** [api.js](review_mnl/review.mnl-frontend/review.mnl-frontend/api.js#L115-128)
```javascript
function getActiveToken() {
    try {
        var sid = getActiveSessionId();
        if (!sid) return null;
        var s = JSON.parse(localStorage.getItem('rmnl_session_' + sid) || 'null');
        return s && s.token ? s.token : null;
    } catch(e) { return null; }
}
```

**Issue:** Doesn't verify expiry time locally, just sends and waits for 401

---

## 8. RESPONSE FIELD MAPPING ISSUES

### Field Name Mismatches Summary

| API | Frontend Expects | Backend Returns | Status |
|-----|-----------------|-----------------|--------|
| Search Results | `center.name` | `business_name` | ❌ Mismatch |
| Search Results | `center.average_rating` | `avg_rating` | ❌ Mismatch |
| Search Results | `center.description` | (not included) | ❌ Missing |
| Center Details | `description` | `description` | ✓ Match |
| Center Profile | `center.programs` (array) | `programs` (JSON string) | ⚠️ Needs parsing |
| Center Profile | `center.achievements` (array) | `achievements` (JSON string) | ⚠️ Needs parsing |
| Testimonials | `t.created_at` | `created_at` | ✓ Match |

---

## 9. CRITICAL BUGS SUMMARY

### P0 - Critical (Breaks Functionality)
1. **Search results don't display** - Field name mismatches in search.js
2. **Profile edit modals don't save** - Save handlers missing
3. **Message system completely broken** - No backend endpoints
4. **Admin stats don't load properly** - Missing stat endpoints

### P1 - High (Impacts User Experience)
1. **OAuth URL might exceed length limits** - Redirect fails on large user objects
2. **Session expiry not handled** - User gets errors without clear message
3. **No error handling for network failures** - Silent failures
4. **File upload no progress** - No feedback during upload

### P2 - Medium (Needs Fixing)
1. **Field validation insufficient** - Password strength not checked
2. **Admin role not checked frontend** - Center owner could access admin dashboard
3. **Testimonial rejection not implemented** - Only delete, no "rejected" reason
4. **Google OAuth profile picture missing** - Not pulled from Google profile

---

## 10. DATABASE SCHEMA COMPATIBILITY

### Schema Issues

**Issue 1:** No `description` field in some operations
- `getCenterById()` doesn't return description
- But schema has it in `review_centers` table
- Line in [centerController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/centerController.js#L14) missing `rc.description`

**Issue 2:** Programs and Achievements stored as JSON
- Schema: `programs JSON, achievements JSON`
- Controller parses them, but frontend might receive as strings
- Lines [143-148](review_mnl/review.mnl-backend/review.mnl-backend/controllers/centerController.js#L143-148) correctly handle parsing

**Issue 3:** Category field doesn't exist
- Frontend search expects `category` field
- Schema has no category column
- Would need migration to add

---

## QUICK FIX CHECKLIST

- [ ] Fix search.js field mappings (name → business_name, average_rating → avg_rating)
- [ ] Implement missing modal save functions in editcenter.html
- [ ] Add description field to getCenterById query
- [ ] Implement admin role check on frontend dashboard pages
- [ ] Add error toast notifications for failed API calls
- [ ] Handle 401 with "Session expired" message
- [ ] Fix Google OAuth redirect URL length issue
- [ ] Add password validation (min 8 chars, mix of letters/numbers)
- [ ] Implement message system backend (or remove from UI)
- [ ] Add admin statistics endpoint or frontend calculation
- [ ] Parse programs/achievements JSON in frontend
- [ ] Add testimonial rejection flow (not just delete)

---

## FILES REQUIRING CHANGES

### Frontend (HTML/JS)
- [search.js](review_mnl/review.mnl-frontend/review.mnl-frontend/search.js) - Field name fixes
- [editcenter.html](review_mnl/review.mnl-frontend/review.mnl-frontend/editcenter.html) - Add save handlers
- [signup.html](review_mnl/review.mnl-frontend/review.mnl-frontend/signup.html) - Add validation UI
- [api.js](review_mnl/review.mnl-frontend/review.mnl-frontend/api.js) - Better error handling
- [admindashboard.html](review_mnl/review.mnl-frontend/review.mnl-frontend/admindashboard.html) - Role check + stats
- [login.html](review_mnl/review.mnl-frontend/review.mnl-frontend/login.html) - Error handling
- [viewcenter.html](review_mnl/review.mnl-frontend/review.mnl-frontend/viewcenter.html) - Error state handling

### Backend (Node.js)
- [centerController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/centerController.js) - Add description to queries
- [authController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/authController.js) - Add validation
- [passport.js](review_mnl/review.mnl-backend/review.mnl-backend/config/passport.js) - Fix Google profile picture
- [testimonialController.js](review_mnl/review.mnl-backend/review.mnl-backend/controllers/testimonialController.js) - Add rejection flow
- [routes/admin.js](review_mnl/review.mnl-backend/review.mnl-backend/routes/admin.js) - Add stats endpoint (optional)

---

## NOTES FOR DEVELOPER

1. **Session Storage Strategy:** Uses sessionStorage for active session ID + localStorage for session data. Good for multi-tab support.

2. **JWT Expiry:** Currently client doesn't check, just waits for 401. Should add client-side check or refresh token endpoint.

3. **Role Management:** Roles are: `student`, `review_center`, `admin`, `superadmin`. Frontend should enforce based on `req.user.role`.

4. **File Upload:** Cloudinary integration working well, no need to change. Just add frontend feedback.

5. **CORS:** Configured to allow multiple origins including vercel.app domains. Good for deployment.

