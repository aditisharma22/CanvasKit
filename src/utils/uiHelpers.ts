// UI helper functions for rendering paragraphs and candidates

import { LineBreakCandidate, ProtectedBreakResult } from '../types';
import { 
  getMetricStatus, 
  calculateCandidateMatchPercentage, 
  createElement, 
  getElementById 
} from './helpers';
import { STYLE_CONSTANTS, ERROR_MESSAGES } from './constants';

/**
 * Updates the tree output visualization with candidate data
 * @param candidate - The selected line break candidate
 * @param index - The index/rank of the candidate
 * @param locale - The current locale
 * @param text - The original text
 * @param targetWidth - The target line width
 */
export function updateTreeOutput(candidate: LineBreakCandidate, index: number, locale: string, text: string, targetWidth: number): void {
  const treeOutput = getElementById('treeOutput', ERROR_MESSAGES.ELEMENT_NOT_FOUND('treeOutput'));
  if (!treeOutput) {
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
        raggedness: getMetricStatus(
          candidate.scoreBreakdown?.raggedness || 0, 
          true, 
          { good: 10, warning: 30 }
        ),
        
        // Evenness: 90-100% is good, 75-90% is acceptable, <75% is poor
        evenness: getMetricStatus(
          candidate.scoreBreakdown?.evenness || 100,
          false,
          { good: 90, warning: 75 }
        ),
        
        // Fill Ratio: 85-100% is good, 70-85% is acceptable, <70% is poor
        fillRatio: getMetricStatus(
          candidate.scoreBreakdown?.fillRatio || 100,
          false,
          { good: 85, warning: 70 }
        ),
        
        // Widows: 0 is good, any number above 0 is poor
        widows: (candidate.scoreBreakdown?.widows || 0) === 0 ? 'good' : 'poor',
        
        // Orphans: 0 is good, any number above 0 is poor
        orphans: (candidate.scoreBreakdown?.orphans || 0) === 0 ? 'good' : 'poor',
        
        // Protected Breaks: 0 is good, any number above 0 is poor
        protectedBreaks: (candidate.scoreBreakdown?.protectedBreaks || 0) === 0 ? 'good' : 'poor'
      }
    },
    lines: (candidate.lines || []).map((line, lineIndex) => {
      const lineText = Array.isArray(line) ? line.join(' ') : line as string;
      const lineWidth = candidate.lineWidths ? candidate.lineWidths[lineIndex] : targetWidth * 0.9;
      
      // Check if this line has a protected break
      const isProtectedBreak = candidate.protectedBreakLines && candidate.protectedBreakLines.includes(lineIndex);
      
      return {
        lineNumber: lineIndex + 1,
        text: lineText,
        words: Array.isArray(line) ? line : (line as string).split(' '),
        width: Math.round(lineWidth),
        fillPercentage: Math.round((lineWidth / targetWidth) * 100) + '%',
        hasBreakAfter: lineIndex < (candidate.lines?.length || 1) - 1,
        isProtectedBreak: isProtectedBreak
      };
    }),
    breaks: candidate.breaks || [],
    lineWidths: (candidate.lineWidths || []).map(w => Math.round(w)),
    matchPercentage: calculateCandidateMatchPercentage(candidate, index).toFixed(1) + '%',
    metadata: {
      originalText: text,
      targetWidth: targetWidth,
      totalWords: text.split(/\s+/).length,
      totalLines: candidate.lines?.length || 1,
      avgWordsPerLine: Math.round(text.split(/\s+/).length / (candidate.lines?.length || 1)),
      avgLineWidth: candidate.lineWidths ? 
        Math.round(candidate.lineWidths.reduce((a, b) => a + b, 0) / candidate.lineWidths.length) : 
        Math.round(targetWidth * 0.9)
    }
  };

  // Format and display the JSON
  const jsonString = JSON.stringify(jsonData, null, 2);
  treeOutput.innerHTML = `<pre style="margin: 0; padding: 15px; font-family: inherit; font-size: inherit; color: inherit;">${jsonString}</pre>`;
}

/**
 * Creates a metric row with status indicator for the candidate UI
 * @param label - The metric label
 * @param value - The metric value
 * @param isPercentage - Whether the value should be displayed as a percentage
 * @param isGoodWhenLow - Whether lower values are considered better
 * @param thresholds - Custom thresholds for good and warning levels
 */
export function createMetricRow(
  label: string, 
  value: number, 
  isPercentage = true, 
  isGoodWhenLow = false, 
  thresholds = { good: 90, warning: 70 }
): HTMLDivElement {
  const status = getMetricStatus(value, isGoodWhenLow, thresholds);
  
  const row = createElement<HTMLDivElement>('div', {}, {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  });
  
  // Status indicator
  const indicator = createElement<HTMLSpanElement>('span', {}, {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    display: 'inline-block',
    backgroundColor: status === 'good' ? '#4caf50' : status === 'warning' ? '#ff9800' : '#f44336'
  });
  
  // Label and value
  const labelEl = createElement<HTMLSpanElement>('span', {}, { flex: '1' });
  labelEl.textContent = label;
  
  const valueEl = createElement<HTMLSpanElement>('span', {}, { fontWeight: 'bold' });
  valueEl.textContent = isPercentage ? `${value.toFixed(1)}%` : value.toString();
  
  row.appendChild(indicator);
  row.appendChild(labelEl);
  row.appendChild(valueEl);
  
  return row;
}

