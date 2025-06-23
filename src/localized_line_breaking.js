import { processTextForLineBreaking, getLineBreakingRules } from './localization/segmenter.js';

/**
 * Apply localization-aware line breaking constraints to the word metrics
 * @param {Array} wordMetrics - Original word metrics from CanvasKit
 * @param {string} locale - The locale code for the text
 * @returns {Array} - Enhanced word metrics with line-breaking constraints
 */
export async function enhanceWordMetricsWithLocalization(wordMetrics, locale) {
  if (!locale || locale === 'en') {
    // No special handling for English
    return wordMetrics;
  }
  
  // Convert from CanvasKit format to localization format
  const text = wordMetrics.map(w => w.text).join(' ');
  
  // Process with localization rules
  const localizedMetrics = await processTextForLineBreaking(text, locale);
  
  // Merge localization constraints back to original word metrics
  return wordMetrics.map((metric, index) => {
    const localConstraint = index < localizedMetrics.length ? 
      localizedMetrics[index].lineBreaking : 'allow';
      
    return {
      ...metric,
      lineBreaking: localConstraint === 'avoid' ? 'avoid' : 'allow'
    };
  });
}

/**
 * Modify line breaking candidates based on localization rules
 * @param {Array} candidates - Line breaking candidates from Knuth-Plass algorithm
 * @param {Array} words - Original words array
 * @param {string} locale - Locale code
 * @returns {Array} - Filtered candidates that respect localization rules
 */
export function filterCandidatesByLocalizationRules(candidates, words, locale) {
  const rules = getLineBreakingRules(locale);
  if (!rules || !rules.rules) {
    return candidates; // No filtering if no rules for this locale
  }
  
  // Filter candidates based on rule violations
  return candidates.filter(candidate => {
    const breaks = candidate.breaks || [];
    
    // Check for violations at each break point
    for (const breakIdx of breaks) {
      // Skip if not a valid break point
      if (breakIdx <= 0 || breakIdx >= words.length - 1) continue;
      
      const prevWord = words[breakIdx];
      const nextWord = words[breakIdx + 1];
      
      // Check hyphenated words
      if (rules.rules.avoidBreakAfter?.includes("hyphen") && 
          prevWord.endsWith('-')) {
        return false;
      }
      
      // Check function words (articles, prepositions)
      if (rules.rules.avoidBreakBefore?.includes("articles") && 
          rules.functionWords?.includes(nextWord.toLowerCase())) {
        return false;
      }
      
      // Additional rule checks can be added here
    }
    
    return true;
  });
}

/**
 * Factory function to create a localization-aware line breaking optimizer
 * @param {function} originalOptimizer - The original line breaking optimizer function
 * @returns {function} - Enhanced optimizer that respects localization rules
 */
export function createLocalizedLineBreakOptimizer(originalOptimizer) {
  return async function(words, wordWidths, spaceWidth, targetWidth, 
                        candidateCount, debugElement, balanceFactor, 
                        minFillRatio, mode, locale = 'en') {
    
    // Get candidates from the original optimizer
    const candidates = originalOptimizer(
      words, wordWidths, spaceWidth, targetWidth, 
      candidateCount, debugElement, balanceFactor, 
      minFillRatio, mode
    );
    
    // Apply localization filtering if locale specified
    if (locale && locale !== 'en') {
      return filterCandidatesByLocalizationRules(candidates, words, locale);
    }
    
    return candidates;
  };
}
