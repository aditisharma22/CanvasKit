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
      
      // Special handling for percent symbols and certain special characters
      const isSpecialChar = segmentText === '%' || segmentText === '€' || segmentText === '$' || segmentText === '°';
      
      // Ensure special characters are always treated as word-like
      if (isSpecialChar && seg.isWordLike === false) {
        seg.isWordLike = true;
      }
      
      // Process percent symbols and special characters with extra care
      if (isSpecialChar) {
        // Ensure we don't already have this special character at this position
        const alreadyHasSpecialChar = tokens.some(token => 
          token.text === segmentText && 
          token.boundary && 
          token.boundary.start === seg.index
        );
        
        if (alreadyHasSpecialChar) continue;
      }
      
      // Skip spaces unless we specifically want to keep them
      if (seg.isWordLike === false && !isSpace && !isSpecialChar) continue;

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
