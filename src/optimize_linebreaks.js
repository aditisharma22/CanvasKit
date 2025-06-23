/**
 * Line candidate type
 * @typedef {Object} LineCandidate
 * @property {number[]} breaks - Break points in the text
 * @property {number} score - Score of the candidate (lower is better)
 * @property {string[][]} lines - The text lines
 * @property {number[]} lineWidths - Width of each line
 * @property {Object} scoreBreakdown - Score breakdown
 * @property {number} scoreBreakdown.raggedness - Raggedness score
 * @property {number} scoreBreakdown.evenness - Evenness score
 * @property {number} scoreBreakdown.fillPenalty - Fill penalty score
 * @property {number} scoreBreakdown.widowsOrphans - Widows/orphans penalty
 * @property {number} scoreBreakdown.protectedBreaks - Protected breaks penalty
 */

/**
 * Set of common function words that shouldn't be separated by line breaks
 * These words typically have close semantic connections to adjacent words
 * @type {Set<string>}
 */
const protectedWords = new Set([
  "the", "a", "an", "of", "in", "on", "with", "and", "but", "or", "for"
]);

/**
 * Determines if a break is at a protected position
 * Protected breaks occur when breaking would separate function words from their context,
 * which would harm readability
 * 
 * @param {string[]} words - Array of words in text
 * @param {number} index - Break position to evaluate
 * @returns {boolean} Whether the break is at a protected position
 */
function isProtectedBreak(words, index) {
  if (index <= 0 || index >= words.length) return false;
  const prev = words[index - 1].toLowerCase();
  const next = words[index].toLowerCase();
  return protectedWords.has(prev) || protectedWords.has(next);
}

/**
 * Calculates the total width of a text segment from start index to end index
 * Takes into account both word widths and the spaces between words
 *
 * @param {string[]} words - Array of all words in the text
 * @param {number[]} wordWidths - Array of pixel widths for each word
 * @param {number} spaceWidth - Width of a space character in pixels
 * @param {number} start - Starting word index (inclusive)
 * @param {number} end - Ending word index (inclusive)
 * @returns {number} Total width of the text segment in pixels
 */
function calcWidth(words, wordWidths, spaceWidth, start, end) {
  let width = 0;
  
  // Sum up the widths of all words in the range
  for (let i = start; i <= end; i++) {
    width += wordWidths[i];
    
    // Add space width for all words except the first one
    if (i > start) width += spaceWidth;
  }
  
  return width;
}

/**
 * Score a candidate based on line width distribution and other text layout factors
 * 
 * @param {string[][]} lines - Lines of text as arrays of words
 * @param {number[]} lineWidths - Width of each line in pixels
 * @param {number} targetWidth - Target width for lines in pixels
 * @param {number[]} breaks - Break positions in the original word array
 * @param {string[]} words - Complete array of words in text
 * @param {'fit'|'uniform'} mode - Optimization mode: 'fit' prioritizes fitting text within width, 'uniform' prioritizes consistent line lengths
 * @returns {Object} Score and detailed breakdown of component scores
 */
function scoreCandidate(lines, lineWidths, targetWidth, breaks, words, mode) {
  // Calculate how well each line fills the available width (0 is perfect)
  const fillPenalty = lineWidths.reduce((acc, w) => acc + Math.pow(1 - (w / targetWidth), 2), 0);
  
  // Calculate how even the line lengths are (0 is perfect)
  const evenness = lineWidths.length < 2 ? 0 : Math.pow(Math.max(...lineWidths) - Math.min(...lineWidths), 2);
  
  // Calculate raggedness (sum of squared differences from target width)
  const raggedness = lineWidths.reduce((acc, w) => acc + Math.pow(targetWidth - w, 2), 0);

  // Penalize single-word lines at the end (widows)
  const lastLine = lines[lines.length - 1];
  const widowsOrphans = lastLine.length === 1 ? 50 : 0;

  // Penalty for breaking at protected words
  const PROTECTED_BREAK_PENALTY = 30; // Extract hardcoded value
  const protectedBreaks = breaks.filter(i => isProtectedBreak(words, i)).length * PROTECTED_BREAK_PENALTY;

  // Weight factors based on selected optimization mode
  const MODE_WEIGHTS = {
    fit: {
      raggedness: 3,
      evenness: 0.2
    },
    uniform: {
      raggedness: 0.5,
      evenness: 4
    }
  };

  // Calculate weighted score based on selected mode
  let weightedScore = 0;
  if (mode === "fit") {
    weightedScore = 
      raggedness * MODE_WEIGHTS.fit.raggedness + 
      evenness * MODE_WEIGHTS.fit.evenness + 
      fillPenalty + 
      widowsOrphans + 
      protectedBreaks;
  } else if (mode === "uniform") {
    weightedScore = 
      raggedness * MODE_WEIGHTS.uniform.raggedness + 
      evenness * MODE_WEIGHTS.uniform.evenness + 
      fillPenalty + 
      widowsOrphans + 
      protectedBreaks;
  }

  return {
    score: weightedScore,
    scoreBreakdown: {
      raggedness,
      evenness,
      fillPenalty,
      widowsOrphans,
      protectedBreaks
    }
  };
}

