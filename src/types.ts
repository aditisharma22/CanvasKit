// Common types for the CanvasKit application

export interface LineBreakCandidate {
  score?: number;
  lines?: string[][] | string[];
  breaks?: number[];
  lineBreaks?: number[];
  lineWidths?: number[];
  scoreBreakdown?: {
    raggedness?: number;
    evenness?: number;
    fillRatio?: number;
    fillPenalty?: number;
    widows?: number;
    orphans?: number;
    widowsOrphans?: number;
    protectedBreaks?: number;
    protected?: number;
    balanceFactor?: number;
  };
  protectedBreakLines?: number[];
}

export interface RenderOptions {
  fontSize?: number;
  candidateCount?: number;
  balanceFactor?: number;
  minFillRatio?: number;
  mode?: string;
  locale?: string;
  containerId?: string;
  enableLocalization?: boolean;
}

export interface LocaleConfig {
  prepositions?: string[];
  articles?: string[];
  conjunctions?: string[];
  functionWords?: string[];
  unitsOfMeasure?: string[];
  punctuation?: string[];
  rules?: {
    removeColonAtLineEnd?: boolean;
    bracketPairs?: Record<string, string>;
    compoundWords?: string[];
  };
}

export interface ProtectedBreakResult {
  count: number;
  lines: number[];
}

export interface ScoreBreakdown {
  raggedness: number;
  evenness: number;
  fillRatio: number;
  fillPenalty?: number;
  widows: number;
  widowsOrphans?: number;
  orphans: number;
  protectedBreaks: number;
  protected?: number;
  balanceFactor: number;
  score?: number;
}

export interface SyntheticMetrics {
  raggedness: number;
  evenness: number;
  fillRatio: number;
  widows: number;
  orphans: number;
  protectedBreaks: number;
  protectedBreakLines: number[];
  balanceFactor: number;
  score: number;
}

export interface OptimizeLineBreakCandidate {
  score?: number;
  lines?: string[][] | string[];
  breaks?: number[];
  lineBreaks?: number[];
  lineWidths?: number[];
  scoreBreakdown?: ScoreBreakdown;
  protectedBreakLines?: number[];
}

export interface WordMetrics {
  word: string;
  width: number;
  breakBefore?: boolean;
  breakAfter?: boolean;
  penalties?: {
    before?: number;
    after?: number;
  };
}

export interface LineNode {
  id: string;
  type: string;
  number: number;
  text: string;
  words: string[];
  width: number;
  isProtectedBreak?: boolean;
  children: any[];
}

export interface CandidateNode {
  id: string;
  type: string;
  rank: number;
  score: number;
  scoreBreakdown?: Record<string, any>;
  lines: string[][] | string[];
  breaks: number[];
  lineWidths: number[];
  children: LineNode[];
}

export interface TreeData {
  children: CandidateNode[];
  summary: {
    totalCandidates: number;
    bestScore: number;
    worstScore: number;
  };
}
