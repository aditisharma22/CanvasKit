/**
 * Line break optimization module
 * Implements an optimal line-breaking algorithm similar to Knuth-Plass
 * with support for multiple candidate generation and scoring
 */

/**
 * Computes optimal line breaks for given text
 * 
 * @param {string[]} words - Array of words
 * @param {number[]} wordWidths - Array of word widths (must match length of words)
 * @param {number} spaceWidth - Width of a space character
 * @param {number} targetWidth - Target width for each line
 * @param {number} candidateCount - Number of candidates to generate (default: 1)
 * @param {Element} debugOutput - Optional element to output debug information
 * @param {number} balanceFactor - Balance between raggedness and evenness (0 to 1, default: 0.5)
 * @param {number} minFillRatio - Minimum fill ratio for lines (default: 0.5)
 * @param {string} mode - Layout mode: 'fit' or 'fill' (default: 'fit')
 * @param {string} locale - The locale to use for line breaking rules (default: 'en')
 * @param {Object} options - Additional options
 * @param {boolean} options.enableLocalization - Whether to apply localization rules (default: true)
 * @returns {Array<Object>} - Array of candidate line breaking solutions
 */
export function computeBreaks(
  words,
  wordWidths,
  spaceWidth,
  targetWidth,
  candidateCount = 1,
  debugOutput = null,
  balanceFactor = 0.5,
  minFillRatio = 0.5,
  mode = 'fit',
  locale = 'en',
  options = { enableLocalization: true }
) {
  // Validate inputs and ensure consistency
  if (words.length !== wordWidths.length) {
    console.error("Words array and widths array must have the same length", words.length, wordWidths.length);
    return [];
  }

  if (words.length === 0) {
    return [];
  }

  // Set a stronger minimum difference threshold to ensure real diversity between candidates
  // Scale based on paragraph length to ensure meaningful diversity in longer text
  let minDifferenceThreshold = words.length > 20 ? 8 : (words.length > 10 ? 5 : 3);
  
  // Knuth-Plass algorithm implementation
  const n = words.length;
  let penalties = new Array(n + 1);
  let breaks = new Array(n + 1);
  let widths = new Array(n + 1);
  
  // Initialize values
  for (let i = 0; i <= n; i++) {
    penalties[i] = Infinity;
    breaks[i] = 0;
    widths[i] = 0;
  }
  
  // Base case
  penalties[0] = 0;
  
  // Dynamic programming approach for optimal line breaks
  for (let i = 0; i < n; i++) {
    // Current line starts with word i
    let width = 0;
    
    for (let j = i; j < n; j++) {
      // Add current word width
      width += wordWidths[j];
      
      // Add space width except for the first word
      if (j > i) {
        width += spaceWidth;
      }
      
      // Check if we exceed the target width
      if (width > targetWidth * 1.5) {
        break; // This line is too wide, stop considering more words
      }
      
      // Calculate line penalty based on mode
      let penalty;
      
      if (mode === 'fill') {
        // Fill mode: Prefer to fill as much of the line as possible
        penalty = Math.abs(targetWidth - width);
      } else {
        // Fit mode: Allow lines to be shorter, penalize exceeding target width heavily
        penalty = width <= targetWidth ? (targetWidth - width) * 0.5 : (width - targetWidth) * 3;
      }
      
      // Adjust penalty based on fill ratio to prevent too-short lines
      const fillRatio = width / targetWidth;
      if (fillRatio < minFillRatio) {
        penalty += (minFillRatio - fillRatio) * targetWidth * 2;
      }
      
      // Calculate total penalty: current line + penalty so far
      let totalPenalty = penalties[i] + penalty;
      
      // Check if this is a better breakpoint
      if (totalPenalty < penalties[j + 1]) {
        penalties[j + 1] = totalPenalty;
        breaks[j + 1] = i;
        widths[j + 1] = width;
      }
    }
  }
  
  // Create the best solution first
  let bestSolution = reconstructSolution(words, breaks, n);
  
  // Calculate line widths for the best solution
  let bestLineWidths = calculateLineWidths(bestSolution, wordWidths, spaceWidth);
  
  // Generate alternative solutions using a diverse set of starting points
  let candidates = [
    {
      lines: bestSolution,
      breaks: findBreakIndices(bestSolution),
      score: penalties[n],
      scoreBreakdown: calculateScoreBreakdown(bestSolution, bestLineWidths, targetWidth, balanceFactor),
      lineWidths: bestLineWidths
    }
  ];
  
  // Track all generated break patterns to ensure diversity
  let generatedBreakPatterns = new Set();
  generatedBreakPatterns.add(candidates[0].breaks.join(","));
  
  // Main function to find alternatives
  function findAlternatives() {
    // Create diverse alternative solutions by perturbing the dynamic programming algorithm
    for (let variant = 0; variant < Math.min(20, candidateCount * 2); variant++) {
      // Use different perturbation strategies based on the variant number
      let altPenalties = new Array(n + 1).fill(Infinity);
      let altBreaks = new Array(n + 1).fill(0);
      let altWidths = new Array(n + 1).fill(0);
      
      // Base case
      altPenalties[0] = 0;
      
      // Variance factor increases with each variant to ensure diversity
      const varianceFactor = 0.1 + (variant * 0.15);
      
      // Use different line width targets for variants
      let variantTargetWidth;
      
      if (variant % 4 === 0) {
        // Make lines slightly shorter
        variantTargetWidth = targetWidth * (0.95 - varianceFactor * 0.1);
      } else if (variant % 4 === 1) {
        // Make lines slightly longer
        variantTargetWidth = targetWidth * (1.05 + varianceFactor * 0.1);
      } else if (variant % 4 === 2) {
        // Alternate between shorter and longer lines
        variantTargetWidth = targetWidth * (variant % 2 === 0 ? 0.9 : 1.1);
      } else {
        // Use original target width but with different penalty calculations
        variantTargetWidth = targetWidth;
      }
      
      // Dynamic programming approach with perturbations
      for (let i = 0; i < n; i++) {
        let width = 0;
        
        for (let j = i; j < n; j++) {
          // Add current word width
          width += wordWidths[j];
          
          // Add space width except for the first word
          if (j > i) {
            width += spaceWidth;
          }
          
          // Check if we exceed the target width by too much
          if (width > variantTargetWidth * 1.5) {
            break; // This line is too wide
          }
          
          // Calculate line penalty with variations
          let penalty;
          
          // Different penalty calculations for different variants
          if (variant % 3 === 0) {
            // Standard penalty but with modified weights
            penalty = width <= variantTargetWidth 
              ? (variantTargetWidth - width) * (0.3 + varianceFactor) 
              : (width - variantTargetWidth) * (2 + varianceFactor);
          } else if (variant % 3 === 1) {
            // Penalty based on squared difference - more aggressive
            const diff = Math.abs(variantTargetWidth - width);
            penalty = diff * diff * (0.01 + varianceFactor * 0.02);
          } else {
            // Linear penalty but with different slopes for under/over
            penalty = width <= variantTargetWidth
              ? (variantTargetWidth - width) * (0.8 - varianceFactor * 0.3)
              : (width - variantTargetWidth) * (1.5 + varianceFactor);
          }
          
          // Adjust penalty based on position in text to create variation
          // Early lines get different treatment than later lines
          const positionFactor = i / n;
          if (variant % 2 === 0) {
            // Favor more even breaks at beginning of text
            penalty *= 1 + (positionFactor * varianceFactor);
          } else {
            // Favor more even breaks at end of text
            penalty *= 1 + ((1 - positionFactor) * varianceFactor);
          }
          
          // Prefer certain line counts by adding penalties to solutions with too many or too few lines
          const avgWordsPerLine = n / Math.max(Math.floor(n / (j - i + 1)), 1);
          
          // Add a penalty for lines that are too short or too long relative to average
          const lineLength = j - i + 1;
          const lengthDiff = Math.abs(lineLength - avgWordsPerLine);
          if (lengthDiff > avgWordsPerLine * 0.5) {
            penalty += lengthDiff * 5 * varianceFactor;
          }
          
          // Calculate total penalty
          let totalPenalty = altPenalties[i] + penalty;
          
          // Random perturbation to create diversity
          // More likely to perturb as variant number increases
          if (Math.random() < varianceFactor * 0.3) {
            totalPenalty *= 0.9 + (Math.random() * 0.2);
          }
          
          // Check if this is a better breakpoint
          if (totalPenalty < altPenalties[j + 1]) {
            altPenalties[j + 1] = totalPenalty;
            altBreaks[j + 1] = i;
            altWidths[j + 1] = width;
          }
        }
      }
      
      // Reconstruct the alternative solution
      const altSolution = reconstructSolution(words, altBreaks, n);
      const altLineWidths = calculateLineWidths(altSolution, wordWidths, spaceWidth);
      const breakIndices = findBreakIndices(altSolution);
      const breakPattern = breakIndices.join(",");
      
      // Calculate score breakdown for this candidate
      const scoreBreakdown = calculateScoreBreakdown(
        altSolution, altLineWidths, targetWidth, balanceFactor
      );
      
      // Check if this break pattern is sufficiently different from existing ones
      let isUnique = true;
      
      if (generatedBreakPatterns.has(breakPattern)) {
        isUnique = false;
      } else {
        // Check difference from all existing candidates
        for (const existingCandidate of candidates) {
          const difference = breakPatternDifference(
            breakIndices, 
            existingCandidate.breaks,
            words.length
          );
          
          // Require a minimum difference to consider this unique
          if (difference < minDifferenceThreshold) {
            isUnique = false;
            break;
          }
        }
      }
      
      // Add to candidates if unique
      if (isUnique) {
        generatedBreakPatterns.add(breakPattern);
        candidates.push({
          lines: altSolution,
          breaks: breakIndices,
          score: altPenalties[n],
          scoreBreakdown,
          lineWidths: altLineWidths
        });
        
        // Stop if we have enough candidates
        if (candidates.length >= candidateCount) {
          break;
        }
      }
    }
  }
  
  // Keep generating alternatives until we have enough candidates or run out of attempts
  let attemptCount = 0;
  const maxAttempts = 10;
  
  while (candidates.length < candidateCount && attemptCount < maxAttempts) {
    findAlternatives();
    attemptCount++;
    
    // If we can't find enough diverse candidates, gradually reduce the difference threshold
    if (attemptCount > 5 && candidates.length < candidateCount) {
      minDifferenceThreshold = Math.max(1, minDifferenceThreshold - 1);
    }
  }
  
  // Sort candidates by score (lower is better)
  candidates.sort((a, b) => a.score - b.score);
  
  // Output debug information if requested
  if (debugOutput) {
    debugOutput.innerHTML = createDebugTree(candidates[0], words.length);
  }
  
  return candidates;
}

