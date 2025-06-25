import { processTextForLineBreaking, getLineBreakingRules } from './localization/segmenter.js';

/**
 * Apply localization-aware line breaking constraints to the word metrics
 * This function enhances the standard metrics with locale-specific line breaking rules
 * 
 * @param {Array} wordMetrics - Original word metrics from CanvasKit
 * @param {string} locale - The ISO language code for the text (e.g., 'en', 'ja', 'de')
 * @returns {Array} - Enhanced word metrics with locale-specific line-breaking constraints
 */
export async function enhanceWordMetricsWithLocalization(wordMetrics, locale) {
  // Define constants for line breaking constraints
  const LINE_BREAK = {
    ALLOW: 'allow',
    AVOID: 'avoid'
  };
  
  // Define default locale
  const DEFAULT_LOCALE = 'en';
  
  // Skip localization processing for English or if no locale provided
  if (!locale || locale === DEFAULT_LOCALE) {
    return wordMetrics;
  }
  
  console.log(`LOCALIZING FOR LOCALE: ${locale}`);
  
  // Convert word metrics to a simple text string for processing
  const text = wordMetrics.map(w => w.text).join(' ');
  
  try {
    // Get the rule engine module for locale-specific rules
    const ruleModule = await import("./localization/rules/ruleConfigs.js");
    const ruleEngine = ruleModule.default;
    
    if (ruleEngine[locale]?.appleServices) {
      console.log(`Found Apple services in rules for ${locale}:`, ruleEngine[locale].appleServices);
    }
    
    // Process text with locale-specific line breaking rules
    let localizedMetrics = await processTextForLineBreaking(text, locale);
    
    // Process text with locale-specific rules from the rule engine
    // The rules are now handled by the segmenter module, no need for manual overrides
    
    return localizedMetrics;
  } catch (error) {
    console.error("Error in enhanceWordMetricsWithLocalization:", error);
    return wordMetrics; // Return original metrics if there's an error
  }
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
  // Constants for rule and validation checks
  const VIOLATION_TYPES = {
    HYPHENATED_WORD: 'hyphen',
    FUNCTION_WORD: 'articles',
    COMPOUND_WORD: 'compounds'
  };

  // Get localization rules for the specified locale
  const rules = getLineBreakingRules(locale);
  
  // Return unfiltered candidates if no specific rules exist for this locale
  if (!rules || !rules.rules) {
    return candidates;
  }
  
  // Filter candidates based on rule violations
  return candidates.filter(candidate => {
    const breaks = candidate.breaks || [];
    
    // Examine each break point for rule violations
    for (const breakIdx of breaks) {
      // Skip invalid break points
      if (breakIdx <= 0 || breakIdx >= words.length - 1) continue;
      
      const prevWord = words[breakIdx];
      const nextWord = words[breakIdx + 1];
      
      // Rule: Don't break after hyphenated words
      if (rules.rules.avoidBreakAfter?.includes(VIOLATION_TYPES.HYPHENATED_WORD) && 
          prevWord.endsWith('-')) {
        return false; // Reject candidate with this violation
      }
      
      // Rule: Don't break before function words (articles, prepositions, etc.)
      if (rules.rules.avoidBreakBefore?.includes(VIOLATION_TYPES.FUNCTION_WORD) && 
          rules.functionWords?.includes(nextWord.toLowerCase())) {
        return false; // Reject candidate with this violation
      }
      
      // Add explicit check for compound words (if supported by locale rules)
      if (rules.rules.avoidBreakWithin?.includes(VIOLATION_TYPES.COMPOUND_WORD) &&
          (prevWord.endsWith('-') || nextWord.startsWith('-'))) {
        return false;
      }
      
      // Future rule implementations can be added here
    }
    
    // No violations found, keep this candidate
    return true;
  });
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
