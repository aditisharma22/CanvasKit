import { 
  segmentsToWordMetrics, 
  handleConsecutiveSpecialChars, 
  isSpecialCharacter, 
  processConsecutivePercentSymbols,
  Segment as BaseSegment,
} from "./segmenterUtils";
import { annotateLineBreakingWithSeparators, applySegmentationRules, WordMetric } from "./ruleEngine";
import ruleEngine from "./rules/ruleConfigs";

// Define our own Segment interface that extends the base one with email-specific properties
interface Segment extends BaseSegment {
  isPartOfEMail?: boolean;
  eMailFullText?: string;
}

// Define SpecialPosition interface for position tracking
interface SpecialPosition {
  start: number;
  end: number;
  text: string;
}

interface SpecialPosition {
  start: number;
  end: number;
  text: string;
}

// Split text into segments using language-appropriate rules
export async function segmentText(text: string, locale = "en"): Promise<Segment[]> {
  try {
    // Handle special terms preprocessing
    let preprocessedText = text;
    let eMailPositions: SpecialPosition[] = [];
    let smartHomePositions: SpecialPosition[] = [];
    
    // Special handling for German terms
    if (locale === 'de') {
      const eMailRegex = /E[\u2011-]Mail/g;
      let match;
      
      while ((match = eMailRegex.exec(preprocessedText)) !== null) {
        eMailPositions.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
      
      const smartHomeRegex = /Smart-home/gi;
      while ((match = smartHomeRegex.exec(preprocessedText)) !== null) {
        smartHomePositions.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0]
        });
      }
    }
    
    // Pre-process the text to handle consecutive percent symbols
    const { processedText, specialCharPositions } = processConsecutivePercentSymbols(preprocessedText);
    
    // Use the browser's built-in Intl.Segmenter if available
    if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
      // Add TypeScript declaration for Intl.Segmenter
      interface SegmentInfo {
        segment: string;
        index: number;
        input: string;
        isWordLike?: boolean;
      }

      interface Segmenter {
        segment(text: string): Iterable<SegmentInfo>;
      }

      interface SegmenterConstructor {
        new(locale: string, options: { granularity: string }): Segmenter;
      }

      // Cast Intl.Segmenter to our interface
      const SegmenterConstructor = (Intl as any).Segmenter as unknown as SegmenterConstructor;
      const segmenter = new SegmenterConstructor(locale, { granularity: "word" });
      const segments = [...segmenter.segment(text)];
      
      // Create a map of all characters already included in segments to avoid duplicates
      const processedCharPositions = new Map<number, boolean>();
      
      // Enhanced segments with special handling for % symbols
      const enhancedSegments: Segment[] = [];
      
      // First, add all regular segments
      for (const seg of segments) {
        if (seg && seg.segment && typeof seg.segment === 'string' && seg.index !== undefined) {
          // Check if this segment contains special characters
          let hasSpecialChars = false;
          
          for (let i = 0; i < seg.segment.length; i++) {
            const position = seg.index + i;
            // Mark this position as processed
            processedCharPositions.set(position, true);
            
            // Check if this position has a special character
            if (specialCharPositions.has(position)) {
              hasSpecialChars = true;
            }
          }
          
          // Enhanced handling for segments with special characters and punctuation
          // Include non-breaking hyphens and other dash types
          if (hasSpecialChars || seg.segment.match(/[:;.,!?\-–—\u2011\u2013\u2014]/)) {
            // Check for non-breaking hyphen in compound words (like E‑Mail)
            if (seg.segment.includes('\u2011')) {
              // Keep the whole segment intact for non-breaking hyphen compounds
              enhancedSegments.push({
                segment: seg.segment,
                index: seg.index,
                isWordLike: true, // Treat as a word
                isSpace: false,
                hasNonBreakingHyphen: true, // Mark for special handling
                input: text
              });
            } else {
              // Split the segment into individual characters
              for (let i = 0; i < seg.segment.length; i++) {
                const char = seg.segment[i];
                const position = seg.index + i;
                
                // Improved character classification with non-breaking hyphens
                const isPunctuation = /[:;.,!?\-–—\u2011\u2013\u2014]/.test(char);
                const isWordChar = /\w/.test(char);
                const isNonBreakingHyphen = char === '\u2011';
                
                enhancedSegments.push({
                  segment: char,
                  index: position,
                  // Ensure punctuation is treated properly
                  isWordLike: isSpecialCharacter(char) || isWordChar || isPunctuation,
                  isSpace: /\s/.test(char),
                  isPunctuation: isPunctuation,
                  isNonBreakingHyphen: isNonBreakingHyphen,
                  input: text
                });
              }
            }
          } else {
            // Regular segment
            enhancedSegments.push({
              segment: seg.segment,
              index: seg.index,
              isWordLike: (seg as any).isWordLike,
              // Check if this segment is punctuation - include non-breaking hyphens
              isPunctuation: seg.segment.length === 1 && /[:;.,!?\-–—\u2011\u2013\u2014]/.test(seg.segment),
              // Check for non-breaking hyphen in the segment
              hasNonBreakingHyphen: seg.segment.includes('\u2011'),
              input: text
            });
          }
        }
      }
      
      // Post-process for special cases like E‑Mail
      if (eMailPositions.length > 0) {
        for (const pos of eMailPositions) {
          // Find any segments that overlap with E‑Mail positions
          for (let i = 0; i < enhancedSegments.length; i++) {
            const seg = enhancedSegments[i];
            if (seg.index >= pos.start && seg.index < pos.end) {
              // Mark this segment as part of E‑Mail
              seg.isPartOfEMail = true;
              seg.isWordLike = true;
              seg.eMailFullText = pos.text;
            }
          }
        }
      }
      
      return enhancedSegments;
    } else {
      throw new Error('Intl.Segmenter not available');
    }
  } catch (err) {
    console.warn(`Segmentation failed for ${locale}, falling back to improved default`, err);
    
    // Enhanced fallback segmentation that handles special characters and preserves spaces
    let segments: Segment[] = [];
    let processedPositions = new Map<number, boolean>();
    
    // First pass: Use a regex that properly handles all character types
    // Modified pattern to properly preserve punctuation like hyphens and colons
    // Also handle non-breaking hyphens (U+2011) and other special hyphens
    const pattern = /([^\s%°€$\w\u2011\u2013\u2014]|[\w\u2011\u2013\u2014-]+|[:;.,!?\u2011\u2013\u2014-]|[\s]+|[%°€$])/g;
    
    // Create a non-overlapping segmentation
    let prevEnd = 0;
    let match;
    
    while ((match = pattern.exec(text)) !== null) {
      const segment = match[0];
      const index = match.index;
      
      // Skip invalid segments or already processed positions
      if (!segment || processedPositions.has(index)) continue;
      
      // Track all positions in this segment to avoid duplicates
      for (let i = 0; i < segment.length; i++) {
        processedPositions.set(index + i, true);
      }
      
      // Update prevEnd to ensure no gaps or overlaps
      prevEnd = index + segment.length;
      
      // Enhanced classification with proper punctuation handling
      const isWordLike = /\w/.test(segment);
      const isSpace = /^\s+$/.test(segment);
      // Enhanced special character and punctuation detection including non-breaking hyphen (U+2011)
      const isSpecialChar = /^[%°€$]$/.test(segment);
      const isPunctuation = /^[:;.,!?\-–—\u2011\u2013\u2014]$/.test(segment);
      
      segments.push({
        segment,
        index,
        // Treat both special chars and punctuation as word-like for consistent processing
        isWordLike: isWordLike || isSpecialChar || isPunctuation,
        isSpace,
        isPunctuation,
        input: text
      });
    }
    
    // Process consecutive special characters
    segments = handleConsecutiveSpecialChars(segments, text);
    
    return segments;
  }
}