/**
 * Calculate a difference score between two break patterns
 * Higher score means more different (more diverse) candidates
 * 
 * @param {number[]} pattern1 - First break pattern
 * @param {number[]} pattern2 - Second break pattern
 * @param {number} totalWords - Total word count for normalization
 * @returns {number} - Difference score
 */
function breakPatternDifference(pattern1, pattern2, totalWords) {
  // Convert break patterns to sets for easier comparison
  const set1 = new Set(pattern1);
  const set2 = new Set(pattern2);
  
  // Count unique breaks in each pattern
  let uniqueToPattern1 = 0;
  let uniqueToPattern2 = 0;
  
  // Count breaks in pattern1 not in pattern2
  for (const breakPoint of pattern1) {
    if (!set2.has(breakPoint)) {
      uniqueToPattern1++;
    }
  }
  
  // Count breaks in pattern2 not in pattern1
  for (const breakPoint of pattern2) {
    if (!set1.has(breakPoint)) {
      uniqueToPattern2++;
    }
  }
  
  // Symmetric difference (breaks that appear in only one pattern)
  const totalDifference = uniqueToPattern1 + uniqueToPattern2;
  
  // Line count difference (different number of lines is a significant difference)
  const lineCountDiff = Math.abs(pattern1.length - pattern2.length);
  
  // Calculate normalized difference score based on total word count
  // Add lineCountDiff with higher weight to prioritize different line counts
  return totalDifference + (lineCountDiff * 2);
}

