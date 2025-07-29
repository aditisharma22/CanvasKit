/**
 * Main rendering module for paragraph layout with optimized line breaks
 */
import { computeBreaks } from './optimize_linebreaks';
import { enhanceWordMetricsWithLocalization } from './localized_line_breaking';
import { LineBreakCandidate, RenderOptions, ProtectedBreakResult, SyntheticMetrics } from './types';
import { LAYOUT_CONSTANTS, STYLE_CONSTANTS, ERROR_MESSAGES } from './utils/constants';
import { 
  getElementById, 
  calculateCandidateMatchPercentage, 
  getMetricStatus,
  generateAlternativeLines,
  generateLineWidths
} from './utils/helpers';
import { updateTreeOutput, renderCandidateBlock, createMetricRow, createBalanceScale } from './utils/uiHelpers';
import { detectProtectedBreaks as detectProtectedBreaksService } from './services/protectedBreaksService';
import { calculateSyntheticMetrics as calculateSyntheticMetricsService } from './services/syntheticMetricsService';
import { localeConfigManager } from './localization/LocaleConfigManager';

// Paragraph rendering functionality with optimized line breaks

// Main render function that creates text layouts with optimized line breaks
// Options include fontSize, candidateCount, balanceFactor (0-1), minFillRatio,
// mode ("fit"/"fill"), locale, and containerId
/**
 * Renders text with optimized line breaks
 * @param text - Text to render
 * @param targetWidth - Target line width
 * @param options - Rendering options
 */
