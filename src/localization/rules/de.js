/**
 * German language line breaking rules
 * Defines rules for German text segmentation and line breaking
 */
export default {
    locale: "de", // ISO language code for German
    
    /**
     * Line breaking rules specific to German language
     */
    rules: {
      /**
       * Special cases for German
       */
      specialCases: {
        "E‑Mail": true,    // Special handling for E-Mail with non-breaking hyphen
        "Smart-home": true // Special handling for Smart-home compound
      },
      /**
       * Avoid breaking lines before these elements
       */
      avoidBreakBefore: [
        "punctuation",        // Avoid break before punctuation like ., :, etc.
        "articles",           // Articles like der, die, das, etc.
        "prepositions"        // Prepositions like auf, mit, von...
      ],
      
      /**
       * Avoid breaking lines after these elements
       */
      avoidBreakAfter: [
        "hyphen",             // Don't break after hyphen (Jean-Luc, Smart-home)
        "numeric",            // Don't break between number and units like 100 Punkte, 20%
        "articles",           // Don't break after articles
        "prepositions"        // Don't break after prepositions
      ],
      
      /**
       * Avoid breaking between specific word sequences
       */
      avoidBreakBetween: [
        "properNounSequence", // First Last names should stay together
        "appleServices",      // Brand names like Apple Store, Apple Books, etc.
        "fixedExpressions"    // Fixed compounds like Smart-home, Auto-werkstatt, Opus 23...
      ],
      
      // Typography rules for German
      removeColonAtLineEnd: true,                 // Remove colon at end of line
      capitalizeSecondLineIfColonRemoved: true    // Capitalize first word after colon if moved to next line
    },
  
    /**
   * German function words that should not be separated from their context
   * These words typically have close semantic connections to adjacent words
   */
  functionWords: [
      // Articles
      "der", "die", "das", "ein", "eine", "einen", "dem", "den",
      // Conjunctions
      "und", "oder", "aber", "sondern", "denn", "doch",
      // Prepositions
      "in", "auf", "über", "mit", "von", "an", "für", "bei", "aus", "zu", 
      "nach", "unter", "vor", "hinter", "zwischen", "gegen", "ohne", "um"
    ],
    
    /**
     * German prepositions that should not be separated from their context
     */
    prepositions: [
      "in", "auf", "über", "mit", "von", "an", "für", "bei", "aus", "zu",
      "nach", "unter", "vor", "hinter", "zwischen", "gegen", "ohne", "um",
      "durch", "seit", "bis", "entlang", "neben", "während", "trotz", "wegen"
    ],
  
    /**
     * Brand names and services that should remain intact
     * These are treated as proper nouns that should not be broken
     */
    appleServices: [
      "App Store",
      "Apple Books",
      "Apple‑ID",      // using non-breaking hyphen
      "Apple TV App",
      "E‑Mail"
    ],
  
    /**
     * Fixed expressions and compounds that should remain intact
     * Includes regular expressions for matching patterns like opus numbers
     */
    fixedExpressions: [
      "Auto-werkstatt",
      "Smart-home",
      "smart-home",        // Lowercase variant (for case-insensitive matching)
      "E‑Mail",            // Email with non-breaking hyphen
      "E-Mail",            // Email with regular hyphen (for fallback)
      "Opus \\d+[ a-z]*",  // Musical opus numbers (Opus 23, Opus 45b)
      "KV \\d+",           // Köchel-Verzeichnis numbers for Mozart compositions
      "BWV \\d+",          // Bach-Werke-Verzeichnis numbers
      "Nr\\. ?\\d+"        // Number indicators (Nr. 5, Nr.12)
    ],
  
    /**
     * Percentage symbols that should stay with their numbers
     */
    percentSymbols: ["%"],
  
    unitsOfMeasure: [
      "km", "kg", "g", "l", "ml", "m", "cm"
    ],
  
    punctuation: [".", ":", ";", "!", "?", "…"]
  };
  