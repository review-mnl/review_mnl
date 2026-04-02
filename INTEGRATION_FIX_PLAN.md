# Review.MNL - Integration Fix Priority Plan

**Created:** April 2, 2026  
**Priority Levels:** P0 (Critical), P1 (High), P2 (Medium)

---

## PHASE 1: CRITICAL FIXES (Must do first)

### Fix #1: Search Results Field Mapping (P0)
**Impact:** Search results completely broken - no centers display  
**Time:** 15 minutes  
**Files:** `search.js`

**Problem:** Frontend uses wrong field names when rendering search results.

**Current Code (BROKEN):**
```javascript
// search.js lines 51-53
div.setAttribute('data-rating', Math.round(center.average_rating || 0));  // WRONG
div.innerHTML = '<h3>' + escHtml(center.name) + '</h3>' +  // WRONG - should be business_name
                '<p class="result-location">' + escHtml(center.address || '') + '</p>' +
                '<p class="result-description">' + escHtml(center.description || '') + '</p>' +  // WRONG - address, not description
                '<div class="result-rating">' + starString(center.average_rating) +  // WRONG
```

**Backend actually returns:**
```
{ id, business_name, address, latitude, longitude, logo_url, avg_rating, review_count }
```

**Fix:** In [search.js](review_mnl/review.mnl-frontend/review.mnl-frontend/search.js), change line 51-53:

```javascript
// BEFORE:
div.setAttribute('data-rating', Math.round(center.average_rating || 0));

// AFTER:
div.setAttribute('data-rating', Math.round(center.avg_rating || 0));

// AND change line ~52:
// BEFORE:
div.innerHTML =
    '<div class="result-image"></div>' +
    '<div class="result-content">' +
        '<h3>' + escHtml(center.name) + '</h3>' +
        '<p class="result-location">' + escHtml(center.address || '') + '</p>' +
        '<p class="result-description">' + escHtml(center.description || '') + '</p>' +
        '<div class="result-rating">' + starString(center.average_rating) +
            ' <span style="font-size:0.8em;color:#555;">' +
            (center.average_rating ? Number(center.average_rating).toFixed(1) : 'No ratings') +
            '</span>' +
        '</div>' +
    '</div>';

// AFTER:
div.innerHTML =
    '<div class="result-image"></div>' +
    '<div class="result-content">' +
        '<h3>' + escHtml(center.business_name) + '</h3>' +
        '<p class="result-location">' + escHtml(center.address || '') + '</p>' +
        '<p class="result-description">' + escHtml(center.address || '') + '</p>' +
        '<div class="result-rating">' + starString(center.avg_rating) +
            ' <span style="font-size:0.8em;color:#555;">' +
            (center.avg_rating ? Number(center.avg_rating).toFixed(1) : 'No ratings') +
            '</span>' +
        '</div>' +
    '</div>';
```

Also fix the filter matching logic (line ~63):
```javascript
// BEFORE (WRONG):
const name = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').toLowerCase();

// AFTER (works because h3 will have business_name):
const name = (card.querySelector('h3') ? card.querySelector('h3').textContent : '').toLowerCase();
// No change needed here - it's selecting the rendered h3 text
```

**Verification:**
1. Go to search.html
2. Search for a center
3. Results should display center names, addresses, and ratings correctly

---

### Fix #2: Center Profile Edit Save Handlers Missing (P0)
**Impact:** Center owners cannot save any profile edits  
**Time:** 45 minutes  
**Files:** `editcenter.html`

**Problem:** Modals exist with forms and save buttons, but no JavaScript functions implement the saves.

**Missing functions needed:**
- `saveProfile()` - Save center name, email, location, logo
- `saveAbout()` - Save description
- `savePrograms()` - Save programs offered
- `saveAchievements()` - Save achievements
- `saveSchedule()` - Save operating hours
- `openModal()` / `closeModal()` - Modal open/close (might exist, check)

**Add to editcenter.html before closing `</body>` tag:**

