/**
 * Universal Rule Processor
 * Provides dynamic rule processing for all locales without hardcoded logic
 * Handles all types of line breaking rules in a unified, extensible manner
 */

import { localeConfigManager, CONFIG } from './LocaleConfigManager.js';

/**
 * Universal Rule Processor Class
 * Processes line breaking rules dynamically for any locale
 */
export class UniversalRuleProcessor {
  constructor() {
    this.configManager = localeConfigManager;
  }

  /**
   * Process word metrics with locale-specific line breaking rules
   * @param {Array} wordMetricsArray - Array of word metrics objects
   * @param {string} locale - The locale code
   * @returns {Array} - Updated word metrics with line breaking annotations
   */
  processWordMetrics(wordMetricsArray, locale) {
    if (!Array.isArray(wordMetricsArray) || wordMetricsArray.length === 0) {
      return wordMetricsArray;
    }

    const config = this.configManager.getConfig(locale);
    const processedMetrics = [...wordMetricsArray];

    // Apply all rule types dynamically
    this.applyBeforeRules(processedMetrics, config);
    this.applyAfterRules(processedMetrics, config);
    this.applyBetweenRules(processedMetrics, config);
    this.applySpecialCases(processedMetrics, config);

    return processedMetrics;
  }

  /**
   * Apply "avoid break before" rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyBeforeRules(metrics, config) {
    const beforeRules = config.rules?.avoidBreakBefore || [];

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];

      for (const rule of beforeRules) {
        if (this.configManager.applyRule({
          rule,
          context: 'before',
          current,
          next,
          config,
          index: i
        })) {
          current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
          this.addRuleMetadata(current, rule, 'before');
        }
      }
    }
  }

  /**
   * Apply "avoid break after" rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyAfterRules(metrics, config) {
    const afterRules = config.rules?.avoidBreakAfter || [];

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];

      for (const rule of afterRules) {
        if (this.configManager.applyRule({
          rule,
          context: 'after',
          current,
          next,
          config,
          index: i
        })) {
          current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
          this.addRuleMetadata(current, rule, 'after');
        }
      }
    }
  }

  /**
   * Apply "avoid break between" rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyBetweenRules(metrics, config) {
    const betweenRules = config.rules?.avoidBreakBetween || [];
    const words = metrics.map(m => m.text || m.segment || '');

    // Convert metrics text to a single string for whole-text searching
    const fullText = metrics.map(m => m.text || m.segment || '').join(' ').toLowerCase();

    for (const rule of betweenRules) {
      switch (rule) {
        case 'fixedExpressions':
          this.applyFixedExpressionRules(metrics, config);
          break;
        case 'appleServices':
          // Enhanced implementation for Apple services
          this.applyAppleServiceRules(metrics, config, fullText);
          break;
        case 'appGameNames':
          // Enhanced implementation for game names
          this.applyGameNameRules(metrics, config, fullText);
          break;
        case 'personNames':
          this.applyPersonNameRules(metrics, config);
          break;
        case 'adjectiveNoun':
          this.applyAdjectiveNounRules(metrics, config);
          break;
        case 'properNounSequence':
          this.applyProperNounRules(metrics, config);
          break;
        default:
          // Generic phrase protection
          this.applyGenericPhraseRules(metrics, config, rule);
          break;
      }
    }
  }
  
  /**
   * Apply Apple service name rules with improved text matching
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   * @param {string} fullText - The full lowercase text of all metrics joined
   */
  applyAppleServiceRules(metrics, config, fullText) {
    const services = this.configManager.getRuleList(config, 'appleServices');
    
    for (const service of services) {
      const serviceName = typeof service === 'string' ? service : 
                         Array.isArray(service) ? service.join(' ') : '';
      
      if (!serviceName) continue;
      
      const serviceNameLower = serviceName.toLowerCase();
      
      // Check if the service name appears in the full text
      if (fullText.includes(serviceNameLower)) {
        // First, find all positions where this service name appears
        let startPos = 0;
        let foundPos = -1;
        
        while ((foundPos = fullText.indexOf(serviceNameLower, startPos)) !== -1) {
          // Calculate word boundaries
          const serviceWords = serviceNameLower.split(/\s+/);
          let wordCount = 0;
          let currentPos = 0;
          
          // Identify which metrics contain parts of this service name
          for (let i = 0; i < metrics.length; i++) {
            const metric = metrics[i];
            const metricText = (metric.text || metric.segment || '').toLowerCase();
            
            if (!metricText) continue;
            
            // Check if this metric is part of the service name
            if (currentPos + metricText.length > foundPos && currentPos < foundPos + serviceNameLower.length) {
              // This metric overlaps with the service name position
              metric.lineBreaking = 'avoid';
              metric._partOfAppleService = serviceName;
              this.addRuleMetadata(metric, 'appleServices', 'between', serviceName);
            }
            
            currentPos += metricText.length + 1; // +1 for space
          }
          
          // Move to find next occurrence
          startPos = foundPos + serviceNameLower.length;
        }
      }
    }
  }
  
