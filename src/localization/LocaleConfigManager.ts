// LocaleConfigManager - Manages locale-specific line breaking rules
import ruleConfigs from './rules/ruleConfigs';
import { LOCALIZATION_CONSTANTS as CONFIG } from '../utils/constants';
import { ERROR_MESSAGES } from '../utils/constants';

// Re-export constants for backward compatibility
export { LOCALIZATION_CONSTANTS as CONFIG } from '../utils/constants';

interface ExtendedLocaleConfig {
  locale?: string;
  rules?: {
    avoidBreakBefore?: string[];
    avoidBreakAfter?: string[];
    avoidBreakBetween?: string[];
    specialCases?: Record<string, any>;
    [key: string]: any;
  };
  appleServices?: string[];
  appGameNames?: string[];
  fixedExpressions?: string[];
  percentSymbols?: string[];
  periods?: string[];
  adjectives?: string[];
  personNamePrefixes?: string[];
  [key: string]: any;
}

interface WordContext {
  text?: string;
  separator?: string;
}

interface RuleApplicationContext {
  rule: string;
  context: string;
  current: WordContext;
  next?: WordContext;
  prev?: WordContext;
  config: ExtendedLocaleConfig;
  words: string[];
  index: number;
}

// Main locale manager class
class LocaleConfigManager {
  private configs: Record<string, ExtendedLocaleConfig>;
  private cache: Map<string, ExtendedLocaleConfig>;

  constructor() {
    this.configs = ruleConfigs as Record<string, ExtendedLocaleConfig>;
    this.cache = new Map();
  }

  // Get configuration for a specific locale with fallback support
  getConfig(locale: string = CONFIG.DEFAULT_LOCALE): ExtendedLocaleConfig {
    // Check cache first
    if (this.cache.has(locale)) {
      return this.cache.get(locale)!;
    }

    // Get the config with fallback
    let config = this.configs[locale];
    
    if (!config && locale !== CONFIG.FALLBACK_LOCALE) {
      console.warn(ERROR_MESSAGES.LOCALE_NOT_FOUND(locale, CONFIG.FALLBACK_LOCALE));
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

  // Create a default configuration for a locale
  private createDefaultConfig(locale: string): ExtendedLocaleConfig {
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

  // Normalize configuration to ensure all required properties exist
  private normalizeConfig(config: ExtendedLocaleConfig, locale: string): ExtendedLocaleConfig {
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

  // Check if a locale is supported
  isSupported(locale: string): boolean {
    return CONFIG.SUPPORTED_LOCALES.includes(locale) || !!this.configs[locale];
  }

  // Get all supported locales
  getSupportedLocales(): string[] {
    return [...CONFIG.SUPPORTED_LOCALES, ...Object.keys(this.configs)].filter((locale, index, arr) => arr.indexOf(locale) === index);
  }

  // Check if localization processing is needed for a locale
  needsLocalization(locale: string): boolean {
    return !!locale && locale !== CONFIG.DEFAULT_LOCALE && this.isSupported(locale);
  }

  // Get rule lists by name from configuration
  getRuleList(config: ExtendedLocaleConfig, ruleName: string): string[] {
    return config[ruleName] || config.rules?.[ruleName] || [];
  }

  // Check if a word matches any entry in a list (case-insensitive)
  matchesList(word: string, list: string[]): boolean {
    if (!Array.isArray(list) || !word) return false;
    return list.some(entry => typeof entry === 'string' && word.toLowerCase() === entry.toLowerCase());
  }

  // Check if breaking at a specific position would split a protected phrase
  breakSplitsPhrase(breakIdx: number, words: string[], phraseList: string[]): boolean {
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

  // Apply universal rule checking logic
  applyRule({ rule, context, current, next, prev, config, words, index }: RuleApplicationContext): boolean {
    const rules = config.rules || {};
    const ruleName = `avoidBreak${context.charAt(0).toUpperCase() + context.slice(1)}`;
    
    if (!rules[ruleName]?.includes(rule)) {
      return false;
    }

    switch (rule) {
      case 'punctuation':
        const punctuation = this.getRuleList(config, 'punctuation');
        const targetWord = context === 'before' ? next : (context === 'after' ? current : null);
        return !!targetWord && this.matchesList(targetWord.text || '', punctuation);

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
        return !!checkWord && this.matchesList(checkWord.text || '', ruleList);

      case 'hyphen':
        const hyphenChars = [CONFIG.SEPARATORS.HYPHEN, CONFIG.SEPARATORS.NON_BREAKING_HYPHEN, CONFIG.SEPARATORS.EN_DASH, CONFIG.SEPARATORS.EM_DASH];
        return !!current && (
          hyphenChars.includes(current.separator || '') || 
          hyphenChars.some(char => (current.text || '').endsWith(char))
        );

      case 'numeric':
        if (context === 'after' && CONFIG.REGEX_PATTERNS.NUMERIC.test(current.text || '')) {
          const units = this.getRuleList(config, 'unitsOfMeasure');
          const percentSymbols = this.getRuleList(config, 'percentSymbols');
          return !!next && (this.matchesList(next.text || '', units) || this.matchesList(next.text || '', percentSymbols));
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

  // Clear configuration cache
  clearCache(): void {
    this.cache.clear();
  }

  // Register a new locale configuration
  registerLocale(locale: string, config: ExtendedLocaleConfig): void {
    this.configs[locale] = config;
    this.cache.delete(locale); // Clear cache for this locale
  }
}

// Export singleton instance
export const localeConfigManager = new LocaleConfigManager();

// Export the class for testing or custom instances
export { LocaleConfigManager };
