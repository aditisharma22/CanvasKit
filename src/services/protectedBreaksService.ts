// Protected breaks detection service
import { ProtectedBreakResult } from '../types';
import { localeConfigManager } from '../localization/LocaleConfigManager';

/**
 * Detect protected breaks using locale rules
 * @param candidateLines - The lines to check for protected breaks
 * @param locale - The locale to use for rules
 * @param isLocalizationEnabled - Whether localization is enabled
 * @returns Object with break count and line indices
 */
export function detectProtectedBreaks(
  candidateLines: string[][] | null,
  locale: string,
  isLocalizationEnabled = true
): ProtectedBreakResult {
  // Skip if no lines or only one line
  if (!candidateLines || candidateLines.length <= 1) {
    return { count: 0, lines: [] };
  }
  
  // If localization is disabled, use basic rules only
  if (!isLocalizationEnabled) {
    // When localization is disabled, we still check for widows and orphans,
    // but not language-specific protected breaks
    let violations = 0;
    let protectedBreakLines: number[] = [];
    
    // Check for widows only when localization is disabled
    if (candidateLines.length > 1 && candidateLines[candidateLines.length - 1].length === 1) {
      violations++;
    }
    
    return { count: violations, lines: protectedBreakLines };
  }
  
  // With localization enabled, apply full rules:
  try {
    // LOCALE-SPECIFIC RULES
    switch (locale) {
      case 'fr':
        return detectFrenchProtectedBreaks(candidateLines);
      case 'de':
        return detectGermanProtectedBreaks(candidateLines);
      case 'es':
        return detectSpanishProtectedBreaks(candidateLines);
      case 'ja':
        return detectJapaneseProtectedBreaks(candidateLines);
      default:
        // For English and other languages, use standard rules with specified locale
        return detectStandardProtectedBreaks(candidateLines, locale);
    }
  } catch (error) {
    console.error(`Error detecting protected breaks for locale ${locale}:`, error);
    // Fallback to standard detection
    return detectStandardProtectedBreaks(candidateLines, 'en');
  }
}

/**
 * Standard protected breaks check (mainly English and similar languages)
 * @param candidateLines - The lines to check
 * @param locale - The locale to use for rules
 * @returns Object with break count and line indices
 */
export function detectStandardProtectedBreaks(
  candidateLines: string[][],
  locale = 'en'
): ProtectedBreakResult {
  let violations = 0;
  let protectedBreakLines: number[] = [];
  
  try {
    // Get the configuration for the specified locale
    const config = localeConfigManager.getConfig(locale);
    
    // Get all the word lists we need from configuration
    const prepositions = config.prepositions || [];
    const articles = config.articles || [];
    const conjunctions = config.conjunctions || [];
    
    // Get function words from config or create from parts
    const functionWords = config.functionWords || 
      [...prepositions, ...articles, ...conjunctions];
    
    // Get units of measure from config
    const unitsOfMeasure = config.unitsOfMeasure || [];
    
    // Check each line except the last
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      
      // Skip empty lines
      if (!Array.isArray(line) || line.length === 0) {
        continue;
      }
      
      // Get last word of this line
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, ''); // Remove punctuation
      
      // Check if last word is a function word (preposition, article, etc.)
      if (functionWords.includes(lastWord)) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for hyphenated words broken across lines
      if (lastWord.endsWith('-') && i < candidateLines.length - 1) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for numbers separated from their units
      if (/^\d+$/.test(lastWord) && i < candidateLines.length - 1) {
        const nextLine = candidateLines[i+1];
        if (nextLine.length > 0 && unitsOfMeasure.includes(nextLine[0].toLowerCase())) {
          violations++;
          protectedBreakLines.push(i);
        }
      }
    }
    
    // Check for widows
    if (candidateLines.length > 1 && candidateLines[candidateLines.length - 1].length === 1) {
      violations++;
      // Widow is not a protected break in the same sense, so we don't add it to protectedBreakLines
    }
  } catch (error) {
    console.error('Error in standard protected break detection:', error);
  }
  
  return { count: violations, lines: protectedBreakLines };
}

/**
 * French-specific protected breaks check
 * @param candidateLines - The lines to check
 * @returns Object with break count and line indices
 */
export function detectFrenchProtectedBreaks(candidateLines: string[][]): ProtectedBreakResult {
  let violations = 0;
  let protectedBreakLines: number[] = [];
  
  try {
    // Get French locale config
    const config = localeConfigManager.getConfig('fr');
    
    // Get French function words from config
    const frenchFunctionWords = config.functionWords || [];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for French function words at line end
      if (frenchFunctionWords.includes(lastWord)) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for colon at line end (should be avoided in French typography)
      // This can be controlled by config.rules.removeColonAtLineEnd
      if (lastWord.endsWith(':')) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for quotation marks and guillemets
      if (lastWord.includes('«') && !lastWord.includes('»')) {
        violations++;
        protectedBreakLines.push(i);
      }
    }
  } catch (error) {
    console.error('Error in French protected break detection:', error);
  }
  
  return { count: violations, lines: protectedBreakLines };
}