/**
 * Calculate score breakdown for a candidate solution
 * 
 * @param {Array} lines - Lines of text
 * @param {Array} lineWidths - Widths of each line
 * @param {number} targetWidth - Target width
 * @param {number} balanceFactor - Balance factor between raggedness and evenness
 * @returns {Object} - Score breakdown
 */
function calculateScoreBreakdown(lines, lineWidths, targetWidth, balanceFactor) {
  // Calculate raggedness (how much lines deviate from target width)
  let totalRaggedness = 0;
  for (let i = 0; i < lineWidths.length - 1; i++) {
    totalRaggedness += Math.pow(targetWidth - lineWidths[i], 2);
  }
  
  // Calculate evenness (how consistent line lengths are)
  let totalEvenness = 0;
  const avgWidth = lineWidths.reduce((sum, width) => sum + width, 0) / lineWidths.length;
  
  for (let i = 0; i < lineWidths.length; i++) {
    totalEvenness += Math.pow(lineWidths[i] - avgWidth, 2);
  }
  
  // Calculate fill penalty (how much of the available width is used)
  let totalFill = 0;
  for (let i = 0; i < lineWidths.length - 1; i++) {
    const fillRatio = lineWidths[i] / targetWidth;
    totalFill += Math.max(0, 0.9 - fillRatio) * 100; // Penalty increases as fill ratio decreases below 90%
  }
  
  // Count widows and orphans
  let widowOrphanCount = 0;
  
  // Check for orphans (first line of a paragraph with a single word)
  if (lines[0].length === 1) {
    widowOrphanCount++;
  }
  
  // Check for widows (last line of a paragraph with a single word)
  if (lines[lines.length - 1].length === 1) {
    widowOrphanCount++;
  }
  
  // Check for protected breaks (placeholder - will be updated later in render)
  // This is initially 0 and will be updated when rendering
  const protectedBreaks = 0;
  
  return {
    raggedness: Math.sqrt(totalRaggedness) / 100,
    evenness: Math.sqrt(totalEvenness) / 100,
    fillPenalty: totalFill / lineWidths.length,
    widowsOrphans: widowOrphanCount,
    protectedBreaks: protectedBreaks
  };
}

