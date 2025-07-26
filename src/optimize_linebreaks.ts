// Optimal line-breaking algorithm similar to Knuth-Plass with candidate generation
import { SyntheticMetrics } from './types';
import ruleEngine from './localization/rules/ruleConfigs';

// Constants for magic numbers to improve readability and maintainability
const CONSTANTS = {
  // Penalty weights
  WIDOW_PENALTY: 15,
  ORPHAN_PENALTY: 10,
  PROTECTED_BREAK_PENALTY: 8,
  
  // Layout constants
  MAX_WIDTH_FACTOR: 1.5,
  MIN_FILL_RATIO_ADJUSTMENT: 0.1,
  
  // Score thresholds
  GOOD_RAGGEDNESS_THRESHOLD: 10,
  WARNING_RAGGEDNESS_THRESHOLD: 30,
  GOOD_EVENNESS_THRESHOLD: 90,
  WARNING_EVENNESS_THRESHOLD: 75
};

interface ScoreBreakdown {
  raggedness: number;
  evenness: number;
  fillRatio: number;
  fillPenalty?: number;
  widows: number;
  widowsOrphans?: number;
  orphans: number;
  protectedBreaks: number;
  protected?: number;
  balanceFactor: number;
  score?: number;
}

interface OptimizeLineBreakCandidate {
  score?: number;
  lines?: string[][] | string[];
  breaks?: number[];
  lineBreaks?: number[];
  lineWidths?: number[];
  scoreBreakdown?: ScoreBreakdown;
  protectedBreakLines?: number[];
}

interface ComputeBreaksOptions {
  enableLocalization?: boolean;
}

/**
 * Calculates the penalty for a line of a specific width relative to target width
 * Takes into account the layout mode and balance factor for tuning penalties
 */
function calculateLinePenalty(
  lineWidth: number, 
  targetWidth: number, 
  mode: string,
  balanceFactor: number
): number {
  if (mode === 'fill') {
    // Fill mode: Prefer to fill as much of the line as possible
    return Math.abs(targetWidth - lineWidth);
  } else {
    // Fit mode: Allow lines to be shorter, penalize exceeding target width heavily
    // Balance factor affects how we penalize deviations from target width
    // Higher balance factor = more focus on matching target width
    const underWeightFactor = 0.5 * (1 - balanceFactor); // Lower if high balance factor
    const overWeightFactor = 3 * (0.5 + balanceFactor * 0.5); // Higher if high balance factor
    
    return lineWidth <= targetWidth 
      ? (targetWidth - lineWidth) * underWeightFactor 
      : (lineWidth - targetWidth) * overWeightFactor;
  }
}

