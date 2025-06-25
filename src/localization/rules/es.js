export default {
  locale: "es",
  rules: {
    avoidBreakBefore: ["articles", "prepositions", "punctuation"],
    avoidBreakAfter: ["hyphen", "numeric"],
    avoidBreakBetween: ["properNounSequence", "appleServices", "appGameNames"],
  },
  functionWords: [
    "y", "e", "o", "u", "de", "del", "la", "el", "los", "las",
    "un", "una", "en", "a", "al", "por", "con"
  ],
  
  // Apple brand services that should not be broken across lines
  appleServices: [
    "Apple Music",
    "Apple One",
    "Apple Arcade",
    "Apple TV+",
    "Apple Books",
    "Fitness+"
  ],
  
  // Popular game names that should not be broken across lines
  appGameNames: [
    "Candy Crush",
    "Clash Royale",
    "Temple Run"
  ],
  
  // Percentage symbols and other special characters
  percentSymbols: ["%"],
  
  // Common units of measure
  unitsOfMeasure: [
    "km", "m", "cm", "g", "kg", "l", "ml"
  ],
  
  // Punctuation that should not be separated from preceding word
  punctuation: [".", ":", ";", "!", "?", "…"]
};