export async function render(text: string, targetWidth: number, options: RenderOptions = {}): Promise<void> {
  // Use defaults from constants
  const {
    fontSize = LAYOUT_CONSTANTS.DEFAULT_FONT_SIZE,
    candidateCount = LAYOUT_CONSTANTS.DEFAULT_CANDIDATE_COUNT,
    balanceFactor = LAYOUT_CONSTANTS.DEFAULT_BALANCE_FACTOR,
    minFillRatio = LAYOUT_CONSTANTS.DEFAULT_MIN_FILL_RATIO,
    mode = LAYOUT_CONSTANTS.DEFAULT_MODE,
    locale = LAYOUT_CONSTANTS.DEFAULT_LOCALE,
    containerId = LAYOUT_CONSTANTS.DEFAULT_CONTAINER_ID
  } = options;
  
  // Define consistent font style
  const defaultFontStyle = `${fontSize}px ${STYLE_CONSTANTS.DEFAULT_FONT_FAMILY}`;
  const defaultTextColor = STYLE_CONSTANTS.DEFAULT_TEXT_COLOR;

  // Get container element
  const container = getElementById(containerId, ERROR_MESSAGES.ELEMENT_NOT_FOUND(containerId));
  if (!container) {
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
      // For each candidate, construct wordMetrics array from the candidate's lines
      const enhancedCandidatesPromises = candidates.map(async candidate => {
        // Extract words from candidate's lines
        const words = [];
        if (candidate.lines) {
          for (const line of candidate.lines) {
            if (Array.isArray(line)) {
              words.push(...line);
            } else if (typeof line === 'string') {
              words.push(...line.split(/\s+/));
            }
          }
        }
        
        // Create simple wordMetrics objects from the words
        const wordMetrics = words.map(word => ({
          word,
          width: word.length * (fontSize * 0.6) // Same approximation as used earlier
        }));
        
        // Apply localization-specific line breaking rules
        const enhancedWordMetrics = await enhanceWordMetricsWithLocalization(
          wordMetrics, 
          locale, 
          { enableLocalization: options.enableLocalization !== false }
        );
        
        // Return the original candidate with any modifications needed based on enhanced metrics
        return candidate;
      });
      
      // Wait for all enhancements to complete
      try {
        const results = await Promise.all(enhancedCandidatesPromises);
        enhancedCandidates = results.filter(candidate => 
          // Simple filtering - keep candidates with reasonable scores
          (candidate.score || 0) < 100
        );
      } catch (error) {
        console.warn('Error enhancing candidates with localization:', error);
        // Fall back to simple filtering
        enhancedCandidates = candidates.filter(candidate => 
          (candidate.score || 0) < 100
        );
      }
    }

    // Sort candidates by score (lower is better in line breaking)
    enhancedCandidates.sort((a, b) => (a.score || 0) - (b.score || 0));
    
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
        variationIndex,
        locale,
        options.enableLocalization !== false
      );
      
      const syntheticCandidate: LineBreakCandidate = {
        score: baseScore + scoreIncrement,
        lines: syntheticLines,
        lineWidths: syntheticLineWidths,
        scoreBreakdown: syntheticMetrics,
        protectedBreakLines: syntheticMetrics.protectedBreakLines || [],
        breaks: [],
        lineBreaks: []
      };
      
      // Generate realistic break positions
      let wordPos = 0;
      if (syntheticCandidate.lines) {
        syntheticCandidate.lines.forEach((line, lineIndex) => {
          wordPos += (line as string[]).length;
          if (syntheticCandidate.lines && lineIndex < syntheticCandidate.lines.length - 1) {
            if (!syntheticCandidate.breaks) {
              syntheticCandidate.breaks = [];
            }
            syntheticCandidate.breaks.push(wordPos - 1);
          }
        });
      }
      
      // Create a properly structured candidate that matches all required properties
      candidatesToDisplay.push({
        lines: syntheticCandidate.lines || [],
        breaks: syntheticCandidate.breaks || [],
        score: syntheticCandidate.score,
        scoreBreakdown: {
          raggedness: syntheticMetrics.raggedness,
          evenness: syntheticMetrics.evenness,
          fillRatio: syntheticMetrics.fillRatio,
          widows: syntheticMetrics.widows,
          orphans: syntheticMetrics.orphans,
          protectedBreaks: syntheticMetrics.protectedBreaks,
          balanceFactor: syntheticMetrics.balanceFactor,
          score: syntheticMetrics.score
        },
        lineWidths: syntheticCandidate.lineWidths || [],
        protectedBreakLines: syntheticCandidate.protectedBreakLines
      });
    }

    // Display candidates
    candidatesToDisplay.slice(0, candidateCount).forEach((candidate, index) => {
      // Check if localization is enabled from options
      const isLocalizationEnabled = options.enableLocalization !== false;
      
      // Add protected breaks detection to each candidate, respecting localization toggle
      const protectedBreaksResult = detectProtectedBreaks(candidate.lines as string[][], locale, isLocalizationEnabled);
      const protectedBreakCount = protectedBreaksResult.count;
      
      // Store protected break lines in the candidate
      candidate.protectedBreakLines = protectedBreaksResult.lines;
      
      // Update the scoreBreakdown with the actual count
      if (candidate.scoreBreakdown) {
        candidate.scoreBreakdown.protectedBreaks = protectedBreakCount;
      }
        
        const candidateDiv = document.createElement('div');
        candidateDiv.className = 'candidate-block';
        
        // Still keep relative positioning for the layout
        candidateDiv.style.position = 'relative';
        
        const radio = document.createElement('input');
        radio.type = 'radio';
        radio.name = 'layoutChoice';
        radio.value = index.toString();
        radio.id = `candidate-${containerId}-${index}`;
        
        // Add click handler to update tree output
        radio.onclick = () => {
          updateTreeOutput(candidate, index, locale, text, targetWidth);
        };
        
        const label = document.createElement('label');
        label.setAttribute('for', `candidate-${containerId}-${index}`);
        
        // Calculate proper match percentage based on candidate ranking
        const rawScore = candidate.score || 0;
        
        // Use our helper function to calculate the match percentage
        const matchPercentage = calculateCandidateMatchPercentage(candidate, index);
        
        label.textContent = `Candidate ${index + 1}: ${matchPercentage.toFixed(1)}% match (Score: ${rawScore.toFixed(1)})`;
        
        // Create score breakdown display with validation
        const scoreBreakdownDiv = document.createElement('div');
        scoreBreakdownDiv.style.fontSize = '0.85em';
        scoreBreakdownDiv.style.color = '#666';
        scoreBreakdownDiv.style.marginTop = '8px';
        scoreBreakdownDiv.style.lineHeight = '1.3';
        
        // Extract and validate breakdown values with proper defaults
        const scoreData = candidate.scoreBreakdown || {};
        const raggedness = (scoreData as any).raggedness ?? 0;
        const evenness = (scoreData as any).evenness ?? 100;
        const fillRatio = (scoreData as any).fillRatio ?? (scoreData as any).fillPenalty ?? 100;
        const widows = (scoreData as any).widows ?? (scoreData as any).widowsOrphans ?? 0;
        const orphans = (scoreData as any).orphans ?? 0;
        const protectedBreaks = (scoreData as any).protectedBreaks ?? (scoreData as any).protected ?? 0;
        const usedBalanceFactor = (scoreData as any).balanceFactor ?? balanceFactor; // Get the balance factor that was used

        // Use helper from utils/helpers

        // Create more informative breakdown display
        const breakdownEl = document.createElement('div');
        breakdownEl.style.display = 'flex';
        breakdownEl.style.flexDirection = 'column';
        breakdownEl.style.gap = '4px';
        
        // Use the imported createMetricRow function from uiHelpers
        
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
        
        // Create a visual representation of the balance factor using the helper function
        const balanceScale = createBalanceScale(usedBalanceFactor);
        
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
        scoreBreakdownDiv.innerHTML = '';
        scoreBreakdownDiv.appendChild(breakdownEl);
        
        // Calculate dynamic canvas dimensions based on text content
        const lines = candidate.lines || [words];
        const lineHeight = Math.round(fontSize * 1.2); // 20% larger than font size for better readability
        const padding = 15;
        
        // Calculate required width - use the target width as a base but ensure it fits longest line
        let maxLineWidth = 0;
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.font = defaultFontStyle;
          
          lines.forEach(line => {
            const lineText = Array.isArray(line) ? line.join(' ') : line as string;
            const textWidth = tempCtx.measureText(lineText).width;
            maxLineWidth = Math.max(maxLineWidth, textWidth);
          });
        }
        
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
        if (ctx) {
          // Enable high-quality text rendering
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
            const lineText = Array.isArray(line) ? line.join(' ') : line as string;
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
        }
        
        candidateDiv.appendChild(radio);
        candidateDiv.appendChild(label);
        candidateDiv.appendChild(scoreBreakdownDiv);
        candidateDiv.appendChild(canvas);
        
        container.appendChild(candidateDiv);
      });
  } catch (error) {
    container.innerHTML = `<div style="color: red; padding: 20px;">Error rendering layout: ${(error as Error).message}</div>`;
  }
}

// This function is now imported from the services module - using local implementation for backward compatibility
function calculateSyntheticMetrics(
  lines: string[][],
  lineWidths: number[],
  targetWidth: number,
  variationIndex: number,
  locale: string = 'en',
  isLocalizationEnabled: boolean = true
): SyntheticMetrics {
  // Use the service implementation
  return calculateSyntheticMetricsService(lines, lineWidths, targetWidth, variationIndex, locale, isLocalizationEnabled);
}

// This function is now imported from the services module - using local implementation for backward compatibility
function detectProtectedBreaks(candidateLines: string[][] | null, locale: string, isLocalizationEnabled = true): ProtectedBreakResult {
  // Use the service implementation
  return detectProtectedBreaksService(candidateLines, locale, isLocalizationEnabled);
}

// These functions have been moved to the protectedBreaksService module

// This function has been moved to the helpers module

export { updateTreeOutput };
