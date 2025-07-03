export type LineCandidate = {
  breaks: number[];
  score: number;
  lines: string[][];
  lineWidths: number[];
  scoreBreakdown: {
    raggedness: number;
    evenness: number;
    fillPenalty: number;
    widowsOrphans: number;
    protectedBreaks: number;
  };
};

const protectedWords = new Set([
  "the", "a", "an", "of", "in", "on", "with", "and", "but", "or", "for"
]);

function isProtectedBreak(words: string[], index: number): boolean {
  if (index <= 0 || index >= words.length) return false;
  const prev = words[index - 1].toLowerCase();
  const next = words[index].toLowerCase();
  return protectedWords.has(prev) || protectedWords.has(next);
}

function calcWidth(words: string[], wordWidths: number[], spaceWidth: number, start: number, end: number): number {
  let width = 0;
  for (let i = start; i <= end; i++) {
    width += wordWidths[i];
    if (i > start) width += spaceWidth;
  }
  return width;
}

function scoreCandidate(
  lines: string[][],
  lineWidths: number[],
  targetWidth: number,
  breaks: number[],
  words: string[],
  mode: "fit" | "uniform"
): { score: number, scoreBreakdown: LineCandidate["scoreBreakdown"] } {
  const fillPenalty = lineWidths.reduce((acc, w) => acc + Math.pow(1 - (w / targetWidth), 2), 0);
  const evenness = lineWidths.length < 2 ? 0 : Math.pow(Math.max(...lineWidths) - Math.min(...lineWidths), 2);
  const raggedness = lineWidths.reduce((acc, w) => acc + Math.pow(targetWidth - w, 2), 0);

  const lastLine = lines[lines.length - 1];
  const widowsOrphans = lastLine.length === 1 ? 50 : 0;

  const protectedBreaks = breaks.filter(i => isProtectedBreak(words, i)).length * 30;

  // Weighting based on mode
  let weightedScore = 0;
  if (mode === "fit") {
    weightedScore = raggedness * 3 + evenness * 0.2 + fillPenalty + widowsOrphans + protectedBreaks;
  } else if (mode === "uniform") {
    weightedScore = raggedness * 0.5 + evenness * 4 + fillPenalty + widowsOrphans + protectedBreaks;
  }

  return {
    score: weightedScore,
    scoreBreakdown: {
      raggedness,
      evenness,
      fillPenalty,
      widowsOrphans,
      protectedBreaks
    }
  };
}

export function generateCandidates(
  words: string[],
  wordWidths: number[],
  spaceWidth: number,
  targetWidth: number,
  candidateCount: number,
  mode: "fit" | "uniform",
  balanceFactor = 0.5,
  minFillRatio = 0.5
): LineCandidate[] {
  const totalWords = words.length;
  const allCandidates: LineCandidate[] = [];

  function recurse(start: number, currentBreaks: number[]) {
    if (start >= totalWords) {
      const breaks = currentBreaks.slice(0, -1); 
      const lines: string[][] = [];
      const lineWidths: number[] = [];
      let prev = 0;
      for (const br of breaks.concat(totalWords - 1)) {
        const lineWords = words.slice(prev, br + 1);
        lines.push(lineWords);
        lineWidths.push(calcWidth(words, wordWidths, spaceWidth, prev, br));
        prev = br + 1;
      }
      const { score, scoreBreakdown } = scoreCandidate(lines, lineWidths, targetWidth, breaks, words, mode);
      allCandidates.push({ breaks, score, lines, lineWidths, scoreBreakdown });
      return;
    }
}

// Function to compute line breaking options
function computeBreaks(
  words: string[],
  wordWidths: number[],
  spaceWidth: number,
  targetWidth: number,
  candidateCount: number,
  debugElement?: HTMLElement,
  balanceFactor = 0.5,
  minFillRatio = 0.5,
  mode: "fit" | "uniform" = "fit"
) {
  // Generate line breaking candidates
  const candidates = generateCandidates(
    words,
    wordWidths,
    spaceWidth,
    targetWidth,
    candidateCount,
    mode,
    balanceFactor,
    minFillRatio
  );
  
  // If debug element is provided, visualize the tree
  if (debugElement) {
    // Visualize tree structure (implementation would depend on your visualization code)
    console.log("Generated candidates:", candidates);
  }
  
  return candidates;
}

    for (let end = start; end < totalWords; end++) {
      const width = calcWidth(words, wordWidths, spaceWidth, start, end);
      if (width > targetWidth) break;
      recurse(end + 1, [...currentBreaks, end]);
    }
  }

  recurse(0, []);
  return allCandidates
    .sort((a, b) => a.score - b.score)
    .slice(0, candidateCount);
}

export function computeBreaks(
  words: string[],
  wordWidths: number[],
  spaceWidth: number,
  targetWidth: number,
  candidateCount: number = 3,
  debugElement?: HTMLElement,
  balanceFactor: number = 0.5,
  minFillRatio: number = 0.5,
  mode: "fit" | "uniform" = "fit"
): LineCandidate[] {
  const candidates = generateCandidates(words, wordWidths, spaceWidth, targetWidth, candidateCount, mode, balanceFactor, minFillRatio);

  if (debugElement) {
    debugElement.innerHTML = `<pre>${JSON.stringify(candidates, null, 2)}</pre>`;
  }

  return candidates;
}
