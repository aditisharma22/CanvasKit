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
 * @returns {Array} - Enhanced word metrics with locale-specific line-breaking constraints
 */
export async function enhanceWordMetricsWithLocalization(wordMetrics, locale) {
  // Skip localization processing if not needed
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
 * @returns {Array} - Filtered candidates that respect locale-specific rules
 */
export function filterCandidatesByLocalizationRules(candidates, words, locale) {
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
   * @returns {Array} - Optimized line breaking candidates for the specified locale
   */
  return async function(words, wordWidths, spaceWidth, targetWidth, 
                        candidateCount, debugElement, balanceFactor, 
                        minFillRatio, mode, locale = DEFAULT_LOCALE) {
    
    // First, get candidates from the original optimizer
    const candidates = originalOptimizer(
      words, wordWidths, spaceWidth, targetWidth, 
      candidateCount, debugElement, balanceFactor, 
      minFillRatio, mode
    );
    
    // Apply localization filtering for non-English locales
    if (locale && locale !== DEFAULT_LOCALE) {
      return filterCandidatesByLocalizationRules(candidates, words, locale);
    }
    
    // Return unfiltered candidates for English or default locale
    return candidates;
  };
}
