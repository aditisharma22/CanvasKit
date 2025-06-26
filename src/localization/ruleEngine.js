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
  // Extract rules and configuration from the rule configuration
  const { 
    rules, 
    periods, 
    functionWords, 
    appleServices, 
    appGameNames, 
    punctuation, 
    adjectives, 
    unitsOfMeasure,
    personNamePrefixes 
  } = ruleConfig || {};
  
  // Process each token in the word metrics array
  return wordMetricsArray.map((token, i, arr) => {
    // Start with existing line breaking setting or default to 'allow'
    let lineBreaking = token.lineBreaking || LINE_BREAK.ALLOW;
    
    // Get token text safely
    const tokenText = token.text || token.segment || '';
    
    // Rule: Avoid breaking after hyphens (compound words)
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakAfter?.includes("hyphen") &&
      (token.separator === SEPARATORS.HYPHEN || token.separator === SEPARATORS.NON_BREAKING_HYPHEN)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // Rule: Avoid breaking before punctuation (especially for French)
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBefore?.includes("punctuation") &&
      punctuation && 
      arr[i + 1] && typeof arr[i + 1].text === 'string' &&
      punctuation.includes(arr[i + 1].text)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // Rule: Avoid breaking after punctuation (especially for French)
    if (
      i > 0 &&
      rules?.avoidBreakBefore?.includes("punctuation") &&
      punctuation && 
      arr[i - 1] && typeof arr[i - 1].text === 'string' &&
      punctuation.includes(arr[i - 1].text)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // French Rule: Articles/Prepositions should never be at the end of a line
    if (
      i < arr.length - 1 &&
      functionWords && 
      typeof tokenText === 'string' && 
      rules?.avoidBreakAfter?.includes("articles") &&
      functionWords.includes(tokenText.toLowerCase())
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // Rule: Avoid breaking before function words (articles, prepositions)
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBefore?.includes("articles") &&
      functionWords && 
      arr[i + 1] && typeof arr[i + 1].text === 'string' &&
      functionWords.includes(arr[i + 1].text.toLowerCase())
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // French Rule: Don't separate names and person name prefixes
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBetween?.includes("personNames") &&
      personNamePrefixes && 
      typeof tokenText === 'string' && 
      personNamePrefixes.includes(tokenText)
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // French Rule: Keep adjectives with what they describe
    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBetween?.includes("adjectiveNoun") &&
      adjectives && 
      typeof tokenText === 'string' && 
      adjectives.includes(tokenText.toLowerCase())
    ) {
      lineBreaking = LINE_BREAK.AVOID;
    }
    
    // Rule: Avoid breaking between Apple brand services
    if (
      rules?.avoidBreakBetween?.includes("appleServices") &&
      appleServices
    ) {
      try {
        // First, check if this is the start of a service name
        const tokenText = token.text || token.segment || '';
        
        for (const service of appleServices) {
          const serviceLower = service.toLowerCase();
          const serviceWords = serviceLower.split(' ');
          
          // If this token matches the first word of a service
          if (tokenText.toLowerCase() === serviceWords[0] && i + serviceWords.length <= arr.length) {
            // Try to match the complete service name
            let isFullServiceMatch = true;
            let serviceWordIndices = [];
            
            // Mark current position
            serviceWordIndices.push(i);
            
            // Check if subsequent tokens form the service name
            let currentServiceWordIndex = 1;
            let j = 1;
            
            while (currentServiceWordIndex < serviceWords.length && i + j < arr.length) {
              const nextToken = arr[i + j];
              const nextText = nextToken?.text || nextToken?.segment || '';
              
              // Skip spaces when matching
              if (nextText.trim() === '') {
                j++;
                continue;
              }
              
              // Check if word matches service word
              if (nextText.toLowerCase() !== serviceWords[currentServiceWordIndex]) {
                isFullServiceMatch = false;
                break;
              }
              
              // Add this position to the service word indices
              serviceWordIndices.push(i + j);
              currentServiceWordIndex++;
              j++;
            }
            
            // If we found a complete service name
            if (isFullServiceMatch && currentServiceWordIndex >= serviceWords.length) {
              console.log(`RuleEngine: Found complete Apple service match for "${service}" at position ${i}`);
              
              // Mark all tokens as part of the service name including spaces between
              for (let k = i; k < i + j; k++) {
                if (arr[k]) {
                  arr[k].lineBreaking = LINE_BREAK.AVOID;
                  arr[k]._partOfAppleService = service; // Store which service this belongs to
                  arr[k]._serviceIndex = k - i; // Position within the service name
                }
              }
              
              // Set the current token
              lineBreaking = LINE_BREAK.AVOID;
            }
          }
          
          // Also check if this token is part of a service name (not the first word)
          const servicePhraseContext = arr
            .slice(Math.max(0, i-4), Math.min(arr.length, i+4))
            .filter(item => item && typeof item.text === 'string')
            .map(item => item.text)
            .join(' ')
            .toLowerCase();
          
          if (servicePhraseContext.includes(serviceLower)) {
            lineBreaking = LINE_BREAK.AVOID;
          }
        }
      } catch (error) {
        console.warn('Error checking Apple services:', error);
        // Continue processing without changing line breaking
      }
    }
    
    // Rule: Avoid breaking between game names
    if (
      rules?.avoidBreakBetween?.includes("appGameNames") &&
      appGameNames
    ) {
      try {
        // Check for game names in a window of words around the current position
        const gameName = arr
          .slice(Math.max(0, i-1), Math.min(arr.length, i+3))
          .filter(item => item && typeof item.text === 'string')
          .map(item => item.text)
          .join(' ')
          .trim();
        
        if (gameName) {
          for (const game of appGameNames) {
            if (gameName.includes(game)) {
              lineBreaking = LINE_BREAK.AVOID;
              break;
            }
          }
        }
      } catch (error) {
        console.warn('Error checking game names:', error);
      }
    }
    
    // Special rule for percent symbol and units of measurement
    // Don't break between a number and a percent symbol or unit
    if (
      i > 0 && 
      // Check if current token is a percent symbol or unit of measurement
      ((tokenText === '%') || 
       (unitsOfMeasure && unitsOfMeasure.includes(tokenText)))
    ) {
      // Check if previous token is numeric or another percent symbol
      const prevToken = arr[i-1];
      const prevText = prevToken?.text || prevToken?.segment || '';
      if (prevToken && typeof prevText === 'string' && 
          (/^\d+$/.test(prevText) || prevText === '%')) {
        lineBreaking = LINE_BREAK.AVOID;
        
        // Also mark the previous token (number or percent symbol) to avoid a line break
        if (prevToken) {
          prevToken.lineBreaking = LINE_BREAK.AVOID;
        }
      }
    }
    
    // Also check the reverse - if this is a number and next token is a percent symbol
    if (
      i < arr.length - 1 &&
      typeof tokenText === 'string' &&
      (/^\d+$/.test(tokenText) || tokenText === '%')
    ) {
      const nextToken = arr[i+1];
      const nextText = nextToken?.text || nextToken?.segment || '';
      
      if (nextText === '%' || (unitsOfMeasure && unitsOfMeasure.includes(nextText))) {
        lineBreaking = LINE_BREAK.AVOID;
      }
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
    
    // Special rule for colon handling (French typography)
    if (
      tokenText === ':' && 
      rules?.removeColonAtLineEnd
    ) {
      // When a colon is found, check if it should be moved or removed
      // This will be handled during layout in index.html
      token._specialColon = true;
    }

    // Handle case where token itself is used as lineBreaking value
    if (token.lineBreaking && typeof token.lineBreaking === 'object' && token.lineBreaking.lineBreaking) {
      lineBreaking = token.lineBreaking.lineBreaking;
    }
    
    // Return updated token with line breaking annotation - ensure it's a string
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
