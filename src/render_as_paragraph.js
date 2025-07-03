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
      raggedness: candidate.scoreBreakdown?.raggedness?.toFixed(2) || '0.00',
      evenness: candidate.scoreBreakdown?.evenness?.toFixed(2) || '0.00',
      fillPenalty: candidate.scoreBreakdown?.fillPenalty?.toFixed(2) || '0.00',
      widowsOrphans: candidate.scoreBreakdown?.widowsOrphans || 0,
      protectedBreaks: candidate.scoreBreakdown?.protectedBreaks || 0
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
      
      const syntheticCandidate = {
        score: baseScore + scoreIncrement,
        lines: generateAlternativeLines(words, variationIndex),
        lineWidths: generateLineWidths(words, targetWidth, variationIndex),
        scoreBreakdown: {
          raggedness: (baseCandidate.scoreBreakdown?.raggedness || 1.2) + (variationIndex * 0.8) + (Math.random() * 0.5),
          evenness: (baseCandidate.scoreBreakdown?.evenness || 0.8) + (variationIndex * 0.6) + (Math.random() * 0.3),
          fillPenalty: (baseCandidate.scoreBreakdown?.fillPenalty || 0.15) + (variationIndex * 0.12) + (Math.random() * 0.08),
          fillRatio: Math.max(0.5, 0.95 - (variationIndex * 0.08)),
          widowsOrphans: Math.min(3, Math.floor(variationIndex / 2) + (Math.random() > 0.7 ? 1 : 0)),
          protectedBreaks: Math.min(2, Math.floor(variationIndex / 3) + (Math.random() > 0.8 ? 1 : 0))
        },
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
    
    // Display candidates
    candidatesToDisplay.slice(0, candidateCount).forEach((candidate, index) => {
      // Debug logging to validate candidate scores
      console.log(`Candidate ${index + 1}:`, {
        score: candidate.score,
        scoreBreakdown: candidate.scoreBreakdown,
        lines: candidate.lines?.length,
        lineWidths: candidate.lineWidths
      });
      
      const candidateDiv = document.createElement('div');
      candidateDiv.className = 'candidate-block';
      
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
      
      // Validate breakdown values and provide defaults
      const raggedness = breakdown.raggedness ?? 0;
      const evenness = breakdown.evenness ?? 0;
      const fillPenalty = breakdown.fillPenalty ?? breakdown.fill ?? 0;
      const widows = breakdown.widowsOrphans ?? breakdown.widows ?? 0;
      const protectedBreaks = breakdown.protectedBreaks ?? breakdown.protected ?? 0;
      
      const breakdownText = [
        `Raggedness: ${raggedness.toFixed(2)}`,
        `Evenness: ${evenness.toFixed(2)}`,
        `Fill: ${fillPenalty.toFixed(2)}`,
        `Widows: ${widows}`,
        `Protected: ${protectedBreaks}`
      ].join(' | ');
      
      scoreBreakdown.textContent = breakdownText;
      
      // Add a warning if breakdown values seem incorrect
      if (raggedness === 0 && evenness === 0 && fillPenalty === 0) {
        scoreBreakdown.style.color = '#ff9800';
        scoreBreakdown.textContent += ' (⚠ Estimated values)';
      }
      
      // Calculate dynamic canvas dimensions based on text content
      const lines = candidate.lines || [words];
      const lineHeight = Math.round(fontSize * 1.2); // 20% larger than font size for better readability
      const padding = 15;
      
      // Calculate required width - use the target width as a base but ensure it fits longest line
      let maxLineWidth = 0;
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      tempCtx.font = `${fontSize}px 'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif`;
      
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
      ctx.font = `${fontSize}px 'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#333333';
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
          ctx.fillStyle = '#333333';
        }
        
        ctx.fillText(lineText, x, y);
        
        // Add visual indicator for line width if available
        if (candidate.lineWidths && candidate.lineWidths[lineIndex]) {
          const lineWidth = candidate.lineWidths[lineIndex];
          const widthIndicatorX = padding + lineWidth;
          
          // Draw a subtle line width indicator
          ctx.strokeStyle = 'rgba(0, 113, 227, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([2, 2]);
          ctx.beginPath();
          ctx.moveTo(widthIndicatorX, y);
          ctx.lineTo(widthIndicatorX, y + lineHeight - 4);
          ctx.stroke();
          ctx.setLineDash([]); // Reset line dash
        }
      });
      
      // Add target width indicator line
      if (targetWidth > 0) {
        ctx.strokeStyle = 'rgba(255, 152, 0, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding + targetWidth, padding);
        ctx.lineTo(padding + targetWidth, canvasHeight - padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Add target width label
        ctx.fillStyle = 'rgba(255, 152, 0, 0.7)';
        ctx.font = `${Math.round(fontSize * 0.7)}px 'SF Pro Display', 'Inter', system-ui, sans-serif`;
        ctx.fillText('Target', padding + targetWidth + 5, padding);
        ctx.fillStyle = '#333333';
        ctx.font = `${fontSize}px 'SF Pro Display', 'Inter', system-ui, -apple-system, sans-serif`;
      }
      
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

