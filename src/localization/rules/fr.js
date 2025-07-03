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
    "Apple Books",
    "Fitness+", 
    "Apple One Super Bowl",
    "Apple Music Super Bowl",
    // Special French colon cases
    "Apple Music Super Bowl : la performance",
    "Apple One Super Bowl : la performance",
    "Super Bowl : la performance",
    // Add arcade with lowercase for French text matching
    "Apple arcade"
  ],
  
  // Game and app names stay on one line
  appGameNames: [
    "Monopoly Go",
    "Candy Crush",
    "Clash Royale",
    "Temple Run",
    "Call of Duty",
    "Minecraft",
    "Fortnite",
    "Among Us",
    // Special French context phrases
    "jouer à Monopoly Go",
    "jouer à Candy Crush",
    "dès aujourd'hui sur Apple Arcade",
    "télécharger Monopoly Go",
    "Jean-Luc Godard",
    "super-home system"
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
