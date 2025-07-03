/**
 * Rule engine for line breaking in localized text
 * Applies language-specific rules to determine where line breaks should be avoided
 */

import { universalRuleProcessor } from './UniversalRuleProcessor.js';
import { localeConfigManager, CONFIG } from './LocaleConfigManager.js';

/**
 * Annotate word metrics with line breaking constraints based on separators
 * 
 * @param {Array} wordMetricsArray - Array of word metrics objects
 * @param {Object} ruleConfig - Language-specific rule configuration
 * @returns {Array} - Updated word metrics with line breaking annotations
 */
export function annotateLineBreakingWithSeparators(wordMetricsArray, ruleConfig) {
  // Use universal rule processor for all rule processing
  if (!ruleConfig || !ruleConfig.locale) {
    return wordMetricsArray;
  }

  // Get the locale from the configuration  
  const locale = ruleConfig.locale;
  
  // Apply universal rule processing
  return universalRuleProcessor.processWordMetrics(wordMetricsArray, locale);
}
export function applySegmentationRules(wordMetricsArray, ruleConfig) {
  // Extract rule configurations
  const { 
    rules, 
    functionWords, 
    fixedExpressions, 
    appleServices, 
    appGameNames,
    periods,
    adjectives,
    personNamePrefixes,
    unitsOfMeasure
  } = ruleConfig || {};
  const violations = [];

  // Helper functions for rule checking
  
  /**
   * Check if a word is a function word (article, preposition, etc.)
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's a function word
   */
  const isFunctionWord = (w) => functionWords?.includes(w?.toLowerCase());
  
  /**
   * Check if a word is an adjective
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's an adjective
   */
  const isAdjective = (w) => adjectives?.includes(w?.toLowerCase());
  
  /**
   * Check if a word is a person name prefix (M., Mme, etc.)
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's a person name prefix
   */
  const isPersonPrefix = (w) => personNamePrefixes?.includes(w);
  
  /**
   * Check if a word is a unit of measurement
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's a unit of measurement
   */
  const isUnit = (w) => unitsOfMeasure?.includes(w);
  
  /**
   * Check if a word is punctuation
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's punctuation
   */
  const isPunctuation = (w) => REGEX_PATTERNS.PUNCTUATION.test(w);
  
  /**
   * Check if a separator is a hyphen
   * @param {string} sep - Separator to check
   * @returns {boolean} - True if it's a hyphen
   */
  const isHyphen = (sep) => sep === SEPARATORS.HYPHEN || sep === SEPARATORS.NON_BREAKING_HYPHEN;
  
  /**
   * Check if a word is numeric
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's numeric
   */
  const isNumeric = (w) => REGEX_PATTERNS.NUMERIC.test(w);
  
  /**
   * Check if a word is a proper noun (capitalized)
   * @param {string} w - Word to check
   * @returns {boolean} - True if it looks like a proper noun
   */
  const isProperNoun = (w) => REGEX_PATTERNS.PROPER_NOUN.test(w);

  /**
   * Check if two adjacent words form a fixed expression or brand name
   * @param {Object} curr - Current word metrics
   * @param {Object} next - Next word metrics
   * @param {string} separator - Separator between words
   * @returns {boolean} - True if it's a fixed expression or brand name
   */
  function isFixedExpressionOrAppleService(curr, next, separator) {
    // Combine words with separator
    const combined = `${curr.text}${separator}${next.text}`;
    
    // Check against fixed expressions (including regex patterns)
    if (fixedExpressions) {
      for (const expr of fixedExpressions) {
        // Check for exact match with the combined expression
        if (new RegExp(`^${expr}$`, 'i').test(combined)) return true;
        
        // Special handling for hyphenated expressions that might be split during tokenization
        if (typeof expr === 'string' && expr.includes('-')) {
          const [first, second] = expr.split('-');
          // Check if this is a pair of words that match a hyphenated expression
          // even if they're not currently joined with a hyphen in the text
          if (first && second && 
              curr.text.toLowerCase() === first.toLowerCase() && 
              next.text.toLowerCase() === second.toLowerCase()) {
            return true;
          }
        }
      }
    }
    
    // Check against brand/service names
    if (appleServices) {
      for (const service of appleServices) {
        if (service.toLowerCase() === combined.toLowerCase()) return true;
      }
    }
    return false;
  }

  // Check for violations in each pair of adjacent words
  for (let i = 0; i < wordMetricsArray.length - 1; i++) {
    const curr = wordMetricsArray[i];
    const next = wordMetricsArray[i + 1];
    const separator = curr.separator;

    // Get text safely
    const currText = curr.text || curr.segment || '';
    const nextText = next.text || next.segment || '';

    // Avoid break after hyphen
    if (rules?.avoidBreakAfter?.includes("hyphen") && isHyphen(separator)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in hyphenated compound"]);
    }

    // Avoid break in fixed expressions or Apple services
    if (
      (rules?.avoidBreakBetween?.includes("fixedExpressions") || rules?.avoidBreakBetween?.includes("appleServices")) &&
      isFixedExpressionOrAppleService(curr, next, separator)
    ) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in fixed expression/Apple service"]);
      // Mark both the current and next words with avoid line breaking
      wordMetricsArray[i].lineBreaking = "avoid";  // Mark the first part as "avoid"
      if (i < wordMetricsArray.length - 1) {
        wordMetricsArray[i+1].lineBreaking = "avoid"; // Mark the second part as "avoid" too
      }
    }

    // French Rule: Articles/Prepositions should never be at the end of a line
    if (rules?.avoidBreakAfter?.includes("articles") && isFunctionWord(currText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Articles/prepositions should not be at the end of a line"]);
    }

    // Avoid break before function word (articles, etc.)
    if (rules?.avoidBreakBefore?.includes("articles") && isFunctionWord(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break before function word"]);
    }
    
    // French Rule: Adjectives should not be separated from what they describe
    if (rules?.avoidBreakBetween?.includes("adjectiveNoun") && isAdjective(currText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Adjective should stay with what it describes"]);
    }
    
    // French Rule: Don't separate names
    if (rules?.avoidBreakBetween?.includes("personNames") && 
        ((isPersonPrefix(currText) && isProperNoun(nextText)) || 
         (isProperNoun(currText) && isProperNoun(nextText)))) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Don't separate names"]);
    }
    
    // French Rule: Units/percent symbols stay with preceding numbers
    if (rules?.avoidBreakAfter?.includes("units") && 
        isNumeric(currText) && (nextText === '%' || isUnit(nextText))) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Units stay with preceding numbers"]);
    }
    
    // Apple brand services should remain on a single line
    if (rules?.avoidBreakBetween?.includes("appleServices")) {
      // Check a range of words for Apple service names
      const possibleServiceText = wordMetricsArray
        .slice(Math.max(0, i-2), Math.min(wordMetricsArray.length, i+3))
        .map(m => m.text || '')
        .join(' ');
      
      for (const service of appleServices || []) {
        if (possibleServiceText.includes(service)) {
          violations.push([i, `'${currText}' | '${nextText}'`, "Apple brands should remain on a single line"]);
          break;
        }
      }
    }
    
    // Game and app names should remain on a single line
    if (rules?.avoidBreakBetween?.includes("appGameNames")) {
      // Check a range of words for game names
      const possibleGameText = wordMetricsArray
        .slice(Math.max(0, i-1), Math.min(wordMetricsArray.length, i+2))
        .map(m => m.text || '')
        .join(' ');
      
      for (const game of appGameNames || []) {
        if (possibleGameText.includes(game)) {
          violations.push([i, `'${currText}' | '${nextText}'`, "Game names should remain on a single line"]);
          break;
        }
      }
    }

    // Avoid break between proper nouns
    if (rules?.avoidBreakBetween?.includes("properNounSequence") && isProperNoun(currText) && isProperNoun(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in name/brand"]);
    }

    // Avoid break for scores (e.g., "100 Punkte")
    if (isNumeric(currText) && REGEX_PATTERNS.SCORE_PATTERN.test(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in score"]);
    }

    // JP: Avoid break before periods
    if (
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(nextText)
    ) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Do not break before Japanese period"]);
    }
    
    // French Rule: Colon handling
    if (nextText === ':' && rules?.removeColonAtLineEnd) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Colon may need special handling at line breaks"]);
    }
  }

  return violations;
}
