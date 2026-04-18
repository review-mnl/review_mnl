/**
 * Form Validation Utilities for review.mnl
 * Provides client-side validation for signup, login, and other forms
 */

const FormValidation = {
  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email).trim());
  },

  /**
   * Validate password strength
   * Requirements: at least 6 characters
   */
  isValidPassword(password) {
    return password && password.length >= 6;
  },

  /**
   * Get password strength feedback (0-3)
   * 0: too weak, 1: weak, 2: medium, 3: strong
   */
  getPasswordStrength(password) {
    if (!password) return 0;
    if (password.length < 6) return 0;
    if (password.length < 8) return 1;
    
    let strengthScore = 2;
    if (/[A-Z]/.test(password)) strengthScore++;
    if (/[0-9]/.test(password)) strengthScore++;
    if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) strengthScore++;
    
    return Math.min(3, strengthScore);
  },

  /**
   * Validate full name (minimum 2 characters)
   */
  isValidFullName(name) {
    const trimmed = String(name || '').trim();
    return trimmed.length >= 2;
  },

  /**
   * Validate business name (minimum 2 characters)
   */
  isValidBusinessName(name) {
    const trimmed = String(name || '').trim();
    return trimmed.length >= 2;
  },

  /**
   * Check if passwords match
   */
  passwordsMatch(password1, password2) {
    return password1 === password2;
  },

  /**
   * Validate file upload (check file size and type)
   */
  isValidFile(file, maxSizeMB = 5, allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']) {
    if (!file) return false;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) return false;
    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) return false;
    return true;
  },

  /**
   * Get file size in readable format
   */
  getReadableFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  },

  /**
   * Validate all signup student form fields
   */
  validateStudentSignup(fullname, email, password, confirmPassword, termsChecked) {
    const errors = [];

    if (!this.isValidFullName(fullname)) {
      errors.push('Full name must be at least 2 characters.');
    }

    if (!email || !email.trim()) {
      errors.push('Email is required.');
    } else if (!this.isValidEmail(email)) {
      errors.push('Please enter a valid email address.');
    }

    if (!password) {
      errors.push('Password is required.');
    } else if (!this.isValidPassword(password)) {
      errors.push('Password must be at least 6 characters.');
    }

    if (!this.passwordsMatch(password, confirmPassword)) {
      errors.push('Passwords do not match.');
    }

    if (!termsChecked) {
      errors.push('You must accept the Terms and Conditions.');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Validate all signup center form fields
   */
  validateCenterSignup(businessName, email, password, confirmPassword, termsChecked, businessPermitFile, dtiFile) {
    const errors = [];

    if (!this.isValidBusinessName(businessName)) {
      errors.push('Business name must be at least 2 characters.');
    }

    if (!email || !email.trim()) {
      errors.push('Email is required.');
    } else if (!this.isValidEmail(email)) {
      errors.push('Please enter a valid email address.');
    }

    if (!password) {
      errors.push('Password is required.');
    } else if (!this.isValidPassword(password)) {
      errors.push('Password must be at least 6 characters.');
    }

    if (!this.passwordsMatch(password, confirmPassword)) {
      errors.push('Passwords do not match.');
    }

    if (!businessPermitFile) {
      errors.push('Business Permit document is required.');
    } else if (!this.isValidFile(businessPermitFile)) {
      errors.push('Business Permit: File must be PDF or image (max 5MB).');
    }

    if (!dtiFile) {
      errors.push('DTI/SEC Registration document is required.');
    } else if (!this.isValidFile(dtiFile)) {
      errors.push('DTI/SEC: File must be PDF or image (max 5MB).');
    }

    if (!termsChecked) {
      errors.push('You must accept the Terms and Conditions.');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Validate login form
   */
  validateLogin(email, password) {
    const errors = [];

    if (!email || !email.trim()) {
      errors.push('Email is required.');
    } else if (!this.isValidEmail(email)) {
      errors.push('Please enter a valid email address.');
    }

    if (!password) {
      errors.push('Password is required.');
    }

    return {
      isValid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Display validation errors in an error message element
   */
  displayErrors(errorElement, errors) {
    if (!errorElement) return;
    
    if (errors.length === 0) {
      errorElement.style.display = 'none';
      errorElement.textContent = '';
    } else {
      errorElement.textContent = errors.join(' ');
      errorElement.style.display = 'block';
    }
  }
};

// Make FormValidation available globally
window.FormValidation = FormValidation;
