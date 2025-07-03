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
  appleServices: [
    "App Store",
    "Apple TV+",
    "Apple Music",
    "Apple Arcade",
    "Apple Books"
  ],
  appGameNames: [
    "Angry Birds"
  ],
  prepositions: [
    "de", "en", "a", "por", "con", "para", "desde", "hasta", "entre", "sin"
  ],
  punctuation: [".", ":", ";", "!", "?"]
};
