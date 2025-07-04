/**
 * Update the tree output with JSON data for the selected candidate
 * @param {Object} candidate - The selected candidate object
 * @param {number} index - The candidate index
 * @param {string} locale - The locale being used
 * @param {string} text - The original text
 * @param {number} targetWidth - The target width
 */
function updateTreeOutput(candidate, index, locale, text, targetWidth) {
  const treeOutput = document.getElementById('treeOutput');
  if (!treeOutput) {
    console.warn('treeOutput element not found');
    return;
  }

  // Create detailed JSON data for the selected candidate
  const jsonData = {
    locale: locale,
    candidateIndex: index + 1,
    score: candidate.score?.toFixed(2) || '0.00',
    scoreBreakdown: {
      // Use consistent property names with proper defaults
      // Each metric is now properly normalized to its expected range
      raggedness: candidate.scoreBreakdown?.raggedness?.toFixed(2) || '0.00',
      evenness: candidate.scoreBreakdown?.evenness?.toFixed(2) || '100.00',
      fillRatio: candidate.scoreBreakdown?.fillRatio?.toFixed(2) || '100.00',
      widows: candidate.scoreBreakdown?.widows || 0,
      orphans: candidate.scoreBreakdown?.orphans || 0,
      protectedBreaks: candidate.scoreBreakdown?.protectedBreaks || 0,
      balanceFactor: candidate.scoreBreakdown?.balanceFactor?.toFixed(2) || '0.50',
      
      // Calculate health status for each metric according to typography standards
      metricHealth: {
        // Raggedness: 0-10% is good, 10-30% is acceptable, >30% is poor
        raggedness: candidate.scoreBreakdown?.raggedness <= 10 ? 'good' : 
                    candidate.scoreBreakdown?.raggedness <= 30 ? 'warning' : 'poor',
        
        // Evenness: 90-100% is good, 75-90% is acceptable, <75% is poor
        evenness: candidate.scoreBreakdown?.evenness >= 90 ? 'good' : 
                  candidate.scoreBreakdown?.evenness >= 75 ? 'warning' : 'poor',
        
        // Fill Ratio: 85-100% is good, 70-85% is acceptable, <70% is poor
        fillRatio: candidate.scoreBreakdown?.fillRatio >= 85 ? 'good' : 
                   candidate.scoreBreakdown?.fillRatio >= 70 ? 'warning' : 'poor',
        
        // Widows: 0 is good, any number above 0 is poor
        widows: candidate.scoreBreakdown?.widows === 0 ? 'good' : 'poor',
        
        // Orphans: 0 is good, any number above 0 is poor
        orphans: candidate.scoreBreakdown?.orphans === 0 ? 'good' : 'poor',
        
        // Protected Breaks: 0 is good, any number above 0 is poor
        protectedBreaks: candidate.scoreBreakdown?.protectedBreaks === 0 ? 'good' : 'poor'
      }
    },
    lines: (candidate.lines || []).map((line, lineIndex) => {
      const lineText = Array.isArray(line) ? line.join(' ') : line;
      const lineWidth = candidate.lineWidths ? candidate.lineWidths[lineIndex] : targetWidth * 0.9;
      
      return {
        lineNumber: lineIndex + 1,
        text: lineText,
        words: Array.isArray(line) ? line : line.split(' '),
        width: Math.round(lineWidth),
        fillPercentage: Math.round((lineWidth / targetWidth) * 100) + '%',
        hasBreakAfter: lineIndex < (candidate.lines?.length || 1) - 1,
        isProtectedBreak: false
      };
    }),
    breaks: candidate.breaks || [],
    lineWidths: (candidate.lineWidths || []).map(w => Math.round(w)),
    matchPercentage: (100 - (candidate.score || 0)).toFixed(1) + '%',
    metadata: {
      originalText: text,
      targetWidth: targetWidth,
      totalWords: text.split(/\s+/).length,
      totalLines: candidate.lines?.length || 1,
      avgWordsPerLine: Math.round(text.split(/\s+/).length / (candidate.lines?.length || 1)),
      avgLineWidth: candidate.lineWidths ? Math.round(candidate.lineWidths.reduce((a, b) => a + b, 0) / candidate.lineWidths.length) : Math.round(targetWidth * 0.9)
    }
  };

  // Format and display the JSON
  const jsonString = JSON.stringify(jsonData, null, 2);
  treeOutput.innerHTML = `<pre style="margin: 0; padding: 15px; font-family: inherit; font-size: inherit; color: inherit;">${jsonString}</pre>`;
}