```javascript
<script>
// ================================================================================
// Modal Functions
// ================================================================================

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'block';
        loadModalData(modalId); // Pre-populate with current data
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Close modal when overlay is clicked
document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', function(e) {
            if (e.target === overlay) {
                overlay.style.display = 'none';
            }
        });
    });
});

// ================================================================================
// Load Modal Data (pre-populate forms)
// ================================================================================

async function loadModalData(modalId) {
    try {
        const center = await CentersAPI.getMyProfile();
        if (!center) return;

        if (modalId === 'profileModal') {
            document.getElementById('centerNameInput').value = center.business_name || '';
            document.getElementById('centerLocationInput').value = center.address || '';
            // Logo preview
            if (center.logo_url) {
                const preview = document.getElementById('modalImgPreview');
                preview.style.backgroundImage = 'url(' + center.logo_url + ')';
                preview.style.backgroundSize = 'cover';
                preview.style.backgroundPosition = 'center';
            }
        } else if (modalId === 'aboutModal') {
            document.getElementById('aboutInput').value = center.description || '';
        } else if (modalId === 'programsModal') {
            loadProgramsModal(center.programs);
        } else if (modalId === 'achievementsModal') {
            loadAchievementsModal(center.achievements);
        } else if (modalId === 'scheduleModal') {
            loadScheduleModal(center.schedule || {});
        }
    } catch(err) {
        console.error('Failed to load modal data:', err);
    }
}

// ================================================================================
// Save Profile (Center Name, Location, Logo)
// ================================================================================

async function saveProfile() {
    try {
        const centerName = document.getElementById('centerNameInput').value.trim();
        const centerLocation = document.getElementById('centerLocationInput').value.trim();
        const fileInput = document.getElementById('centerImageInput');

        if (!centerName) {
            alert('Please enter a center name.');
            return;
        }

        // Show loading state
        const btn = document.querySelector('#profileModal .modal-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            // Update profile data
            const updateData = {
                business_name: centerName,
                address: centerLocation
            };

            const response = await CentersAPI.updateMyProfile(updateData);

            // Upload logo if a new file was selected
            if (fileInput && fileInput.files.length > 0) {
                const formData = new FormData();
                formData.append('logo', fileInput.files[0]);
                await CentersAPI.uploadLogo(formData);
            }

            // Update display
            document.getElementById('centerNameDisplay').textContent = centerName;
            document.getElementById('centerDescDisplay').textContent = centerLocation;

            alert('Profile updated successfully!');
            closeModal('profileModal');

            // Refresh the page data
            location.reload();
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Save profile error:', err);
        alert('Error saving profile: ' + (err.message || 'Unknown error'));
    }
}

// ================================================================================
// Save About
// ================================================================================

async function saveAbout() {
    try {
        const aboutText = document.getElementById('aboutInput').value.trim();

        const btn = document.querySelector('#aboutModal .modal-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await CentersAPI.updateMyProfile({ description: aboutText });

            document.getElementById('aboutDisplay').textContent = aboutText;
            alert('About updated successfully!');
            closeModal('aboutModal');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Save about error:', err);
        alert('Error saving about: ' + (err.message || 'Unknown error'));
    }
}

// ================================================================================
// Save Programs
// ================================================================================

async function savePrograms() {
    try {
        // Get checked programs
        const checkboxes = document.querySelectorAll('#programsModal .program-check-item input[type="checkbox"]');
        const selectedPrograms = Array.from(checkboxes)
            .filter(cb => cb.checked)
            .map(cb => cb.value);

        // Add custom program if entered
        const othersCheckbox = document.getElementById('othersCheckbox');
        const othersInput = document.getElementById('othersInput');
        if (othersCheckbox && othersCheckbox.checked && othersInput && othersInput.value.trim()) {
            selectedPrograms.push(othersInput.value.trim());
        }

        const btn = document.querySelector('#programsModal .modal-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await CentersAPI.updateMyProfile({ programs: selectedPrograms });

            // Update display
            const programTags = document.getElementById('programTagsDisplay');
            programTags.innerHTML = '';
            selectedPrograms.forEach(prog => {
                const btn = document.createElement('button');
                btn.className = 'program-tag';
                btn.textContent = prog;
                programTags.appendChild(btn);
            });

            alert('Programs updated successfully!');
            closeModal('programsModal');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Save programs error:', err);
        alert('Error saving programs: ' + (err.message || 'Unknown error'));
    }
}

function loadProgramsModal(programsData) {
    try {
        const programs = Array.isArray(programsData) ? programsData : 
                        (typeof programsData === 'string' ? JSON.parse(programsData) : []);
        
        const checkboxes = document.querySelectorAll('#programsModal .program-check-item input[type="checkbox"]');
        checkboxes.forEach(cb => {
            cb.checked = programs.includes(cb.value);
        });

        // Check if any custom program exists
        const known = ['Civil Engineering', 'Architecture', 'Nursing', 'Accountancy', 'Medical Technology',
                      'Education', 'Electrical Engineering', 'Mechanical Engineering', 'Electronics Engineering',
                      'Chemical Engineering', 'Geodetic Engineering', 'Dentistry', 'Pharmacy', 'Physical Therapy', 'Law'];
        
        const custom = programs.filter(p => !known.includes(p));
        if (custom.length > 0) {
            document.getElementById('othersCheckbox').checked = true;
            document.getElementById('othersInput').value = custom[0];
            document.getElementById('othersInput').disabled = false;
        }
    } catch(err) {
        console.error('Load programs modal error:', err);
    }
}

function toggleOthersInput(checkbox) {
    document.getElementById('othersInput').disabled = !checkbox.checked;
    if (checkbox.checked) document.getElementById('othersInput').focus();
}

// ================================================================================
// Save Achievements
// ================================================================================

async function saveAchievements() {
    try {
        // Collect achievement items
        const achievementItems = document.querySelectorAll('#achievementsModal .achievement-input');
        const achievements = Array.from(achievementItems)
            .map(item => item.value.trim())
            .filter(item => item.length > 0);

        const btn = document.querySelector('#achievementsModal .modal-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await CentersAPI.updateMyProfile({ achievements: achievements });

            // Update display
            const achList = document.getElementById('achievementListDisplay');
            achList.innerHTML = '';
            achievements.forEach(ach => {
                const div = document.createElement('div');
                div.className = 'achievement-item';
                div.innerHTML = '<span class="trophy-icon">🏆</span><p>' + escapeHtml(ach) + '</p>';
                achList.appendChild(div);
            });

            alert('Achievements updated successfully!');
            closeModal('achievementsModal');
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Save achievements error:', err);
        alert('Error saving achievements: ' + (err.message || 'Unknown error'));
    }
}

function loadAchievementsModal(achievementsData) {
    try {
        const achievements = Array.isArray(achievementsData) ? achievementsData :
                            (typeof achievementsData === 'string' ? JSON.parse(achievementsData) : []);
        
        let achContainer = document.getElementById('achievementsInputContainer');
        if (!achContainer) {
            // Create container if it doesn't exist
            achContainer = document.createElement('div');
            achContainer.id = 'achievementsInputContainer';
            achContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
            document.querySelector('#achievementsModal .modal-body').appendChild(achContainer);
        }

        achContainer.innerHTML = '';
        achievements.forEach(ach => {
            const input = document.createElement('input');
            input.type = 'text';
            input.className = 'achievement-input';
            input.value = ach;
            input.placeholder = 'Enter achievement...';
            input.style.cssText = 'padding:10px;border:1.5px solid #ddd;border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;';
            achContainer.appendChild(input);
        });

        // Add blank input for new achievement
        const newInput = document.createElement('input');
        newInput.type = 'text';
        newInput.className = 'achievement-input';
        newInput.placeholder = 'Add a new achievement...';
        newInput.style.cssText = 'padding:10px;border:1.5px solid #ddd;border-radius:8px;font-family:Poppins,sans-serif;font-size:13px;';
        achContainer.appendChild(newInput);
    } catch(err) {
        console.error('Load achievements modal error:', err);
    }
}

// ================================================================================
// Save Schedule
// ================================================================================

async function saveSchedule() {
    try {
        // Collect schedule data
        const scheduleRows = document.querySelectorAll('#scheduleInputRows .schedule-row');
        const schedule = {};
        
        scheduleRows.forEach(row => {
            const day = row.dataset.day || '';
            const openCheckbox = row.querySelector('.schedule-open-check');
            const openInput = row.querySelector('.schedule-open-time');
            const closeInput = row.querySelector('.schedule-close-time');

            if (openCheckbox && openCheckbox.checked) {
                schedule[day] = {
                    open: openInput ? openInput.value : '09:00',
                    close: closeInput ? closeInput.value : '17:00'
                };
            }
        });

        const btn = document.querySelector('#scheduleModal .modal-save-btn');
        const originalText = btn.textContent;
        btn.textContent = 'Saving...';
        btn.disabled = true;

        try {
            await CentersAPI.updateMyProfile({ schedule: schedule });
            alert('Schedule updated successfully!');
            closeModal('scheduleModal');
            location.reload(); // Refresh to show updated calendar
        } finally {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    } catch(err) {
        console.error('Save schedule error:', err);
        alert('Error saving schedule: ' + (err.message || 'Unknown error'));
    }
}

function loadScheduleModal(scheduleData) {
    try {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        const container = document.getElementById('scheduleInputRows');
        
        if (!container) return;
        
        container.innerHTML = '';

        days.forEach(day => {
            const dayData = scheduleData[day] || {};
            const isOpen = Object.keys(dayData).length > 0;

            const row = document.createElement('div');
            row.className = 'schedule-row';
            row.dataset.day = day;
            row.style.cssText = 'display:flex;gap:12px;align-items:flex-end;';

            row.innerHTML = `
                <label style="flex:0;display:flex;align-items:center;gap:6px;">
                    <input type="checkbox" class="schedule-open-check" ${isOpen ? 'checked' : ''}>
                    <span style="min-width:80px;font-size:13px;">${day}</span>
                </label>
                <div style="flex:1;display:flex;gap:8px;align-items:center;">
                    <input type="time" class="schedule-open-time" value="${dayData.open || '09:00'}" 
                           style="padding:6px;border:1.5px solid #ddd;border-radius:6px;font-family:Poppins,sans-serif;" ${isOpen ? '' : 'disabled'}>
                    <span style="color:#999;">to</span>
                    <input type="time" class="schedule-close-time" value="${dayData.close || '17:00'}" 
                           style="padding:6px;border:1.5px solid #ddd;border-radius:6px;font-family:Poppins,sans-serif;" ${isOpen ? '' : 'disabled'}>
                </div>
            `;

            const checkbox = row.querySelector('.schedule-open-check');
            const openTime = row.querySelector('.schedule-open-time');
            const closeTime = row.querySelector('.schedule-close-time');

            checkbox.addEventListener('change', function() {
                openTime.disabled = !this.checked;
                closeTime.disabled = !this.checked;
            });

            container.appendChild(row);
        });
    } catch(err) {
        console.error('Load schedule modal error:', err);
    }
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

</script>
```