/**
 * Creates a balance scale UI element for the candidate display
 * @param usedBalanceFactor - The balance factor used for this candidate
 */
export function createBalanceScale(usedBalanceFactor: number): HTMLDivElement {
  const balanceScale = createElement<HTMLDivElement>('div', {}, {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    marginTop: '4px',
    marginBottom: '4px'
  });
  
  // Text labels
  const leftLabel = createElement<HTMLSpanElement>('span', {}, { fontSize: '0.8em' });
  leftLabel.textContent = 'Even lines';
  
  const rightLabel = createElement<HTMLSpanElement>('span', {}, { fontSize: '0.8em' });
  rightLabel.textContent = 'Target width';
  
  // Progress bar showing balance
  const bar = createElement<HTMLDivElement>('div', {}, {
    flex: '1',
    height: '6px',
    background: '#e0e0e0',
    borderRadius: '3px',
    position: 'relative',
    backgroundImage: 'linear-gradient(to right, #4caf50, #ffeb3b, #f44336)'
  });
  
  // Indicator
  const indicator = createElement<HTMLDivElement>('div', {}, {
    position: 'absolute',
    width: '10px',
    height: '10px',
    background: '#3f51b5',
    border: '2px solid white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    borderRadius: '50%',
    top: '-5px',
    left: `calc(${usedBalanceFactor * 100}% - 5px)`
  });
  
  // Assemble balance scale
  bar.appendChild(indicator);
  balanceScale.appendChild(leftLabel);
  balanceScale.appendChild(bar);
  balanceScale.appendChild(rightLabel);
  
  return balanceScale;
}

/**
 * Creates and renders a candidate block in the UI
 * @param candidate - The line break candidate to render
 * @param index - The index/rank of the candidate
 * @param containerId - The ID of the container element
 * @param locale - The current locale
 * @param text - The original text
 * @param targetWidth - The target line width
 * @param fontSize - Font size in pixels
 */
