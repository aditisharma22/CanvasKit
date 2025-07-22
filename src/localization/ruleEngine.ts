// Rule engine for applying line breaking rules to text segments

import { universalRuleProcessor } from './UniversalRuleProcessor';
import { localeConfigManager, CONFIG } from './LocaleConfigManager';

export interface WordMetric {
  text?: string;
  segment?: string;
  separator?: string;
  lineBreaking?: string;
  [key: string]: any;
}

interface RuleConfig {
  locale?: string;
  rules?: {
    avoidBreakAfter?: string[];
    avoidBreakBefore?: string[];
    avoidBreakBetween?: string[];
    removeColonAtLineEnd?: boolean;
    [key: string]: any;
  };
  functionWords?: string[];
  fixedExpressions?: string[];
  appleServices?: string[];
  appGameNames?: string[];
  periods?: string[];
  adjectives?: string[];
  personNamePrefixes?: string[];
  unitsOfMeasure?: string[];
  [key: string]: any;
}

type ViolationType = [number, string, string]; // [index, wordPair, violationDescription]

// Apply line breaking rules based on the locale configuration
export function annotateLineBreakingWithSeparators(wordMetricsArray: WordMetric[], ruleConfig: RuleConfig): WordMetric[] {
  if (!ruleConfig || !ruleConfig.locale) {
    return wordMetricsArray;
  }

  return universalRuleProcessor.processWordMetrics(wordMetricsArray, ruleConfig.locale);
}