**Verification:**
1. Go to editcenter.html (logged in as center)
2. Click "Edit Profile" button
3. Change center name and save
4. Verify name is updated both in database and on page

---

### Fix #3: Add Description to Center Details Query (P0)
**Impact:** Center descriptions don't display in view  
**Time:** 5 minutes  
**Files:** `centerController.js`

**Problem:** `getCenterById()` doesn't return description field.

**Current Code (Line ~14 in centerController.js):**
```javascript
const [center] = await db.query(
    `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.latitude, rc.longitude, rc.logo_url,
            IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
     FROM review_centers rc
     LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
     WHERE rc.id = ? AND rc.status = 'approved' GROUP BY rc.id`, [id]
);
```

**Fix:**
```javascript
const [center] = await db.query(
    `SELECT rc.id, rc.business_name, rc.email, rc.address, rc.latitude, rc.longitude, rc.logo_url, rc.description,
            IFNULL(AVG(t.rating), 0) AS avg_rating, COUNT(t.id) AS review_count
     FROM review_centers rc
     LEFT JOIN testimonials t ON t.center_id = rc.id AND t.is_approved = 1
     WHERE rc.id = ? AND rc.status = 'approved' GROUP BY rc.id`, [id]
);
```

**Note:** Also check other queries in the same file that might be missing description (e.g., `getApprovedCenters()`, `getMyCenterProfile()`). Database queries should be consistent.

