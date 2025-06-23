import { processTextForLineBreaking, runTestCases } from './src/localization/segmenter.js';

// For node environment, import actual modules; for browser, use stubs
let fs, path;
const isNode = typeof process !== 'undefined' && 
  process.versions != null && 
  process.versions.node != null;

if (isNode) {
  // Node.js environment
  const fsModule = await import('fs');
  const pathModule = await import('path');
  fs = fsModule.default || fsModule;
  path = pathModule.default || pathModule;
} else {
  // Browser environment
  const fsStub = await import('./src/stubs/fs-stub.js');
  const pathStub = await import('./src/stubs/path-stub.js');
  fs = fsStub.default || fsStub;
  path = pathStub.default || pathStub;
  console.log("Using filesystem stubs for browser environment");
}

// Function to save results to a JSON file
async function saveResultsToFile(results, filename = 'line-break-opportunities.json') {
  try {
    // Use fs and path stubs for browser compatibility if needed
    if (typeof fs.writeFileSync !== 'function') {
      console.log("File system API not available. Results will only be logged to console.");
      console.log("Complete JSON results:");
      console.log(JSON.stringify(results, null, 2));
      return;
    }
    
    fs.writeFileSync(filename, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Results successfully written to ${filename}`);
  } catch (error) {
    console.error("Error writing results to file:", error);
    console.log("Logging results to console instead:");
    console.log(JSON.stringify(results, null, 2));
  }
}

// Run the demonstration of localization capabilities
console.log("Testing Localization Capabilities:");
const results = await runTestCases();

// Save the results to a JSON file
await saveResultsToFile(results);

// Example usage in CanvasKit applications
console.log("\n\nUsage in CanvasKit applications:");
console.log("==================================");
console.log("1. Import the render function with locale option:");
console.log("   import { render } from './src/render_as_paragraph.js';");
console.log("\n2. Use the render function with locale:");
console.log(`   
   // Example for Japanese text
   render('これは改行ポイントを見つけるためのテストです。', 400, {
     fontSize: 36,
     locale: 'ja'  // Specify the locale
   });

   // Example for German text
   render('Das neue Smart-home System ist da.', 400, {
     fontSize: 36,
     locale: 'de'  // Specify the locale
   });
`);

console.log("\n3. To use just the localization features directly:");
console.log(`   
   import { processTextForLineBreaking } from './src/localization/segmenter.js';
   
   async function example() {
     const text = "Jean-Luc Godard revient avec un film culte.";
     const locale = "fr";
     
     // Get word metrics with line-breaking constraints
     const wordMetrics = await processTextForLineBreaking(text, locale);
     
     console.log(wordMetrics);
     // Use these metrics to make line-breaking decisions
   }
`);

console.log("\nThe integration is complete! You can now use localization-aware line breaking in your CanvasKit applications.");
