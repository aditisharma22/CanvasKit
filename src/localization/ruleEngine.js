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
  const { locale, rules, functionWords, fixedExpressions, appleServices, periods } = ruleConfig || {};
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
   * Determines if two adjacent words form a fixed expression or an Apple service name
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
    
    // Check against brand/service names with improved matching
    if (appleServices) {
      for (const service of appleServices) {
        // Direct match
        if (service.toLowerCase() === combined.toLowerCase()) return true;
        
        // Prefix match for multi-word services (e.g., "Apple Music Super Bowl")
        if (combined.toLowerCase() === service.toLowerCase()) return true;
        
        // Check if the two words are the start of a service name
        // This handles cases like "Apple Music" from "Apple Music Super Bowl"
        if (service.toLowerCase().startsWith(combined.toLowerCase() + " ")) return true;
      }
    }
    return false;
  }

  // --- Apple Service Brand Name Detection (multi-word, e.g., 'Apple Music') ---
  if (rules?.avoidBreakBetween?.includes("appleServices") && appleServices) {
    // For each Apple service, scan the word sequence for matches
    for (const service of appleServices) {
      const serviceParts = service.split(' ');
      if (serviceParts.length < 2) continue;
      
      for (let i = 0; i <= wordMetricsArray.length - serviceParts.length; i++) {
        let match = true;
        for (let j = 0; j < serviceParts.length; j++) {
          if (!wordMetricsArray[i + j] || 
              wordMetricsArray[i + j].text.toLowerCase() !== serviceParts[j].toLowerCase()) {
            match = false;
            break;
          }
        }
        
        if (match) {
          // This is critically important for proper line breaking in services like "Apple Music"
          console.log(`Found ${service} match at position ${i}`);
          
          // 1. Mark all possible word pairs in the service name as violations
          for (let j = 0; j < serviceParts.length - 1; j++) {
            violations.push([
              i + j, 
              `'${wordMetricsArray[i + j].text}' | '${wordMetricsArray[i + j + 1].text}'`, 
              `Avoid break in Apple service name (${service})`
            ]);
          }
          
          // 2. DIRECT ENFORCEMENT: Explicitly set lineBreaking="avoid" on all words in the service
          for (let j = 0; j < serviceParts.length; j++) {
            if (i + j < wordMetricsArray.length) {
              // Force this to be "avoid" regardless of what else happens
              wordMetricsArray[i + j].lineBreaking = 'avoid';
              wordMetricsArray[i + j]._violationReason = `Apple service: ${service}`;
              
              // Make this stand out in logs for debugging
              console.log(`DIRECT MARK: Set ${wordMetricsArray[i + j].text} to AVOID (${service})`);
            }
          }
          
          // Log the match for debugging purposes
          console.log(`Found service match for "${service}" at index ${i}`);
        }
      }
    }
    
    // Direct check for "Apple Music" (the main case we need to ensure is handled)
    for (let i = 0; i < wordMetricsArray.length - 1; i++) {
      if (wordMetricsArray[i].text === "Apple" && wordMetricsArray[i + 1].text === "Music") {
        console.log("Direct Apple Music match at index", i);
        violations.push([
          i, 
          `'Apple' | 'Music'`, 
          "Avoid break in Apple Music (prioritized)"
        ]);
      }
    }
  }

  // Ensure that both words in multi-word Apple service names are marked as 'avoid'
  function markAppleServiceWordsAsAvoid(wordMetricsArray, violations) {
    violations.forEach(([index, violatedPair, reason]) => {
      if (reason.includes("Apple service") || reason.includes("Apple Music")) {
        // Mark the word at the violation index
        if (index >= 0 && index < wordMetricsArray.length) {
          wordMetricsArray[index].lineBreaking = "avoid";
          wordMetricsArray[index]._violationReason = reason;
        }
        
        // Also mark the next word as 'avoid'
        if (index + 1 < wordMetricsArray.length) {
          wordMetricsArray[index + 1].lineBreaking = "avoid";
          wordMetricsArray[index + 1]._violationReason = reason;
        }
      }
    });
  }

  // Mark Apple service words as 'avoid'
  markAppleServiceWordsAsAvoid(wordMetricsArray, violations);

  // Check for violations in each pair of adjacent words (other rules)
  for (let i = 0; i < wordMetricsArray.length - 1; i++) {
    const curr = wordMetricsArray[i];
    const next = wordMetricsArray[i + 1];
    const separator = curr.separator;

    // Avoid break after hyphen
    if (rules?.avoidBreakAfter?.includes("hyphen") && isHyphen(separator)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in hyphenated compound"]);
    }

    // Avoid break in fixed expressions or other services
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
    
    // Handle specific French articles case sensitivity
    if (locale === 'fr' && rules?.avoidBreakBefore?.includes("articles")) {
      // Use only the function words defined in the fr.js file for French
      if (functionWords && functionWords.includes(next.text.toLowerCase())) {
        violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break before French article/function word"]);
      }
    }

    // Avoid break between proper nouns
    if (rules?.avoidBreakBetween?.includes("properNounSequence") && isProperNoun(curr.text) && isProperNoun(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in name/brand"]);
    }

    // Avoid break for scores (e.g., "100 Punkte")
    if (isNumeric(curr.text) && REGEX_PATTERNS.SCORE_PATTERN.test(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in score"]);
    }

    // Avoid break before periods (especially important for Japanese)
    if (
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(next.text)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Do not break before period"]);
    }
    
    // Avoid break before punctuation (applicable to all locales)
    if (
      rules?.avoidBreakBefore?.includes("punctuation") && 
      ruleConfig.punctuation &&
      ruleConfig.punctuation.includes(next.text)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Do not break before punctuation"]);
      // Also mark the punctuation itself with avoid
      next.lineBreaking = "avoid";
      next._violationReason = "Punctuation";
    }
    
    // Special handling for standalone punctuation marks - force override any existing value
    if (
      ruleConfig.punctuation && 
      ruleConfig.punctuation.includes(curr.text)
    ) {
      // Force mark punctuation as avoid (overriding any other value)
      if (typeof curr.lineBreaking === 'object') {
        console.log(`Fixing complex lineBreaking value for punctuation: ${curr.text}`);
      }
      curr.lineBreaking = "avoid";
      curr._violationReason = "Standalone punctuation";
    }
  }

  return violations;
}
