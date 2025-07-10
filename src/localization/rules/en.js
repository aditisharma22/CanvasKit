// English (en) rules file

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
  
  functionWords: [],
  
  // Words that should not be separated from what they modify
  articles: [
    "the", "a", "an"
  ],
  
  prepositions: [
    "of", "in", "on", "with", "by", "for", "to", "from", "at", "about", 
    "under", "over", "between", "among", "through", "during", "before",
    "after", "since", "until", "against", "into", "onto", "upon"
  ],
  
  conjunctions: [
    "and", "but", "or", "nor", "so", "yet", "because", "if", "when",
    "although", "though", "unless", "until", "while", "where"
  ],
  
  adjectives: [
    "new", "good", "high", "old", "great", "big", "small", "large", "young",
    "long", "black", "white", "red", "blue", "green", "free", "poor", "full",
    "best", "right", "wrong", "true", "false", "same", "whole", "important",
    "only", "early", "late", "recent", "final", "main", "major", "current"
  ],
  
  // Title prefixes that stay with names
  personNamePrefixes: [
    "Mr.", "Mrs.", "Ms.", "Dr.", "Prof.", "Sir", "Lady", "Lord", "Rev."
  ],
  
  // Expressions that should remain intact
  fixedExpressions: [
    "e-mail",
    "real-time",
    "state-of-the-art",
    "face-to-face",
    "Vol\\. \\d+",
    "No\\. \\d+"
  ],
  
  // Avoid unnecessary line breaking
  // Apple brand services to keep on one line
  appleServices: [
    "Apple One",
    "Apple Arcade",
    "Apple Music",
    "Apple TV",
    "Apple Watch"
  ],
  
  // Game names to keep intact
  appGameNames: [
    "Candy Crush",
    "Clash Royale",
    "Zombie Attack",
    "Monopoly Go"
  ],

  // Compound words
  compoundWords: [
    "smart-home"
  ],
  
  // Brand terms
  dntTerms: [
    "iPhone",
    "iPad",
    "macOS"
  ],
  
  percentSymbols: ["%"],
  
  // Units of measurement
  unitsOfMeasure: [
    "km", "m", "cm",
    "MB", "GB",
    "kg", "g",
    "h", "min",
    "°C", "°F",
    "$", "€"
  ],
  
  // Punctuation that should not start a line
  punctuation: [".", ",", ":", ";", "!", "?", "...", ")", "]", "}"],
  
  periods: ["."],
  
  // Hyphenation patterns
  syllablePatterns: [
    "con-so-nant",
    "vo-wel"
  ],
  
  // Special cases
  specialCases: {
    "e-mail": true,
    "T-shirt": true,
    "real-time": true
  }
}