---

### Fix #4: Message System Not Implemented (P0)
**Impact:** Message feature completely broken  
**Time:** 60 minutes (or remove UI if not needed)  
**Decision needed:** Keep or remove?

**Current State:**
- Frontend UI exists in [userdashboard.html](review_mnl/review.mnl-frontend/review.mnl-frontend/userdashboard.html) and [admindashboard.html](review_mnl/review.mnl-backend/review.mnl-backend/routes/admin.js) (doesn't exist in routes)
- No backend endpoints
- No database table for messages

**Option A: Remove the UI temporarily**
```html
<!-- In dashboard files, hide the sidebar with CSS -->
<style>
  .sidebar { display: none !important; }
  .sidebar-overlay { display: none !important; }
  .dashboard-toggle { display: none !important; }
</style>
```

**Option B: Implement Basic Message System (recommended for later)**
- Create `messages` table in schema.sql
- Create `messageController.js`
- Add routes in `/api/messages/`
- Implement message list and send endpoints
- Add WebSocket for real-time (optional)

**For now:** Use Option A to hide it from UI.

---

## PHASE 2: HIGH PRIORITY FIXES (Do next)

### Fix #5: Frontend Admin Role Verification (P1)
**Impact:** Any authenticated user can access admin pages  
**Time:** 10 minutes  
**Files:** `admindashboard.html`, `managestudents.html`, `superadmin.html`

**Add to each page immediately after `<body>` tag:**

```javascript
<script>
    // Check auth and role before loading page
    (function() {
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        const role = getActiveRole();
        const isAdmin = role === 'admin' || role === 'superadmin';
        
        if (!isAdmin) {
            alert('Access denied. Admin access required.');
            window.location.href = 'loggedin.html';
        }
    })();
</script>
```

**For superadmin.html specifically:**
```javascript
<script>
    (function() {
        if (!isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        const role = getActiveRole();
        if (role !== 'superadmin') {
            alert('Access denied. Superadmin access required.');
            window.location.href = 'loggedin.html';
        }
    })();
</script>
```

---

### Fix #6: Session Expiry Handling (P1)
**Impact:** Users get confusing errors when session expires  
**Time:** 15 minutes  
**Files:** `api.js`

**Current Code (Line ~205 in api.js):**
```javascript
if (res.status === 401) {
    try { clearSession(); } catch(e) {}
    console.warn('API returned 401 for', path, json);
    throw new Error(json.message || 'Invalid or expired token.');
}
```

**Fix:**
```javascript
if (res.status === 401) {
    try { clearSession(); } catch(e) {}
    console.warn('API returned 401 for', path, json);
    
    // Check if it's actually a timeout/expiry vs permission issue
    const message = json.message || 'Unauthorized';
    const isExpiry = message.includes('expired') || message.includes('Invalid') || 
                     message.includes('No token');
    
    // Show user-friendly message
    if (isExpiry) {
        const errorDiv = document.getElementById('apiErrorNotification') || createErrorNotification();
        errorDiv.textContent = 'Your session has expired. Please log in again.';
        errorDiv.style.display = 'block';
        
        // Redirect after 2 seconds
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
    }
    
    throw new Error(message);
}

function createErrorNotification() {
    const div = document.createElement('div');
    div.id = 'apiErrorNotification';
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #d32f2f;
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        z-index: 9999;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        font-family: Poppins, sans-serif;
        font-size: 14px;
    `;
    document.body.appendChild(div);
    return div;
}
```

---

### Fix #7: Input Validation for Signup/Login (P1)
**Impact:** Invalid data accepted, backend rejects confusingly  
**Time:** 20 minutes  
**Files:** `signup.html`, `login.html`

**In signup.html, add validation before form submit:**

```javascript
<script>
function validateStudentSignup() {
    const name = document.getElementById('fullnameInput')?.value.trim() || '';
    const email = document.getElementById('emailInput')?.value.trim() || '';
    const password = document.getElementById('passwordInput')?.value || '';
    const confirmPass = document.getElementById('confirmPassInput')?.value || '';

    // Name validation
    if (name.length < 2) {
        alert('Please enter your full name (at least 2 characters).');
        return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return false;
    }

    // Password validation
    if (password.length < 8) {
        alert('Password must be at least 8 characters long.');
        return false;
    }

    if (!/[A-Z]/.test(password)) {
        alert('Password must contain at least one uppercase letter.');
        return false;
    }

    if (!/[0-9]/.test(password)) {
        alert('Password must contain at least one number.');
        return false;
    }

    if (password !== confirmPass) {
        alert('Passwords do not match.');
        return false;
    }

    return true;
}

