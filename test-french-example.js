// Test script for French text example
import { createLocalizedLineBreakOptimizer } from './src/localized_line_breaking.js';
import { computeBreaks } from './src/optimize_linebreaks.js';
import { processTextForLineBreaking } from './src/localization/segmenter.js';
import { enhanceWordMetricsWithRules } from './src/localization/ruleEngine.js';

// Create the optimizer
const localizedComputeBreaks = createLocalizedLineBreakOptimizer(computeBreaks);

// French test case
const frenchExample = "L'artiste pop se donne à 100 % dans son nouvel album.";

async function testFrenchExample() {
  console.log("Testing French example:", frenchExample);
  
  // Process text for line breaking
  const processedText = await processTextForLineBreaking(frenchExample, "fr");
  console.log("\nProcessed Text:");
  console.log(JSON.stringify(processedText, null, 2));
  
  // Enhance word metrics with localization rules
  const enhancedMetrics = enhanceWordMetricsWithRules(
    processedText.words,
    processedText.wordWidths,
    "fr"
  );
  console.log("\nEnhanced Word Metrics with French Rules:");
  console.log(JSON.stringify(enhancedMetrics, null, 2));
  
  // Compute breaks with localization
  const result = await localizedComputeBreaks({
    words: processedText.words,
    wordWidths: processedText.wordWidths,
    spaceWidth: processedText.spaceWidth,
    targetWidth: 300,
    candidateCount: 5,
    balanceFactor: 0.5,
    minFillRatio: 0.5,
    locale: "fr"
  });
  
  console.log("\nComputed Line Breaks:");
  console.log(JSON.stringify(result, null, 2));
  
  // Create a visualization of where the breaks happen
  console.log("\nBreak visualization:");
  
  // Best fit breaks
  console.log("\nBest Fit Layout:");
  visualizeBreaks(processedText.words, result.bestFitBreaks);
  
  // Most uniform breaks
  console.log("\nMost Uniform Layout:");
  visualizeBreaks(processedText.words, result.mostUniformBreaks);
}

function visualizeBreaks(words, breaks) {
  let lines = [];
  let currentLine = [];
  
  words.forEach((word, index) => {
    currentLine.push(word);
    if (breaks.includes(index)) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  });
  
  // Add the last line if there's anything left
  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }
  
  // Print lines
  lines.forEach((line, i) => {
    console.log(`Line ${i + 1}: ${line}`);
  });
}

// Run the test
testFrenchExample().catch(error => {
  console.error("Error running test:", error);
});
