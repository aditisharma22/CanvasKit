export default {
  locale: "es",
  rules: {
    avoidBreakBefore: ["articles", "prepositions", "punctuation"],
    avoidBreakAfter: ["hyphen", "numeric"],
    avoidBreakBetween: ["properNounSequence"],
  },
  functionWords: [
    "y", "e", "o", "u", "de", "del", "la", "el", "los", "las",
    "un", "una", "en", "a", "al", "por", "con"
  ],
};