  /**
   * Apply game name rules with improved text matching
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   * @param {string} fullText - The full lowercase text of all metrics joined
   */
  applyGameNameRules(metrics, config, fullText) {
    const gameNames = this.configManager.getRuleList(config, 'appGameNames');
    
    for (const gameName of gameNames) {
      const gameNameText = typeof gameName === 'string' ? gameName : 
                          Array.isArray(gameName) ? gameName.join(' ') : '';
      
      if (!gameNameText) continue;
      
      const gameNameLower = gameNameText.toLowerCase();
      
      // Check if the game name appears in the full text
      if (fullText.includes(gameNameLower)) {
        // Find all positions where this game name appears
        let startPos = 0;
        let foundPos = -1;
        
        while ((foundPos = fullText.indexOf(gameNameLower, startPos)) !== -1) {
          // Calculate word boundaries
          let currentPos = 0;
          
          // Identify which metrics contain parts of this game name
          for (let i = 0; i < metrics.length; i++) {
            const metric = metrics[i];
            const metricText = (metric.text || metric.segment || '').toLowerCase();
            
            if (!metricText) continue;
            
            // Check if this metric is part of the game name
            if (currentPos + metricText.length > foundPos && currentPos < foundPos + gameNameLower.length) {
              // This metric overlaps with the game name position
              metric.lineBreaking = 'avoid';
              metric._partOfGameName = gameNameText;
              this.addRuleMetadata(metric, 'appGameNames', 'between', gameNameText);
            }
            
            currentPos += metricText.length + 1; // +1 for space
          }
          
          // Move to find next occurrence
          startPos = foundPos + gameNameLower.length;
        }
      }
    }
  }

  /**
   * Apply special cases defined in the configuration
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applySpecialCases(metrics, config) {
    const specialCases = config.rules?.specialCases || {};

    for (const [caseKey, caseValue] of Object.entries(specialCases)) {
      if (caseValue) {
        this.applySpecialCase(metrics, caseKey, config);
      }
    }
  }

  /**
   * Apply fixed expression rules (hyphenated compounds, etc.)
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyFixedExpressionRules(metrics, config) {
    const fixedExpressions = this.configManager.getRuleList(config, 'fixedExpressions');
    
    for (const expression of fixedExpressions) {
      if (typeof expression === 'string') {
        if (expression.includes('-')) {
          // Handle hyphenated expressions
          this.markHyphenatedExpression(metrics, expression);
        } else if (expression.includes('\\')) {
          // Handle regex expressions
          this.markRegexExpression(metrics, expression);
        } else {
          // Handle simple multi-word expressions
          this.markMultiWordExpression(metrics, expression);
        }
      }
    }
  }



  /**
   * Apply person name rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyPersonNameRules(metrics, config) {
    const prefixes = this.configManager.getRuleList(config, 'personNamePrefixes');
    
    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];
      
      if (this.configManager.matchesList(current.text, prefixes) && 
          CONFIG.REGEX_PATTERNS.PROPER_NOUN.test(next.text)) {
        current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(current, 'personNames', 'between');
      }
    }
  }

  /**
   * Apply adjective-noun rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyAdjectiveNounRules(metrics, config) {
    const adjectives = this.configManager.getRuleList(config, 'adjectives');
    
    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      
      if (this.configManager.matchesList(current.text, adjectives)) {
        current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(current, 'adjectiveNoun', 'between');
      }
    }
  }

  /**
   * Apply proper noun sequence rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   */
  applyProperNounRules(metrics, config) {
    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];
      