export function renderCandidateBlock(
  candidate: LineBreakCandidate, 
  index: number,
  containerId: string,
  locale: string,
  text: string,
  targetWidth: number,
  fontSize: number,
  balanceFactor: number,
  protectedBreaksResult: ProtectedBreakResult
): HTMLDivElement | null {
  try {
    // Store protected break lines in the candidate
    candidate.protectedBreakLines = protectedBreaksResult.lines;
    
    // Update the scoreBreakdown with the actual count
    if (candidate.scoreBreakdown) {
      candidate.scoreBreakdown.protectedBreaks = protectedBreaksResult.count;
    }
    
    const candidateDiv = createElement<HTMLDivElement>('div', {
      className: 'candidate-block'
    }, {
      position: 'relative'
    });
    
    const radio = createElement<HTMLInputElement>('input', {
      type: 'radio',
      name: 'layoutChoice',
      value: index.toString(),
      id: `candidate-${containerId}-${index}`
    });
    
    // Add click handler to update tree output
    radio.onclick = () => {
      updateTreeOutput(candidate, index, locale, text, targetWidth);
    };
    
    const label = createElement<HTMLLabelElement>('label', {
      for: `candidate-${containerId}-${index}`
    });
    
    // Calculate proper match percentage based on candidate ranking
    const rawScore = candidate.score || 0;
    
    // Use our helper function to calculate the match percentage
    const matchPercentage = calculateCandidateMatchPercentage(candidate, index);
    
    label.textContent = `Candidate ${index + 1}: ${matchPercentage.toFixed(1)}% match (Score: ${rawScore.toFixed(1)})`;
    
    // Create score breakdown display with validation
    const scoreBreakdownDiv = createElement<HTMLDivElement>('div', {}, {
      fontSize: '0.85em',
      color: '#666',
      marginTop: '8px',
      lineHeight: '1.3'
    });
    
    // Extract and validate breakdown values with proper defaults
    const scoreData = candidate.scoreBreakdown || {};
    const raggedness = (scoreData as any).raggedness ?? 0;
    const evenness = (scoreData as any).evenness ?? 100;
    const fillRatio = (scoreData as any).fillRatio ?? (scoreData as any).fillPenalty ?? 100;
    const widows = (scoreData as any).widows ?? (scoreData as any).widowsOrphans ?? 0;
    const orphans = (scoreData as any).orphans ?? 0;
    const protectedBreaks = (scoreData as any).protectedBreaks ?? (scoreData as any).protected ?? 0;
    const usedBalanceFactor = (scoreData as any).balanceFactor ?? balanceFactor;
    
    // Create more informative breakdown display
    const breakdownEl = createElement<HTMLDivElement>('div', {}, {
      display: 'flex',
      flexDirection: 'column',
      gap: '4px'
    });
    
    // Create heading for metrics section
    const metricsHeading = createElement<HTMLDivElement>('div', {}, {
      fontWeight: 'bold',
      marginBottom: '4px'
    });
    metricsHeading.textContent = 'Layout Quality Metrics:';
    breakdownEl.appendChild(metricsHeading);
    
    // Create metrics container with proper spacing
    const metricsContainer = createElement<HTMLDivElement>('div', {}, {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, 1fr)',
      gap: '4px 12px',
      marginBottom: '8px'
    });
    
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
    const settingsHeading = createElement<HTMLDivElement>('div', {}, {
      fontWeight: 'bold',
      marginTop: '8px',
      marginBottom: '4px'
    });
    settingsHeading.textContent = 'Layout Settings:';
    breakdownEl.appendChild(settingsHeading);
    
    // Balance factor explanation
    const balanceExplainer = createElement<HTMLDivElement>('div', {}, {
      fontSize: '0.9em',
      color: '#444'
    });
    
    // Add balance factor text
    balanceExplainer.textContent = `Balance factor: ${usedBalanceFactor.toFixed(2)} - ${
      usedBalanceFactor < 0.4 ? 'Prioritizing even line lengths' :
      usedBalanceFactor > 0.6 ? 'Prioritizing target width adherence' :
      'Balanced approach'
    }`;
    
    // Add balance explainer
    breakdownEl.appendChild(balanceExplainer);
    
    // Add balance scale
    breakdownEl.appendChild(createBalanceScale(usedBalanceFactor));
    
    // Replace text with our custom element
    scoreBreakdownDiv.innerHTML = '';
    scoreBreakdownDiv.appendChild(breakdownEl);
    
    // Calculate dynamic canvas dimensions based on text content
    const lines = candidate.lines || [text.split(/\s+/)];
    const lineHeight = Math.round(fontSize * STYLE_CONSTANTS.LINE_HEIGHT_FACTOR);
    const padding = 15;
    
    // Calculate required width - use the target width as a base but ensure it fits longest line
    let maxLineWidth = 0;
    try {
      const tempCanvas = document.createElement('canvas');
      const tempCtx = tempCanvas.getContext('2d');
      if (tempCtx) {
        tempCtx.font = `${fontSize}px ${STYLE_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        
        lines.forEach(line => {
          const lineText = Array.isArray(line) ? line.join(' ') : line as string;
          const textWidth = tempCtx.measureText(lineText).width;
          maxLineWidth = Math.max(maxLineWidth, textWidth);
        });
      }
    } catch (error) {
      console.warn('Error calculating text dimensions:', error);
      maxLineWidth = targetWidth; // Fallback to target width
    }
    
    // Set canvas dimensions with proper sizing
    const canvasWidth = Math.max(targetWidth, maxLineWidth) + (padding * 2);
    const canvasHeight = (lines.length * lineHeight) + (padding * 2);
    
    const canvas = createElement<HTMLCanvasElement>('canvas', {}, {
      width: canvasWidth + 'px',
      height: canvasHeight + 'px',
      maxWidth: '100%' // Responsive behavior
    });
    
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Draw text on canvas with high-quality rendering
    const ctx = canvas.getContext('2d');
    if (ctx) {
      try {
        // Enable high-quality text rendering
        ctx.textBaseline = 'top';
        
        // Clear canvas with white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
        
        // Set consistent font styling
        ctx.font = `${fontSize}px ${STYLE_CONSTANTS.DEFAULT_FONT_FAMILY}`;
        ctx.fillStyle = STYLE_CONSTANTS.DEFAULT_TEXT_COLOR;
        ctx.textAlign = 'left';
        
        // Render lines with proper spacing
        lines.forEach((line, lineIndex) => {
          const lineText = Array.isArray(line) ? line.join(' ') : line as string;
          const x = padding;
          const y = padding + (lineIndex * lineHeight);
          
          // Add subtle line background for better visibility (alternating)
          if (lineIndex % 2 === 1) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.02)';
            ctx.fillRect(0, y - 2, canvasWidth, lineHeight);
            ctx.fillStyle = STYLE_CONSTANTS.DEFAULT_TEXT_COLOR;
          }
          
          ctx.fillText(lineText, x, y);
        });
      } catch (error) {
        console.error('Error rendering canvas:', error);
        // Add error message to canvas
        ctx.fillStyle = 'red';
        ctx.fillText('Error rendering text', padding, padding);
      }
    }
    
    candidateDiv.appendChild(radio);
    candidateDiv.appendChild(label);
    candidateDiv.appendChild(scoreBreakdownDiv);
    candidateDiv.appendChild(canvas);
    
    return candidateDiv;
  } catch (error) {
    console.error('Error creating candidate block:', error);
    return null;
  }
}
