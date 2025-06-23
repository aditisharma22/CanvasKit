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

const protectedWords = new Set([
  "the", "a", "an", "of", "in", "on", "with", "and", "but", "or", "for"
]);

/**
 * Determines if a break is at a protected position
 * @param {string[]} words - Array of words
 * @param {number} index - Break position
 * @returns {boolean} Whether the break is protected
 */
function isProtectedBreak(words, index) {
  if (index <= 0 || index >= words.length) return false;
  const prev = words[index - 1].toLowerCase();
  const next = words[index].toLowerCase();
  return protectedWords.has(prev) || protectedWords.has(next);
}

/**
 * Calculates width of text from start to end
 * @param {string[]} words - Array of words
 * @param {number[]} wordWidths - Width of each word
 * @param {number} spaceWidth - Width of space
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {number} Width of text from start to end
 */
function calcWidth(words, wordWidths, spaceWidth, start, end) {
  let width = 0;
  for (let i = start; i <= end; i++) {
    width += wordWidths[i];
    if (i > start) width += spaceWidth;
  }
  return width;
}

/**
 * Score a candidate based on line width distribution
 * @param {string[][]} lines - Lines of text
 * @param {number[]} lineWidths - Width of each line
 * @param {number} targetWidth - Target width for lines
 * @param {number[]} breaks - Break positions
 * @param {string[]} words - Array of words
 * @param {'fit'|'uniform'} mode - Optimization mode
 * @returns {Object} Score and breakdown
 */
function scoreCandidate(lines, lineWidths, targetWidth, breaks, words, mode) {
  const fillPenalty = lineWidths.reduce((acc, w) => acc + Math.pow(1 - (w / targetWidth), 2), 0);
  const evenness = lineWidths.length < 2 ? 0 : Math.pow(Math.max(...lineWidths) - Math.min(...lineWidths), 2);
  const raggedness = lineWidths.reduce((acc, w) => acc + Math.pow(targetWidth - w, 2), 0);

  const lastLine = lines[lines.length - 1];
  const widowsOrphans = lastLine.length === 1 ? 50 : 0;

  const protectedBreaks = breaks.filter(i => isProtectedBreak(words, i)).length * 30;

  // Weighting based on mode
  let weightedScore = 0;
  if (mode === "fit") {
    weightedScore = raggedness * 3 + evenness * 0.2 + fillPenalty + widowsOrphans + protectedBreaks;
  } else if (mode === "uniform") {
    weightedScore = raggedness * 0.5 + evenness * 4 + fillPenalty + widowsOrphans + protectedBreaks;
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
export function generateCandidates(words, wordWidths, spaceWidth, targetWidth, candidateCount, mode, balanceFactor = 0.5, minFillRatio = 0.5) {
  const totalWords = words.length;
  const allCandidates = [];

  function recurse(start, currentBreaks) {
    if (start >= totalWords) {
      const breaks = currentBreaks.slice(0, -1); 
      const lines = [];
      const lineWidths = [];
      let prev = 0;
      for (const br of breaks.concat(totalWords - 1)) {
        const lineWords = words.slice(prev, br + 1);
        lines.push(lineWords);
        lineWidths.push(calcWidth(words, wordWidths, spaceWidth, prev, br));
        prev = br + 1;
      }
      const { score, scoreBreakdown } = scoreCandidate(lines, lineWidths, targetWidth, breaks, words, mode);
      allCandidates.push({ breaks, score, lines, lineWidths, scoreBreakdown });
      return;
    }

    for (let end = start; end < totalWords; end++) {
      const width = calcWidth(words, wordWidths, spaceWidth, start, end);
      if (width >= targetWidth * minFillRatio && width <= targetWidth * (1 + balanceFactor)) {
        recurse(end + 1, [...currentBreaks, end]);
      }
      if (width > targetWidth * (1 + balanceFactor)) {
        break;
      }
    }
  }

  recurse(0, []);

  // Sort by score and return the top candidates
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
  
  // If debug element is provided, visualize the tree
  if (debugElement) {
    console.log("Generated candidates:", candidates);
  }
  
  return candidates;
}
