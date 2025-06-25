import { testCases } from "./testData.js";
import { segmentsToWordMetrics } from "./segmenterUtils.js";
import { annotateLineBreakingWithSeparators, applySegmentationRules } from "./ruleEngine.js";
import ruleEngine from "./rules/ruleConfigs.js";

/**
 * Segments text based on locale using Intl.Segmenter
 * 
 * @param {string} text - The text to segment
 * @param {string} locale - The locale/language code (e.g., "en", "ja", "th")
 * @returns {Array} - Array of segment objects
 */
export async function segmentText(text, locale = "en") {
  try {
    // Use the browser's built-in Intl.Segmenter if available
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return [...segmenter.segment(text)];
  } catch (err) {
    console.warn(`Segmentation failed for ${locale}, falling back to default`, err);
    
    // Fallback to basic space-based segmentation if Intl.Segmenter fails
    const segments = [];
    let currentPos = 0;
    const words = text.split(/\s+/);
    
    for (const word of words) {
      if (!word) continue;
      
      const index = text.indexOf(word, currentPos);
      if (index !== -1) {
        segments.push({
          segment: word,
          index,
          isWordLike: true
        });
        currentPos = index + word.length;
      }
    }
    
    return segments;
  }
}

/**
 * Process text for line-breaking based on locale-specific rules
 * @param {string} text - Text to process
 * @param {string} locale - Locale code
 * @returns {Array} - Array of word metrics with line breaking annotations
 */
export async function processTextForLineBreaking(text, locale = "en") {
  const segments = await segmentText(text, locale);
  const rulesConfig = ruleEngine[locale] || {};

  // Apply line breaking rules and get annotations
  const lineBreakingAnnotations = annotateLineBreakingWithSeparators(segments, rulesConfig);
  let wordMetricsArray = segmentsToWordMetrics(segments, text, lineBreakingAnnotations);
  
  // Apply additional segmentation rules to identify line-breaking constraints
  wordMetricsArray = annotateLineBreakingWithSeparators(wordMetricsArray, rulesConfig);
  
  // Check for rule violations and update metrics accordingly
  if (rulesConfig.rules && typeof applySegmentationRules === "function") {
    const violations = applySegmentationRules(wordMetricsArray, rulesConfig);
    if (violations.length > 0) {
      // Mark the break *after* the word at index as 'avoid' (i.e., for the break between index and index+1)
      for (const [index, violatedPair, reason] of violations) {
        // Mark the break after the word at index as 'avoid'
        if (index >= 0 && index < wordMetricsArray.length - 1) {
          wordMetricsArray[index].lineBreaking = 'avoid';
          wordMetricsArray[index]._violationReason = reason;
        }
        
        // Enhanced handling for multi-word Apple services
        if (reason && (reason.includes('Apple service') || reason.includes('fixed expression'))) {
          // First, handle the current violation by marking both words
          // Mark the word at index as 'avoid'
          if (index >= 0 && index < wordMetricsArray.length) {
            wordMetricsArray[index].lineBreaking = 'avoid';
            wordMetricsArray[index]._violationReason = reason;
          }
          
          // Mark the next word as 'avoid' too
          if (index + 1 < wordMetricsArray.length) {
            wordMetricsArray[index + 1].lineBreaking = 'avoid';
            wordMetricsArray[index + 1]._violationReason = reason;
          }
          
          // Special handling for Apple service names like "Apple Music"
          if (locale === 'fr' && 
              index >= 0 && index < wordMetricsArray.length &&
              index + 1 < wordMetricsArray.length &&
              wordMetricsArray[index].text === 'Apple' && 
              ['Music', 'Books', 'One', 'Arcade', 'TV+'].includes(wordMetricsArray[index + 1].text)) {
              
            console.log(`French Apple service detected: ${wordMetricsArray[index].text} ${wordMetricsArray[index + 1].text}`);
            // Double ensure both words get marked as avoid
            wordMetricsArray[index].lineBreaking = 'avoid';
            wordMetricsArray[index + 1].lineBreaking = 'avoid';
            wordMetricsArray[index]._violationReason = 'Apple service name (fr)';
            wordMetricsArray[index + 1]._violationReason = 'Apple service name (fr)';
          }
        }
      }
    }
    
    // For French locale, do an extra pass to ensure all Apple Services are marked correctly
    // but only if the rule is enabled in the fr.js config
    if (locale === 'fr' && 
        rulesConfig.rules?.avoidBreakBetween?.includes("appleServices") && 
        rulesConfig.appleServices) {
      
      // Only proceed if this rule is actually defined for French
      console.log("Applying French-specific Apple service rules");
      
      for (const service of rulesConfig.appleServices) {
        const serviceWords = service.split(' ');
        if (serviceWords.length < 2) continue;
        
        // Look for matches to the service name
        for (let i = 0; i <= wordMetricsArray.length - serviceWords.length; i++) {
          let foundMatch = true;
          for (let j = 0; j < serviceWords.length; j++) {
            if (i + j >= wordMetricsArray.length || 
                wordMetricsArray[i + j].text.toLowerCase() !== serviceWords[j].toLowerCase()) {
              foundMatch = false;
              break;
            }
          }
          
          if (foundMatch) {
            console.log(`Service match for ${service} at index ${i}`);
            // Mark all words in the service name
            for (let j = 0; j < serviceWords.length; j++) {
              wordMetricsArray[i + j].lineBreaking = 'avoid';
              wordMetricsArray[i + j]._violationReason = `Apple service name (${service})`;
            }
          }
        }
      }
    }
    
    // Final pass to ensure punctuation is always marked as avoid
    // but only if the punctuation rule is explicitly enabled for this locale
    if (rulesConfig.punctuation && rulesConfig.rules?.avoidBreakBefore?.includes("punctuation")) {
      console.log(`Applying punctuation rules for ${locale}`);
      
      for (let i = 0; i < wordMetricsArray.length; i++) {
        const word = wordMetricsArray[i];
        
        // Check if this word is a punctuation mark
        if (rulesConfig.punctuation.includes(word.text)) {
          console.log(`[Segmenter] Found punctuation: "${word.text}" at position ${i}`);
          // Force override any existing value
          word.lineBreaking = 'avoid';
          word._violationReason = 'Punctuation mark';
        }
        
        // Also check for words before punctuation
        if (i < wordMetricsArray.length - 1 && rulesConfig.punctuation.includes(wordMetricsArray[i + 1].text)) {
          word.lineBreaking = 'avoid';
          word._violationReason = 'Word before punctuation';
        }
      }
    }
  }
  

  
  return wordMetricsArray;
}

