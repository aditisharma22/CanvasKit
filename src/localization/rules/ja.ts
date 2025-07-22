// Japanese language rules for line breaking

interface JapaneseRules {
  locale: string;
  rules: {
    avoidBreakBefore: string[];
    avoidBreakInside: string[];
  };
  periods: string[];
}

const jaRules: JapaneseRules = {
  locale: "ja",
  rules: {
    avoidBreakBefore: ["period"],
    avoidBreakInside: ["word"]
  },
  periods: ["。", "、", "．"]
};

export default jaRules;
