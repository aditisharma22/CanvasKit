/**
 * Rule engine for line breaking in localized text
 * Applies language-specific rules to determine where line breaks should be avoided
 */

// Constants for line breaking behavior
const LINE_BREAK = {
  ALLOW: 'allow',
  AVOID: 'avoid'
};

// Constants for special characters
const SEPARATORS = {
  HYPHEN: '-',
  NON_BREAKING_HYPHEN: '\u2011'
};

// Regular expression patterns for text classification
const REGEX_PATTERNS = {
  PUNCTUATION: /^[.,:;!?%)]$/,
  NUMERIC: /^\d+$/,
  PROPER_NOUN: /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/,
  SCORE_PATTERN: /^(Punkte|punkt|Punkte\.)$/i
};

/**
 * Annotate word metrics with line breaking constraints based on separators
 * 
 * @param {Array} wordMetricsArray - Array of word metrics objects
 * @param {Object} ruleConfig - Language-specific rule configuration
 * @returns {Array} - Updated word metrics with line breaking annotations
 */
export function annotateLineBreakingWithSeparators(wordMetricsArray, ruleConfig) {
  // Extract rules and periods from the rule configuration
  const { rules, periods } = ruleConfig || {};
  
  // Process each token in the word metrics array
  return wordMetricsArray.map((token, i, arr) => {
    // Start with existing line breaking setting or default to 'allow'
    let lineBreaking = token.lineBreaking || LINE_BREAK.ALLOW;

    // Rule: Avoid breaking after hyphens (compound words)
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakAfter?.includes("hyphen") &&
      (token.separator === SEPARATORS.HYPHEN || token.separator === SEPARATORS.NON_BREAKING_HYPHEN)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }

    // Rule: Avoid breaking before periods in specific contexts
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(arr[i + 1].text)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }

    // Return updated token with line breaking annotation
    return { ...token, lineBreaking };
  });
}

/**
 * Apply segmentation rules to find potential line breaking violations
 * This helps validate the line breaking constraints and identify problematic areas
 * 
 * @param {Array} wordMetricsArray - Array of word metrics objects
 * @param {Object} ruleConfig - Language-specific rule configuration
 * @returns {Array} - List of violations found
 */
export function applySegmentationRules(wordMetricsArray, ruleConfig) {
  // Extract rule configurations
  const { rules, functionWords, fixedExpressions, appleServices, periods } = ruleConfig || {};
  const violations = [];

  // Helper functions for rule checking
  
  /**
   * Check if a word is a function word (article, preposition, etc.)
   * @param {string} w - Word to check
   * @returns {boolean} - True if it's a function word
   */
  const isFunctionWord = (w) => functionWords?.includes(w?.toLowerCase());
  
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
        if (new RegExp(`^${expr}$`, 'i').test(combined)) return true;
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

    // Avoid break after hyphen
    if (rules?.avoidBreakAfter?.includes("hyphen") && isHyphen(separator)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in hyphenated compound"]);
    }

    // Avoid break in fixed expressions or Apple services
    if (
      (rules?.avoidBreakBetween?.includes("fixedExpressions") || rules?.avoidBreakBetween?.includes("appleServices")) &&
      isFixedExpressionOrAppleService(curr, next, separator)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in fixed expression/Apple service"]);
    }

    // Avoid break before function word (articles, etc.)
    if (rules?.avoidBreakBefore?.includes("articles") && isFunctionWord(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break before function word"]);
    }

    // Avoid break between proper nouns
    if (rules?.avoidBreakBetween?.includes("properNounSequence") && isProperNoun(curr.text) && isProperNoun(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in name/brand"]);
    }

    // Avoid break for scores (e.g., "100 Punkte")
    if (isNumeric(curr.text) && REGEX_PATTERNS.SCORE_PATTERN.test(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in score"]);
    }

    // JP: Avoid break before periods
    if (
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(next.text)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Do not break before Japanese period"]);
    }
    
  }

  return violations;
}
