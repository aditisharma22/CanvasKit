import { testCases } from "./testData.js";
import { 
  segmentsToWordMetrics, 
  handleConsecutiveSpecialChars, 
  isSpecialCharacter, 
  processConsecutivePercentSymbols 
} from "./segmenterUtils.js";
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
    // Pre-process the text to handle consecutive percent symbols
    const { processedText, specialCharPositions } = processConsecutivePercentSymbols(text);
    
    // Use the browser's built-in Intl.Segmenter if available
    if (typeof Intl !== 'undefined' && Intl.Segmenter) {
      const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
      const segments = [...segmenter.segment(text)];
      
      // Create a map of all characters already included in segments to avoid duplicates
      const processedCharPositions = new Map();
      
      // Enhanced segments with special handling for % symbols
      const enhancedSegments = [];
      
      // First, add all regular segments
      for (const seg of segments) {
        if (seg && seg.segment && typeof seg.segment === 'string' && seg.index !== undefined) {
          // Check if this segment contains special characters
          let hasSpecialChars = false;
          
          for (let i = 0; i < seg.segment.length; i++) {
            const position = seg.index + i;
            // Mark this position as processed
            processedCharPositions.set(position, true);
            
            // Check if this position has a special character
            if (specialCharPositions.has(position)) {
              hasSpecialChars = true;
            }
          }
          
          // If the segment contains special characters, we need to handle them specially
          if (hasSpecialChars) {
            // Split the segment into individual characters
            for (let i = 0; i < seg.segment.length; i++) {
              const char = seg.segment[i];
              const position = seg.index + i;
              
              enhancedSegments.push({
                segment: char,
                index: position,
                isWordLike: isSpecialCharacter(char) || /\w/.test(char),
                isSpace: /\s/.test(char),
                input: text
              });
            }
          } else {
            // Regular segment
            enhancedSegments.push({
              segment: seg.segment,
              index: seg.index,
              isWordLike: seg.isWordLike,
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
    
    // Process consecutive special characters
    segments = handleConsecutiveSpecialChars(segments, text);
    
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
    console.log(`[processTextForLineBreaking] Starting with locale ${locale}, text: "${text?.substring(0, 20)}${text?.length > 20 ? '...' : ''}"`);
    
    // Input validation
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text input for processTextForLineBreaking:', text);
      return [];
    }
    
    // Get text segments
    console.log(`[processTextForLineBreaking] Getting segments...`);
    const segments = await segmentText(text, locale);
    console.log(`[processTextForLineBreaking] Got ${segments?.length || 0} segments`);
    
    // Validate segments
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      console.warn('No valid segments returned from segmentText');
      return [];
    }
    
    // Process consecutive special characters
    console.log(`[processTextForLineBreaking] Handling consecutive special characters...`);
    const enhancedSegments = handleConsecutiveSpecialChars(segments, text);
    console.log(`[processTextForLineBreaking] Enhanced segments count: ${enhancedSegments?.length || 0}`);
    
    // Get locale-specific rules
    const rulesConfig = ruleEngine[locale] || {};
    console.log(`[processTextForLineBreaking] Using rules for locale: ${rulesConfig.locale || locale}`);

    // Filter out invalid segments before processing
    const validSegments = enhancedSegments.filter(seg => 
      seg && typeof seg === 'object' && 
      (seg.isWordLike !== undefined || seg.segment !== undefined)
    );
    console.log(`[processTextForLineBreaking] Valid segments after filtering: ${validSegments.length}`);
    
    if (validSegments.length === 0) {
      console.warn('No valid segments found after filtering');
      return [];
    }

    // Apply line breaking rules and get annotations
    console.log(`[processTextForLineBreaking] Applying line breaking rules...`);
    const lineBreakingAnnotations = annotateLineBreakingWithSeparators(validSegments, rulesConfig);
    console.log(`[processTextForLineBreaking] Converting to word metrics...`);
    let wordMetricsArray = segmentsToWordMetrics(validSegments, text, lineBreakingAnnotations);
    console.log(`[processTextForLineBreaking] Word metrics array length: ${wordMetricsArray?.length || 0}`);
    
    // Apply special handling for Apple service names in French text
    if (locale === 'fr' && rulesConfig.appleServices) {
      console.log(`[processTextForLineBreaking] Special handling for Apple service names in French`);
      
      // Detect Apple service names in text
      const fullText = wordMetricsArray.map(m => m.text).join('');
      
      for (const appleService of rulesConfig.appleServices) {
        // Case-insensitive search
        const serviceLower = appleService.toLowerCase();
        const textLower = fullText.toLowerCase();
        
        // Check if the service name appears in the text
        if (textLower.includes(serviceLower)) {
          console.log(`[processTextForLineBreaking] Found Apple service "${appleService}" in text`);
          
          // Find the starting position of the service name in the text
          const servicePos = textLower.indexOf(serviceLower);
          const serviceEndPos = servicePos + serviceLower.length;
          
          // Mark all word metrics that overlap with the service name position
          for (let i = 0; i < wordMetricsArray.length; i++) {
            const metric = wordMetricsArray[i];
            
            // Check if this metric is within the service name range
            if (metric.boundary) {
              if ((metric.boundary.start >= servicePos && metric.boundary.start < serviceEndPos) || 
                  (metric.boundary.end > servicePos && metric.boundary.end <= serviceEndPos)) {
                console.log(`[processTextForLineBreaking] Marking word "${metric.text}" as part of Apple service name`);
                wordMetricsArray[i].lineBreaking = 'avoid';
                wordMetricsArray[i]._partOfAppleService = appleService;
              }
            }
          }
        }
      }
    }
    
    // Apply special handling for game names in French text
    if (locale === 'fr' && rulesConfig.appGameNames) {
      console.log(`[processTextForLineBreaking] Special handling for game names in French`);
      
      // Detect game names in text
      const fullText = wordMetricsArray.map(m => m.text).join('');
      
      for (const gameName of rulesConfig.appGameNames) {
        // Case-insensitive search
        const gameLower = gameName.toLowerCase();
        const textLower = fullText.toLowerCase();
        
        // Check if the game name appears in the text
        if (textLower.includes(gameLower)) {
          console.log(`[processTextForLineBreaking] Found game name "${gameName}" in text`);
          
          // Find the starting position of the game name in the text
          const gamePos = textLower.indexOf(gameLower);
          const gameEndPos = gamePos + gameLower.length;
          
          // Mark all word metrics that overlap with the game name position
          for (let i = 0; i < wordMetricsArray.length; i++) {
            const metric = wordMetricsArray[i];
            
            // Check if this metric is within the game name range
            if (metric.boundary) {
              if ((metric.boundary.start >= gamePos && metric.boundary.start < gameEndPos) || 
                  (metric.boundary.end > gamePos && metric.boundary.end <= gameEndPos)) {
                console.log(`[processTextForLineBreaking] Marking word "${metric.text}" as part of game name`);
                wordMetricsArray[i].lineBreaking = 'avoid';
                wordMetricsArray[i]._partOfGameName = gameName;
              }
            }
          }
        }
      }
    }
    
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

/**
 * Tests the percent symbol handling specifically
 */
export async function testPercentSymbolHandling() {
  const tests = [
    "Basic test with a percent symbol: 100%",
    "Test with a percent symbol with space: 100 %",
    "Test with double percent: 100%%",
    "Test with triple percent: 100%%%",
    "Multiple test: 10% and 20% and 30%",
    "L'artiste pop se donne à 100 % dans son nouvel album."
  ];
  
  console.log("RUNNING PERCENT SYMBOL TESTS");
  
  for (const test of tests) {
    console.log(`\n====== TESTING: "${test}" ======`);
    
    // First, check percent symbol detection
    const { processedText, specialCharPositions } = processConsecutivePercentSymbols(test);
    console.log("✅ Special Characters Found:", specialCharPositions.size);
    Array.from(specialCharPositions.entries()).forEach(([pos, info]) => {
      console.log(`  Position ${pos}: ${test[pos]} (${info.isConsecutive ? 'consecutive' : 'single'})`);
    });
    
    // Test segmentation
    const segments = await segmentText(test, "fr");
    console.log("\n✅ Segmentation Results:");
    console.log(`  Total segments: ${segments.length}`);
    
    // Log important segments (numbers, percent signs, and adjacent tokens)
    const importantSegments = [];
    segments.forEach((seg, i) => {
      if (seg.segment === "%" || /\d+/.test(seg.segment) || 
          (i > 0 && (segments[i-1].segment === "%" || /\d+/.test(segments[i-1].segment)))) {
        importantSegments.push(i);
        console.log(`  ${i}: "${seg.segment}" at ${seg.index} (wordLike: ${seg.isWordLike})`);
      }
    });
    
    // Test word metrics
    const metrics = await processTextForLineBreaking(test, "fr");
    console.log("\n✅ Word Metrics Results:");
    console.log(`  Total metrics: ${metrics.length}`);
    
    console.log("  Key metrics (numbers and percent symbols):");
    metrics.forEach((m, i) => {
      if (m.text === "%" || /\d+/.test(m.text) || 
          (i > 0 && (metrics[i-1].text === "%" || /\d+/.test(metrics[i-1].text)))) {
        console.log(`  ${i}: "${m.text}" (lineBreaking: ${m.lineBreaking})`);
      }
    });
    
    // Special focus on "100 %" sequence
    const hundred = test.indexOf("100");
    if (hundred >= 0) {
      console.log("\n✅ Analysis of '100 %' sequence:");
      const context = test.substring(Math.max(0, hundred - 10), Math.min(test.length, hundred + 15));
      console.log(`  Context: "${context}"`);
      
      // Find corresponding metrics
      const hundredMetric = metrics.findIndex(m => m.text === "100");
      if (hundredMetric >= 0) {
        console.log(`  "100" is at index ${hundredMetric} with lineBreaking: ${metrics[hundredMetric].lineBreaking}`);
        
        if (hundredMetric < metrics.length - 1) {
          const nextMetric = metrics[hundredMetric + 1];
          console.log(`  Next token: "${nextMetric.text}" with lineBreaking: ${nextMetric.lineBreaking}`);
          
          if (nextMetric.text === "%") {
            console.log("  ✓ CORRECT: Percent symbol directly follows number");
          } else if (nextMetric.text === " " && hundredMetric < metrics.length - 2) {
            const percentMetric = metrics[hundredMetric + 2];
            console.log(`  Space followed by: "${percentMetric.text}" with lineBreaking: ${percentMetric.lineBreaking}`);
          }
        }
      } else {
        console.log("  Could not find '100' in metrics");
      }
    }
  }
  
  return true;
}

/**
 * Tests percent symbol handling with a specific French text example
 * @param {string} text - The text to test, defaults to "L'artiste pop se donne à 100 % dans son nouvel album."
 */
export async function testSpecificFrenchPercent(text = "L'artiste pop se donne à 100 % dans son nouvel album.") {
  console.log(`\n=== DETAILED TEST: "${text}" ===\n`);
  
  // 1. Test the segmentation
  console.log("STEP 1: SEGMENTATION");
  const segments = await segmentText(text, "fr");
  console.log(`Got ${segments.length} segments:`);
  
  segments.forEach((seg, i) => {
    console.log(`  Segment ${i}: "${seg.segment}" at index ${seg.index} (wordLike: ${seg.isWordLike})`);
  });
  
  // Find the important segments
  const numberIndex = segments.findIndex(seg => seg.segment === "100");
  const percentIndex = segments.findIndex(seg => seg.segment === "%");
  
  if (numberIndex >= 0) {
    console.log(`\nFound number "100" at segment index ${numberIndex}`);
  } else {
    console.log(`\nCould not find number "100" in segments`);
  }
  
  if (percentIndex >= 0) {
    console.log(`Found percent symbol "%" at segment index ${percentIndex}`);
  } else {
    console.log(`Could not find percent symbol "%" in segments`);
  }
  
  // 2. Process for line breaking
  console.log("\nSTEP 2: LINE BREAKING");
  const wordMetrics = await processTextForLineBreaking(text, "fr");
  console.log(`Got ${wordMetrics.length} word metrics:`);
  
  wordMetrics.forEach((metric, i) => {
    console.log(`  Metric ${i}: "${metric.text}" (lineBreaking: ${metric.lineBreaking})`);
  });
  
  // Find the important metrics
  const numberMetricIndex = wordMetrics.findIndex(m => m.text === "100");
  const percentMetricIndex = wordMetrics.findIndex(m => m.text === "%");
  
  if (numberMetricIndex >= 0) {
    console.log(`\nFound number "100" at metric index ${numberMetricIndex} with lineBreaking: ${wordMetrics[numberMetricIndex].lineBreaking}`);
    
    // Check what comes next
    if (numberMetricIndex < wordMetrics.length - 1) {
      const nextMetric = wordMetrics[numberMetricIndex + 1];
      console.log(`Next metric is "${nextMetric.text}" with lineBreaking: ${nextMetric.lineBreaking}`);
      
      if (nextMetric.text === "%") {
        console.log("CORRECT: Percent symbol directly follows number");
      } else if (nextMetric.text === " " && numberMetricIndex < wordMetrics.length - 2) {
        const afterSpace = wordMetrics[numberMetricIndex + 2];
        console.log(`After space: "${afterSpace.text}" with lineBreaking: ${afterSpace.lineBreaking}`);
        
        if (afterSpace.text === "%") {
          console.log("CORRECT: Space then percent symbol follows number");
        }
      }
    }
  }
  
  if (percentMetricIndex >= 0) {
    console.log(`\nFound percent "%" at metric index ${percentMetricIndex} with lineBreaking: ${wordMetrics[percentMetricIndex].lineBreaking}`);
    
    // Check what comes before
    if (percentMetricIndex > 0) {
      const prevMetric = wordMetrics[percentMetricIndex - 1];
      console.log(`Previous metric is "${prevMetric.text}" with lineBreaking: ${prevMetric.lineBreaking}`);
    }
  }
  
  // 3. Check for specific rule application
  console.log("\nSTEP 3: RULE VERIFICATION");
  console.log("Verifying French rule: Units must stay with the number");
  
  // Check if the rule is correctly applied
  if (numberMetricIndex >= 0 && percentMetricIndex >= 0) {
    if (Math.abs(numberMetricIndex - percentMetricIndex) <= 2) { // Allow for space between
      if (wordMetrics[numberMetricIndex].lineBreaking === 'avoid') {
        console.log("✅ Number correctly marked as 'avoid' for line breaking");
      } else {
        console.log("❌ NUMBER NOT PROPERLY MARKED FOR LINE BREAKING");
      }
      
      if (percentMetricIndex >= 0 && wordMetrics[percentMetricIndex].lineBreaking === 'avoid') {
        console.log("✅ Percent symbol correctly marked as 'avoid' for line breaking");
      } else {
        console.log("❌ PERCENT SYMBOL NOT PROPERLY MARKED FOR LINE BREAKING");
      }
    }
  }
  
  return {
    segments,
    wordMetrics,
    numberIndex,
    percentIndex,
    numberMetricIndex,
    percentMetricIndex
  };
}

/**
 * Test function to verify Apple service name recognition
 * @param {string} text - Text to test, defaults to a sample with Apple Music Super Bowl
 */
export async function testAppleServiceHandling(text = "Apple Music Super Bowl : la performance.") {
  console.log(`Testing Apple service recognition for: "${text}"`);
  
  // Get the French rule configuration
  const locale = "fr";
  const ruleConfig = ruleEngine[locale];
  
  if (!ruleConfig) {
    console.error(`No rule configuration found for locale: ${locale}`);
    return;
  }
  
  // Log the configured Apple services
  console.log("Configured Apple services:", ruleConfig.appleServices);
  
  // Segment the text
  const segments = await segmentText(text, locale);
  console.log("Text segmentation:", segments);
  
  // Convert to word metrics
  const wordMetrics = segmentsToWordMetrics(segments);
  
  // Apply line breaking rules including Apple service detection
  const annotatedMetrics = annotateLineBreakingWithSeparators(wordMetrics, ruleConfig);
  
  // Log the results with focus on line breaking settings
  console.log("Annotated metrics with line breaking:");
  annotatedMetrics.forEach((metric, i) => {
    console.log(`[${i}] "${metric.text || metric.segment}" - lineBreaking: ${metric.lineBreaking}, _partOfAppleService: ${metric._partOfAppleService || "none"}`);
  });
  
  // Calculate statistics
  const totalSegments = annotatedMetrics.length;
  const avoidBreakCount = annotatedMetrics.filter(m => m.lineBreaking === 'avoid').length;
  const allowBreakCount = totalSegments - avoidBreakCount;
  
  console.log(`\nSummary:`);
  console.log(`Total segments: ${totalSegments}`);
  console.log(`Avoid break segments: ${avoidBreakCount}`);
  console.log(`Allow break segments: ${allowBreakCount}`);
  
  return {
    segments: annotatedMetrics,
    stats: {
      totalSegments,
      avoidBreakCount,
      allowBreakCount
    }
  };
}

/**
 * Test function to verify game name recognition
 * @param {string} text - Text to test, defaults to a sample with Monopoly Go
 */
export async function testGameNameHandling(text = "Jouez à Monopoly Go maintenant.") {
  console.log(`Testing game name recognition for: "${text}"`);
  
  // Get the French rule configuration
  const locale = "fr";
  const ruleConfig = ruleEngine[locale];
  
  if (!ruleConfig) {
    console.error(`No rule configuration found for locale: ${locale}`);
    return;
  }
  
  // Log the configured game names
  console.log("Configured game names:", ruleConfig.appGameNames);
  
  // Segment the text
  const segments = await segmentText(text, locale);
  console.log("Text segmentation:", segments);
  
  // Convert to word metrics
  const wordMetrics = segmentsToWordMetrics(segments);
  
  // Apply line breaking rules including game name detection
  const annotatedMetrics = annotateLineBreakingWithSeparators(wordMetrics, ruleConfig);
  
  // Log the results with focus on line breaking settings
  console.log("Annotated metrics with line breaking:");
  annotatedMetrics.forEach((metric, i) => {
    console.log(`[${i}] "${metric.text || metric.segment}" - lineBreaking: ${metric.lineBreaking}, _partOfGameName: ${metric._partOfGameName || "none"}`);
  });
  
  // Calculate statistics
  const totalSegments = annotatedMetrics.length;
  const avoidBreakCount = annotatedMetrics.filter(m => m.lineBreaking === 'avoid').length;
  const allowBreakCount = totalSegments - avoidBreakCount;
  
  console.log(`\nSummary:`);
  console.log(`Total segments: ${totalSegments}`);
  console.log(`Avoid break segments: ${avoidBreakCount}`);
  console.log(`Allow break segments: ${allowBreakCount}`);
  
  return {
    segments: annotatedMetrics,
    stats: {
      totalSegments,
      avoidBreakCount,
      allowBreakCount
    }
  };
}
