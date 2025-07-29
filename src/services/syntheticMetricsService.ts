// Synthetic metrics calculation service
import { SyntheticMetrics } from '../types';
import { localeConfigManager } from '../localization/LocaleConfigManager';
import { LAYOUT_CONSTANTS, UNIT_REGEX } from '../utils/constants';

/**
 * Calculate realistic metrics for synthetic candidates
 * @param lines - The lines of text
 * @param lineWidths - The width of each line
 * @param targetWidth - The target line width
 * @param variationIndex - The variation index
 * @param locale - The locale to use for rules
 * @param isLocalizationEnabled - Whether localization is enabled
 * @returns Calculated synthetic metrics
 */
export function calculateSyntheticMetrics(
  lines: string[][],
  lineWidths: number[],
  targetWidth: number,
  variationIndex: number,
  locale: string = 'en',
  isLocalizationEnabled: boolean = true
): SyntheticMetrics {
  try {
    // ===== CALCULATE RAGGEDNESS (0-100%, lower is better) =====
    // Measures how uneven the right edge of text is (excluding the last line)
    
    // Only consider non-last lines unless there's only one line
    const raggedLinesToMeasure = lineWidths.length > 1 ? lineWidths.slice(0, -1) : [];
    let totalSquaredDeviation = 0;
    let raggedness = 0;
    
    if (raggedLinesToMeasure.length > 0) {
      // Calculate squared deviations from target width
      for (let i = 0; i < raggedLinesToMeasure.length; i++) {
        const deviation = Math.abs(targetWidth - raggedLinesToMeasure[i]);
        const deviationRatio = deviation / targetWidth; // Normalized by target width
        totalSquaredDeviation += Math.pow(deviationRatio, 2);
      }
      
      // Scale to 0-100% range using root-mean-square deviation
      raggedness = Math.min(100, Math.sqrt(totalSquaredDeviation / raggedLinesToMeasure.length) * 100);
    }
    
    // ===== CALCULATE EVENNESS (0-100%, higher is better) =====
    // Measures how consistent line lengths are with each other
    
    // Use all lines for evenness calculation
    const avgLineWidth = lineWidths.reduce((sum, w) => sum + w, 0) / lineWidths.length;
    let sumOfSquaredDifferences = 0;
    
    // Calculate variance
    for (const width of lineWidths) {
      sumOfSquaredDifferences += Math.pow(width - avgLineWidth, 2);
    }
    
    // Calculate coefficient of variation (CV)
    const variance = sumOfSquaredDifferences / lineWidths.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = avgLineWidth > 0 ? (stdDev / avgLineWidth) : 0;
    
    // Transform CV to evenness score (0-100%)
    // A CV of 0 means perfect evenness (100% score)
    // A CV of 0.33 (33%) or higher means very poor evenness (0% score)
    const evenness = Math.max(0, Math.min(100, 100 - (coefficientOfVariation * 300)));
    
    // ===== CALCULATE FILL RATIO (0-100%, higher is better) =====
    // Measures how much of the available width is used by each line
    
    // Skip last line for fill ratio calculations unless there's only one line
    const fillLinesToMeasure = lineWidths.length > 1 ? lineWidths.slice(0, -1) : lineWidths;
    let totalWidth = 0;
    let totalAvailableWidth = fillLinesToMeasure.length * targetWidth;
    
    // Sum the actual widths of all measured lines
    for (const lineWidth of fillLinesToMeasure) {
      totalWidth += Math.min(lineWidth, targetWidth); // Cap at target width
    }
    
    // Calculate fill ratio as percentage of available space used
    const fillRatio = totalAvailableWidth > 0 ? (totalWidth / totalAvailableWidth) * 100 : 100;
    
    // ===== COUNT WIDOWS AND ORPHANS =====
    // Check for actual widows and orphans in the generated lines
    let widows = 0;
    let orphans = 0;
    
    if (lines.length > 0) {
      if (Array.isArray(lines[0]) && lines[0].length === 1) {
        orphans = 1;
      }
      
      if (lines.length > 1 && Array.isArray(lines[lines.length - 1]) && 
          lines[lines.length - 1].length === 1) {
        widows = 1;
      }
    }
    
    // ===== DETECT PROTECTED BREAKS =====
    // Actually calculate protected breaks based on typography rules
    let protectedBreaks = 0;
    let protectedBreakLines: number[] = [];
    
    // Get appropriate function words from locale config
    const config = localeConfigManager.getConfig(locale || 'en');
    
    // Get function words from config or create from parts
    const prepositions = config.prepositions || [];
    const articles = config.articles || [];
    const conjunctions = config.conjunctions || [];
    const functionWords = config.functionWords || 
      [...prepositions, ...articles, ...conjunctions];
    
    // Check each line except the last for protected break violations
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i];
      if (Array.isArray(line) && line.length > 0) {
        const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
        
        // Check for function words at line end
        if (functionWords.includes(lastWord)) {
          protectedBreaks++;
          protectedBreakLines.push(i);
        }
        
        // Check for hyphenated words broken at inappropriate places
        if (lastWord.endsWith('-')) {
          protectedBreaks++;
          protectedBreakLines.push(i);
        }
      }
    }
    
    // Calculate final score using the same formula as the main algorithm
    // This ensures consistency between real and synthetic candidates
    const raggednessPenalty = raggedness * 0.5;
    const evennessPenalty = (100 - evenness) * 0.3;
    const fillPenalty = (100 - fillRatio) * 0.2;
    
    // Apply balance factor to adjust relative importance
    // Lower balance factor (0) prioritizes target width adherence, higher (1) prioritizes even line lengths
    const balancedRaggednessPenalty = raggednessPenalty * (1 - 0.5); // Using middle balance factor
    const balancedEvennessPenalty = evennessPenalty * 0.5;
    
    // Additional penalties for typographical issues
    const widowPenalty = widows * LAYOUT_CONSTANTS.WIDOW_PENALTY;
    const orphanPenalty = orphans * LAYOUT_CONSTANTS.ORPHAN_PENALTY;
    const protectedBreakPenalty = protectedBreaks * LAYOUT_CONSTANTS.PROTECTED_BREAK_PENALTY;
    
    // Calculate final score (lower is better)
    const score = balancedRaggednessPenalty + 
                  balancedEvennessPenalty + 
                  fillPenalty + 
                  widowPenalty + 
                  orphanPenalty + 
                  protectedBreakPenalty;
    
    return {
      raggedness,
      evenness,
      fillRatio,
      widows,
      orphans,
      protectedBreaks,
      protectedBreakLines,
      balanceFactor: 0.5,
      score
    };
  } catch (error) {
    console.error('Error calculating synthetic metrics:', error);
    // Return default values on error
    return {
      raggedness: 0,
      evenness: 100,
      fillRatio: 100,
      widows: 0,
      orphans: 0,
      protectedBreaks: 0,
      protectedBreakLines: [],
      balanceFactor: 0.5,
      score: 0
    };
  }
}

