import { processTextForLineBreaking } from './localization/segmenter';
import { localeConfigManager, CONFIG } from './localization/LocaleConfigManager';
import { UniversalRuleProcessor } from './localization/UniversalRuleProcessor';
import { WordMetrics } from './types';

// Create an instance of the UniversalRuleProcessor
const universalRuleProcessor = new UniversalRuleProcessor();

// Interface for word metrics with localization
export interface LocalizedWordMetric {
  text: string;
  lineBreaking: string;
  [key: string]: any;
}

// Interface for line breaking options
export interface LineBreakingOptions {
  enableLocalization?: boolean;
}

// Make line breaking rules globally available for UI highlighting
if (typeof window !== 'undefined') {
  // Just expose the locale configs via helper method instead of accessing private property
  (window as any).lineBreakRules = CONFIG.SUPPORTED_LOCALES.reduce((obj: Record<string, any>, locale: string) => {
    obj[locale] = localeConfigManager.getConfig(locale);
    return obj;
  }, {});
}

// Apply locale-specific line breaking rules to word metrics
export async function enhanceWordMetricsWithLocalization(
  wordMetrics: WordMetrics[], 
  locale: string, 
  options: LineBreakingOptions = { enableLocalization: true }
): Promise<WordMetrics[]> {
  // When toggle is off, return metrics with basic line breaks
  if (options.enableLocalization === false) {
    return wordMetrics.map((metric, index) => {
      // For basic line breaks, avoid breaks:
      // 1. At the last word
      // 2. For punctuation marks
      // 3. For units after numbers
      // 4. For currency symbols
      const isPunctuation = metric.word && /^[.,;:!?)]$/.test(metric.word);
      const isUnit = metric.word && /^(km|m|cm|mm|kg|g|mg|l|ml|h|min|s|ms|%|€|\$)$/.test(metric.word);
      const isNumber = metric.word && /^\d+$/.test(metric.word);
      const nextMetric = index < wordMetrics.length - 1 ? wordMetrics[index + 1] : null;
      const nextIsUnit = nextMetric && nextMetric.word && /^(km|m|cm|mm|kg|g|mg|l|ml|h|min|s|ms|%|€|\$)$/.test(nextMetric.word);
      
      return {
        ...metric,
        lineBreaking: (
          index === wordMetrics.length - 1 || // Last word
          isPunctuation || // Punctuation marks
          (isNumber && nextIsUnit) || // Number followed by unit
          (isUnit && index > 0 && wordMetrics[index - 1].word && /^\d+$/.test(wordMetrics[index - 1].word)) // Unit after number
        ) ? 'avoid' : 'allow',
        _localeRules: null, // Clear any previous rule metadata
        _partOfAppleService: null, // Clear any special word metadata
        _partOfGameName: null,
        _isSmartHomeCompound: null
      };
    });
  }
  
  // Skip localization processing if not needed for this locale
  if (!localeConfigManager.needsLocalization(locale)) {
    return wordMetrics;
  }
  
  // Convert word metrics to a simple text string for processing
  const text = wordMetrics.map(w => w.word).join(' ');
  
  // Process text with locale-specific line breaking rules
  const localizedMetrics = await processTextForLineBreaking(text, locale);

  // Apply universal rule processing
  const universalProcessedMetrics = universalRuleProcessor.processWordMetrics(wordMetrics, locale);
  
  // Merge localization constraints back into the original word metrics
  return universalProcessedMetrics.map((metric, index) => {
    // Get line breaking constraint from localized metrics, default to 'allow' if not available
    const localConstraint = index < localizedMetrics.length ? 
      (localizedMetrics[index] as LocalizedWordMetric).lineBreaking : CONFIG.LINE_BREAK.ALLOW;
      
    // Return enhanced metrics with line breaking constraint - ensure we keep the required WordMetrics properties
    return {
      ...metric,
      word: metric.word,  // Keep the required word property
      width: metric.width, // Keep the required width property
      lineBreaking: localConstraint === CONFIG.LINE_BREAK.AVOID ? CONFIG.LINE_BREAK.AVOID : CONFIG.LINE_BREAK.ALLOW
    } as WordMetrics;  // Explicitly cast to WordMetrics
  });
}

// Filter line breaking candidates based on locale-specific rules
// Removes candidates that violate language-specific line breaking conventions
export function filterCandidatesByLocalizationRules(
  candidates: any[], 
  words: string[], 
  locale: string, 
  options: LineBreakingOptions = { enableLocalization: true }
): any[] {
  // Skip filtering if localization is disabled
  if (options.enableLocalization === false) {
    return candidates;
  }
  
  // Use universal rule processor for dynamic filtering
  return universalRuleProcessor.filterCandidates(candidates, words, locale);
}

// Type for line breaking optimizer function
type LineBreakOptimizer = (
  words: string[],
  wordWidths: number[],
  spaceWidth: number,
  targetWidth: number,
  candidateCount: number,
  debugElement: HTMLElement | null,
  balanceFactor: number,
  minFillRatio: number,
  mode: string,
  locale: string,
  options: LineBreakingOptions
) => any[] | Promise<any[]>;

// Factory function to create a localization-aware line breaking optimizer
// Wraps an existing optimizer with locale-specific rules
export function createLocalizedLineBreakOptimizer(originalOptimizer: LineBreakOptimizer): LineBreakOptimizer {
  // Define constants for default values and locale handling
  const DEFAULT_LOCALE = 'en';
  
  // Localized line breaking optimizer function
  return async function(
    words: string[], 
    wordWidths: number[], 
    spaceWidth: number, 
    targetWidth: number, 
    candidateCount: number, 
    debugElement: HTMLElement | null, 
    balanceFactor: number, 
    minFillRatio: number, 
    mode: string, 
    locale: string = DEFAULT_LOCALE, 
    options: LineBreakingOptions = { enableLocalization: true }
  ): Promise<any[]> {
    
    // Check if localization is explicitly disabled
    const isLocalizationEnabled = options.enableLocalization !== false;
    
    // When localization is disabled, use basic word-level line breaking
    // regardless of the locale specified
    const effectiveLocale = isLocalizationEnabled ? locale : DEFAULT_LOCALE;
    
    // First, get candidates from the original optimizer
    // Pass the localization toggle state to ensure the core algorithm knows whether to apply rules
    // Use the effective locale based on whether localization is enabled
    const candidates = originalOptimizer(
      words, wordWidths, spaceWidth, targetWidth, 
      candidateCount, debugElement, balanceFactor, 
      minFillRatio, mode,
      effectiveLocale, // Use the effective locale
      { enableLocalization: isLocalizationEnabled }
    );
    
    // Apply localization filtering for non-English locales if enabled
    if (isLocalizationEnabled && locale && locale !== DEFAULT_LOCALE) {
      // Handle both Promise and non-Promise return types
      if (candidates instanceof Promise) {
        return candidates.then(resolvedCandidates => 
          filterCandidatesByLocalizationRules(resolvedCandidates, words, locale, { enableLocalization: true })
        );
      } else {
        // Pass the toggle state to the filter function as well
        return filterCandidatesByLocalizationRules(candidates, words, locale, { enableLocalization: true });
      }
    }
    
    return candidates;
  };
}