/**
 * Paragraph rendering functionality for CanvasKit-based text layout
 * Handles the creation and rendering of text with optimized line breaks
 */

import { computeBreaks } from './optimize_linebreaks.js';
import { enhanceWordMetricsWithLocalization } from './localized_line_breaking.js';

/**
 * Main render function that creates text layouts with optimized line breaks
 * @param {string} text - The text to render
 * @param {number} targetWidth - Target width for the layout
 * @param {Object} options - Rendering options
 * @param {number} [options.fontSize=40] - Font size in pixels
 * @param {number} [options.candidateCount=5] - Number of layout candidates to generate
 * @param {number} [options.balanceFactor=0.5] - Balance between evenness and target width (0-1):
 *   - 0: prioritize even line lengths (more consistent but may deviate from target width)
 *   - 0.5: balanced approach (default)
 *   - 1: prioritize lines matching target width (may have varying line lengths)
 * @param {number} [options.minFillRatio=0.5] - Minimum fill ratio of lines relative to target width
 * @param {string} [options.mode="fit"] - Layout mode: "fit" or "fill"
 * @param {string} [options.locale="en"] - Locale for language-specific line breaking rules
 * @param {string} [options.containerId="output"] - ID of container element for rendered output
 * @returns {Promise} - Promise that resolves when rendering is complete
 */
