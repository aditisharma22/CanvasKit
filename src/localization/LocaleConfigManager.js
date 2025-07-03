/**
 * Dynamic Locale Configuration Manager
 * Centralizes all locale-specific configurations and rule management
 * Provides a unified interface for locale handling across the entire application
 */

import ruleConfigs from './rules/ruleConfigs.js';

/**
 * Configuration constants
 */
export const CONFIG = {
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

/**
 * Locale Configuration Manager Class
 * Handles all locale-specific configurations and rule applications
 */
class LocaleConfigManager {
  constructor() {
    this.configs = ruleConfigs;
    this.cache = new Map();
  }

  /**
   * Get configuration for a specific locale with fallback support
   * @param {string} locale - The locale code
   * @returns {Object} - The locale configuration
   */
  getConfig(locale = CONFIG.DEFAULT_LOCALE) {
    // Check cache first
    if (this.cache.has(locale)) {
      return this.cache.get(locale);
    }

    // Get the config with fallback
    let config = this.configs[locale];
    
    if (!config && locale !== CONFIG.FALLBACK_LOCALE) {
      console.warn(`No configuration found for locale '${locale}', falling back to '${CONFIG.FALLBACK_LOCALE}'`);
      config = this.configs[CONFIG.FALLBACK_LOCALE] || this.createDefaultConfig(locale);
    }
    
    if (!config) {
      config = this.createDefaultConfig(locale);
    }

    // Ensure the config has all required properties
    config = this.normalizeConfig(config, locale);
    
    // Cache the normalized config
    this.cache.set(locale, config);
    
    return config;
  }

  /**
   * Create a default configuration for unsupported locales
   * @param {string} locale - The locale code
   * @returns {Object} - Default configuration
   */
  createDefaultConfig(locale) {
    return {
      locale,
      rules: {
        avoidBreakBefore: [],
        avoidBreakAfter: [],
        avoidBreakBetween: [],
        specialCases: {}
      },
      functionWords: [],
      prepositions: [],
      appleServices: [],
      appGameNames: [],
      fixedExpressions: [],
      percentSymbols: ['%'],
      unitsOfMeasure: [],
      punctuation: ['.', ':', ';', '!', '?', '…'],
      periods: ['.'],
      adjectives: [],
      personNamePrefixes: []
    };
  }

  /**
   * Normalize configuration to ensure all required properties exist
   * @param {Object} config - The configuration object
   * @param {string} locale - The locale code
   * @returns {Object} - Normalized configuration
   */
  normalizeConfig(config, locale) {
    const defaultConfig = this.createDefaultConfig(locale);
    
    return {
      ...defaultConfig,
      ...config,
      rules: {
        ...defaultConfig.rules,
        ...(config.rules || {})
      }
    };
  }

  /**
   * Check if a locale is supported
   * @param {string} locale - The locale code
   * @returns {boolean} - True if locale is supported
   */
  isSupported(locale) {
    return CONFIG.SUPPORTED_LOCALES.includes(locale) || !!this.configs[locale];
  }

  /**
   * Get all supported locales
   * @returns {string[]} - Array of supported locale codes
   */
  getSupportedLocales() {
    return [...CONFIG.SUPPORTED_LOCALES, ...Object.keys(this.configs)].filter((locale, index, arr) => arr.indexOf(locale) === index);
  }

  /**
   * Check if localization processing is needed for a locale
   * @param {string} locale - The locale code
   * @returns {boolean} - True if processing is needed
   */
  needsLocalization(locale) {
    return locale && locale !== CONFIG.DEFAULT_LOCALE && this.isSupported(locale);
  }

  /**
   * Get rule lists by name from configuration
   * @param {Object} config - The locale configuration
   * @param {string} ruleName - The name of the rule list
   * @returns {Array} - The rule list array
   */
  getRuleList(config, ruleName) {
    return config[ruleName] || config.rules?.[ruleName] || [];
  }

  /**
   * Check if a word matches any entry in a list (case-insensitive)
   * @param {string} word - The word to check
   * @param {Array} list - The list to check against
   * @returns {boolean} - True if word matches any entry
   */
  matchesList(word, list) {
    if (!Array.isArray(list) || !word) return false;
    return list.some(entry => typeof entry === 'string' && word.toLowerCase() === entry.toLowerCase());
  }

  /**
   * Check if a word matches any regex pattern in a list
   * @param {string} word - The word to check
   * @param {Array} list - The list of regex patterns
   * @returns {boolean} - True if word matches any pattern
   */
  matchesRegex(word, list) {
    if (!Array.isArray(list) || !word) return false;
    return list.some(entry => {
      if (typeof entry === 'string' && entry.includes('\\')) {
        try {
          return new RegExp(entry, 'i').test(word);
        } catch {
          return false;
        }
      }
      return false;
    });
  }

  /**
   * Check if breaking at a specific position would split a protected phrase
   * @param {number} breakIdx - The break position
   * @param {Array} words - The words array
   * @param {Array} phraseList - List of protected phrases
   * @returns {boolean} - True if break would split a protected phrase
   */
  breakSplitsPhrase(breakIdx, words, phraseList) {
    if (!Array.isArray(phraseList) || !Array.isArray(words)) return false;
    
    for (const phrase of phraseList) {
      // Handle hyphenated expressions that might be split during tokenization
      if (typeof phrase === 'string' && phrase.includes('-')) {
        const parts = phrase.split('-');
        if (parts.length === 2 && breakIdx > 0 && breakIdx < words.length) {
          if (words[breakIdx - 1]?.toLowerCase() === parts[0].toLowerCase() && 
              words[breakIdx]?.toLowerCase() === parts[1].toLowerCase()) {
            return true;
          }
        }
      }
      
      // Handle regex patterns
      if (typeof phrase === 'string' && phrase.includes('\\')) {
        for (let win = 5; win >= 2; --win) {
          for (let start = Math.max(0, breakIdx - win + 1); start <= Math.min(breakIdx, words.length - win); ++start) {
            const candidate = words.slice(start, start + win).join(' ');
            try {
              if (new RegExp('^' + phrase + '$', 'i').test(candidate)) {
                if (breakIdx >= start && breakIdx < start + win - 1) return true;
              }
            } catch {}
          }
        }
      } else if (typeof phrase === 'string') {
        // Handle plain string phrases
        const phraseWords = phrase.split(/\s+/);
        if (phraseWords.length < 2) continue;
        
        for (let start = Math.max(0, breakIdx - phraseWords.length + 2); start <= Math.min(breakIdx, words.length - phraseWords.length); ++start) {
          let match = true;
          for (let j = 0; j < phraseWords.length; ++j) {
            if (words[start + j]?.toLowerCase() !== phraseWords[j].toLowerCase()) {
              match = false;
              break;
            }
          }
          if (match && breakIdx >= start && breakIdx < start + phraseWords.length - 1) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Apply universal rule checking logic
   * @param {Object} params - Parameters object
   * @param {string} params.rule - The rule type
   * @param {string} params.context - The context (before, after, between)
   * @param {Object} params.current - Current word/token
   * @param {Object} params.next - Next word/token (for before/between rules)
   * @param {Object} params.prev - Previous word/token (for after/between rules)
   * @param {Object} params.config - Locale configuration
   * @param {Array} params.words - All words (for between rules)
   * @param {number} params.index - Current index (for between rules)
   * @returns {boolean} - True if rule violation detected
   */
  applyRule({ rule, context, current, next, prev, config, words, index }) {
    const rules = config.rules || {};
    const ruleName = `avoidBreak${context.charAt(0).toUpperCase() + context.slice(1)}`;
    
    if (!rules[ruleName]?.includes(rule)) {
      return false;
    }

    switch (rule) {
      case 'punctuation':
        const punctuation = this.getRuleList(config, 'punctuation');
        const targetWord = context === 'before' ? next : (context === 'after' ? current : null);
        return targetWord && this.matchesList(targetWord.text, punctuation);

      case 'articles':
      case 'prepositions':
      case 'functionWords':
        // Handle all types of word lists
        let listName;
        if (rule === 'articles') {
          listName = config.articles && config.articles.length > 0 ? 'articles' : 'functionWords';
        } else if (rule === 'functionWords') {
          listName = 'functionWords';
        } else {
          listName = 'prepositions';
        }
        const ruleList = this.getRuleList(config, listName);
        const checkWord = context === 'before' ? next : current;
        return checkWord && this.matchesList(checkWord.text, ruleList);

      case 'hyphen':
        const hyphenChars = [CONFIG.SEPARATORS.HYPHEN, CONFIG.SEPARATORS.NON_BREAKING_HYPHEN, CONFIG.SEPARATORS.EN_DASH, CONFIG.SEPARATORS.EM_DASH];
        return current && (
          hyphenChars.includes(current.separator) || 
          hyphenChars.some(char => current.text?.endsWith(char))
        );

      case 'numeric':
        if (context === 'after' && CONFIG.REGEX_PATTERNS.NUMERIC.test(current.text)) {
          const units = this.getRuleList(config, 'unitsOfMeasure');
          const percentSymbols = this.getRuleList(config, 'percentSymbols');
          return next && (this.matchesList(next.text, units) || this.matchesList(next.text, percentSymbols));
        }
        return false;

      case 'fixedExpressions':
      case 'appleServices':
      case 'appGameNames':
        if (context === 'between') {
          const list = this.getRuleList(config, rule);
          return this.breakSplitsPhrase(index, words, list);
        }
        return false;

      default:
        return false;
    }
  }

  /**
   * Clear configuration cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Register a new locale configuration
   * @param {string} locale - The locale code
   * @param {Object} config - The configuration object
   */
  registerLocale(locale, config) {
    this.configs[locale] = config;
    this.cache.delete(locale); // Clear cache for this locale
  }
}

// Export singleton instance
export const localeConfigManager = new LocaleConfigManager();

// Export the class for testing or custom instances
export { LocaleConfigManager };
