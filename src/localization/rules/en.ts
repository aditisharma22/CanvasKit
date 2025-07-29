// English (en) rules file

interface EnglishRules {
  locale: string;
  rules: {
    avoidBreakBefore: string[];
    avoidBreakAfter: string[];
    avoidBreakBetween: string[];
    removeColonAtLineEnd: boolean;
    capitalizeSecondLineIfColonRemoved: boolean;
  };
  functionWords: string[];
  articles: string[];
  prepositions: string[];
  conjunctions: string[];
  adjectives: string[];
  personNamePrefixes: string[];
  fixedExpressions: string[];
  appleServices: string[];
  appGameNames: string[];
  compoundWords: string[];
  dntTerms: string[];
  percentSymbols: string[];
  unitsOfMeasure: string[];
  punctuation: string[];
  periods: string[];
  syllablePatterns: string[];
  specialCases: Record<string, boolean>;
}

const enRules: EnglishRules = {
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
    "after", "since", "until", "against", "into", "onto", "upon", 
    "across", "along", "around", "behind", "beneath", "beside", "beyond",
    "despite", "inside", "outside", "off", "near", "past", "within", 
    "without", "like", "as", "except", "than", "up", "down"
  ],
  
  conjunctions: [
    "and", "but", "or", "nor", "so", "yet", "for", "because", "if", "when",
    "although", "though", "even though", "unless", "until", "while", "where",
    "since", "as", "after", "before", "once", "whereas", "as if", "as though",
    "provided that", "in order that", "now that", "so that", "as soon as"
  ],
  
  adjectives: [
    "good", "bad", "happy", "sad", "big", "small", "large", "tiny", "tall", "short",
    "long", "young", "old", "new", "hot", "cold", "warm", "cool", "fast", "slow",
    "early", "late", "easy", "hard", "difficult", "simple", "strong", "weak",
    "beautiful", "ugly", "clean", "dirty", "bright", "dark", "light", "heavy",
    "rich", "poor", "smart", "dumb", "kind", "mean", "funny", "serious", "brave",
    "shy", "friendly", "angry", "calm", "loud", "quiet", "soft", "rough", "smooth",
    "round", "square", "flat", "sharp", "thin", "thick", "red", "blue", "green",
    "yellow", "white", "black", "brown", "orange", "gray", "purple", "pink",
    "first", "last", "next", "previous", "few", "many", "several", "all", "some",
    "each", "every", "much", "more", "most", "less", "least", "same", "different"
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
};

export default enRules;