function validateCenterSignup() {
    const businessName = document.getElementById('businessNameInput')?.value.trim() || '';
    const email = document.getElementById('centerEmailInput')?.value.trim() || '';
    const password = document.getElementById('centerPasswordInput')?.value || '';
    const permit = document.getElementById('permitInput')?.files[0];
    const dti = document.getElementById('dtiInput')?.files[0];

    if (businessName.length < 3) {
        alert('Business name must be at least 3 characters.');
        return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('Please enter a valid email address.');
        return false;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters.');
        return false;
    }

    if (!permit) {
        alert('Please upload a Business Permit.');
        return false;
    }

    if (!dti) {
        alert('Please upload DTI/SEC Registration.');
        return false;
    }

    // Check file types
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(permit.type)) {
        alert('Business Permit must be PDF, JPG, or PNG.');
        return false;
    }
    if (!allowedTypes.includes(dti.type)) {
        alert('DTI/SEC Registration must be PDF, JPG, or PNG.');
        return false;
    }

    // Check file sizes (5MB max)
    if (permit.size > 5 * 1024 * 1024) {
        alert('Business Permit file is too large (max 5MB).');
        return false;
    }
    if (dti.size > 5 * 1024 * 1024) {
        alert('DTI/SEC Registration file is too large (max 5MB).');
        return false;
    }

    return true;
}
</script>
```

Then modify signup form HTML to call validation:
```html
<!-- Before: <button class="signup-btn" onclick="register()">Sign Up</button> -->
<!-- After: -->
<button class="signup-btn" onclick="if(validateStudentSignup()) register()">Sign Up</button>
```

---

### Fix #8: Google OAuth Profile Picture (P1)
**Impact:** OAuth users don't get profile pictures  
**Time:** 10 minutes  
**Files:** `passport.js`

**Current Code (Line ~37):**
```javascript
profile_picture_url: req.user.profile_picture_url || null
```

**Fix:**
```javascript
// In passport.js, modify the Google Strategy callback

