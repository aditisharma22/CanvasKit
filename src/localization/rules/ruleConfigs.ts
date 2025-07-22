/**
 * Line breaking rules configuration
 * This module imports and consolidates line breaking rules for all supported languages
 */

// Import language-specific rule configurations
import deRules from "./de";  // German rules
import enRules from "./en";  // English rules
import esRules from "./es";  // Spanish rules
import frRules from "./fr";  // French rules
import jaRules from "./ja";  // Japanese rules

const ruleConfigs = {
  de: deRules,  // German
  en: enRules,  // English
  es: esRules,  // Spanish
  fr: frRules,  // French
  ja: jaRules,  // Japanese
};

export default ruleConfigs;