/**
 * Generate line breaking candidates
 * @param {string[]} words - Array of words
 * @param {number[]} wordWidths - Width of each word
 * @param {number} spaceWidth - Width of space
 * @param {number} targetWidth - Target line width
 * @param {number} candidateCount - Number of candidates to generate
 * @param {'fit'|'uniform'} mode - Optimization mode
 * @param {number} balanceFactor - Balance factor (0-1)
 * @param {number} minFillRatio - Minimum fill ratio (0-1)
 * @returns {LineCandidate[]} Line breaking candidates
 */
/**
 * Generate possible line breaking candidates for text layout optimization
 * Uses a recursive approach to explore different line breaking possibilities
 *
 * @param {string[]} words - Complete array of words in text
 * @param {number[]} wordWidths - Width of each word in pixels
 * @param {number} spaceWidth - Width of space character in pixels
 * @param {number} targetWidth - Target line width in pixels
 * @param {number} candidateCount - Maximum number of candidates to return
 * @param {'fit'|'uniform'} mode - Optimization mode
 * @param {number} balanceFactor - Balance factor controlling how much lines can exceed target width (0-1)
 * @param {number} minFillRatio - Minimum fill ratio controlling how short lines can be (0-1)
 * @returns {LineCandidate[]} Array of line breaking candidates, sorted by score
 */
export function generateCandidates(words, wordWidths, spaceWidth, targetWidth, candidateCount, mode, balanceFactor = 0.5, minFillRatio = 0.5) {
  const totalWords = words.length;
  const allCandidates = [];

  /**
   * Recursively build line breaking candidates
   * @param {number} start - Starting word index for current line
   * @param {number[]} currentBreaks - Current line breaks being considered
   */
  function recurse(start, currentBreaks) {
    // Base case: we've processed all words
    if (start >= totalWords) {
      // Final breaks exclude the last item (handled separately)
      const breaks = currentBreaks.slice(0, -1); 
      const lines = [];
      const lineWidths = [];
      
      // Build lines and calculate line widths
      let prev = 0;
      for (const br of breaks.concat(totalWords - 1)) {
        const lineWords = words.slice(prev, br + 1);
        lines.push(lineWords);
        lineWidths.push(calcWidth(words, wordWidths, spaceWidth, prev, br));
        prev = br + 1;
      }
      
      // Score this candidate and add to collection
      const { score, scoreBreakdown } = scoreCandidate(lines, lineWidths, targetWidth, breaks, words, mode);
      allCandidates.push({ breaks, score, lines, lineWidths, scoreBreakdown });
      return;
    }

    // Try different end positions for the current line
    for (let end = start; end < totalWords; end++) {
      const width = calcWidth(words, wordWidths, spaceWidth, start, end);
      
      // Check if this is a valid line width
      if (width >= targetWidth * minFillRatio && width <= targetWidth * (1 + balanceFactor)) {
        recurse(end + 1, [...currentBreaks, end]);
      }
      
      // Stop if we exceed maximum allowed width
      if (width > targetWidth * (1 + balanceFactor)) {
        break;
      }
    }
  }

  // Start recursion with no breaks
  recurse(0, []);

  // Sort candidates by score (lower is better) and return top N
  return allCandidates
    .sort((a, b) => a.score - b.score)
    .slice(0, candidateCount);
}

/**
 * Compute line breaking options
 * @param {string[]} words - Array of words
 * @param {number[]} wordWidths - Width of each word
 * @param {number} spaceWidth - Width of space
 * @param {number} targetWidth - Target line width
 * @param {number} candidateCount - Number of candidates to generate
 * @param {HTMLElement} [debugElement] - Debug element
 * @param {number} balanceFactor - Balance factor (0-1)
 * @param {number} minFillRatio - Minimum fill ratio (0-1)
 * @param {'fit'|'uniform'} mode - Optimization mode
 * @returns {LineCandidate[]} Line breaking candidates
 */
/**
 * Compute optimal line breaking options for a given text
 * This is the main entry point for the line breaking optimization
 *
 * @param {string[]} words - Complete array of words in text
 * @param {number[]} wordWidths - Width of each word in pixels
 * @param {number} spaceWidth - Width of space character in pixels
 * @param {number} targetWidth - Target line width in pixels
 * @param {number} candidateCount - Maximum number of candidates to return
 * @param {HTMLElement} [debugElement] - Optional HTML element for debug visualization
 * @param {number} balanceFactor - Balance factor controlling how much lines can exceed target width (0-1)
 * @param {number} minFillRatio - Minimum fill ratio controlling how short lines can be (0-1)
 * @param {'fit'|'uniform'} mode - Optimization mode: 'fit' or 'uniform'
 * @returns {LineCandidate[]} Array of line breaking candidates, sorted by score
 */
export function computeBreaks(words, wordWidths, spaceWidth, targetWidth, candidateCount, debugElement, balanceFactor = 0.5, minFillRatio = 0.5, mode = "fit") {
  // Generate line breaking candidates
  const candidates = generateCandidates(
    words,
    wordWidths,
    spaceWidth,
    targetWidth,
    candidateCount,
    mode,
    balanceFactor,
    minFillRatio
  );
  
  // If debug element is provided, log detailed information
  if (debugElement) {
    console.log("Generated candidates:", candidates);
    // Additional debug information could be added here
  }
  
  return candidates;
}
