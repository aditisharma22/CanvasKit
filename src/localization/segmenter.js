import { testCases } from "./testData.js";
import { segmentsToWordMetrics } from "./segmenterUtils.js";
import { annotateLineBreakingWithSeparators, applySegmentationRules } from "./ruleEngine.js";
import ruleEngine from "./rules/ruleConfigs.js";

/**
 * Segments text based on locale using Intl.Segmenter
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
  
  // Default to Intl.Segmenter for most languages
  try {
    const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
    return [...segmenter.segment(text)];
  } catch (err) {
    console.warn(`Segmentation failed for ${locale}, falling back to default`, err);
    // Fallback to basic space-based segmentation if Intl.Segmenter fails
    return text.split(/\s+/).map((word, idx) => {
      const index = idx === 0 ? 0 : text.indexOf(word, previousEnd);
      const previousEnd = index + word.length;
      return {
        segment: word,
        index,
        isWordLike: true
      };
    });
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
  
  // Check for rule violations (can be used for validation or debugging)
  if (rulesConfig.rules && typeof applySegmentationRules === "function") {
    const violations = applySegmentationRules(wordMetricsArray, rulesConfig);
    if (violations.length > 0) {
      console.debug("Line breaking rule violations detected:", violations);
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
export async function runTestCases() {
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
      
      // Figure out the separator - typically space between words or punctuation at the end
      let separator = " ";
      let separatorCharCount = 1;
      
      if (isLast) {
        // Check if text ends with punctuation
        const lastChar = text.charAt(text.length - 1);
        if (lastChar === '.' || lastChar === ',' || lastChar === '!' || lastChar === '?') {
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