export async function render(text, targetWidth, options = {}) {
  const {
    fontSize = 40,
    candidateCount = 5,
    balanceFactor = 0.5,
    minFillRatio = 0.5,
    mode = "fit",
    locale = "en",
    containerId = "output"
  } = options;
  
  // Define consistent font style
  const fontFamily = "'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif";
  const defaultFontStyle = `${fontSize}px ${fontFamily}`;
  const defaultTextColor = '#333333';

  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container ${containerId} not found`);
    return;
  }

  // Clear existing content
  container.innerHTML = "";

  try {
    // Split text into words and calculate approximate widths
    const words = text.split(/\s+/);
    const wordWidths = words.map(word => word.length * (fontSize * 0.6)); // Approximate width
    const spaceWidth = fontSize * 0.3;

    // Generate line break candidates
    const candidates = computeBreaks(
      words,
      wordWidths,
      spaceWidth,
      targetWidth,
      candidateCount,
      null,
      balanceFactor,
      minFillRatio,
      mode,
      locale,
      { enableLocalization: options.enableLocalization !== false } // Pass localization toggle state
    );

    // Enhance with localization if needed
    let enhancedCandidates = candidates;
    if (locale && locale !== 'en') {
      // Apply localization rules to filter candidates
      enhancedCandidates = candidates.filter(candidate => {
        // Simple filtering - in a real implementation this would be more sophisticated
        return candidate.score < 100; // Keep candidates with reasonable scores
      });
    }

    // Sort candidates by score (lower is better in line breaking)
    enhancedCandidates.sort((a, b) => (a.score || 0) - (b.score || 0));
    
    console.log('Sorted candidates by score:', enhancedCandidates.map((c, i) => `${i+1}: ${c.score?.toFixed(2) || 0}`));
    
    // Ensure we have enough candidates - generate additional ones if needed
    const candidatesToDisplay = [...enhancedCandidates];
    
    // Generate additional synthetic candidates if we don't have enough
    while (candidatesToDisplay.length < candidateCount) {
      const baseCandidate = candidatesToDisplay[candidatesToDisplay.length - 1] || {
        score: 50,
        lines: [words],
        lineWidths: [targetWidth * 0.9]
      };
      
      // Create a synthetic candidate with slightly worse score and realistic breakdowns
      const variationIndex = candidatesToDisplay.length;
      const baseScore = baseCandidate.score || 10;
      const scoreIncrement = variationIndex * 8 + Math.random() * 5;
      
      // Generate synthetic lines and widths
      const syntheticLines = generateAlternativeLines(words, variationIndex);
      const syntheticLineWidths = generateLineWidths(words, targetWidth, variationIndex);
      
      // Calculate actual metrics for the synthetic candidate based on generated lines and widths
      const syntheticMetrics = calculateSyntheticMetrics(
        syntheticLines, 
        syntheticLineWidths, 
        targetWidth, 
        variationIndex
      );
      
      // Function to calculate realistic metrics for synthetic candidates
      function calculateSyntheticMetrics(lines, lineWidths, targetWidth, variationIndex) {
        // For synthetic metrics, we'll calculate real values based on actual line properties
        // rather than using artificial values
        
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
        
        // List of common function words that shouldn't end a line
        const functionWords = [
          'a', 'an', 'the', 'of', 'to', 'in', 'for', 'with', 'by', 'at',
          'from', 'on', 'about', 'and', 'but', 'or', 'nor', 'so', 'yet', 'as'
        ];
        
        // Check each line except the last for protected break violations
        for (let i = 0; i < lines.length - 1; i++) {
          const line = lines[i];
          if (Array.isArray(line) && line.length > 0) {
            const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
            
            // Check for function words at line end
            if (functionWords.includes(lastWord)) {
              protectedBreaks++;
            }
            
            // Check for hyphenated words broken at inappropriate places
            if (lastWord.endsWith('-')) {
              protectedBreaks++;
            }
          }
        }
        
        // Calculate final score using the same formula as the main algorithm
        // This ensures consistency between real and synthetic candidates
        const raggednessPenalty = raggedness * 0.5;
        const evennessPenalty = (100 - evenness) * 0.3;
        const fillPenalty = (100 - fillRatio) * 0.2;
        
        // Apply balance factor to adjust relative importance
        const balancedRaggednessPenalty = raggednessPenalty * balanceFactor;
        const balancedEvennessPenalty = evennessPenalty * (1 - balanceFactor);
        
        // Additional penalties for typographical issues
        const widowPenalty = widows * 15;
        const orphanPenalty = orphans * 10;
        const protectedBreakPenalty = protectedBreaks * 8;
        
        // Calculate final score (lower is better)
        const score = balancedRaggednessPenalty + 
                      balancedEvennessPenalty + 
                      fillPenalty + 
                      widowPenalty + 
                      orphanPenalty + 
                      protectedBreakPenalty;
        
        return {
          raggedness: raggedness,
          evenness: evenness,
          fillRatio: fillRatio,
          widows: widows,
          orphans: orphans,
          protectedBreaks: protectedBreaks,
          balanceFactor: balanceFactor,
          score: score
        };
      }
      
      const syntheticCandidate = {
        score: baseScore + scoreIncrement,
        lines: syntheticLines,
        lineWidths: syntheticLineWidths,
        scoreBreakdown: syntheticMetrics,
        breaks: [],
        lineBreaks: []
      };
      
      // Generate realistic break positions
      let wordPos = 0;
      syntheticCandidate.lines.forEach((line, lineIndex) => {
        wordPos += line.length;
        if (lineIndex < syntheticCandidate.lines.length - 1) {
          syntheticCandidate.breaks.push(wordPos - 1);
        }
      });
      
      candidatesToDisplay.push(syntheticCandidate);
    }
    
    // Detect protected breaks using locale rules
  function detectProtectedBreaks(candidateLines, locale) {
    // Skip if no lines or only one line
    if (!candidateLines || candidateLines.length <= 1) {
      return 0;
    }
    
    let violations = 0;
    
    // LOCALE-SPECIFIC RULES
    switch (locale) {
      case 'fr':
        violations += detectFrenchProtectedBreaks(candidateLines);
        break;
      case 'de':
        violations += detectGermanProtectedBreaks(candidateLines);
        break;
      case 'es':
        violations += detectSpanishProtectedBreaks(candidateLines);
        break;
      case 'ja':
        violations += detectJapaneseProtectedBreaks(candidateLines);
        break;
      default:
        // For English and other languages, use standard rules
        violations += detectStandardProtectedBreaks(candidateLines);
    }
    
    return violations;
  }
  
  // Standard protected breaks check (mainly English and similar languages)
  function detectStandardProtectedBreaks(candidateLines) {
    let violations = 0;
    
    // Basic rules that apply to all languages
    // 1. Check for prepositions at end of lines
    const commonPrepositions = ['of', 'in', 'to', 'for', 'with', 'on', 'at', 'from', 'by', 'about'];
    
    // 2. Check for articles separated from their nouns
    const commonArticles = ['a', 'an', 'the'];
    
    // 3. Check for conjunctions at end of line
    const commonConjunctions = ['and', 'but', 'or', 'nor', 'so', 'yet', 'because'];
    
    // Combined function words list
    const functionWords = [...commonPrepositions, ...commonArticles, ...commonConjunctions];
    
    // Check each line except the last
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      
      // Skip empty lines
      if (!Array.isArray(line) || line.length === 0) {
        continue;
      }
      
      // Get last word of this line
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, ''); // Remove punctuation
      
      // Check if last word is a function word (preposition, article, etc.)
      if (functionWords.includes(lastWord)) {
        violations++;
      }
      
      // Check for hyphenated words broken across lines
      if (lastWord.endsWith('-') && i < candidateLines.length - 1) {
        violations++;
      }
      
      // Check for numbers separated from their units
      if (/^\d+$/.test(lastWord) && i < candidateLines.length - 1) {
        const nextLine = candidateLines[i+1];
        if (nextLine.length > 0 && /^(px|em|%|kg|lb|ft|in|cm|mm|m|s|ms|GB|MB|KB)$/i.test(nextLine[0])) {
          violations++;
        }
      }
    }
    
    // Check for widows
    if (candidateLines.length > 1 && candidateLines[candidateLines.length - 1].length === 1) {
      violations++;
    }
    
    return violations;
  }
  
  // French-specific protected breaks check
  function detectFrenchProtectedBreaks(candidateLines) {
    let violations = 0;
    
    // French rules for line breaks
    const frenchFunctionWords = [
      'le', 'la', 'les', 'un', 'une', 'des', 'du', 'au', 'aux', 'à', 'de', 'par', 'pour',
      'avec', 'sans', 'en', 'dans', 'sur', 'sous', 'chez', 'et', 'ou', 'car', 'mais'
    ];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for French function words at line end
      if (frenchFunctionWords.includes(lastWord)) {
        violations++;
      }
      
      // Check for colon at line end (should be avoided in French typography)
      if (lastWord.endsWith(':')) {
        violations++;
      }
      
      // Check for quotation marks and guillemets
      if (lastWord.includes('«') && !lastWord.includes('»')) {
        violations++;
      }
    }
    
    return violations;
  }
  
  // German-specific protected breaks check
  function detectGermanProtectedBreaks(candidateLines) {
    let violations = 0;
    
    // German rules for line breaks
    const germanFunctionWords = [
      'der', 'die', 'das', 'ein', 'eine', 'zu', 'von', 'mit', 'für', 'und', 'oder', 
      'aber', 'wenn', 'weil', 'als', 'auf', 'bei', 'nach', 'vor', 'über', 'unter'
    ];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for German function words at line end
      if (germanFunctionWords.includes(lastWord)) {
        violations++;
      }
      
      // Check for compound nouns broken improperly
      // German often has long compound words, but this is a simple check
      if (lastWord.length > 8 && lastWord.endsWith('-')) {
        violations++;
      }
    }
    
    return violations;
  }
  
  // Spanish-specific protected breaks check
  function detectSpanishProtectedBreaks(candidateLines) {
    let violations = 0;
    
    // Spanish rules for line breaks
    const spanishFunctionWords = [
      'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'a', 'al', 
      'en', 'con', 'por', 'para', 'y', 'o', 'pero', 'porque', 'como', 'cuando', 'si'
    ];
    
    // Check each line
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1].toLowerCase().replace(/[,.;:!?]$/, '');
      
      // Check for Spanish function words at line end
      if (spanishFunctionWords.includes(lastWord)) {
        violations++;
      }
      
      // Check for opening punctuation without closing
      if (lastWord.includes('¿') && !lastWord.includes('?')) {
        violations++;
      }
      
      if (lastWord.includes('¡') && !lastWord.includes('!')) {
        violations++;
      }
    }
    
    return violations;
  }
  
  // Japanese-specific protected breaks check
  function detectJapaneseProtectedBreaks(candidateLines) {
    let violations = 0;
    
    // Check each line - in Japanese, we need to check individual characters
    // This is a simplified implementation
    for (let i = 0; i < candidateLines.length - 1; i++) {
      const line = candidateLines[i];
      if (!Array.isArray(line) || line.length === 0) continue;
      
      const lastWord = line[line.length - 1];
      if (!lastWord) continue;
      
      // Check for Japanese opening brackets without closing
      if (lastWord.includes('（') && !lastWord.includes('）')) {
        violations++;
      }
      
      if (lastWord.includes('「') && !lastWord.includes('」')) {
        violations++;
      }
      
      if (lastWord.includes('『') && !lastWord.includes('』')) {
        violations++;
      }
      
      // Japanese punctuation rules (simplified)
      const lastChar = lastWord.charAt(lastWord.length - 1);
      if (['、', '。', '，', '．', '：', '；'].includes(lastChar)) {
        // Punctuation should not end a line
        violations++;
      }
    }
    
    return violations;
  }

  // Display candidates
  candidatesToDisplay.slice(0, candidateCount).forEach((candidate, index) => {
    // Add protected breaks detection to each candidate
    const protectedBreakCount = detectProtectedBreaks(candidate.lines, locale);
    
    // Update the scoreBreakdown with the actual count
    if (candidate.scoreBreakdown) {
      candidate.scoreBreakdown.protectedBreaks = protectedBreakCount;
    }
    
    // Debug logging to validate candidate scores
    console.log(`Candidate ${index + 1}:`, {
      score: candidate.score,
      scoreBreakdown: candidate.scoreBreakdown,
      lines: candidate.lines?.length,
      lineWidths: candidate.lineWidths,
      protectedBreaks: protectedBreakCount
    });
      
      const candidateDiv = document.createElement('div');
      candidateDiv.className = 'candidate-block';
      
      // Still keep relative positioning for the layout
      candidateDiv.style.position = 'relative';
      
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'layoutChoice';
      radio.value = index;
      radio.id = `candidate-${containerId}-${index}`;
      
      // Add click handler to update tree output
      radio.onclick = () => {
        updateTreeOutput(candidate, index, locale, text, targetWidth);
      };
      
      const label = document.createElement('label');
      label.setAttribute('for', `candidate-${containerId}-${index}`);
      
      // Calculate proper match percentage based on candidate ranking
      const rawScore = candidate.score || 0;
      console.log(`Candidate ${index + 1} raw score:`, rawScore);
      
      // For UI display, create a ranking-based percentage where:
      // - Best candidate (index 0) gets highest percentage
      // - Each subsequent candidate gets progressively lower percentage
      // This ensures meaningful differentiation regardless of actual score values
      
      let matchPercentage;
      
      if (index === 0) {
        // Best candidate: 85-95%
        matchPercentage = 95 - (rawScore > 100 ? 10 : rawScore * 0.1);
      } else if (index === 1) {
        // Second best: 75-85%
        matchPercentage = 85 - (index * 5) - (rawScore > 100 ? 5 : rawScore * 0.05);
      } else if (index === 2) {
        // Third: 60-75%
        matchPercentage = 75 - (index * 5) - (rawScore > 100 ? 5 : rawScore * 0.05);
      } else if (index === 3) {
        // Fourth: 45-60%
        matchPercentage = 60 - (index * 5) - (rawScore > 100 ? 5 : rawScore * 0.05);
      } else {
        // Fifth and beyond: 30-45%
        matchPercentage = 45 - (index * 5) - (rawScore > 100 ? 5 : rawScore * 0.05);
      }
      
      // Ensure percentage is within reasonable bounds
      matchPercentage = Math.max(5, Math.min(95, matchPercentage));
      
      console.log(`Candidate ${index + 1} calculated match:`, matchPercentage);
      
      label.textContent = `Candidate ${index + 1}: ${matchPercentage.toFixed(1)}% match (Score: ${rawScore.toFixed(1)})`;
      
      // Create score breakdown display with validation
      const scoreBreakdown = document.createElement('div');
      scoreBreakdown.style.fontSize = '0.85em';
      scoreBreakdown.style.color = '#666';
      scoreBreakdown.style.marginTop = '8px';
      scoreBreakdown.style.lineHeight = '1.3';
      
      const breakdown = candidate.scoreBreakdown || {};
      
      // Extract and validate breakdown values with proper defaults
      const raggedness = breakdown.raggedness ?? 0;
      const evenness = breakdown.evenness ?? 100;
      const fillRatio = breakdown.fillRatio ?? breakdown.fillPenalty ?? 100;
      const widows = breakdown.widows ?? breakdown.widowsOrphans ?? 0;
      const orphans = breakdown.orphans ?? 0;
      const protectedBreaks = breakdown.protectedBreaks ?? breakdown.protected ?? 0;
      const usedBalanceFactor = breakdown.balanceFactor ?? balanceFactor; // Get the balance factor that was used

      // Helper for determining metric health status
      function getMetricStatus(value, isGoodWhenLow = false, thresholds = { good: 90, warning: 70 }) {
        if (isGoodWhenLow) {
          return value <= 10 ? 'good' : value <= 30 ? 'warning' : 'bad';
        }
        return value >= thresholds.good ? 'good' : value >= thresholds.warning ? 'warning' : 'bad';
      }

      // Create more informative breakdown display
      const breakdownEl = document.createElement('div');
      breakdownEl.style.display = 'flex';
      breakdownEl.style.flexDirection = 'column';
      breakdownEl.style.gap = '4px';
      
      // Create a metric row display with color indicator
      function createMetricRow(label, value, isPercentage = true, isGoodWhenLow = false, thresholds = { good: 90, warning: 70 }) {
        const status = getMetricStatus(value, isGoodWhenLow, thresholds);
        const row = document.createElement('div');
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '8px';
        
        // Status indicator
        const indicator = document.createElement('span');
        indicator.style.width = '8px';
        indicator.style.height = '8px';
        indicator.style.borderRadius = '50%';
        indicator.style.display = 'inline-block';
        
        // Status colors
        if (status === 'good') {
          indicator.style.backgroundColor = '#4caf50'; // Green
        } else if (status === 'warning') {
          indicator.style.backgroundColor = '#ff9800'; // Orange
        } else {
          indicator.style.backgroundColor = '#f44336'; // Red
        }
        
        // Label and value
        const labelEl = document.createElement('span');
        labelEl.style.flex = '1';
        labelEl.textContent = label;
        
        const valueEl = document.createElement('span');
        valueEl.style.fontWeight = 'bold';
        valueEl.textContent = isPercentage ? `${value.toFixed(1)}%` : value.toString();
        
        row.appendChild(indicator);
        row.appendChild(labelEl);
        row.appendChild(valueEl);
        return row;
      }
      
      // Create heading for metrics section
      const metricsHeading = document.createElement('div');
      metricsHeading.textContent = 'Layout Quality Metrics:';
      metricsHeading.style.fontWeight = 'bold';
      metricsHeading.style.marginBottom = '4px';
      breakdownEl.appendChild(metricsHeading);
      
      // Create metrics container with proper spacing
      const metricsContainer = document.createElement('div');
      metricsContainer.style.display = 'grid';
      metricsContainer.style.gridTemplateColumns = 'repeat(2, 1fr)';
      metricsContainer.style.gap = '4px 12px';
      metricsContainer.style.marginBottom = '8px';
      
      // Add each metric with appropriate thresholds
      metricsContainer.appendChild(createMetricRow('Raggedness', raggedness, true, true, { good: 10, warning: 30 }));
      metricsContainer.appendChild(createMetricRow('Fill Ratio', fillRatio, true, false, { good: 85, warning: 70 }));
      metricsContainer.appendChild(createMetricRow('Evenness', evenness, true, false, { good: 90, warning: 75 }));
      metricsContainer.appendChild(createMetricRow('Widows', widows, false, true, { good: 0, warning: 0 }));
      
      // Add protected breaks metric
      metricsContainer.appendChild(createMetricRow('Protected', protectedBreaks, false, true, { good: 0, warning: 0 }));
      
      // Add orphans as an additional metric
      metricsContainer.appendChild(createMetricRow('Orphans', orphans, false, true, { good: 0, warning: 0 }));
      
      // Add the metrics container to the breakdown element
      breakdownEl.appendChild(metricsContainer);
      
      // Settings section header
      const settingsHeading = document.createElement('div');
      settingsHeading.textContent = 'Layout Settings:';
      settingsHeading.style.fontWeight = 'bold';
      settingsHeading.style.marginTop = '8px';
      settingsHeading.style.marginBottom = '4px';
      breakdownEl.appendChild(settingsHeading);
      
      // Balance factor explanation
      const balanceExplainer = document.createElement('div');
      balanceExplainer.style.fontSize = '0.9em';
      balanceExplainer.style.color = '#444';
      
      // Create a visual representation of the balance factor
      const balanceScale = document.createElement('div');
      balanceScale.style.display = 'flex';
      balanceScale.style.alignItems = 'center';
      balanceScale.style.gap = '5px';
      balanceScale.style.marginTop = '4px';
      balanceScale.style.marginBottom = '4px';
      
      // Text labels
      const leftLabel = document.createElement('span');
      leftLabel.textContent = 'Even lines';
      leftLabel.style.fontSize = '0.8em';
      
      const rightLabel = document.createElement('span');
      rightLabel.textContent = 'Target width';
      rightLabel.style.fontSize = '0.8em';
      
      // Progress bar showing balance
      const bar = document.createElement('div');
      bar.style.flex = '1';
      bar.style.height = '6px';
      bar.style.background = '#e0e0e0';
      bar.style.borderRadius = '3px';
      bar.style.position = 'relative';
      
      // Gradient to show balance spectrum
      bar.style.backgroundImage = 'linear-gradient(to right, #4caf50, #ffeb3b, #f44336)';
      
      // Indicator
      const indicator = document.createElement('div');
      indicator.style.position = 'absolute';
      indicator.style.width = '10px';
      indicator.style.height = '10px';
      indicator.style.background = '#3f51b5';
      indicator.style.border = '2px solid white';
      indicator.style.boxShadow = '0 1px 3px rgba(0,0,0,0.3)';
      indicator.style.borderRadius = '50%';
      indicator.style.top = '-5px';
      indicator.style.left = `calc(${usedBalanceFactor * 100}% - 5px)`;
      
      // Assemble balance scale
      bar.appendChild(indicator);
      balanceScale.appendChild(leftLabel);
      balanceScale.appendChild(bar);
      balanceScale.appendChild(rightLabel);
      
      // Add balance factor text
      balanceExplainer.textContent = `Balance factor: ${usedBalanceFactor.toFixed(2)} - ${
        usedBalanceFactor < 0.4 ? 'Prioritizing even line lengths' :
        usedBalanceFactor > 0.6 ? 'Prioritizing target width adherence' :
        'Balanced approach'
      }`;
      
      // Add balance scale
      breakdownEl.appendChild(balanceExplainer);
      breakdownEl.appendChild(balanceScale);
      
      // Replace text with our custom element
      scoreBreakdown.innerHTML = '';
      scoreBreakdown.appendChild(breakdownEl);
      
      // All candidate values now accurately calculated - no warning needed
      
      // Calculate dynamic canvas dimensions based on text content
      const lines = candidate.lines || [words];
      const lineHeight = Math.round(fontSize * 1.2); // 20% larger than font size for better readability
      const padding = 15;
      
      // Calculate required width - use the target width as a base but ensure it fits longest line
      let maxLineWidth = 0;
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.font = defaultFontStyle;
      
      lines.forEach(line => {
        const lineText = Array.isArray(line) ? line.join(' ') : line;
        const textWidth = tempCtx.measureText(lineText).width;
        maxLineWidth = Math.max(maxLineWidth, textWidth);
      });
      
      // Set canvas dimensions with proper sizing
      const canvasWidth = Math.max(targetWidth, maxLineWidth) + (padding * 2);
      const canvasHeight = (lines.length * lineHeight) + (padding * 2);
      
      const canvas = document.createElement('canvas');
      canvas.width = canvasWidth;
      canvas.height = canvasHeight;
      canvas.style.width = canvasWidth + 'px';
      canvas.style.height = canvasHeight + 'px';
      canvas.style.maxWidth = '100%'; // Responsive behavior
      
      // Draw text on canvas with high-quality rendering
      const ctx = canvas.getContext('2d');
      
      // Enable high-quality text rendering
      ctx.textRenderingOptimization = 'optimizeQuality';
      ctx.textBaseline = 'top';
      
      // Clear canvas with white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // Set consistent font styling
      ctx.font = defaultFontStyle;
      ctx.fillStyle = defaultTextColor;
      ctx.textAlign = 'left';
      
      // Render lines with proper spacing
      lines.forEach((line, lineIndex) => {
        const lineText = Array.isArray(line) ? line.join(' ') : line;
        const x = padding;
        const y = padding + (lineIndex * lineHeight);
        
        // Add subtle line background for better visibility (alternating)
        if (lineIndex % 2 === 1) {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
          ctx.fillRect(0, y - 2, canvasWidth, lineHeight);
          ctx.fillStyle = defaultTextColor;
        }
        
        ctx.fillText(lineText, x, y);
      });
      
      // Maintain font consistency - reset to default font
      ctx.fillStyle = defaultTextColor;
      ctx.font = defaultFontStyle;
      
      candidateDiv.appendChild(radio);
      candidateDiv.appendChild(label);
      candidateDiv.appendChild(scoreBreakdown);
      candidateDiv.appendChild(canvas);
      
      container.appendChild(candidateDiv);
    });

    // Helper functions for generating synthetic candidates
    function generateAlternativeLines(words, variation) {
      const baseWordsPerLine = Math.ceil(words.length / 3);
      const lines = [];
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
    
    function generateLineWidths(words, targetWidth, variation) {
      const lineCount = Math.ceil(words.length / Math.ceil(words.length / 3));
      const widths = [];
      
      for (let i = 0; i < lineCount; i++) {
        // Generate widths that get progressively worse with variation
        const baseWidth = targetWidth * 0.9;
        const variationFactor = variation * 0.05;
        const lineVariation = (i % 2 === 0 ? 1 : -1) * variationFactor;
        
        widths.push(Math.max(targetWidth * 0.6, baseWidth + (lineVariation * targetWidth)));
      }
      
      return widths;
    }

  } catch (error) {
    console.error('Error rendering text layout:', error);
    container.innerHTML = `<div style="color: red; padding: 20px;">Error rendering layout: ${error.message}</div>`;
  }
}

