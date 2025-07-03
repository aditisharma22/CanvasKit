/**
 * Convert text segments to word metrics format
 * Transforms segmented text into a structured format with boundary, line breaking, and separator information
 *
 * @param {Array} segments - Segments from Intl.Segmenter or custom segmentation
 * @param {string} sourceText - Original source text
 * @param {Array} lineBreakingAnnotations - Optional line breaking annotations for each segment
 * @param {CanvasRenderingContext2D} context - Optional canvas context for rect calculation
 * @param {Object} paragraph - Optional paragraph object for rect calculation
 * @returns {Array} - Array of word metrics objects
 */
export function segmentsToWordMetrics(
  segments,
  sourceText,
  lineBreakingAnnotations = [],
  context,
  paragraph
) {
  try {
    // Validate inputs
    if (!segments || !Array.isArray(segments)) {
      console.warn('Invalid segments array passed to segmentsToWordMetrics');
      return [];
    }
    
    if (!sourceText || typeof sourceText !== 'string') {
      console.warn('Invalid source text passed to segmentsToWordMetrics');
      return [];
    }
    
    // Constants for default values
    const DEFAULT_SEPARATOR = '';
    const DEFAULT_SEPARATOR_WIDTH = 0;
    const DEFAULT_LINE_BREAKING = 'allow';
    
    /**
     * Count Unicode graphemes (visible characters) in a string
     * This handles multi-codepoint characters properly
     * 
     * @param {string} str - String to count
     * @returns {number} - Number of graphemes
     */
    function getGraphemesCount(str) {
      if (!str || typeof str !== 'string') return 0;
      try {
        return Array.from(str).length;
      } catch (e) {
        console.warn('Error counting graphemes:', e);
        return str.length || 0;
      }
    }
    
    /**
     * Get bounding rectangle for a word
     * Currently returns null as placeholder for future implementation
     * 
     * @param {CanvasRenderingContext2D} context - Canvas context
     * @param {Object} paragraph - Paragraph object
     * @param {Object} boundary - Word boundary
     * @returns {Object|null} - Word bounding rectangle or null
     */
    function getWordRect(context, paragraph, boundary) {
      // Placeholder for future implementation
      return null;
    }

    // Ensure segments are in array form and filter out invalid entries
    const segArr = Array.from(segments).filter(seg => 
      seg && typeof seg === 'object' &&
      (seg.segment !== undefined || seg.text !== undefined)
    );
    
    if (segArr.length === 0) {
      console.warn('No valid segments after filtering');
      return [];
    }
    
    const tokens = [];

  // Process each segment
  for (let i = 0; i < segArr.length; i++) {
    const seg = segArr[i];
    
    // Use segment.text if it exists, otherwise use segment.segment
    const segmentText = seg.text || seg.segment;
    
    // Skip segments without text
    if (!segmentText || typeof segmentText !== 'string') continue;
    
    // Handle spaces differently - we want to preserve them in the output
    const isSpace = seg.isSpace || /^\s+$/.test(segmentText);
    
    // Special handling for percent symbols, punctuation, and certain special characters
    // Use the isSpecialCharacter function for consistency
    const isSpecialChar = isSpecialCharacter(segmentText) || 
                         (segmentText.length === 1 && isSpecialCharacter(segmentText[0]));
    
    // Ensure special characters are always treated as word-like
    if (isSpecialChar && seg.isWordLike === false) {
      seg.isWordLike = true;
    }
    
    // Process special characters with extra care
    if (isSpecialChar) {
      // Ensure we don't already have this special character at this position
      const alreadyHasSpecialChar = tokens.some(token => 
        token.text === segmentText && 
        token.boundary && 
        token.boundary.start === seg.index
      );
      
      if (alreadyHasSpecialChar) continue;
    }      // Don't skip punctuation characters even if they're not marked as word-like
    // This ensures we preserve characters like hyphens and colons
    const isPunctuation = segmentText === ':' || segmentText === '-' || segmentText === ';' || 
                          segmentText === '.' || segmentText === ',' || segmentText === '!' || 
                          segmentText === '?' || segmentText === '—' || segmentText === '–' ||
                          segmentText === '\u2011'; // non-breaking hyphen
                          
    // Special handling for non-breaking hyphens (like in E‑Mail)
    const hasNonBreakingHyphen = segmentText.includes('\u2011');
    
    // Skip non-word characters only if they're not spaces, special chars, punctuation, or have non-breaking hyphens
    if (seg.isWordLike === false && !isSpace && !isSpecialChar && !isPunctuation && !hasNonBreakingHyphen) continue;

      // Calculate segment boundaries safely
      const start = seg.index || 0;
      const end = i + 1 < segArr.length && segArr[i + 1].index !== undefined 
        ? segArr[i + 1].index 
        : sourceText.length;

      // Extract separator that follows this segment
      let separator = DEFAULT_SEPARATOR;
      if (end < sourceText.length) {
        try {
          // Find next word-like segment
          const nextWordLike = segArr.slice(i + 1).find(s => s && (s.isWordLike || s.segment || s.text));
          const nextIndex = nextWordLike && nextWordLike.index !== undefined 
            ? nextWordLike.index 
            : sourceText.length;
          
          // Get text between this segment and next word
          separator = sourceText.slice(end, nextIndex);
        } catch (error) {
          console.warn('Error extracting separator:', error);
        }
      }

      // Get line breaking annotation for this segment if available
      let lineBreaking = DEFAULT_LINE_BREAKING;
      if (Array.isArray(lineBreakingAnnotations) && i < lineBreakingAnnotations.length) {
        lineBreaking = lineBreakingAnnotations[i] || DEFAULT_LINE_BREAKING;
      }

      // Create token with all metadata
      tokens.push({
        text: segmentText,
        trimmedText: typeof segmentText === 'string' ? segmentText.trimEnd() : segmentText,
        charCount: getGraphemesCount(segmentText),
        boundary: { start, end },
        rect: getWordRect(context, paragraph, { start, end }),
        lineBreaking,
        separator,
        separatorWidth: DEFAULT_SEPARATOR_WIDTH, // Will be calculated later if needed
        separatorCharCount: getGraphemesCount(separator),
      });
    }
    
    return tokens;
  } catch (error) {
    console.error('Error in segmentsToWordMetrics:', error);
    return [];
  }
  
  return tokens;
}

