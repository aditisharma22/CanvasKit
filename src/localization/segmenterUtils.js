export function segmentsToWordMetrics(
  segments,
  sourceText,
  lineBreakingAnnotations = [],
  context,
  paragraph
) {
  function getGraphemesCount(str) {
    return Array.from(str).length;
  }
  function getWordRect(context, paragraph, boundary) {
    return null;
  }

  const segArr = Array.from(segments);
  const tokens = [];

  for (let i = 0; i < segArr.length; i++) {
    const seg = segArr[i];
    if (!seg.isWordLike) continue;

    const start = seg.index;
    const end = segArr[i + 1] ? segArr[i + 1].index : sourceText.length;

    let separator = '';
    if (end < sourceText.length) {
      const nextWordLike = segArr.slice(i + 1).find(s => s.isWordLike);
      const nextIndex = nextWordLike ? nextWordLike.index : sourceText.length;
      separator = sourceText.slice(end, nextIndex);
    }

   
    let lineBreaking = lineBreakingAnnotations[i] || 'allow';

    tokens.push({
      text: seg.segment,
      trimmedText: seg.segment.trimEnd(),
      charCount: getGraphemesCount(seg.segment),
      boundary: { start, end },
      rect: getWordRect(context, paragraph, { start, end }),
      lineBreaking,
      separator,
      separatorWidth: 0,
      separatorCharCount: getGraphemesCount(separator),
    });
  }
  return tokens;
}