/**
 * Helper function to generate alternative lines for synthetic candidates
 * @param words Original words
 * @param targetWidth Target width
 * @param variationIndex Variation index for diversity
 * @returns Line break candidate with synthetic data
 */
export function generateSyntheticCandidate(
  words: string[], 
  wordWidths: number[],
  targetWidth: number, 
  variationIndex: number,
  locale: string = 'en',
  enableLocalization: boolean = true
): {
  syntheticCandidate: any,
  syntheticMetrics: SyntheticMetrics
} {
  // Generate synthetic lines by distributing words differently
  const syntheticLines = generateAlternativeLines(words, variationIndex);
  
  // Generate synthetic line widths
  const syntheticLineWidths = generateLineWidths(syntheticLines, wordWidths, targetWidth, variationIndex);
  
  // Calculate actual metrics for the synthetic candidate
  const syntheticMetrics = calculateSyntheticMetrics(
    syntheticLines, 
    syntheticLineWidths, 
    targetWidth, 
    variationIndex,
    locale,
    enableLocalization
  );
  
  // Create the synthetic candidate object
  const syntheticCandidate = {
    score: syntheticMetrics.score,
    lines: syntheticLines,
    lineWidths: syntheticLineWidths,
    scoreBreakdown: {
      raggedness: syntheticMetrics.raggedness,
      evenness: syntheticMetrics.evenness,
      fillRatio: syntheticMetrics.fillRatio,
      widows: syntheticMetrics.widows,
      orphans: syntheticMetrics.orphans,
      protectedBreaks: syntheticMetrics.protectedBreaks,
      balanceFactor: syntheticMetrics.balanceFactor
    },
    protectedBreakLines: syntheticMetrics.protectedBreakLines,
    breaks: []
  };
  
  // Generate realistic break positions
  let wordPos = 0;
  if (syntheticCandidate.lines) {
    syntheticCandidate.lines.forEach((line: string[], lineIndex: number) => {
      wordPos += line.length;
      if (syntheticCandidate.lines && lineIndex < syntheticCandidate.lines.length - 1) {
        if (!syntheticCandidate.breaks) {
          syntheticCandidate.breaks = [];
        }
        syntheticCandidate.breaks.push(wordPos - 1);
      }
    });
  }
  
  return {
    syntheticCandidate,
    syntheticMetrics
  };
}