/**
 * Get line breaking rules for a specific locale
 * @param {string} locale - The locale code
 * @returns {Object|null} - Rules configuration for the locale
 */
export function getLineBreakingRules(locale) {
  return ruleEngine[locale] || null;
}

/**
 * Run test cases to demonstrate localization segmentation with beautified JSON output
 */
/**
 * Run test cases to demonstrate localization segmentation with beautified JSON output
 * @returns {Array} - Array of test results with formatted metrics
 */
export async function runTestCases() {
  // Define constants for separators and punctuation
  const DEFAULT_SEPARATOR = " ";
  const DEFAULT_SEPARATOR_CHAR_COUNT = 1;
  const END_PUNCTUATION = ['.', ',', '!', '?', ';', ':'];
  
  const allResults = [];
  
  for (const { locale, text } of testCases) {
    const wordMetrics = await processTextForLineBreaking(text, locale);
    
    // Format wordMetrics with additional properties to match requested format
    let currentPosition = 0;
    const formattedMetrics = wordMetrics.map((w, i) => {
      const isLast = i === wordMetrics.length - 1;
      
      // Calculate boundary based on the position in original text
      const start = w.index || currentPosition;
      const end = start + w.text.length;
      currentPosition = end + 1; // +1 for space or punctuation
      
      // Default separator configuration
      let separator = DEFAULT_SEPARATOR;
      let separatorCharCount = DEFAULT_SEPARATOR_CHAR_COUNT;
      
      // Handle last word's separator - check for punctuation
      if (isLast) {
        const lastChar = text.charAt(text.length - 1);
        if (END_PUNCTUATION.includes(lastChar)) {
          separator = lastChar;
        }
      }
      
      return {
        text: w.text,
        trimmedText: w.text.trim(),
        charCount: w.text.length,
        boundary: {
          start: start,
          end: end
        },
        rect: null,
        lineBreaking: isLast ? "avoid" : "allow",
        separator: separator,
        separatorWidth: 0,
        separatorCharCount: separatorCharCount
      };
    });
    
    // Format the output as a properly indented, beautified JSON
    const prettyFormattedMetrics = JSON.stringify(formattedMetrics, null, 2);
    
    // Output in exactly the requested format with pretty-printing
    console.log(`\n=== Locale: ${locale} ===`);
    console.log(`Input: "${text}"`);
    console.log("Line Break Opportunities:");
    console.log(prettyFormattedMetrics);
    
    // Also store for potential file output with consistent formatting
    const result = {
      locale,
      originalText: text,
      formattedMetrics
    };
    
    allResults.push(result);
  }
  
  return allResults;
}
