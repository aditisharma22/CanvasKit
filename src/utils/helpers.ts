// Utility functions for the CanvasKit application
import { LAYOUT_CONSTANTS } from './constants';
import { LineBreakCandidate } from '../types';

/**
 * Calculates a candidate match percentage based on ranking and raw score
 * @param candidate - The line break candidate to evaluate
 * @param index - The index/rank of the candidate (0 = best)
 * @returns A percentage score between 10 and 100
 */
export function calculateCandidateMatchPercentage(candidate: LineBreakCandidate, index: number): number {
  const rawScore = candidate.score || 0;
  let matchPercentage: number;
  
  if (index === 0) {
    // Best candidate: 95-100%
    matchPercentage = 100 - (rawScore > 50 ? 5 : rawScore * 0.1);
  } else if (index === 1) {
    // Second best: 85-95%
    matchPercentage = 95 - (rawScore > 50 ? 10 : rawScore * 0.2);
  } else if (index === 2) {
    // Third: 75-85%
    matchPercentage = 85 - (rawScore > 50 ? 10 : rawScore * 0.2);
  } else if (index === 3) {
    // Fourth: 65-75%
    matchPercentage = 75 - (rawScore > 50 ? 10 : rawScore * 0.2);
  } else {
    // Fifth and beyond: 50-65%
    matchPercentage = 65 - (index * 3) - (rawScore > 50 ? 5 : rawScore * 0.1);
  }
  
  // Ensure percentage is within reasonable bounds
  return Math.max(10, Math.min(100, matchPercentage));
}

/**
 * Returns the appropriate color based on the metric value and thresholds
 * @param value - The metric value to evaluate
 * @param isGoodWhenLow - Whether lower values are considered better
 * @param thresholds - Custom thresholds for good and warning levels
 * @returns A color string (hex code)
 */
export function getMetricStatusColor(
  value: number, 
  isGoodWhenLow: boolean = false, 
  thresholds = { 
    good: LAYOUT_CONSTANTS.GOOD_EVENNESS_THRESHOLD, 
    warning: LAYOUT_CONSTANTS.WARNING_EVENNESS_THRESHOLD 
  }
): string {
  if (isGoodWhenLow) {
    return value <= thresholds.good ? '#4caf50' :  // Green for good
           value <= thresholds.warning ? '#ff9800' :  // Orange for warning
           '#f44336';  // Red for poor
  } else {
    return value >= thresholds.good ? '#4caf50' :  // Green for good
           value >= thresholds.warning ? '#ff9800' :  // Orange for warning
           '#f44336';  // Red for poor
  }
}

/**
 * Determine the metric status (good, warning, poor) based on the value
 * @param value - The metric value to evaluate
 * @param isGoodWhenLow - Whether lower values are considered better
 * @param thresholds - Custom thresholds for good and warning levels
 * @returns A status string: 'good', 'warning', or 'poor'
 */
export function getMetricStatus(
  value: number, 
  isGoodWhenLow: boolean = false, 
  thresholds = { good: 90, warning: 70 }
): string {
  if (isGoodWhenLow) {
    return value <= thresholds.good ? 'good' : 
           value <= thresholds.warning ? 'warning' : 
           'poor';
  }
  return value >= thresholds.good ? 'good' : 
         value >= thresholds.warning ? 'warning' : 
         'poor';
}

/**
 * Safely get an HTML element by ID with type checking
 * @param id - The ID of the element to find
 * @param errorMessage - Optional custom error message
 * @returns The HTML element or null if not found
 */
export function getElementById<T extends HTMLElement = HTMLElement>(
  id: string, 
  errorMessage?: string
): T | null {
  const element = document.getElementById(id) as T | null;
  if (!element && errorMessage) {
    console.warn(errorMessage);
  }
  return element;
}

/**
 * Creates a DOM element with specified attributes and styles
 * @param tagName - The HTML tag name
 * @param attributes - Optional attributes to set on the element
 * @param styles - Optional styles to apply to the element
 * @returns The created HTML element
 */
export function createElement<T extends HTMLElement>(
  tagName: string,
  attributes: Record<string, string> = {},
  styles: Record<string, string> = {}
): T {
  const element = document.createElement(tagName) as T;
  
  // Set attributes
  Object.entries(attributes).forEach(([key, value]) => {
    if (key === 'className') {
      element.className = value;
    } else {
      element.setAttribute(key, value);
    }
  });
  
  // Set styles
  Object.entries(styles).forEach(([key, value]) => {
    element.style[key as any] = value;
  });
  
  return element;
}

/**
 * Calculates the penalty for a line of a specific width relative to target width
 * @param lineWidth - The width of the current line
 * @param targetWidth - The target line width
 * @param mode - The layout mode ('fill' or 'fit')
 * @param balanceFactor - How to balance between raggedness and evenness
 * @returns The calculated penalty value
 */
export function calculateLinePenalty(
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

/**
 * Find break indices (where line breaks occur in the original word array)
 * @param lines - The lines of text
 * @returns An array of indices where breaks occur
 */
export function findBreakIndices(lines: string[][]): number[] {
  let breaks: number[] = [];
  let wordCount = 0;
  
  // For each line except the last one
  for (let i = 0; i < lines.length - 1; i++) {
    wordCount += lines[i].length;
    breaks.push(wordCount - 1); // Index of last word in the line
  }
  
  return breaks;
}

/**
 * Calculate widths for each line
 * @param lines - The lines of text
 * @param wordWidths - Array of individual word widths
 * @param spaceWidth - Width of a space character
 * @returns Array of calculated line widths
 */
export function calculateLineWidths(lines: string[][], wordWidths: number[], spaceWidth: number): number[] {
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
 * Generate alternative lines of text based on a variation factor
 * @param words - Original array of words
 * @param variation - Variation factor to influence line generation
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
    
    const endIndex = Math.min(wordIndex + wordsInThisLine, words.length);
    lines.push(words.slice(wordIndex, endIndex));
    wordIndex = endIndex;
  }
  
  return lines;
}

/**
 * Generate line widths for alternative layouts
 * @param words - Original array of words
 * @param targetWidth - Target width for lines
 * @param variation - Variation factor to influence width generation
 * @returns Array of line widths
 */
export function generateLineWidths(words: string[], targetWidth: number, variation: number): number[] {
  const lineCount = Math.ceil(words.length / Math.ceil(words.length / 3));
  const widths: number[] = [];
  
  for (let i = 0; i < lineCount; i++) {
    // Generate widths that get progressively worse with variation
    const baseWidth = targetWidth * 0.9;
    const variationFactor = variation * 0.05;
    const lineVariation = (i % 2 === 0 ? 1 : -1) * variationFactor;
    
    widths.push(Math.max(targetWidth * 0.6, baseWidth + (lineVariation * targetWidth)));
  }
  
  return widths;
}
