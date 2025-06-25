// Simple script to display test data JSON
import { testCases } from './src/localization/testData.js';

// Find the French example
const frenchExample = testCases.find(test => 
  test.locale === "fr" && test.text.includes("L'artiste pop se donne à 100 %")
);

console.log("French Example:");
console.log(JSON.stringify(frenchExample, null, 2));

// Show all French examples
console.log("\nAll French Test Cases:");
const frenchCases = testCases.filter(test => test.locale === "fr");
console.log(JSON.stringify(frenchCases, null, 2));