/**
 * Reconstruct solution from breaks array
 * 
 * @param {Array} words - Words array
 * @param {Array} breaks - Breaks array
 * @param {number} j - Current position
 * @returns {Array} - Array of lines, each containing words
 */
function reconstructSolution(words, breaks, j) {
  if (j === 0) return [];
  
  let result = reconstructSolution(words, breaks, breaks[j]);
  let line = [];
  
  for (let i = breaks[j]; i < j; i++) {
    line.push(words[i]);
  }
  
  result.push(line);
  return result;
}

/**
 * Calculate widths for each line
 * 
 * @param {Array} lines - Lines of text
 * @param {Array} wordWidths - Word widths
 * @param {number} spaceWidth - Space width
 * @returns {Array} - Line widths
 */
function calculateLineWidths(lines, wordWidths, spaceWidth) {
  return lines.map(line => {
    let width = 0;
    let wordIndex = 0;
    
    // Find the index of each word in the original words array
    for (let i = 0; i < lines.indexOf(line); i++) {
      wordIndex += lines[i].length;
    }
    
    // Calculate the width of this line
    for (let i = 0; i < line.length; i++) {
      width += wordWidths[wordIndex + i];
      
      // Add space width except after last word
      if (i < line.length - 1) {
        width += spaceWidth;
      }
    }
    
    return width;
  });
}

/**
 * Find break indices (where line breaks occur in the original word array)
 * 
 * @param {Array} lines - Lines of text
 * @returns {Array} - Break indices
 */
function findBreakIndices(lines) {
  let breaks = [];
  let wordCount = 0;
  
  // For each line except the last one
  for (let i = 0; i < lines.length - 1; i++) {
    wordCount += lines[i].length;
    breaks.push(wordCount - 1); // Index of last word in the line
  }
  
  return breaks;
}

/**
 * Create debug tree display
 * 
 * @param {Object} solution - Best solution
 * @param {number} wordCount - Total word count
 * @returns {string} - Debug HTML
 */
function createDebugTree(solution, wordCount) {
  if (!solution) return "No solution found";
  
  const lineBreaks = solution.breaks;
  const lineCount = solution.lines.length;
  const avgWordsPerLine = wordCount / lineCount;
  
  let html = `
    <div style="font-family: monospace; white-space: pre;">
      <div style="font-weight: bold; margin-bottom: 10px;">
        Line Break Tree (${wordCount} words, ${lineCount} lines, ~${avgWordsPerLine.toFixed(1)} words/line)
      </div>
  `;
  
  // Create a line break visualization
  let breakPositions = new Set(lineBreaks);
  
  html += '<div style="margin-bottom: 15px;">';
  
  // Create a line with markers where breaks occur
  for (let i = 0; i < wordCount; i++) {
    if (breakPositions.has(i)) {
      html += '<span style="color: #ff6b6b;">|</span>';
    } else {
      html += '<span style="color: #a0a0a0;">·</span>';
    }
  }
  
  html += '</div>';
  
  // Add score breakdown
  html += `
    <div style="margin-top: 10px;">
      <div>Score: ${solution.score.toFixed(2)}</div>
      <div>Raggedness: ${solution.scoreBreakdown.raggedness.toFixed(2)}</div>
      <div>Evenness: ${solution.scoreBreakdown.evenness.toFixed(2)}</div>
      <div>Fill Penalty: ${solution.scoreBreakdown.fillPenalty.toFixed(2)}</div>
    </div>
  `;
  
  html += '</div>';
  
  return html;
}
