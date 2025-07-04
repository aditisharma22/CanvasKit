/**
 * Text rendering module with optimized line breaking
 * This module handles rendering text with optimized line breaking in CanvasKit
 */
import { computeBreaks } from './optimize_linebreaks.js';
import { createLocalizedLineBreakOptimizer } from './localized_line_breaking.js';

// Import CanvasKit from global scope (loaded via script tag)
const CanvasKitInit = window.CanvasKitInit;

// Create a localization-aware line breaking optimizer
// This enhances the standard optimizer with locale-specific rules
const localizedComputeBreaks = createLocalizedLineBreakOptimizer(computeBreaks);

/**
 * Format candidate JSON for display in the UI
 * @param {Object} candidate - The line breaking candidate
 * @param {Array} words - Original words array
 * @param {string} locale - Current locale
 * @returns {string} Formatted HTML
 */
function formatCandidateJson(candidate, words, locale) {
  const targetWidth = DEFAULT_CONFIG.targetWidth || 500; // Use default or fallback to 500px
  
  const jsonData = {
    locale: locale || 'en',
    score: candidate.score.toFixed(2),
    scoreBreakdown: {
      raggedness: candidate.scoreBreakdown.raggedness.toFixed(2),
      evenness: candidate.scoreBreakdown.evenness.toFixed(2),
      fillPenalty: candidate.scoreBreakdown.fillPenalty.toFixed(2),
      widowsOrphans: candidate.scoreBreakdown.widowsOrphans,
      protectedBreaks: candidate.scoreBreakdown.protectedBreaks
    },
    lines: candidate.lines.map((line, i) => {
      return {
        lineNumber: i + 1,
        text: line.join(" "),
        words: line,
        width: Math.round(candidate.lineWidths[i]),
        fillPercentage: Math.round((candidate.lineWidths[i] / targetWidth) * 100) + "%",
        hasBreakAfter: candidate.breaks.includes(i),
        isProtectedBreak: candidate.breaks.includes(i) && 
                         isProtectedBreak(words, candidate.breaks[i])
      };
    }),
    breaks: candidate.breaks,
    lineWidths: candidate.lineWidths.map(w => Math.round(w))
  };
  
  // Convert to pretty JSON string
  const jsonString = JSON.stringify(jsonData, null, 2);
  
  // Colorize JSON for better readability
  const colorizedJson = colorizeJson(jsonString);
  
  // Plain pre tag for tree output (which already has styling from CSS)
  return `<pre style="margin: 0; padding: 15px; font-family: inherit; font-size: inherit; color: inherit;">${colorizedJson}</pre>`;
}

/**
 * Colorize JSON string for better display on dark background
 * @param {string} jsonString - JSON string to colorize
 * @returns {string} HTML with colorized JSON
 */
function colorizeJson(jsonString) {
  // Add syntax highlighting with different colors for dark background
  return jsonString
    .replace(/"([^"]+)":/g, '<span style="color:#BB86FC">"$1"</span>:') // keys in light purple
    .replace(/: "([^"]+)"/g, ': <span style="color:#03DAC5">"$1"</span>') // string values in teal
    .replace(/: (true|false)/g, ': <span style="color:#8BB4FE">$1</span>') // booleans in light blue
    .replace(/: (\d+\.?\d*)/g, ': <span style="color:#CF6679">$1</span>') // numbers in pink
    .replace(/: (\d+\.?\d*%)/g, ': <span style="color:#FFAB91">$1</span>'); // percentages in orange
}

/**
 * Apply styling to the tree output element
 * @param {HTMLElement} element - The tree output element
 */
function applyTreeOutputStyling(element) {
  if (!element) return;
  
  // Apply proper styling for the tree output
  element.style.backgroundColor = '#1e1e1e';
  element.style.color = '#f8f8f8';
  element.style.fontFamily = "'Consolas', 'Monaco', monospace";
  element.style.fontSize = '13px';
  element.style.lineHeight = '1.4';
  element.style.overflow = 'auto';
  element.style.resize = 'both';
  element.style.maxHeight = '800px';
  element.style.minHeight = '400px';
  element.style.padding = '20px';
  element.style.border = '1px solid #333';
  element.style.boxSizing = 'border-box';
  element.style.whiteSpace = 'pre';
}

/**
 * Common function words by language that shouldn't be separated by line breaks
 * @type {Object.<string, Set<string>>}
 */
const PROTECTED_WORDS_BY_LANGUAGE = {
  en: new Set([
    "the", "a", "an", "of", "in", "on", "with", "and", "but", "or", "for"
  ]),
  de: new Set([
    "der", "die", "das", "ein", "eine", "zu", "für", "mit", "und", "oder"
  ]),
  fr: new Set([
    "le", "la", "les", "un", "une", "des", "de", "à", "pour", "avec", "et", "ou"
  ])
};

