/**
 * Line breaking rules configuration
 * This module imports and consolidates line breaking rules for all supported languages
 */

// Import language-specific rule configurations
import deRules from "./de.js";  // German rules
import esRules from "./es.js";  // Spanish rules
import frRules from "./fr.js";  // French rules
import jaRules from "./ja.js";  // Japanese rules

/**
 * Ruleset registry indexed by ISO language code
 * Each language has its own set of line breaking rules and configurations
 */
export default {
  de: deRules,  // German
  es: esRules,  // Spanish
  fr: frRules,  // French
  ja: jaRules,  // Japanese
};
