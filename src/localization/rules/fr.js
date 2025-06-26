export default {
  locale: "fr",
  rules: {
    avoidBreakBefore: [
      "punctuation",        // Prevent line break before punctuation
      "articles",           // Articles should stay with following word
      "prepositions"        // Prepositions should stay with following word
    ],
    avoidBreakAfter: [
      "hyphen",             // Don't break after a hyphen
      "numeric",            // Don't break between number and units/percent
      "articles"            // Articles should never be at end of line
    ],
    avoidBreakBetween: [
      "appleServices",      // Apple service names on one line
      "appGameNames",       // Game and app names stay on one line
      "personNames",        // Don't separate names
      "adjectiveNoun"       // Adjective with noun
    ],
    removeColonAtLineEnd: true,                // Remove colon on multiple lines
    capitalizeSecondLineIfColonRemoved: true   // Capitalize the first letter of second line if colon was removed
  },
  
  // Articles should not end a line, must be on the same line as following word
  articles: [
    "le", "la", "les", "un", "une", "des", "de", "du", "l'"
  ],
  
  // No line break after prepositions
  prepositions: [
    "à", "de", "pour", "par", "en", "dans", "sans",
    "avec", "parmi", "sous", "chez", "sur"
  ],
  
  // Common adjectives that should stay with what they describe
  adjectives: [
    "petit", "petite", "petits", "petites",
    "grand", "grande", "grands", "grandes",
    "nouveau", "nouvelle", "nouveaux", "nouvelles",
    "bon", "bonne", "bons", "bonnes",
    "beau", "belle", "beaux", "belles",
    "vieux", "vieille", "vieux", "vieilles"
  ],
  
  // Don't separate names
  personNamePrefixes: [
    "M.", "Mme", "Mlle", "Dr", "Prof"
  ],
  
  // Apple service names on one line
  appleServices: [
    "Apple One",
    "Apple Arcade",
    "Apple Music",
    "Apple TV+",
    "Apple News+",
    "Fitness+", 
    "Apple Music Super Bowl",
    "Apple One Super Bowl"
  ],
  
  // Game and app names stay on one line
  appGameNames: [
    "Monopoly Go",
    "Candy Crush",
    "Clash Royale",
    "Temple Run"
  ],
  
  // Units must stay with the number
  percentSymbols: ["%"],
  
  // Units of measurement that should stay with preceding numbers
  unitsOfMeasure: [
    "km", "m", "cm", "mm",      // Distance
    "mo", "ko", "go", "to",     // Data size
    "cl", "ml", "l", "dl",      // Volume
    "kg", "g", "mg",            // Weight
    "h", "min", "s", "ms",      // Time
    "°", "°C", "°F"             // Temperature
  ],
  
  // Punctuation that should not be at end/beginning of line
  punctuation: [".", ":", ";", "!", "?", "…"]
};
