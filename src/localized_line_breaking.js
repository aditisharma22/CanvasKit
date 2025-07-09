import { processTextForLineBreaking } from './localization/segmenter.js';
import { localeConfigManager, CONFIG } from './localization/LocaleConfigManager.js';
import { universalRuleProcessor } from './localization/UniversalRuleProcessor.js';

// Make line breaking rules globally available for UI highlighting
if (typeof window !== 'undefined') {
  window.lineBreakRules = localeConfigManager.configs;
}

/**
 * Apply localizing constraints to the word metrics
 * This function enhances the standard metrics with locale-specific line breaking rules
 * 
 * @param {Array} wordMetrics - Original word metrics from CanvasKit
 * @param {string} locale - The ISO language code for the text (e.g., 'en', 'ja', 'de')
 * @param {Object} options - Additional options
 * @param {boolean} options.enableLocalization - Whether to apply localization rules
 * @returns {Array} - Enhanced word metrics with locale-specific line-breaking constraints
 */
export async function enhanceWordMetricsWithLocalization(wordMetrics, locale, options = { enableLocalization: true }) {
  // When toggle is off, return metrics with basic line breaks
  if (options.enableLocalization === false) {
    return wordMetrics.map((metric, index) => {
      // For basic line breaks, avoid breaks:
      // 1. At the last word
      // 2. For punctuation marks
      // 3. For units after numbers
      // 4. For currency symbols
      const isPunctuation = metric.text && /^[.,;:!?)]$/.test(metric.text);
      const isUnit = metric.text && /^(km|m|cm|mm|kg|g|mg|l|ml|h|min|s|ms|%|€|\$)$/.test(metric.text);
      const isNumber = metric.text && /^\d+$/.test(metric.text);
      const nextMetric = index < wordMetrics.length - 1 ? wordMetrics[index + 1] : null;
      const nextIsUnit = nextMetric && nextMetric.text && /^(km|m|cm|mm|kg|g|mg|l|ml|h|min|s|ms|%|€|\$)$/.test(nextMetric.text);
      
      return {
        ...metric,
        lineBreaking: (
          index === wordMetrics.length - 1 || // Last word
          isPunctuation || // Punctuation marks
          (isNumber && nextIsUnit) || // Number followed by unit
          (isUnit && index > 0 && wordMetrics[index - 1].text && /^\d+$/.test(wordMetrics[index - 1].text)) // Unit after number
        ) ? 'avoid' : 'allow',
        _localeRules: null, // Clear any previous rule metadata
        _partOfAppleService: null, // Clear any special word metadata
        _partOfGameName: null,
        _isSmartHomeCompound: null
      };
    });
  }
  
  // Skip localization processing if not needed for this locale
  if (!localeConfigManager.needsLocalization(locale)) {
    return wordMetrics;
  }
  
  // Convert word metrics to a simple text string for processing
  const text = wordMetrics.map(w => w.text).join(' ');
  
  // Process text with locale-specific line breaking rules
  const localizedMetrics = await processTextForLineBreaking(text, locale);

  // Apply universal rule processing
  const universalProcessedMetrics = universalRuleProcessor.processWordMetrics(wordMetrics, locale);
  
  // Merge localization constraints back into the original word metrics
  return universalProcessedMetrics.map((metric, index) => {
    // Get line breaking constraint from localized metrics, default to 'allow' if not available
    const localConstraint = index < localizedMetrics.length ? 
      localizedMetrics[index].lineBreaking : CONFIG.LINE_BREAK.ALLOW;
      
    // Return enhanced metrics with line breaking constraint
    return {
      ...metric,
      lineBreaking: localConstraint === CONFIG.LINE_BREAK.AVOID ? CONFIG.LINE_BREAK.AVOID : CONFIG.LINE_BREAK.ALLOW
    };
  });
}

/**
 * Filter line breaking candidates based on locale-specific rules
 * Removes candidates that violate language-specific line breaking conventions
 * 
 * @param {Array} candidates - Line breaking candidates from optimization algorithm
 * @param {Array} words - Original words array
 * @param {string} locale - ISO language code (e.g., 'en', 'ja', 'de')
 * @param {Object} options - Additional options
 * @param {boolean} options.enableLocalization - Whether to apply localization rules
 * @returns {Array} - Filtered candidates that respect locale-specific rules
 */
export function filterCandidatesByLocalizationRules(candidates, words, locale, options = { enableLocalization: true }) {
  // Skip filtering if localization is disabled
  if (options.enableLocalization === false) {
    return candidates;
  }
  
  // Use universal rule processor for dynamic filtering
  return universalRuleProcessor.filterCandidates(candidates, words, locale);
}

/**
 * Factory function to create a localization-aware line breaking optimizer
 * Wraps an existing line breaking optimizer with locale-specific rules
 *
 * @param {function} originalOptimizer - The original line breaking optimizer function
 * @returns {function} - Enhanced optimizer that respects locale-specific rules
 */
export function createLocalizedLineBreakOptimizer(originalOptimizer) {
  // Define constants for default values and locale handling
  const DEFAULT_LOCALE = 'en';
  
  /**
   * Localized line breaking optimizer function
   * 
   * @param {string[]} words - Array of words in the text
   * @param {number[]} wordWidths - Array of word widths
   * @param {number} spaceWidth - Width of space character
   * @param {number} targetWidth - Target line width
   * @param {number} candidateCount - Number of candidates to generate
   * @param {HTMLElement} debugElement - Debug visualization element
   * @param {number} balanceFactor - Balance factor (0-1)
   * @param {number} minFillRatio - Minimum fill ratio (0-1)
   * @param {string} mode - Optimization mode ('fit' or 'uniform')
   * @param {string} locale - ISO language code (defaults to 'en')
   * @param {Object} options - Additional options
   * @param {boolean} options.enableLocalization - Whether to apply localization rules
   * @returns {Array} - Optimized line breaking candidates for the specified locale
   */
  return async function(words, wordWidths, spaceWidth, targetWidth, 
                        candidateCount, debugElement, balanceFactor, 
                        minFillRatio, mode, locale = DEFAULT_LOCALE, 
                        options = { enableLocalization: true }) {
    
    // Check if localization is explicitly disabled
    const isLocalizationEnabled = options.enableLocalization !== false;
    
    // When localization is disabled, use basic word-level line breaking
    // regardless of the locale specified
    const effectiveLocale = isLocalizationEnabled ? locale : DEFAULT_LOCALE;
    
    // First, get candidates from the original optimizer
    // Pass the localization toggle state to ensure the core algorithm knows whether to apply rules
    // Use the effective locale based on whether localization is enabled
    const candidates = originalOptimizer(
      words, wordWidths, spaceWidth, targetWidth, 
      candidateCount, debugElement, balanceFactor, 
      minFillRatio, mode,
      effectiveLocale, // Use the effective locale
      { enableLocalization: isLocalizationEnabled }
    );
    
    // Apply localization filtering for non-English locales if enabled
    if (isLocalizationEnabled && locale && locale !== DEFAULT_LOCALE) {
      // Pass the toggle state to the filter function as well
      return filterCandidatesByLocalizationRules(candidates, words, locale, { enableLocalization: true });
    }
    
    return candidates;
  };
}
