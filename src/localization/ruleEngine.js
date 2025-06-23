export function annotateLineBreakingWithSeparators(wordMetricsArray, ruleConfig) {
  const { rules, periods } = ruleConfig || {};
  return wordMetricsArray.map((token, i, arr) => {
    let lineBreaking = token.lineBreaking || 'allow';

    if (
      i < arr.length - 1 &&
      rules?.avoidBreakAfter?.includes("hyphen") &&
      (token.separator === "-" || token.separator === "\u2011")
    ) {
      lineBreaking = 'avoid';
    }

    if (
      i < arr.length - 1 &&
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(arr[i + 1].text)
    ) {
      lineBreaking = 'avoid';
    }

    return { ...token, lineBreaking };
  });
}


export function applySegmentationRules(wordMetricsArray, ruleConfig) {
  const { rules, functionWords, fixedExpressions, appleServices, periods } = ruleConfig || {};
  const violations = [];

  const isFunctionWord = (w) => functionWords?.includes(w?.toLowerCase());
  const isPunctuation = (w) => /^[.,:;!?%)]$/.test(w);
  const isHyphen = (sep) => sep === "-" || sep === "\u2011";
  const isNumeric = (w) => /^\d+$/.test(w);
  const isProperNoun = (w) => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+$/.test(w);

 
  function isFixedExpressionOrAppleService(curr, next, separator) {
    const combined = `${curr.text}${separator}${next.text}`;
    if (fixedExpressions) {
      for (const expr of fixedExpressions) {
        if (new RegExp(`^${expr}$`, 'i').test(combined)) return true;
      }
    }
    if (appleServices) {
      for (const service of appleServices) {
        if (service.toLowerCase() === combined.toLowerCase()) return true;
      }
    }
    return false;
  }

  for (let i = 0; i < wordMetricsArray.length - 1; i++) {
    const curr = wordMetricsArray[i];
    const next = wordMetricsArray[i + 1];
    const separator = curr.separator;

    // Avoid break after hyphen
    if (rules?.avoidBreakAfter?.includes("hyphen") && isHyphen(separator)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in hyphenated compound"]);
    }

    // Avoid break in fixed expressions or Apple services
    if (
      (rules?.avoidBreakBetween?.includes("fixedExpressions") || rules?.avoidBreakBetween?.includes("appleServices")) &&
      isFixedExpressionOrAppleService(curr, next, separator)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in fixed expression/Apple service"]);
    }

    // Avoid break before function word (articles, etc.)
    if (rules?.avoidBreakBefore?.includes("articles") && isFunctionWord(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break before function word"]);
    }

    // Avoid break between proper nouns
    if (rules?.avoidBreakBetween?.includes("properNounSequence") && isProperNoun(curr.text) && isProperNoun(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in name/brand"]);
    }

    // Avoid break for scores (e.g., "100 Punkte")
    if (isNumeric(curr.text) && /^(Punkte|punkt|Punkte\.)$/i.test(next.text)) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Avoid break in score"]);
    }

    // JP: Avoid break before periods
    if (
      rules?.avoidBreakBefore?.includes("period") &&
      periods &&
      periods.includes(next.text)
    ) {
      violations.push([i, `'${curr.text}' | '${next.text}'`, "Do not break before Japanese period"]);
    }
    
  }

  return violations;
}