      if (CONFIG.REGEX_PATTERNS.PROPER_NOUN.test(current.text) && 
          CONFIG.REGEX_PATTERNS.PROPER_NOUN.test(next.text)) {
        current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(current, 'properNounSequence', 'between');
      }
    }
  }

  /**
   * Apply generic phrase protection rules
   * @param {Array} metrics - Word metrics array
   * @param {Object} config - Locale configuration
   * @param {string} rule - Rule name
   */
  applyGenericPhraseRules(metrics, config, rule) {
    const phrases = this.configManager.getRuleList(config, rule);
    const words = metrics.map(m => m.text || '');
    
    for (let i = 0; i < metrics.length; i++) {
      if (this.configManager.breakSplitsPhrase(i, words, phrases)) {
        metrics[i].lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(metrics[i], rule, 'between');
      }
    }
  }

  /**
   * Apply a specific special case
   * @param {Array} metrics - Word metrics array
   * @param {string} caseKey - Special case key
   * @param {Object} config - Locale configuration
   */
  applySpecialCase(metrics, caseKey, config) {
    // Handle common special cases dynamically
    if (caseKey.includes('-') || caseKey.includes('\u2011')) {
      this.markHyphenatedExpression(metrics, caseKey);
    } else {
      this.markMultiWordExpression(metrics, caseKey);
    }
  }

  /**
   * Mark hyphenated expression parts to avoid line breaks
   * @param {Array} metrics - Word metrics array
   * @param {string} expression - Hyphenated expression
   */
  markHyphenatedExpression(metrics, expression) {
    const parts = expression.split(/[-\u2011]/); // Split on both regular and non-breaking hyphens
    if (parts.length !== 2) return;

    const [firstPart, secondPart] = parts.map(p => p.toLowerCase());

    for (let i = 0; i < metrics.length - 1; i++) {
      const current = metrics[i];
      const next = metrics[i + 1];
      
      if (current.text?.toLowerCase() === firstPart && 
          next.text?.toLowerCase() === secondPart) {
        current.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        next.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(current, 'fixedExpression', 'between', expression);
        this.addRuleMetadata(next, 'fixedExpression', 'between', expression);
      }
    }
  }

  /**
   * Mark regex expression matches to avoid line breaks
   * @param {Array} metrics - Word metrics array
   * @param {string} pattern - Regex pattern
   */
  markRegexExpression(metrics, pattern) {
    const fullText = metrics.map(m => m.text || '').join(' ');
    
    try {
      const regex = new RegExp(pattern, 'gi');
      let match;
      
      while ((match = regex.exec(fullText)) !== null) {
        const startPos = match.index;
        const endPos = startPos + match[0].length;
        
        this.markRangeInMetrics(metrics, startPos, endPos, 'regexExpression', pattern);
      }
    } catch (error) {
      console.warn(`Invalid regex pattern: ${pattern}`, error);
    }
  }

  /**
   * Mark multi-word expression to avoid line breaks
   * @param {Array} metrics - Word metrics array
   * @param {string} expression - Multi-word expression
   */
  markMultiWordExpression(metrics, expression) {
    const words = expression.toLowerCase().split(/\s+/);
    if (words.length < 2) return;

    for (let i = 0; i <= metrics.length - words.length; i++) {
      let match = true;
      
      for (let j = 0; j < words.length; j++) {
        if (metrics[i + j]?.text?.toLowerCase() !== words[j]) {
          match = false;
          break;
        }
      }
      
      if (match) {
        for (let j = 0; j < words.length; j++) {
          metrics[i + j].lineBreaking = CONFIG.LINE_BREAK.AVOID;
          this.addRuleMetadata(metrics[i + j], 'multiWordExpression', 'between', expression);
        }
      }
    }
  }

  /**
   * Mark a range of characters in metrics to avoid line breaks
   * @param {Array} metrics - Word metrics array
   * @param {number} startPos - Start position in full text
   * @param {number} endPos - End position in full text
   * @param {string} ruleType - Type of rule
   * @param {string} ruleValue - Rule value
   */
  markRangeInMetrics(metrics, startPos, endPos, ruleType, ruleValue) {
    let currentPos = 0;
    
    for (const metric of metrics) {
      const metricStart = currentPos;
      const metricEnd = currentPos + (metric.text?.length || 0);
      
      if ((metricStart >= startPos && metricStart < endPos) || 
          (metricEnd > startPos && metricEnd <= endPos) ||
          (metricStart < startPos && metricEnd > endPos)) {
        metric.lineBreaking = CONFIG.LINE_BREAK.AVOID;
        this.addRuleMetadata(metric, ruleType, 'between', ruleValue);
      }
      
      currentPos = metricEnd + 1; // +1 for space
    }
  }

  /**
   * Add rule metadata to a metric for debugging and analysis
   * @param {Object} metric - Word metric object
   * @param {string} rule - Rule name
   * @param {string} context - Rule context
   * @param {string} value - Rule value (optional)
   */
  addRuleMetadata(metric, rule, context, value = null) {
    if (!metric._appliedRules) {
      metric._appliedRules = [];
    }
    
    metric._appliedRules.push({
      rule,
      context,
      value,
      timestamp: Date.now()
    });
  }

  /**
   * Filter line breaking candidates based on locale rules
   * @param {Array} candidates - Line breaking candidates
   * @param {Array} words - Words array
   * @param {string} locale - Locale code
   * @returns {Array} - Filtered candidates
   */
  filterCandidates(candidates, words, locale) {
    if (!this.configManager.needsLocalization(locale)) {
      return candidates;
    }

    const config = this.configManager.getConfig(locale);
    
    return candidates.filter(candidate => {
      const breaks = candidate.breaks || [];
      
      for (const breakIdx of breaks) {
        if (this.isBreakViolation(breakIdx, words, config)) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Check if a break position violates any rules
   * @param {number} breakIdx - Break position
   * @param {Array} words - Words array
   * @param {Object} config - Locale configuration
   * @returns {boolean} - True if break violates rules
   */
  isBreakViolation(breakIdx, words, config) {
    if (breakIdx <= 0 || breakIdx >= words.length - 1) return false;

    const prev = { text: words[breakIdx - 1] };
    const curr = { text: words[breakIdx] };
    const next = { text: words[breakIdx + 1] };

    // Check all rule types
    const rules = config.rules || {};
    
    // Check before rules
    for (const rule of rules.avoidBreakBefore || []) {
      if (this.configManager.applyRule({
        rule, context: 'before', current: prev, next: curr, config
      })) {
        return true;
      }
    }

    // Check after rules
    for (const rule of rules.avoidBreakAfter || []) {
      if (this.configManager.applyRule({
        rule, context: 'after', current: prev, next: curr, config
      })) {
        return true;
      }
    }

    // Check between rules
    for (const rule of rules.avoidBreakBetween || []) {
      if (this.configManager.applyRule({
        rule, context: 'between', words, index: breakIdx, config
      })) {
        return true;
      }
    }

    return false;
  }


}

// Export singleton instance
export const universalRuleProcessor = new UniversalRuleProcessor();
