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
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
      const segments = [...segmenter.segment(text)];
      
      // Create a map of all characters already included in segments to avoid duplicates
      const processedCharPositions = new Map();
      
      segments.forEach(seg => {
        if (seg && seg.segment && typeof seg.segment === 'string' && seg.index !== undefined) {
          for (let i = 0; i < seg.segment.length; i++) {
            processedCharPositions.set(seg.index + i, true);
          }
        }
      });
      
      // Now create enhanced segments with special character handling
      const enhancedSegments = [];
      
      for (const seg of segments) {
        enhancedSegments.push(seg);
        
        // Check if we need to add a special character segment, but only if not already included
        if (seg.index !== undefined && seg.segment && 
            seg.index + seg.segment.length < text.length) {
          
          const specialCharPosition = seg.index + seg.segment.length;
          
          // Skip if this position has already been processed
          if (processedCharPositions.has(specialCharPosition)) {
            continue;
          }
          
          const nextChar = text[specialCharPosition];
          
          // If the next character is a special character and not already processed
          if (nextChar === '%' || nextChar === '°' || nextChar === '€' || nextChar === '$') {
            // Mark this position as processed
            processedCharPositions.set(specialCharPosition, true);
            
            // Add the special character as its own segment
            enhancedSegments.push({
              segment: nextChar,
              index: specialCharPosition,
              isWordLike: true, // Treat as word-like to ensure it's processed
              input: text
            });
          }
        }
      }
      
      return enhancedSegments;
    } else {
      throw new Error('Intl.Segmenter not available');
    }
  } catch (err) {
    console.warn(`Segmentation failed for ${locale}, falling back to improved default`, err);
    
    // Enhanced fallback segmentation that handles special characters and preserves spaces
    const segments = [];
    let processedPositions = new Map();
    
    // First pass: Use a regex that properly handles all character types
    const pattern = /([^\s%°€$\w]|[\w]+|[\s]+|[%°€$])/g;
    
    // Create a non-overlapping segmentation
    let prevEnd = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const segment = match[0];
      const index = match.index;
      
      // Skip invalid segments or already processed positions
      if (!segment || processedPositions.has(index)) continue;
      
      // Track all positions in this segment to avoid duplicates
      for (let i = 0; i < segment.length; i++) {
        processedPositions.set(index + i, true);
      }
      
      // Update prevEnd to ensure no gaps or overlaps
      prevEnd = index + segment.length;
      
      // Classify the segment
      const isWordLike = /\w/.test(segment);
      const isSpace = /^\s+$/.test(segment);
      const isSpecialChar = /^[%°€$]$/.test(segment);
      
      segments.push({
        segment,
        index,
        isWordLike: isWordLike || isSpecialChar, // Treat special chars as word-like
        isSpace,
        input: text
      });
      
      currentPos = index + segment.length;
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
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text input for processTextForLineBreaking:', text);
      return [];
    }
    
    // Get text segments
    const segments = await segmentText(text, locale);
    
    // Validate segments
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      console.warn('No valid segments returned from segmentText');
      return [];
    }
    
    // Get locale-specific rules
    const rulesConfig = ruleEngine[locale] || {};

    // Filter out invalid segments before processing
    const validSegments = segments.filter(seg => 
      seg && typeof seg === 'object' && 
      (seg.isWordLike !== undefined || seg.segment !== undefined)
    );
    
    if (validSegments.length === 0) {
      console.warn('No valid segments found after filtering');
      return [];
    }

    // Apply line breaking rules and get annotations
    const lineBreakingAnnotations = annotateLineBreakingWithSeparators(validSegments, rulesConfig);
    let wordMetricsArray = segmentsToWordMetrics(validSegments, text, lineBreakingAnnotations);
    
    // Validate before applying additional rules
    if (!wordMetricsArray || !Array.isArray(wordMetricsArray)) {
      console.warn('Invalid word metrics array after initial processing');
      return [];
    }
    
    // Filter out any invalid metrics
    wordMetricsArray = wordMetricsArray.filter(
      metric => metric && typeof metric === 'object' && typeof metric.text === 'string'
    );
    
    // Apply additional segmentation rules to identify line-breaking constraints
    wordMetricsArray = annotateLineBreakingWithSeparators(wordMetricsArray, rulesConfig);
    
    return wordMetricsArray;
  } catch (error) {
    console.error('Error in processTextForLineBreaking:', error);
    return [];
  }
  
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
