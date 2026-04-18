/**
 * API Error Handler Utility
 * Provides consistent error handling and user-friendly error messages
 */

const APIErrorHandler = {
  /**
   * Map backend error messages to user-friendly messages
   */
  getUserFriendlyMessage(error) {
    if (!error) return 'An unexpected error occurred. Please try again.';
    
    const message = String(error.message || error || '').toLowerCase();
    
    // Authentication errors
    if (message.includes('not authenticated') || message.includes('unauthorized')) {
      return 'You need to log in to continue. Please log in and try again.';
    }
    if (message.includes('invalid token') || message.includes('token expired')) {
      return 'Your session has expired. Please log in again.';
    }
    if (message.includes('forbidden') || message.includes('access required')) {
      return 'You do not have permission to perform this action.';
    }
    if (message.includes('not verified') || message.includes('verify your email')) {
      return 'Please verify your email address first. Check your inbox for a verification link.';
    }
    
    // Registration errors
    if (message.includes('already registered') || message.includes('already in use') || message.includes('already exists')) {
      return 'This email is already registered. Please log in instead.';
    }
    if (message.includes('email is required')) {
      return 'Email address is required.';
    }
    if (message.includes('password must be')) {
      return 'Password must be at least 6 characters.';
    }
    if (message.includes('valid email')) {
      return 'Please enter a valid email address.';
    }
    
    // Document/File errors
    if (message.includes('file too large') || message.includes('file size')) {
      return 'File is too large. Please upload a file smaller than 5MB.';
    }
    if (message.includes('invalid file type')) {
      return 'Invalid file type. Please upload a PDF or image file.';
    }
    if (message.includes('document') && message.includes('required')) {
      return 'Please upload the required documents.';
    }
    
    // Network errors
    if (message.includes('network') || message.includes('failed to fetch')) {
      return 'Network error. Please check your internet connection and try again.';
    }
    if (message.includes('timeout')) {
      return 'Request timed out. Please try again.';
    }
    if (message.includes('server error') || message.includes('500')) {
      return 'Server error. Please try again later.';
    }
    
    // Not found errors
    if (message.includes('not found') || message.includes('404')) {
      return 'The requested resource was not found.';
    }
    
    // Validation errors
    if (message.includes('required')) {
      const field = message.split('is required')[0].trim();
      return `${field} is required.`;
    }
    
    // Default: return original message if it's short enough, otherwise generic message
    if (error.message && error.message.length < 100) {
      return error.message;
    }
    return 'An error occurred. Please try again.';
  },

  /**
   * Log error for debugging (non-intrusive)
   */
  logError(endpoint, error, context = '') {
    if (typeof console !== 'undefined' && console.error) {
      const logData = {
        endpoint: endpoint,
        timestamp: new Date().toISOString(),
        error: error.message || error,
        context: context
      };
      console.error('[API Error]', logData);
    }
  },

  /**
   * Parse error response from fetch
   */
  async parseErrorResponse(response) {
    try {
      const data = await response.json();
      return data.message || `HTTP ${response.status}`;
    } catch (e) {
      return `HTTP ${response.status}: ${response.statusText}`;
    }
  },

  /**
   * Handle network errors gracefully
   */
  handleNetworkError(error) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return {
        message: 'Unable to connect to the server. Please check your internet connection.',
        code: 'NETWORK_ERROR'
      };
    }
    return {
      message: error.message || 'Network error occurred.',
      code: 'UNKNOWN_ERROR'
    };
  },

  /**
   * Display error to user with appropriate styling
   */
  displayError(element, error, options = {}) {
    if (!element) return;
    
    const message = this.getUserFriendlyMessage(error);
    element.textContent = message;
    element.style.display = 'block';
    
    // Apply styling if provided
    if (options.style) {
      Object.assign(element.style, options.style);
    }
    
    // Optional: scroll to error
    if (options.scrollTo) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  },

  /**
   * Retry request with exponential backoff
   */
  async retryRequest(fn, maxRetries = 3, delayMs = 1000) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (error) {
        if (i === maxRetries - 1) throw error; // Last attempt, throw error
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }
};

// Make APIErrorHandler available globally
window.APIErrorHandler = APIErrorHandler;
