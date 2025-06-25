export default {
    locale: "ja",
    rules: {
      avoidBreakBefore: ["period", "punctuation"],
      avoidBreakInside: ["word"],
      avoidBreakBetween: ["properNounSequence", "appleServices", "appGameNames"]
    },
    // Japanese periods and comma equivalents
    periods: ["。", "、", "．", "，"],
    
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
    percentSymbols: ["%", "％"],
    
    // Common units of measure
    unitsOfMeasure: [
      "km", "m", "cm", "g", "kg", "l", "ml",
      "キロ", "メートル", "センチ", "グラム", "キログラム", "リットル"
    ],
    
    // Punctuation that should not be separated from preceding word
    punctuation: [".", ":", ";", "!", "?", "…", "。", "、", "：", "；", "！", "？", "…"]
  };
