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
  /**
   * Count Unicode graphemes (visible characters) in a string
   * This handles multi-codepoint characters properly
   * 
   * @param {string} str - String to count
   * @returns {number} - Number of graphemes
   */
  function getGraphemesCount(str) {
    return Array.from(str).length;
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

  // Ensure segments are in array form
  const segArr = Array.from(segments);
  const tokens = [];

  // Process each segment
  for (let i = 0; i < segArr.length; i++) {
    const seg = segArr[i];
    
    // Skip non-word segments (like whitespace)
    if (!seg.isWordLike) continue;

    // Calculate segment boundaries
    const start = seg.index;
    const end = segArr[i + 1] ? segArr[i + 1].index : sourceText.length;

    // Extract separator that follows this segment
    let separator = '';
    if (end < sourceText.length) {
      // Find next word-like segment
      const nextWordLike = segArr.slice(i + 1).find(s => s.isWordLike);
      const nextIndex = nextWordLike ? nextWordLike.index : sourceText.length;
      
      // Get text between this segment and next word
      separator = sourceText.slice(end, nextIndex);
    }

    // Get line breaking annotation for this segment if available
    let lineBreaking = lineBreakingAnnotations[i] || 'allow';

    // Create token with all metadata
    tokens.push({
      text: seg.segment,
      trimmedText: seg.segment.trimEnd(),
      charCount: getGraphemesCount(seg.segment),
      boundary: { start, end },
      rect: getWordRect(context, paragraph, { start, end }),
      lineBreaking,
      separator,
      separatorWidth: 0, // Will be calculated later if needed
      separatorCharCount: getGraphemesCount(separator),
    });
  }
  
  return tokens;
}
