export default {
    locale: "de",
    rules: {
      avoidBreakBefore: [
        "punctuation",        // Avoid break before punctuation like ., :, etc.
        "articles",           // Articles like der, die, das, etc.
        "prepositions"        // Prepositions like auf, mit, von...
      ],
      avoidBreakAfter: [
        "hyphen",             // Don't break after hyphen (Jean-Luc, Smart-home)
        "numeric"             // Don't break between number and units like 100 Punkte, 20%
      ],
      avoidBreakBetween: [
        "properNounSequence", // First Last names
        "appleServices",      // Apple Store, Apple Books, etc.
        "fixedExpressions"    // Smart-home, Auto-werkstatt, Opus 23...
      ],
      removeColonAtLineEnd: true,
      capitalizeSecondLineIfColonRemoved: true
    },
  
    functionWords: [
      // Articles
      "der", "die", "das", "ein", "eine", "einen", "den",
      // Conjunctions
      "und", "oder", "aber", "sondern", "denn", "doch",
      // Prepositions
      "in", "auf", "über", "mit", "von", "an", "für", "bei", "aus", "zu", "nach", "unter", "vor", "hinter", "zwischen", "gegen", "ohne", "um"
    ],
  
    appleServices: [
      "App Store",
      "Apple Books",
      "Apple‑ID",      // using non-breaking hyphen
      "Apple TV App",
      "E‑Mail"
    ],
  
    fixedExpressions: [
      "Auto-werkstatt",
      "Smart-home",
      "Opus \\d+[ a-z]*",
      "KV \\d+",
      "BWV \\d+",
      "Nr\\. ?\\d+"
    ],
  
    percentSymbols: ["%"],
  
    unitsOfMeasure: [
      "km", "kg", "g", "l", "ml", "m", "cm"
    ],
  
    punctuation: [".", ":", ";", "!", "?", "…"]
  };
  