/**
 * German-specific protected breaks check
 * @param candidateLines - The lines to check
 * @returns Object with break count and line indices
 */
export function detectGermanProtectedBreaks(candidateLines: string[][]): ProtectedBreakResult {
  let violations = 0;
  let protectedBreakLines: number[] = [];
  
  try {
    // Get German locale config
    const config = localeConfigManager.getConfig('de');
    
    // Get German function words from config
    const germanFunctionWords = config.functionWords || [];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for German function words at line end
      if (germanFunctionWords.includes(lastWord)) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for compound nouns broken improperly
      // German often has long compound words, but this is a simple check
      // We can use config.rules?.compoundWords if available
      if ((config.rules?.compoundWords && config.rules.compoundWords.some(compound => 
           typeof compound === 'string' && compound.includes('-') && compound.split('-')[0] === lastWord)) || 
          (lastWord.length > 8 && lastWord.endsWith('-'))) {
        violations++;
        protectedBreakLines.push(i);
      }
    }
  } catch (error) {
    console.error('Error in German protected break detection:', error);
  }
  
  return { count: violations, lines: protectedBreakLines };
}

/**
 * Spanish-specific protected breaks check
 * @param candidateLines - The lines to check
 * @returns Object with break count and line indices
 */
export function detectSpanishProtectedBreaks(candidateLines: string[][]): ProtectedBreakResult {
  let violations = 0;
  let protectedBreakLines: number[] = [];
  
  try {
    // Get Spanish locale config
    const config = localeConfigManager.getConfig('es');
    
    // Get Spanish function words from config
    const spanishFunctionWords = config.functionWords || [];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for Spanish function words at line end
      if (spanishFunctionWords.includes(lastWord)) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      // Check for opening punctuation without closing
      // Spanish specific rules for opening/closing punctuation
      if (lastWord.includes('¿') && !lastWord.includes('?')) {
        violations++;
        protectedBreakLines.push(i);
      }
      
      if (lastWord.includes('¡') && !lastWord.includes('!')) {
        violations++;
        protectedBreakLines.push(i);
      }
    }
  } catch (error) {
    console.error('Error in Spanish protected break detection:', error);
  }
  
  return { count: violations, lines: protectedBreakLines };
}

/**
 * Japanese-specific protected breaks check
 * @param candidateLines - The lines to check
 * @returns Object with break count and line indices
 */
export function detectJapaneseProtectedBreaks(candidateLines: string[][]): ProtectedBreakResult {
  let violations = 0;
  let protectedBreakLines: number[] = [];
  
  try {
    // Get Japanese locale config
    const config = localeConfigManager.getConfig('ja');
    
    // Get Japanese punctuation from config
    const japanesePunctuation = config.punctuation || [];
    
    // Check each line - in Japanese, we need to check individual characters
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1];
      if (!lastWord) continue;
      
      let lineHasViolation = false;
      
      // Check for Japanese opening brackets without closing
      // These pairs should be defined in the config
      const bracketsRules = config.rules?.bracketPairs || {};
      
      Object.entries(bracketsRules).forEach(([opening, closing]) => {
        const openStr = opening as string;
        const closeStr = closing as string;
        if (typeof lastWord === 'string' && lastWord.includes(openStr) && !lastWord.includes(closeStr)) {
          violations++;
          lineHasViolation = true;
        }
      });
      
      // Japanese punctuation rules
      const lastChar = lastWord.charAt(lastWord.length - 1);
      if (japanesePunctuation.includes(lastChar)) {
        // Punctuation should not end a line
        violations++;
        lineHasViolation = true;
      }
      
      if (lineHasViolation) {
        protectedBreakLines.push(i);
      }
    }
  } catch (error) {
    console.error('Error in Japanese protected break detection:', error);
  }
  
  return { count: violations, lines: protectedBreakLines };
}

/**
 * Detect hyphen breaks in lines
 * @param lines - The lines to check
 * @returns Count of hyphen breaks
 */
export function detectHyphenBreaks(lines: (string[] | string)[]): number {
  let count = 0;
  
  if (!Array.isArray(lines)) {
    return 0;
  }
  
  try {
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (Array.isArray(line) && line.length > 0) {
        const lastWord = line[line.length - 1];
        if (lastWord.endsWith('-')) {
          count++;
        }
      } else if (typeof line === 'string') {
        const words = line.split(/\s+/);
        const lastWord = words[words.length - 1];
        if (lastWord && lastWord.endsWith('-')) {
          count++;
        }
      }
    }
  } catch (error) {
    console.error('Error detecting hyphen breaks:', error);
  }
  
  return count;
}