/**
 * Generate synthetic line widths based on word widths
 * @param lines Lines of text
 * @param wordWidths Individual word widths
 * @param targetWidth Target width for each line
 * @param variationIndex Variation index for diversity
 * @returns Array of calculated line widths
 */
export function generateLineWidths(
  lines: string[][], 
  wordWidths: number[], 
  targetWidth: number, 
  variationIndex: number
): number[] {
  const widths: number[] = [];
  let wordIndex = 0;
  
  // Calculate actual width for each line based on word widths
  for (const line of lines) {
    let width = 0;
    const spaceWidth = Math.max(wordWidths[0] * 0.3, 5); // Approximation for space width
    
    for (let i = 0; i < line.length; i++) {
      // Add current word width
      if (wordIndex < wordWidths.length) {
        width += wordWidths[wordIndex++];
      } else {
        // Fallback if we run out of widths
        width += line[i].length * 5;
      }
      
      // Add space width except after last word
      if (i < line.length - 1) {
        width += spaceWidth;
      }
    }
    
    // Apply variation based on index to create diversity
    const variationFactor = 0.05 + (variationIndex * 0.03);
    const lineVariation = (widths.length % 2 === 0 ? 1 : -1) * variationFactor;
    
    widths.push(Math.max(
      targetWidth * 0.6, 
      Math.min(
        targetWidth * 1.1,
        width * (1 + lineVariation)
      )
    ));
  }
  
  return widths;
}

/**
 * Generate alternative lines from words
 * @param words Original words array
 * @param variation Variation index for diversity
 * @returns Array of lines with words distributed differently
 */
export function generateAlternativeLines(words: string[], variation: number): string[][] {
  const baseWordsPerLine = Math.ceil(words.length / 3);
  const lines: string[][] = [];
  let wordIndex = 0;
  
  // Create different line breaking patterns based on variation
  while (wordIndex < words.length) {
    let wordsInThisLine = baseWordsPerLine;
    
    // Vary the distribution based on the variation number
    if (variation % 3 === 1) {
      // First variation: uneven distribution
      wordsInThisLine = lines.length === 0 ? baseWordsPerLine + 2 : baseWordsPerLine - 1;
    } else if (variation % 3 === 2) {
      // Second variation: different uneven distribution
      wordsInThisLine = lines.length % 2 === 0 ? baseWordsPerLine + 1 : baseWordsPerLine;
    }
    
    // Ensure we have at least one word per line
    wordsInThisLine = Math.max(1, wordsInThisLine);
    
    // Don't exceed the remaining words
    const endIndex = Math.min(wordIndex + wordsInThisLine, words.length);
    lines.push(words.slice(wordIndex, endIndex));
    wordIndex = endIndex;
    
    // Break if we've used all words
    if (wordIndex >= words.length) break;
  }
  
  return lines;
}