interface ProcessOptions {
  enableLocalization?: boolean;
}

// Process text for line-breaking based on locale-specific rules
export async function processTextForLineBreaking(text: string, locale = "en", options: ProcessOptions = { enableLocalization: true }): Promise<WordMetric[]> {
  try {
    // Input validation
    if (!text || typeof text !== 'string') {
      console.warn('Invalid text input for processTextForLineBreaking:', text);
      return [];
    }
    
    // If localization is disabled, provide basic line breaking metrics
    if (options.enableLocalization === false) {
      console.log('[processTextForLineBreaking] Localization disabled, using basic line breaks');
      
      // Split by spaces to get basic words
      const words = text.split(/\s+/);
      
      // Create basic word metrics with all line breaks allowed (except last word)
      const basicMetrics = words.map((word, index) => ({
        text: word,
        lineBreaking: index === words.length - 1 ? 'avoid' : 'allow',
        boundary: {
          start: text.indexOf(word),
          end: text.indexOf(word) + word.length
        }
      }));
      
      return basicMetrics;
    }
    
    // Get text segments
    const segments = await segmentText(text, locale);
    
    // Validate segments
    if (!segments || !Array.isArray(segments) || segments.length === 0) {
      console.warn('No valid segments returned from segmentText');
      return [];
    }
    
    // Process consecutive special characters
    const enhancedSegments = handleConsecutiveSpecialChars(segments, text);
    
    // Get locale-specific rules
    const rulesConfig = (ruleEngine as any)[locale] || {};

    // Filter out invalid segments before processing
    const validSegments = enhancedSegments.filter(seg => 
      seg && typeof seg === 'object' && 
      (seg.isWordLike !== undefined || seg.segment !== undefined)
    );
    
    if (validSegments.length === 0) {
      console.warn('No valid segments found after filtering');
      return [];
    }

    // Apply line breaking rules and get annotations
    const lineBreakingAnnotations = annotateLineBreakingWithSeparators(validSegments, rulesConfig);
    // Cast the result of segmentsToWordMetrics to our WordMetric[] type
    let wordMetricsArray: WordMetric[] = segmentsToWordMetrics(validSegments, text, lineBreakingAnnotations as any) as any;
    
    // Special direct check for Smart-home compound in the text
    if (locale === 'de' && text.toLowerCase().includes('smart-home')) {
      // Find all occurrences of Smart, hyphen and home in the wordMetricsArray
      for (let i = 0; i < wordMetricsArray.length; i++) {
        const metric = wordMetricsArray[i];
        if (metric.text && 
            (metric.text.toLowerCase() === 'smart' || 
             metric.text === '-' || 
             metric.text.toLowerCase() === 'home')) {
          metric.lineBreaking = 'avoid';
        }
      }
    }
    
    // Additional check for rules about avoiding breaks before punctuation, articles, and prepositions
    if (rulesConfig.rules?.avoidBreakBefore) {
      // Get list of punctuation, articles, and prepositions from rules
      const punctuation = rulesConfig.punctuation || [];
      const articles = (rulesConfig.functionWords || []).filter((w: string) => w.length <= 3); // Simple heuristic for articles
      const prepositions = rulesConfig.prepositions || [];
      
      // Check each word metric against the rules
      for (let i = 0; i < wordMetricsArray.length - 1; i++) {
        const currWord = wordMetricsArray[i];
        const nextWord = wordMetricsArray[i + 1];
        
        // Skip if either is not a valid text
        if (!currWord.text || !nextWord.text) {
          continue;
        }
        
        // Check if next word is punctuation and the rule is active
        if (rulesConfig.rules.avoidBreakBefore.includes('punctuation') &&
            punctuation.includes(nextWord.text)) {
          currWord.lineBreaking = 'avoid';
        }
        
        // Check if next word is an article and the rule is active
        if (rulesConfig.rules.avoidBreakBefore.includes('articles') &&
            articles.includes(nextWord.text.toLowerCase())) {
          currWord.lineBreaking = 'avoid';
        }
        
        // Check if next word is a preposition and the rule is active
        if (rulesConfig.rules.avoidBreakBefore.includes('prepositions') &&
            prepositions.includes(nextWord.text.toLowerCase())) {
          currWord.lineBreaking = 'avoid';
        }
      }
    }
    
    // This handles hyphenated words
    if (rulesConfig.fixedExpressions && Array.isArray(rulesConfig.fixedExpressions)) {
      const fullText = wordMetricsArray.map(m => m.text).join('');
      for (const expr of rulesConfig.fixedExpressions) {
        if (typeof expr === 'string' && (expr.includes('\u2011') || expr === 'E‑Mail')) {
          if (fullText.includes(expr)) {
            // Find the word metrics that match the expression
            for (let i = 0; i < wordMetricsArray.length; i++) {
              const metric = wordMetricsArray[i];
              if (metric.text === 'E' || metric.text === 'Mail' || 
                  metric.text === expr || metric.text.includes('\u2011')) {
                metric.lineBreaking = 'avoid';
              }
            }
          }
        }
        
        // Special handling for Smart-home
        if (typeof expr === 'string' && expr === 'Smart-home') {
          // Look for both exact match and case-insensitive match
          if (fullText.includes('Smart-home') || fullText.toLowerCase().includes('smart-home')) {
            // Find and mark Smart, hyphen, and home parts
            for (let i = 0; i < wordMetricsArray.length; i++) {
              const metric = wordMetricsArray[i];
              if (metric.text.toLowerCase() === 'smart' || 
                  metric.text === '-' || 
                  metric.text.toLowerCase() === 'home') {
                metric.lineBreaking = 'avoid';
                // Set a flag for special handling
                metric._isSmartHomeCompound = true;
              }
            }
          }
        }
      }
      
      // Look for parts of hyphenated expressions with regular hyphens
      for (let i = 0; i < wordMetricsArray.length - 1; i++) {
        const currWord = wordMetricsArray[i];
        const nextWord = wordMetricsArray[i + 1];
        
        // Skip if either is a space
        if (currWord.text.trim() === '' || nextWord.text.trim() === '') {
          continue;
        }
        
        // Check against fixed expressions that have hyphens
        for (const expr of rulesConfig.fixedExpressions) {
          if (typeof expr === 'string' && expr.includes('-')) {
            const [first, second] = expr.split('-');
            
            // Check for a match with the parts of the hyphenated expression
            if (currWord.text.toLowerCase() === first.toLowerCase() && 
                nextWord.text.toLowerCase() === second.toLowerCase()) {
                      // Mark both parts with avoid line breaking
              currWord.lineBreaking = 'avoid';
              nextWord.lineBreaking = 'avoid';
            }
          }
        }
      }
    }
    
    // Apply special handling for Apple service names in all locales
    if (rulesConfig.appleServices) {
      // Detect Apple service names in text
      const fullText = wordMetricsArray.map(m => m.text).join('');
      
      for (const appleService of rulesConfig.appleServices) {
        // Case-insensitive search
        const serviceLower = appleService.toLowerCase();
        const textLower = fullText.toLowerCase();
        
        // Check if the service name appears in the text
        if (textLower.includes(serviceLower)) {
          // Find the starting position of the service name in the text
          const servicePos = textLower.indexOf(serviceLower);
          const serviceEndPos = servicePos + serviceLower.length;
          
          // Mark all word metrics that overlap with the service name position
          for (let i = 0; i < wordMetricsArray.length; i++) {
            const metric = wordMetricsArray[i];
            
            // Check if this metric is within the service name range
            if (metric.boundary) {
              if ((metric.boundary.start >= servicePos && metric.boundary.start < serviceEndPos) || 
                  (metric.boundary.end > servicePos && metric.boundary.end <= serviceEndPos)) {
                wordMetricsArray[i].lineBreaking = 'avoid';
                wordMetricsArray[i]._partOfAppleService = appleService;
              }
            }
          }
        }
      }
    }
    
    // Apply special handling for game names in all locales
    if (rulesConfig.appGameNames) {
      // Detect game names in text
      const fullText = wordMetricsArray.map(m => m.text).join('');
      
      for (const gameName of rulesConfig.appGameNames) {
        // Case-insensitive search
        const gameLower = gameName.toLowerCase();
        const textLower = fullText.toLowerCase();
        
        // Check if the game name appears in the text
        if (textLower.includes(gameLower)) {
          // Find the starting position of the game name in the text
          const gamePos = textLower.indexOf(gameLower);
          const gameEndPos = gamePos + gameLower.length;
          
          // Mark all word metrics that overlap with the game name position
          for (let i = 0; i < wordMetricsArray.length; i++) {
            const metric = wordMetricsArray[i];
            
            // Check if this metric is within the game name range
            if (metric.boundary) {
              if ((metric.boundary.start >= gamePos && metric.boundary.start < gameEndPos) || 
                  (metric.boundary.end > gamePos && metric.boundary.end <= gameEndPos)) {
                wordMetricsArray[i].lineBreaking = 'avoid';
                wordMetricsArray[i]._partOfGameName = gameName;
              }
            }
          }
        }
      }
    }
    
    // Validate before applying additional rules
    if (!wordMetricsArray || !Array.isArray(wordMetricsArray)) {
      console.warn('Invalid word metrics array after initial processing');
      return [];
    }
    
    // Filter out any invalid metrics
    wordMetricsArray = wordMetricsArray.filter(
      metric => metric && typeof metric === 'object' && typeof metric.text === 'string'
    );
    
    // Apply additional segmentation rules to identify line-breaking constraints
    wordMetricsArray = annotateLineBreakingWithSeparators(wordMetricsArray as any, rulesConfig) as any;
    
    // Check for rule violations (can be used for validation or debugging)
    if (rulesConfig.rules && typeof applySegmentationRules === "function") {
      applySegmentationRules(wordMetricsArray, rulesConfig);
    }
  
    return wordMetricsArray;
  } catch (error) {
    console.error('Error in processTextForLineBreaking:', error);
    return [];
  }
}

// Get line breaking rules for a specific locale
export function getLineBreakingRules(locale: string) {
  return (ruleEngine as any)[locale] || null;
}
