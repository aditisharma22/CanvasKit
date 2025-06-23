export default {
  locale: "fr",
  rules: {
    avoidBreakBefore: [
      "punctuation",        // Prevent line break before ., :, ?, etc.
      "articles",           // le, la, les...
      "prepositions"        // à, de, pour...
    ],
    avoidBreakAfter: [
      "hyphen",             // Don't break after a hyphen (e.g., Jean-Luc)
      "numeric",            //  Don't break between 100 and %
    ],
    avoidBreakBetween: [
      "properNounSequence", // Jean Luc, Apple Music...
      "appleServices",      
      "appGameNames",       
    ],
    removeColonAtLineEnd: true,                
    capitalizeSecondLineIfColonRemoved: true   
  },

  functionWords: [
    // Articles (Rule 3)
    "le", "la", "les", "un", "une", "des", "de", "du",
    // Prepositions (Rule 5)
    "à", "de", "pour", "par", "en", "dans", "sans",
    "avec", "parmi", "sous", "chez", "sur",
    // Conjunctions
    "et", "ou", "mais", "donc", "or", "ni", "car"
  ],

  appleServices: [
    "Apple One",
    "Apple Arcade",
    "Apple Music",
    "Apple TV+",
    "Apple News+",
    "Fitness+"
  ],

  appGameNames: [
    "Monopoly Go",
    "Candy Crush",
    "Clash Royale",
    "Temple Run"
  ],

  percentSymbols: ["%"],

  unitsOfMeasure: [
    "km", "mo", "cl", "l", "kg", "g"
  ],

  punctuation: [".", ":", ";", "!", "?", "…"] 
};