passport.use(new GoogleStrategy(
    {
        clientID:     process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:  process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(null, false, { message: 'Google did not provide an email address.' });
            
            const first = profile.name?.givenName  || profile.displayName || 'User';
            const last  = profile.name?.familyName || '';
            const profilePictureUrl = profile.photos?.[0]?.value || null;  // ADD THIS LINE
            
            const user  = await findOrCreateOAuthUser(email, first, last, profilePictureUrl);  // ADD PARAM
            return done(null, user);
        } catch (err) {
            return done(err);
        }
    }
));

// Modify findOrCreateOAuthUser to handle profile picture
async function findOrCreateOAuthUser(email, firstName, lastName, profilePictureUrl) {
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length > 0) return rows[0];

    // Update to include profile picture
    const fakePassword = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    const [result] = await db.query(
        `INSERT INTO users (first_name, last_name, email, password, profile_picture_url, role, is_verified)
         VALUES (?, ?, ?, ?, ?, 'student', 1)`,
        [firstName, lastName, email, fakePassword, profilePictureUrl]
    );
    const [newUser] = await db.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
    return newUser[0];
}
```

Also fix the callback to return profile picture:

```javascript
router.get('/google/callback',
  passport.authenticate('google', { 
    session: false,
    failureRedirect: `${process.env.CLIENT_URL}/login.html?error=google_auth_failed`
  }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, role: req.user.role, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );
    
    const userData = encodeURIComponent(JSON.stringify({
      id: req.user.id,
      name: `${req.user.first_name} ${req.user.last_name}`,
      email: req.user.email,
      role: req.user.role,
      profile_picture_url: req.user.profile_picture_url || null  // FIX: Use the actual value
    }));
    
    res.redirect(`${process.env.CLIENT_URL}/loggedin.html?token=${token}&user=${userData}`);
  }
);
```

---

## PHASE 3: MEDIUM PRIORITY (Fix after Phase 1 & 2)

### Fix #9: Parse JSON Fields in Frontend (P2)
**Location:** When frontend receives programs/achievements from API
**Add to viewcenter.html and editcenter.html:**

```javascript
// Helper function to safely parse JSON fields
function parseJsonField(field) {
    if (!field) return [];
    if (Array.isArray(field)) return field;
    if (typeof field === 'string') {
        try { return JSON.parse(field); } catch(e) { return []; }
    }
    return [];
}