/**
 * Checks if a character is a special character like % € $ °
 * @param {string} char Character to check
 * @return {boolean} true if special character
 */
export function isSpecialCharacter(char) {
  // Extended to include common punctuation characters that need special handling
  // Add U+2011 (non-breaking hyphen) and other dash/hyphen types (U+2013, U+2014)
  return char === '%' || char === '€' || char === '$' || char === '°' ||
         char === ':' || char === '-' || char === ';' || 
         char === '.' || char === ',' || char === '!' || char === '?' ||
         char === '\u2011' || char === '\u2013' || char === '\u2014'; // non-breaking hyphen, en-dash, em-dash
}

/**
 * Properly handle consecutive special characters by ensuring they are correctly segmented
 * @param {Array} segments Array of segments
 * @param {string} text Original text
 * @return {Array} Enhanced segments with proper handling of consecutive special chars
 */
export function handleConsecutiveSpecialChars(segments, text) {
  if (!segments || !Array.isArray(segments) || segments.length === 0 || !text) {
    return segments || [];
  }

  // Already processed positions
  const processedPositions = new Map();
  const enhancedSegments = [...segments];
  
  // First, mark all existing segment positions
  enhancedSegments.forEach(seg => {
    if (seg && seg.index !== undefined && seg.segment) {
      for (let i = 0; i < seg.segment.length; i++) {
        processedPositions.set(seg.index + i, true);
      }
    }
  });
  
  // Look for consecutive special characters
  for (let i = 0; i < text.length - 1; i++) {
    if (isSpecialCharacter(text[i]) && isSpecialCharacter(text[i+1])) {
      // If we have consecutive special characters
      if (!processedPositions.has(i+1)) {
        // Mark as processed
        processedPositions.set(i+1, true);
        
        // Add as a new segment
        enhancedSegments.push({
          segment: text[i+1],
          index: i+1,
          isWordLike: true,
          input: text
        });
      }
    }
  }
  
  // Sort segments by index to maintain proper order
  return enhancedSegments.sort((a, b) => (a.index || 0) - (b.index || 0));
}

/**
 * Detects sequences of special characters and returns information about them
 * @param {string} text - The text to analyze
 * @returns {Array} Array of objects with information about special character sequences
 */
export function detectSpecialCharSequences(text) {
  if (!text || typeof text !== 'string') return [];
  
  const sequences = [];
  let inSequence = false;
  let currentSequence = {
    start: -1,
    chars: [],
    type: ''
  };
  
  try {
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      
      if (isSpecialCharacter(char)) {
        if (!inSequence) {
          // Start a new sequence
          inSequence = true;
          currentSequence = {
            start: i,
            chars: [char],
            type: char
          };
        } else if (currentSequence.type === char) {
          // Continue the current sequence
          currentSequence.chars.push(char);
        } else {
          // Different special character - end current sequence and start new one
          sequences.push({...currentSequence});
          currentSequence = {
            start: i,
            chars: [char],
            type: char
          };
        }
      } else if (inSequence) {
        // End of a sequence
        sequences.push({...currentSequence});
        inSequence = false;
      }
    }
    
    // Add the final sequence if we ended while in a sequence
    if (inSequence) {
      sequences.push({...currentSequence});
    }
  } catch (error) {
    console.warn('Error detecting special character sequences:', error);
  }
  
  return sequences;
}

/**
 * Specifically processes text with consecutive percent symbols
 * to ensure they are properly segmented and will be displayed correctly
 * 
 * @param {string} text The original text to process
 * @returns {object} Object with processed text and special character positions
 */
export function processConsecutivePercentSymbols(text) {
  if (!text || typeof text !== 'string') {
    return { 
      processedText: text, 
      specialCharPositions: new Map() 
    };
  }
  
  try {
    // Track positions of special characters
    const specialCharPositions = new Map();
    
    // Find consecutive percent symbols
    const regex = /(%{2,})/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Mark all positions
      for (let i = 0; i < match[0].length; i++) {
        specialCharPositions.set(match.index + i, {
          isConsecutive: true,
          position: i,
          totalCount: match[0].length
        });
      }
    }
    
    // Find single percent symbols
    const singleRegex = /(?<![%])%(?![%])/g;
    
    while ((match = singleRegex.exec(text)) !== null) {
      if (!specialCharPositions.has(match.index)) {
        specialCharPositions.set(match.index, {
          isConsecutive: false,
          position: 0,
          totalCount: 1
        });
      }
    }
    
    return {
      processedText: text,
      specialCharPositions
    };
  } catch (error) {
    console.warn('Error processing consecutive percent symbols:', error);
    return { 
      processedText: text, 
      specialCharPositions: new Map() 
    };
  }
}