export function computeBreaks(
  words: string[],
  wordWidths: number[],
  spaceWidth: number,
  targetWidth: number,
  candidateCount: number = 1,
  debugOutput: HTMLElement | null = null,
  balanceFactor: number = 0.5,
  minFillRatio: number = 0.5,
  mode: string = 'fit',
  locale: string = 'en',
  options: ComputeBreaksOptions = { enableLocalization: true }
): OptimizeLineBreakCandidate[] {
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
  let penalties = new Array(n + 1).fill(Infinity);
  let breaks = new Array(n + 1).fill(0);
  let widths = new Array(n + 1).fill(0);
  
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
      if (width > targetWidth * CONSTANTS.MAX_WIDTH_FACTOR) {
        break; // This line is too wide, stop considering more words
      }
      
      // Calculate line penalty using the extracted calculateLinePenalty function
      let penalty = calculateLinePenalty(width, targetWidth, mode, balanceFactor);
      
      // Adjust penalty based on fill ratio to prevent too-short lines
      // Higher balance factor means stricter adherence to minFillRatio
      const fillRatio = width / targetWidth;
      const adjustedMinFillRatio = minFillRatio + (balanceFactor * CONSTANTS.MIN_FILL_RATIO_ADJUSTMENT); // Higher balance factor means higher minimum fill ratio
      if (fillRatio < adjustedMinFillRatio) {
        penalty += (adjustedMinFillRatio - fillRatio) * targetWidth * (1.5 + balanceFactor * 1);
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
  let candidates: OptimizeLineBreakCandidate[] = [
    {
      lines: bestSolution,
      breaks: findBreakIndices(bestSolution),
      score: penalties[n],
      scoreBreakdown: calculateScoreBreakdown(bestSolution, bestLineWidths, targetWidth, balanceFactor, locale),
      lineWidths: bestLineWidths
    }
  ];
  
  // Track all generated break patterns to ensure diversity
  let generatedBreakPatterns = new Set<string>();
  if (candidates[0].breaks) {
    generatedBreakPatterns.add(candidates[0].breaks.join(","));
  }
  
  // Main function to find alternatives
  function findAlternatives(): void {
    // Create diverse alternative solutions by perturbing the dynamic programming algorithm
    for (let variant = 0; variant < Math.min(20, candidateCount * 2); variant++) {
      // Setup for dynamic programming with perturbations
      let altPenalties = new Array(n + 1).fill(Infinity);
      let altBreaks = new Array(n + 1).fill(0);
      let altWidths = new Array(n + 1).fill(0);
      
      // Base case
      altPenalties[0] = 0;
      
      // Variance factor increases with each variant to ensure diversity
      const varianceFactor = 0.1 + (variant * 0.15);
      
      // Determine target width for this variant
      let variantTargetWidth: number;
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
          let penalty: number;
          
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
        altSolution, altLineWidths, targetWidth, balanceFactor, locale
      );
      
      // Check if this break pattern is sufficiently different from existing ones
      let isUnique = true;
      
      if (generatedBreakPatterns.has(breakPattern)) {
        isUnique = false;
      } else {
        // Check difference from all existing candidates
        for (const existingCandidate of candidates) {
          if (existingCandidate.breaks && breakIndices) {
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
  candidates.sort((a, b) => (a.score || 0) - (b.score || 0));
  
  // Output debug information if requested
  if (debugOutput) {
    debugOutput.innerHTML = createDebugTree(candidates[0], words.length);
  }
  
  return candidates;
}

// Calculate a difference score between two break patterns (higher score = more diverse)
function breakPatternDifference(pattern1: number[], pattern2: number[], totalWords: number): number {
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

// Calculate score breakdown for a candidate solution with normalized metrics (0-100% scale)
function calculateScoreBreakdown(lines: string[][], lineWidths: number[], targetWidth: number, balanceFactor: number, locale: string = 'en'): ScoreBreakdown {
  // Skip calculation for empty inputs
  if (!lines || !lineWidths || lines.length === 0 || lineWidths.length === 0) {
    return {
      raggedness: 0,
      evenness: 100,
      fillRatio: 100,
      widows: 0,
      orphans: 0,
      protectedBreaks: 0,
      balanceFactor: balanceFactor
    };
  }

  // ===== CALCULATE RAGGEDNESS (0-100%, lower is better) =====
  // Measures how uneven the right edge of text is (excluding the last line)
  // Perfect score (0%) means all lines exactly match the target width
  
  // Only consider non-last lines unless there's only one line
  const raggedLinesToMeasure = lineWidths.length > 1 ? lineWidths.slice(0, -1) : [];
  let totalSquaredDeviation = 0;
  let normalizedRaggedness = 0;
  
  // Skip calculation if we have nothing to measure (single line paragraph)
  if (raggedLinesToMeasure.length > 0) {
    // Calculate squared deviations from target width
    for (let i = 0; i < raggedLinesToMeasure.length; i++) {
      const deviation = Math.abs(targetWidth - raggedLinesToMeasure[i]);
      const deviationRatio = deviation / targetWidth; // Normalized by target width
      totalSquaredDeviation += Math.pow(deviationRatio, 2);
    }
    
    // Scale to 0-100% range using root-mean-square deviation
    // This provides a proper measure of raggedness where:
    // - 0% = perfect right edge alignment (all lines exactly match target width)
    // - ~10% = minor variations (good)
    // - ~30% = noticeable variations (acceptable)
    // - >50% = highly ragged (poor)
    normalizedRaggedness = Math.min(100, Math.sqrt(totalSquaredDeviation / raggedLinesToMeasure.length) * 100);
  }
  
  // ===== CALCULATE EVENNESS (0-100%, higher is better) =====
  // Measures how consistent line lengths are with each other
  // Perfect score (100%) means all lines are exactly the same length
  
  // Use all lines for evenness calculation
  const avgLineWidth = lineWidths.reduce((sum, w) => sum + w, 0) / lineWidths.length;
  let sumOfSquaredDifferences = 0;
  
  // Calculate variance
  for (const width of lineWidths) {
    sumOfSquaredDifferences += Math.pow(width - avgLineWidth, 2);
  }
  
  // Calculate coefficient of variation (CV)
  // CV = (Standard Deviation / Mean) * 100%
  // Lower CV means better evenness
  const variance = sumOfSquaredDifferences / lineWidths.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = avgLineWidth > 0 ? (stdDev / avgLineWidth) : 0;
  
  // Transform CV to evenness score (0-100%)
  // A CV of 0 means perfect evenness (100% score)
  // A CV of 0.33 (33%) or higher means very poor evenness (0% score)
  const normalizedEvenness = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 300)));
  
  // ===== CALCULATE FILL RATIO (0-100%, higher is better) =====
  // Measures how much of the available width is used by each line
  // Perfect score (100%) means all lines use the full width
  
  // Skip last line for fill ratio calculations unless there's only one line
  const fillLinesToMeasure = lineWidths.length > 1 ? lineWidths.slice(0, -1) : lineWidths;
  let totalWidth = 0;
  let totalAvailableWidth = fillLinesToMeasure.length * targetWidth;
  
  // Sum the actual widths of all measured lines
  for (const lineWidth of fillLinesToMeasure) {
    totalWidth += Math.min(lineWidth, targetWidth); // Cap at target width
  }
  
  // Calculate fill ratio as percentage of available space used
  // Handle edge case of single-line or empty text
  const avgFillRatio = totalAvailableWidth > 0 ? 
    (totalWidth / totalAvailableWidth) * 100 : 100;
  
  // ===== COUNT WIDOWS (single words on last line) =====
  // A widow is specifically a single word left alone on the last line
  const widowCount = lines.length > 1 && Array.isArray(lines[lines.length - 1]) && 
    lines[lines.length - 1].length === 1 ? 1 : 0;
  
  // ===== COUNT ORPHANS (single words on first line) =====
  // An orphan is specifically a single word on the first line
  const orphanCount = lines.length > 0 && Array.isArray(lines[0]) && 
    lines[0].length === 1 ? 1 : 0;
  
  // ===== DETECT PROTECTED BREAKS (violations of typography rules) =====
  // Calculate initial count based on basic rules
  let protectedBreaks = 0;
  
  // Get function words from the locale-specific rules configuration
  // Add proper type casting to access rule properties
  const rulesConfig = ruleEngine[locale as keyof typeof ruleEngine] || ruleEngine['en' as keyof typeof ruleEngine] || {};
  
  // Use a Set for faster lookups when checking words
  const functionWordsSet = new Set([
    ...((rulesConfig as any).articles || []),
    ...((rulesConfig as any).prepositions || []),
    ...((rulesConfig as any).conjunctions || []),
    ...((rulesConfig as any).functionWords || [])
  ].map(word => word.toLowerCase()));  // Convert to lowercase for case-insensitive matching
  
  // Check each line except the last for protected break violations
  for (let i = 0; i < lines.length - 1; i++) {
    const line = lines[i];
    if (Array.isArray(line) && line.length > 0) {
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, ''); // Remove punctuation
      
      // Check for function words at line end
      if (functionWordsSet.has(lastWord)) {
        protectedBreaks++;
      }
      
      // Check for hyphenated words broken at inappropriate places
      if (lastWord.endsWith('-')) {
        protectedBreaks++;
      }
      
      // Check for numbers separated from units
      if (i < lines.length - 1 && Array.isArray(lines[i+1]) && lines[i+1].length > 0) {
        if (/^\d+$/.test(lastWord)) {
          const nextFirstWord = lines[i+1][0].toLowerCase();
          // Check if next word is a unit
          if (/^(px|em|%|kg|lb|ft|in|cm|mm|m|s|ms|gb|mb|kb)$/i.test(nextFirstWord)) {
            protectedBreaks++;
          }
        }
      }
    }
  }
  
  // Calculate final score based on all metrics with proper weighting
  // This combines all factors into a single score, influenced by balance factor
  // Lower score is better in our scoring system
  
  // Base score components - adjusted to align with expected ranges
  // Raggedness: 0-10% is good, 10-30% is acceptable, >30% is poor
  const raggednessPenalty = normalizedRaggedness * 0.5; // 0-50 points
  
  // Evenness: 90-100% is good, 75-90% is acceptable, <75% is poor
  const evennessPenalty = (100 - normalizedEvenness) * 0.3; // 0-30 points
  
  // Fill Ratio: 85-100% is good, 70-85% is acceptable, <70% is poor
  const fillPenalty = (100 - avgFillRatio) * 0.2; // 0-20 points
  
  // Apply balance factor to adjust relative importance of raggedness vs evenness
  // Higher balance factor means we care more about adherence to target width (raggedness)
  // Lower balance factor means we care more about consistent line lengths (evenness)
  const balancedRaggednessPenalty = raggednessPenalty * balanceFactor;
  const balancedEvennessPenalty = evennessPenalty * (1 - balanceFactor);
  
  // Additional penalties for typographical issues using defined constants
  const widowPenalty = widowCount * CONSTANTS.WIDOW_PENALTY; // Penalty per widow
  const orphanPenalty = orphanCount * CONSTANTS.ORPHAN_PENALTY; // Penalty per orphan
  const protectedBreakPenalty = protectedBreaks * CONSTANTS.PROTECTED_BREAK_PENALTY; // Penalty per protected break violation
  
  // Calculate final score (lower is better)
  const finalScore = balancedRaggednessPenalty + 
                     balancedEvennessPenalty + 
                     fillPenalty + 
                     widowPenalty + 
                     orphanPenalty + 
                     protectedBreakPenalty;
  
  return {
    // Main metrics as normalized values (0-100%)
    raggedness: normalizedRaggedness,
    evenness: normalizedEvenness,
    fillRatio: avgFillRatio,
    
    // Count-based metrics (absolute values)
    widows: widowCount,
    orphans: orphanCount,
    protectedBreaks: protectedBreaks,
    
    // Store settings and calculated score
    balanceFactor: balanceFactor,
    score: finalScore
  };
}

// Reconstruct solution from breaks array with memoization for performance
function reconstructSolution(words: string[], breaks: number[], j: number, memo: Map<number, string[][]> = new Map()): string[][] {
  // Return memoized result if available
  if (memo.has(j)) return memo.get(j)!;
  
  // Base case
  if (j === 0) return [];
  
  // Recursive case with memoization
  let result = reconstructSolution(words, breaks, breaks[j], memo);
  let line: string[] = [];
  
  for (let i = breaks[j]; i < j; i++) {
    line.push(words[i]);
  }
  
  result.push(line);
  
  // Store result in memo cache
  memo.set(j, result);
  return result;
}

// Calculate widths for each line
function calculateLineWidths(lines: string[][], wordWidths: number[], spaceWidth: number): number[] {
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

// Find break indices (where line breaks occur in the original word array)
function findBreakIndices(lines: string[][]): number[] {
  let breaks: number[] = [];
  let wordCount = 0;
  
  // For each line except the last one
  for (let i = 0; i < lines.length - 1; i++) {
    wordCount += lines[i].length;
    breaks.push(wordCount - 1); // Index of last word in the line
  }
  
  return breaks;
}

// Create debug tree display with comprehensive metrics
function createDebugTree(solution: OptimizeLineBreakCandidate, wordCount: number): string {
  if (!solution) return "No solution found";
  
  const lineBreaks = solution.breaks || [];
  const lineCount = solution.lines?.length || 0;
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
  
  // Helper function to generate color-coded metric display with improved thresholds
  function getMetricColor(
    value: number, 
    isGoodWhenLow: boolean = false, 
    thresholds = { 
      good: CONSTANTS.GOOD_EVENNESS_THRESHOLD, 
      warning: CONSTANTS.WARNING_EVENNESS_THRESHOLD 
    }
  ): string {
    if (isGoodWhenLow) {
      return value <= thresholds.good ? '#4caf50' : // Green for good
             value <= thresholds.warning ? '#ff9800' : // Orange for warning
             '#f44336';               // Red for poor
    } else {
      return value >= thresholds.good ? '#4caf50' : // Green for good
             value >= thresholds.warning ? '#ff9800' : // Orange for warning
             '#f44336';                            // Red for poor
    }
  }
  
  // Extract metrics with proper fallbacks
  const breakdowns = solution.scoreBreakdown || {} as ScoreBreakdown;
  const balanceFactor = (breakdowns as any).balanceFactor?.toFixed(2) || '0.50';
  const raggedness = (breakdowns as any).raggedness || 0;
  const evenness = (breakdowns as any).evenness || 100;
  const fillRatio = (breakdowns as any).fillRatio || (breakdowns as any).fillPenalty || 100;
  const widows = (breakdowns as any).widows || (breakdowns as any).widowsOrphans || 0;
  const orphans = (breakdowns as any).orphans || 0;
  const protectedBreaks = (breakdowns as any).protectedBreaks || 0;
  
  // Add enhanced score breakdown with color indicators and better explanations
  html += `
    <div style="margin-top: 10px; border-top: 1px dashed #666; padding-top: 10px;">
      <div style="font-weight: bold; font-size: 1.1em;">
        Solution Score: ${solution.score?.toFixed(2)}
        <span style="font-size: 0.8em; color: #666; font-weight: normal;">(lower is better)</span>
      </div>
      
      <div style="margin-top: 12px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">
        Quality Metrics
        <span style="font-weight: normal; font-size: 0.9em; color: #666; margin-left: 10px;">
          Aligned with professional typography standards
        </span>
      </div>
      
      <div style="display: grid; grid-template-columns: auto 1fr; gap: 8px; margin: 8px 0;">
        <div style="color: ${getMetricColor(raggedness, true, { good: CONSTANTS.GOOD_RAGGEDNESS_THRESHOLD, warning: CONSTANTS.WARNING_RAGGEDNESS_THRESHOLD })}; font-weight: bold;">
          Raggedness:
        </div>
        <div>
          ${raggedness.toFixed(1)}% 
          <span style="color: #666; font-size: 0.9em;">
            (0-${CONSTANTS.GOOD_RAGGEDNESS_THRESHOLD}% ideal) - Measures how uneven the right margin appears
          </span>
          <div style="width: 100%; height: 4px; background: #eee; margin-top: 3px;">
            <div style="width: ${Math.min(100, raggedness)}%; height: 4px; background: ${getMetricColor(raggedness, true, { good: 10, warning: 30 })};"></div>
          </div>
        </div>
        
        <div style="color: ${getMetricColor(evenness, false, { good: 90, warning: 75 })}; font-weight: bold;">
          Evenness:
        </div>
        <div>
          ${evenness.toFixed(1)}% 
          <span style="color: #666; font-size: 0.9em;">
            (90-100% ideal) - Consistency of line lengths throughout text
          </span>
          <div style="width: 100%; height: 4px; background: #eee; margin-top: 3px;">
            <div style="width: ${evenness}%; height: 4px; background: ${getMetricColor(evenness, false, { good: 90, warning: 75 })};"></div>
          </div>
        </div>
        
        <div style="color: ${getMetricColor(fillRatio, false, { good: 85, warning: 70 })}; font-weight: bold;">
          Fill Ratio:
        </div>
        <div>
          ${fillRatio.toFixed(1)}% 
          <span style="color: #666; font-size: 0.9em;">
            (85-100% ideal) - How efficiently the available width is used
          </span>
          <div style="width: 100%; height: 4px; background: #eee; margin-top: 3px;">
            <div style="width: ${fillRatio}%; height: 4px; background: ${getMetricColor(fillRatio, false, { good: 85, warning: 70 })};"></div>
          </div>
        </div>
        
        <div style="color: ${getMetricColor(widows, true, { good: 0, warning: 0 })}; font-weight: bold;">
          Widows:
        </div>
        <div>
          ${widows} 
          <span style="color: #666; font-size: 0.9em;">
            (0 ideal) - Single words isolated on the last line
          </span>
        </div>
        
        <div style="color: ${getMetricColor(orphans, true, { good: 0, warning: 0 })}; font-weight: bold;">
          Orphans:
        </div>
        <div>
          ${orphans} 
          <span style="color: #666; font-size: 0.9em;">
            (0 ideal) - Single words isolated on the first line
          </span>
        </div>
        
        <div style="color: ${getMetricColor(protectedBreaks, true, { good: 0, warning: 0 })}; font-weight: bold;">
          Protected:
        </div>
        <div>
          ${protectedBreaks} 
          <span style="color: #666; font-size: 0.9em;">
            (0 ideal) - Violations of typographic rules (e.g., prepositions at line end)
          </span>
        </div>
      </div>
      
      <div style="margin-top: 12px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 4px;">
        Balance Settings
      </div>
      <div style="margin-top: 5px;">
        <div>Balance Factor: <strong>${balanceFactor}</strong></div>
        <div style="display: flex; align-items: center; gap: 8px; margin: 8px 0;">
          <span style="font-size: 0.9em; min-width: 75px;">Even lines</span>
          <div style="flex: 1; height: 8px; background: linear-gradient(to right, #4caf50, #ffeb3b, #f44336); border-radius: 4px; position: relative;">
            <div style="position: absolute; width: 12px; height: 12px; background: #3f51b5; border: 2px solid white; border-radius: 50%; top: -4px; left: calc(${parseFloat(balanceFactor.toString()) * 100}% - 6px); box-shadow: 0 1px 3px rgba(0,0,0,0.3);"></div>
          </div>
          <span style="font-size: 0.9em; min-width: 75px; text-align: right;">Target width</span>
        </div>
        <div style="font-size: 0.9em; color: #666; margin-top: 2px;">
          ${parseFloat(balanceFactor.toString()) < 0.4 ? 'Prioritizing even line lengths - lines will be more consistent in length, but may vary from target width' :
          parseFloat(balanceFactor.toString()) > 0.6 ? 'Prioritizing target width adherence - lines will closely match the target width, but may vary in length' :
          'Balanced approach - compromise between even lines and target width adherence'}
        </div>
      </div>
    </div>
  `;
  
  html += '</div>';
  
  return html;
}