/**
 * All protected words across all supported languages
 * @type {Set<string>}
 */
const ALL_PROTECTED_WORDS = new Set([
  ...PROTECTED_WORDS_BY_LANGUAGE.en,
  ...PROTECTED_WORDS_BY_LANGUAGE.de,
  ...PROTECTED_WORDS_BY_LANGUAGE.fr
]);

/**
 * Determines if a break is at a protected position
 * Protected breaks occur when breaking would harm readability or semantics
 * 
 * @param {string[]} words - Array of words in text
 * @param {number} index - Break position to evaluate
 * @returns {boolean} Whether the break is at a protected position
 */
function isProtectedBreak(words, index) {
  // Invalid break position
  if (index <= 0 || index >= words.length) return false;
  
  // Clean words for comparison
  const prev = words[index - 1].toLowerCase().replace(/[,.;:!?]$/, "");
  const next = words[index].toLowerCase();
  
  // Check for protected function words
  if (ALL_PROTECTED_WORDS.has(prev) || ALL_PROTECTED_WORDS.has(next)) {
    return true;
  }
  
  // Check for hyphenated compounds that should stay together
  if (prev.endsWith("-")) {
    return true;
  }
  
  // Check for numeric sequences (like dates, scores, measurements)
  // Numbers and their units should stay together
  if ((/^\d+$/.test(prev) && /^\d+$|^[A-Za-z]+[.,]?$/.test(next)) || 
      (/^\d+$/.test(next) && /^\d+$|^[A-Za-z]+[.,]?$/.test(prev))) {
    return true;
  }
  
  return false;
}

/**
 * Default font and rendering configuration
 */
const DEFAULT_CONFIG = {
  fontSize: 40,
  candidateCount: 5,
  balanceFactor: 0.5,
  minFillRatio: 0.5,
  mode: 'fit',
  locale: 'en',
  lineSpacing: 1.6,
  preventTruncation: true,
  highlightViolations: true,
  canvaskitVersion: '0.40.0',
  primaryFont: 'New York Medium',
  primaryFontPath: '/NewYorkMedium-Regular.woff2',
  fallbackFont: 'SF Pro Display',
  fallbackFontPath: '/sf-pro-display_regular.woff2',
  targetWidth: 500, // Default target width in pixels
  paragraphHeight: 1.2 // Default paragraph height multiplier
};

/**
 * Render text as paragraph with optimized line breaking
 * 
 * @param {string} text - Text to render
 * @param {number} targetWidth - Target width for rendering in pixels
 * @param {Object} userOptions - User-specified rendering options
 * @returns {Promise<void>} - Resolution when rendering completes
 */