// Track rule application for debugging purposes
export function applySegmentationRules(wordMetricsArray: WordMetric[], ruleConfig: RuleConfig): ViolationType[] {
  // Extract rule configurations
  const { 
    rules, 
    functionWords, 
    fixedExpressions, 
    appleServices, 
    appGameNames,
    periods,
    adjectives,
    personNamePrefixes,
    unitsOfMeasure
  } = ruleConfig || {};
  const violations: ViolationType[] = [];
  
  // Constants from LocaleConfigManager
  const { SEPARATORS, REGEX_PATTERNS } = CONFIG;

  // Helper functions for rule checking
  const isFunctionWord = (w: string | undefined): boolean => 
    Array.isArray(functionWords) && !!w && functionWords.includes(w.toLowerCase());
  
  const isAdjective = (w: string | undefined): boolean => 
    Array.isArray(adjectives) && !!w && adjectives.includes(w.toLowerCase());
  
  const isPersonPrefix = (w: string | undefined): boolean => 
    Array.isArray(personNamePrefixes) && !!w && personNamePrefixes.includes(w);
  
  const isUnit = (w: string | undefined): boolean => 
    Array.isArray(unitsOfMeasure) && !!w && unitsOfMeasure.includes(w);
  
  const isPunctuation = (w: string | undefined): boolean => 
    !!w && REGEX_PATTERNS.PUNCTUATION.test(w);
  
  const isHyphen = (sep: string | undefined): boolean => 
    !!sep && (sep === SEPARATORS.HYPHEN || sep === SEPARATORS.NON_BREAKING_HYPHEN);
  
  const isNumeric = (w: string | undefined): boolean => 
    !!w && REGEX_PATTERNS.NUMERIC.test(w);
  
  const isProperNoun = (w: string | undefined): boolean => 
    !!w && REGEX_PATTERNS.PROPER_NOUN.test(w);

  // Check if two adjacent words form a fixed expression or brand name
  function isFixedExpressionOrAppleService(curr: WordMetric, next: WordMetric, separator: string): boolean {
    // Combine words with separator
    const combined = `${curr.text || ''}${separator || ''}${next.text || ''}`;
    
    // Check against fixed expressions
    if (fixedExpressions && Array.isArray(fixedExpressions)) {
      for (const expr of fixedExpressions) {
        // Check for exact match with the combined expression
        if (typeof expr === 'string' && new RegExp(`^${expr}$`, 'i').test(combined)) return true;
        
        // Special handling for hyphenated expressions
        if (typeof expr === 'string' && expr.includes('-')) {
          const [first, second] = expr.split('-');
          if (first && second && 
              curr.text?.toLowerCase() === first.toLowerCase() && 
              next.text?.toLowerCase() === second.toLowerCase()) {
            return true;
          }
        }
      }
    }
    
    // Check against brand/service names
    if (appleServices && Array.isArray(appleServices)) {
      for (const service of appleServices) {
        if (typeof service === 'string' && service.toLowerCase() === combined.toLowerCase()) return true;
      }
    }
    return false;
  }

  // Check for violations in each pair of adjacent words
  for (let i = 0; i < wordMetricsArray.length - 1; i++) {
    const curr = wordMetricsArray[i];
    const next = wordMetricsArray[i + 1];
    const separator = curr.separator;

    // Get text safely
    const currText = curr.text || curr.segment || '';
    const nextText = next.text || next.segment || '';

    // Avoid break after hyphen
    if (rules?.avoidBreakAfter?.includes("hyphen") && isHyphen(separator)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in hyphenated compound"]);
    }

    // Avoid break in fixed expressions or Apple services
    if (
      (rules?.avoidBreakBetween?.includes("fixedExpressions") || rules?.avoidBreakBetween?.includes("appleServices")) &&
      isFixedExpressionOrAppleService(curr, next, separator || '')
    ) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in fixed expression/Apple service"]);
      // Mark both the current and next words with avoid line breaking
      wordMetricsArray[i].lineBreaking = "avoid";
      if (i < wordMetricsArray.length - 1) {
        wordMetricsArray[i+1].lineBreaking = "avoid";
      }
    }

    // Articles/Prepositions should never be at the end of a line
    if (rules?.avoidBreakAfter?.includes("articles") && isFunctionWord(currText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Articles/prepositions should not be at the end of a line"]);
    }

    // Avoid break before function word (articles, etc.)
    if (rules?.avoidBreakBefore?.includes("articles") && isFunctionWord(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break before function word"]);
    }
    
    // Adjectives should not be separated from what they describe
    if (rules?.avoidBreakBetween?.includes("adjectiveNoun") && isAdjective(currText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Adjective should stay with what it describes"]);
    }
    
    // Don't separate names
    if (rules?.avoidBreakBetween?.includes("personNames") && 
        ((isPersonPrefix(currText) && isProperNoun(nextText)) || 
         (isProperNoun(currText) && isProperNoun(nextText)))) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Don't separate names"]);
    }
    
    // Units/percent symbols stay with preceding numbers
    if (rules?.avoidBreakAfter?.includes("units") && 
        isNumeric(currText) && (nextText === '%' || isUnit(nextText))) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Units stay with preceding numbers"]);
    }
    
    // Apple brand services should remain on a single line
    if (rules?.avoidBreakBetween?.includes("appleServices") && appleServices && Array.isArray(appleServices)) {
      const possibleServiceText = wordMetricsArray
        .slice(Math.max(0, i-2), Math.min(wordMetricsArray.length, i+3))
        .map(m => m.text || '')
        .join(' ');
      
      for (const service of appleServices) {
        if (typeof service === 'string' && possibleServiceText.includes(service)) {
          violations.push([i, `'${currText}' | '${nextText}'`, "Apple brands should remain on a single line"]);
          break;
        }
      }
    }
    
    // Game and app names should remain on a single line
    if (rules?.avoidBreakBetween?.includes("appGameNames") && appGameNames && Array.isArray(appGameNames)) {
      const possibleGameText = wordMetricsArray
        .slice(Math.max(0, i-1), Math.min(wordMetricsArray.length, i+2))
        .map(m => m.text || '')
        .join(' ');
      
      for (const game of appGameNames) {
        if (typeof game === 'string' && possibleGameText.includes(game)) {
          violations.push([i, `'${currText}' | '${nextText}'`, "Game names should remain on a single line"]);
          break;
        }
      }
    }

    // Avoid break between proper nouns
    if (rules?.avoidBreakBetween?.includes("properNounSequence") && isProperNoun(currText) && isProperNoun(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in name/brand"]);
    }

    // Avoid break for scores - check for score pattern (likely a pattern like 1-0, 2:1, etc.)
    // Since SCORE_PATTERN doesn't exist in the REGEX_PATTERNS, we'll use a simple check for hyphen or colon
    if (isNumeric(currText) && nextText && /^[:.-]\d+$/.test(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Avoid break in score"]);
    }

    // Avoid break before periods 
    if (rules?.avoidBreakBefore?.includes("period") && 
        periods && periods.includes(nextText)) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Do not break before period"]);
    }
    
    // Special colon handling
    if (nextText === ':' && rules?.removeColonAtLineEnd) {
      violations.push([i, `'${currText}' | '${nextText}'`, "Colon may need special handling at line breaks"]);
    }
  }

  return violations;
}
