/**
 * Security: Input sanitization utilities
 */
export const Security = {
  sanitizeInput: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>]/g, '') // Basic XSS prevention
      .trim()
      .slice(0, 1000); // Prevent extremely long inputs
  },

  sanitizeHtml: (html) => {
    const div = document.createElement('div');
    div.textContent = html;
    return div.innerHTML;
  },

  validateVin: (vin) => {
    if (!vin || typeof vin !== 'string') return false;
    // VIN validation: 17 characters, alphanumeric except I, O, Q
    return /^[A-HJ-NPR-Z0-9]{17}$/i.test(vin);
  }
};
