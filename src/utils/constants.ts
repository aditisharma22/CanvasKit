// Centralized constants for the CanvasKit application

export const LAYOUT_CONSTANTS = {
  // Penalty weights
  WIDOW_PENALTY: 15,
  ORPHAN_PENALTY: 10,
  PROTECTED_BREAK_PENALTY: 8,
  
  // Layout constants
  MAX_WIDTH_FACTOR: 1.5,
  MIN_FILL_RATIO_ADJUSTMENT: 0.1,
  
  // Score thresholds
  GOOD_RAGGEDNESS_THRESHOLD: 10,
  WARNING_RAGGEDNESS_THRESHOLD: 30,
  GOOD_EVENNESS_THRESHOLD: 90,
  WARNING_EVENNESS_THRESHOLD: 75,
  GOOD_FILL_RATIO_THRESHOLD: 85,
  WARNING_FILL_RATIO_THRESHOLD: 70,

  // Default render options
  DEFAULT_FONT_SIZE: 40,
  DEFAULT_CANDIDATE_COUNT: 5,
  DEFAULT_BALANCE_FACTOR: 0.5,
  DEFAULT_MIN_FILL_RATIO: 0.5,
  DEFAULT_MODE: "fit",
  DEFAULT_LOCALE: "en",
  DEFAULT_CONTAINER_ID: "output"
};

export const LOCALIZATION_CONSTANTS = {
  DEFAULT_LOCALE: 'en',
  FALLBACK_LOCALE: 'en',
  SUPPORTED_LOCALES: ['en', 'de', 'fr', 'es', 'ja'],
  
  // Line breaking behavior constants
  LINE_BREAK: {
    ALLOW: 'allow',
    AVOID: 'avoid'
  },
  
  // Common separators
  SEPARATORS: {
    SPACE: ' ',
    HYPHEN: '-',
    NON_BREAKING_HYPHEN: '\u2011',
    EN_DASH: '\u2013',
    EM_DASH: '\u2014'
  },
  
  // Common punctuation patterns
  REGEX_PATTERNS: {
    PUNCTUATION: /^[.,:;!?%)]$/,
    NUMERIC: /^\d+$/,
    PROPER_NOUN: /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/,
    WHITESPACE: /^\s+$/,
    SPECIAL_CHARS: /^[%°€$]$/,
    HYPHENS: /^[:;.,!?\-–—\u2011\u2013\u2014]$/
  }
};

export const STYLE_CONSTANTS = {
  DEFAULT_FONT_FAMILY: "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif",
  DEFAULT_TEXT_COLOR: '#333333',
  LINE_HEIGHT_FACTOR: 1.2 // Line height is 20% larger than font size
};

export const UNIT_REGEX = /^(px|em|%|kg|lb|ft|in|cm|mm|m|s|ms|gb|mb|kb)$/i;

export const ERROR_MESSAGES = {
  ELEMENT_NOT_FOUND: (id: string) => `Element with ID "${id}" not found`,
  ARRAY_LENGTH_MISMATCH: "Words array and widths array must have the same length",
  RENDER_ERROR: (error: string) => `Error rendering layout: ${error}`,
  LOCALE_NOT_FOUND: (locale: string, fallback: string) => 
    `No configuration found for locale '${locale}', falling back to '${fallback}'`
};