export async function render(text, targetWidth, userOptions = {}) {
  // Merge user options with defaults
  const options = {
    ...DEFAULT_CONFIG,
    ...userOptions
  };

  console.log("RENDER OPTIONS:", options);
  const fontSize = options.fontSize;

  // Initialize CanvasKit with configured version
  const CanvasKit = await CanvasKitInit({
    locateFile: (file) =>
      `https://unpkg.com/canvaskit-wasm@${options.canvaskitVersion}/bin/${file}`,
  });

  // Load primary font
  const fontBytes = await fetch(options.primaryFontPath).then(res => res.arrayBuffer());
  const fontData = new Uint8Array(fontBytes);
  const typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(fontData);
  const font = new CanvasKit.Font(typeface, fontSize);

  // Load fallback font
  const fallbackFontData = await fetch(options.fallbackFontPath).then(res => res.arrayBuffer());
  
  // Set up font provider with both fonts
  const fontProvider = CanvasKit.TypefaceFontProvider.Make();
  fontProvider.registerFont(fallbackFontData, options.fallbackFont);
  fontProvider.registerFont(fontBytes, options.primaryFont);

  const words = text.split(/\s+/);
  const wordWidths = words.map(word => {
    const glyphs = font.getGlyphIDs(word);
    const widths = font.getGlyphWidths(glyphs);
    return widths.reduce((sum, w) => sum + w, 0);
  });
  const spaceWidth = (() => {
    const glyphs = font.getGlyphIDs(" ");
    const widths = font.getGlyphWidths(glyphs);
    return widths[0] || 10;
  })();

  // Get debug output element if specified
  const debugElement = document.getElementById('treeOutput');
  
  // Apply styling to debug output element if it exists
  if (debugElement) {
    applyTreeOutputStyling(debugElement);
  }
  
  // Process text with localization-aware line breaking
  const candidates = await localizedComputeBreaks(
    words,
    wordWidths,
    spaceWidth,
    targetWidth,
    options.candidateCount,
    debugElement,
    options.balanceFactor,
    options.minFillRatio,
    options.mode,
    options.locale // Pass the locale for localization-aware line breaking
  );

  // Calculate score range for relative scoring display
  const bestScore = candidates[0].score;
  const worstScore = candidates[candidates.length - 1].score;
  const scoreRange = Math.max(1, worstScore - bestScore); // Avoid division by zero

  // Get container element for rendering layouts
  const containerId = userOptions.containerId || "layoutContainer";
  const container = document.getElementById(containerId);
  
  // Clear container before adding new content
  if (container) {
    container.innerHTML = "";
  } else {
    console.error(`Container element with ID "${containerId}" not found`);
    return;
  }
  
  // Display the first candidate's JSON in the treeOutput div
  if (debugElement && candidates.length > 0) {
    const bestCandidate = candidates[0];
    // Pass targetWidth to formatCandidateJson through DEFAULT_CONFIG
    DEFAULT_CONFIG.targetWidth = targetWidth;
    const formattedJson = formatCandidateJson(bestCandidate, words, options.locale);
    debugElement.innerHTML = formattedJson;
    applyTreeOutputStyling(debugElement);
  }
  
  // Add styles to document head if not already present
  if (!document.getElementById('layout-styles')) {
    const styleElement = document.createElement('style');
    styleElement.id = 'layout-styles';
    styleElement.textContent = `
      .candidate-block {
        margin-bottom: 25px;
        padding: 10px;
        border-radius: 5px;
        overflow: visible;
      }
      .candidate-block canvas {
        margin-top: 10px;
        margin-bottom: 10px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }
      .violation-highlight {
        background-color: rgba(255, 200, 200, 0.3);
        padding: 2px 0;
        border-bottom: 2px dotted red;
      }
      .violation-warning {
        color: #d32f2f;
        font-weight: bold;
        margin: 5px 0;
        padding: 5px;
        border-left: 3px solid #d32f2f;
        background-color: rgba(255, 200, 200, 0.2);
      }
    `;
    document.head.appendChild(styleElement);
  }

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = targetWidth + 20;

  candidates.forEach((candidate, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "candidate-block";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "layoutChoice";
    input.value = index;
    input.id = `candidate-${index}`;
    if (index === 0) input.checked = true;

    input.onclick = () => {
      console.log(`Selected layout ${index}`, candidate);
      
      // Update the treeOutput div with JSON data for the selected layout
      const treeOutputDiv = document.getElementById('treeOutput');
      if (treeOutputDiv) {
        // Use the already configured DEFAULT_CONFIG with proper targetWidth
        const formattedJson = formatCandidateJson(candidate, words, options.locale);
        treeOutputDiv.innerHTML = formattedJson;
        applyTreeOutputStyling(treeOutputDiv);
      }
    };

  const label = document.createElement("label");
  label.setAttribute("for", `candidate-${index}`);
  const percentage = 100 - ((candidate.score - bestScore) / scoreRange) * 100;
  label.innerText = `Candidate ${index + 1}: ${percentage.toFixed(1)}% match`;

    const breakdown = candidate.scoreBreakdown;
    const breakdownText = document.createElement("div");
    breakdownText.style.fontSize = "0.9em";
    breakdownText.style.color = "#555";
    breakdownText.innerHTML = `
      Raggedness: ${breakdown.raggedness.toFixed(1)} |
      Evenness: ${breakdown.evenness.toFixed(1)} |
      Fill: ${breakdown.fillPenalty.toFixed(2)} |
      Widows: ${breakdown.widowsOrphans} |
      Protected: ${breakdown.protectedBreaks}
    `;
    wrapper.appendChild(breakdownText);

    const canvas = document.createElement("canvas");
    const lineCount = candidate.lines.length;
    // Calculate canvas dimensions with proper scaling for text
    const lineSpacingMultiplier = options.lineSpacing || DEFAULT_CONFIG.lineSpacing; // Use configured line spacing
    const canvasHeight = lineCount * (fontSize * lineSpacingMultiplier);
    
    // Apply device pixel ratio for crisp rendering on high-DPI displays
    canvas.width = cssWidth * dpr;
    canvas.height = canvasHeight * dpr;
    
    // Set CSS dimensions
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const surface = CanvasKit.MakeCanvasSurface(canvas);
    const skCanvas = surface.getCanvas();
    skCanvas.scale(dpr, dpr);
    skCanvas.clear(CanvasKit.Color4f(1, 1, 1, 1));

    const paragraphStyle = new CanvasKit.ParagraphStyle({
      textStyle: {
        fontSize,
        fontFamilies: [options.primaryFont || DEFAULT_CONFIG.primaryFont],
        heightMultiplier: options.paragraphHeight || 1.2 // Use configured paragraph height or default
      }
    });

    let yOffset = 0;
    // Improve protected word violation highlighting
    if (candidate.scoreBreakdown.protectedBreaks > 0) {
      wrapper.style.border = "2px solid red";
      wrapper.style.backgroundColor = "rgba(255, 200, 200, 0.2)";
      wrapper.title = "⚠ Contains protected phrase breaks";
      
      // Add a warning label
      const warningLabel = document.createElement("div");
      warningLabel.style.color = "red";
      warningLabel.style.fontWeight = "bold";
      warningLabel.style.marginBottom = "5px";
      warningLabel.innerHTML = "⚠️ Protected word break violation";
      wrapper.appendChild(warningLabel);
    }
    
    candidate.lines.forEach((line, lineIndex) => {
      const builder = CanvasKit.ParagraphBuilder.MakeFromFontProvider(paragraphStyle, fontProvider);
      
      // Check if this line has a violation at the end
      const hasViolation = lineIndex < candidate.lines.length - 1 && 
                          candidate.breaks.includes(lineIndex) &&
                          isProtectedBreak(words, candidate.breaks[lineIndex]);
      
      // Add text with styling
      const lineText = line.join(" ");
      builder.addText(lineText);
      
      // Build and layout paragraph first
      const paragraph = builder.build();
      paragraph.layout(cssWidth - 20); // Reduce width slightly to prevent edge truncation
      
      // Draw paragraph
      skCanvas.drawParagraph(paragraph, 10, yOffset);
      
      // If there's a violation, highlight the problematic area
      if (hasViolation && options.highlightViolations !== false) {
        try {
          // Find the break point in the line
          const breakIndex = candidate.breaks.indexOf(lineIndex);
          if (breakIndex >= 0) {
            const lastWordIndex = line.length - 1;
            const lastWord = line[lastWordIndex];
            
            // Create a paint with translucent highlight for violation
            const paint = new CanvasKit.Paint();
            paint.setStyle(CanvasKit.PaintStyle.Fill);
            paint.setColor(CanvasKit.Color4f(1, 0.5, 0.5, 0.4)); // Light red with transparency
            
            // Calculate position of the last word more accurately based on measured text
            const lastWordWidth = Math.max(
              font.getTextWidth(lastWord),
              lastWord.length * (fontSize * 0.5)
            );
            
            // Position the highlight at the end of the line
            const lineWidth = paragraph.getMaxWidth();
            const lastWordStartX = lineWidth - lastWordWidth - 20;
            
            // Draw a more noticeable highlight box for the problematic word
            skCanvas.drawRect(
              CanvasKit.LTRBRect(
                lastWordStartX, 
                yOffset - 2, 
                lastWordStartX + lastWordWidth + 20, 
                yOffset + fontSize + 2
              ),
              paint
            );
            
            // Draw a warning symbol
            const warningPaint = new CanvasKit.Paint();
            warningPaint.setStyle(CanvasKit.PaintStyle.Fill);
            warningPaint.setColor(CanvasKit.Color4f(0.9, 0.1, 0.1, 1)); // Bright red
            
            // Warning triangle
            const trianglePath = new CanvasKit.Path();
            const triangleSize = fontSize * 0.8;
            const triangleX = cssWidth - triangleSize - 5;
            const triangleY = yOffset + fontSize/2;
            
            trianglePath.moveTo(triangleX, triangleY - triangleSize/2);
            trianglePath.lineTo(triangleX + triangleSize, triangleY - triangleSize/2);
            trianglePath.lineTo(triangleX + triangleSize/2, triangleY + triangleSize/2);
            trianglePath.close();
            
            skCanvas.drawPath(trianglePath, warningPaint);
            
            // Border highlighting
            const strokePaint = new CanvasKit.Paint();
            strokePaint.setStyle(CanvasKit.PaintStyle.Stroke);
            strokePaint.setStrokeWidth(2);
            strokePaint.setColor(CanvasKit.Color4f(0.9, 0.2, 0.2, 1)); // Solid red
            
            // Draw a box around the last word to highlight the violation
            skCanvas.drawRect(
              CanvasKit.LTRBRect(
                lastWordStartX, 
                yOffset, 
                lastWordStartX + lastWordWidth, 
                yOffset + fontSize
              ),
              strokePaint
            );
          }
        } catch (err) {
          console.warn("Error highlighting violation:", err);
        }
      }
      
      // Use configured line spacing for consistent text layout
      yOffset += fontSize * lineSpacingMultiplier;
    });

    surface.flush();

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  });
}