// When displaying programs:
const programs = parseJsonField(center.programs);
progWrap.innerHTML = '';
programs.forEach(prog => {
    const btn = document.createElement('button');
    btn.className = 'program-tag';
    btn.textContent = typeof prog === 'string' ? prog : (prog.name || JSON.stringify(prog));
    progWrap.appendChild(btn);
});
```

---

### Fix #10: Testimonial Rejection Flow (P2)
**Time:** 30 minutes  
**Files:** `testimonialController.js`, `admindashboard.html`

**Note:** Currently can only delete, not reject. To implement rejection:

1. Add `rejection_reason` column to schema
2. Change delete to mark as rejected
3. Add API endpoint for rejection
4. Update admin dashboard UI

For now, add confirmation before delete in [admindashboard.html](review_mnl/review.mnl-frontend/review.mnl-frontend/admindashboard.html):

```javascript
async function deleteTestimonial(testimonialId) {
    if (!confirm('Are you sure you want to delete this testimonial? This cannot be undone.')) {
        return;
    }
    try {
        await AdminAPI.deleteTestimonial(testimonialId);
        alert('Testimonial deleted.');
        location.reload(); // Refresh list
    } catch(err) {
        alert('Error: ' + err.message);
    }
}
```

---

## VERIFICATION CHECKLIST

After each fix, test:

- [ ] **Fix #1 (Search):** Search for center → Results show names and ratings correctly
- [ ] **Fix #2 (Profile):** Edit center profile → Changes are saved and persist after reload
- [ ] **Fix #3 (Description):** View center → Description displays in "About" section
- [ ] **Fix #4 (Messages):** Sidebar hidden or working
- [ ] **Fix #5 (Admin):** Try accessing `/admindashboard.html` as student → Redirected to login
- [ ] **Fix #6 (Expiry):** Let JWT expire (wait 7 days or modify JWT_EXPIRES_IN to 1 minute) → See friendly error
- [ ] **Fix #7 (Validation):** Try weak password → See validation error
- [ ] **Fix #8 (OAuth):** Login with Google → Profile picture displays
- [ ] **Fix #9 (JSON):** View center with programs → Displays as tags not stringified
- [ ] **Fix #10 (Testimonials):** Delete testimonial → Confirmation shows

---

## DEPLOYMENT NOTES

1. **Environment Variables:** Ensure all are set on production
   - `JWT_SECRET` - random string
   - `GOOGLE_CLIENT_ID/SECRET` - from Google Cloud
   - `CLOUDINARY_*` - from Cloudinary
   - `DB_HOST, DB_USER, DB_PASSWORD, DB_NAME`
   - `JWT_EXPIRES_IN` - default "7d"

2. **Database Migration:** After code changes, run:
   ```sql
   -- No schema changes needed for Phase 1
   -- Phase 2+ will require new columns for message system
   ```

3. **Testing:** After all Phase 1 fixes, test full user flow:
   - Register student → Login → Search → View center → Submit testimonial
   - Register center → Login → Edit profile → View in search
   - Admin login → Approve center → Approve testimonial

