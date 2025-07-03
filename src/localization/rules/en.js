/**
 * English (en) Locale Configuration
 * Defines line breaking rules and constraints for English text
 */

export default {
  locale: "en",
  rules: {
    avoidBreakBefore: [
      "punctuation",
      "articles",
      "prepositions",
      "functionWords"
    ],
    avoidBreakAfter: [
      "hyphen",
      "numeric",
      "articles",
      "prepositions",
      "functionWords"
    ],
    avoidBreakBetween: [
      "properNounSequence",
      "appleServices",
      "appGameNames",
      "personNames",
      "adjectiveNoun",
      "compoundWords",
      "dntTerms",
      "fixedExpressions"
    ],
    // Typography rules for English
    removeColonAtLineEnd: true,
    capitalizeSecondLineIfColonRemoved: false
  },
  
  /**
   * English function words that should not be separated from their context
   * These words typically have close semantic connections to adjacent words
   */
  functionWords: [
    // Articles
    "the", "a", "an",
    // Conjunctions
    "and", "but", "or", "nor", "so", "yet", "because", "if", "when",
    "although", "though", "unless", "until", "while", "where"
  ],
  
  // Articles should not be separated from the word they modify
  articles: [
    "the", "a", "an"
  ],
  
  // No line break after prepositions
  prepositions: [
    "of", "in", "on", "with", "by", "for", "to", "from", "at", "about", 
    "under", "over", "between", "among", "through", "during", "before",
    "after", "since", "until", "against", "into", "onto", "upon"
  ],
  
  // Conjunctions should stay with context
  conjunctions: [
    "and", "but", "or", "nor", "so", "yet", "because", "if", "when",
    "although", "though", "unless", "until", "while", "where"
  ],
  
  // Common adjectives that should stay with what they describe
  adjectives: [
    "new", "good", "high", "old", "great", "big", "small", "large", "young",
    "long", "black", "white", "red", "blue", "green", "free", "poor", "full",
    "best", "right", "wrong", "true", "false", "same", "whole", "important",
    "only", "early", "late", "recent", "final", "main", "major", "current"
  ],
  
  /**
   * Person name properties
   */
  // Don't separate names and titles
  personNamePrefixes: [
    "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Sir", "Lady", "Lord", "Rev."
  ],
  
  /**
   * Fixed expressions and compounds that should remain intact
   * Includes regular expressions for matching patterns
   */
  fixedExpressions: [
    "e-mail",
    "real-time",
    "state-of-the-art",
    "face-to-face",
    "Vol\\. \\d+",
    "No\\. \\d+"
  ],
  
  // Apple service names on one line
  appleServices: [
    "Apple One",
    "Apple Music",
    "Apple TV+"
  ],
  
  // Game and app names stay on one line
  appGameNames: [
    "Monopoly Go",
    "Candy Crush",
    "Clash Royale"
  ],

  // Compound words that should stay together
  compoundWords: [
    "smart-home",
    "e-mail",
    "real-time"
  ],
  
  // DNT terms that shouldn't be broken
  dntTerms: [
    "iPhone",
    "iPad",
    "macOS"
  ],
  
  // Units must stay with the number
  percentSymbols: ["%"],
  
  // Units of measurement that should stay with preceding numbers
  unitsOfMeasure: [
    "km", "m", "cm",
    "MB", "GB",
    "kg", "g",
    "h", "min",
    "°C", "°F",
    "$", "€"
  ],
  
  // Punctuation that should not be at beginning of line
  punctuation: [".", ",", ":", ";", "!", "?", "...", ")", "]", "}"],
  
  // Period characters for sentence endings
  periods: ["."],
  
  // Syllable patterns for hyphenation
  syllablePatterns: [
    "con-so-nant",
    "vo-wel"
  ],
  
  // Special case rules
  specialCases: {
    "e-mail": true,
    "T-shirt": true,
    "real-time": true
  }
}
