# CanvasKit with Localization Integration

This project integrates CanvasKit's line-breaking capabilities with a localization rules engine to provide language-aware text layout. The localization module provides culturally appropriate line-breaking rules and constraints for various languages.

## Features

- **Language-Specific Line Breaking**: Follow language-specific typographic rules
- **Localization Rules**: Support for special rules in different languages:
  - French, German, Spanish, Japanese, Chinese, Thai, Korean
- **Visual Testing**: Interactive UI to test line-breaking with different locales
- **Rule Checking**: Automatic validation against language-specific constraints

## Code Improvements

The codebase has been enhanced with:

- **Comprehensive Documentation**: Detailed JSDoc comments for all functions
- **Removed Hardcoded Values**: Configuration values extracted to constants
- **Better Organization**: Code structured for improved maintainability
- **Improved Error Handling**: More robust checks and validations

## Project Structure

```
CanvasKit/
├── index.html              # Main demo UI with locale selector
├── package.json            # Project dependencies
├── vite.config.js          # Vite configuration
├── test-localization.js    # Test script for localization features
├── src/
│   ├── break_tree_visualizer.js   # Visualization of line breaks
│   ├── optimize_linebreaks.ts     # Line breaking algorithm
│   ├── render_as_paragraph.js     # Text rendering with CanvasKit
│   ├── localized_line_breaking.js # Integration of localization with line breaking
│   └── localization/              # Localization module
│       ├── segmenter.js           # Text segmentation by locale
│       ├── segmenterUtils.js      # Utilities for segmentation
│       ├── ruleEngine.js          # Rules processing engine
│       ├── testData.js            # Test cases for various languages
│       └── rules/                 # Language-specific rules
│           ├── de.js              # German rules
│           ├── es.js              # Spanish rules
│           ├── fr.js              # French rules
│           ├── ja.js              # Japanese rules
│           └── ruleConfigs.js     # Rules configuration index
```

## Running the Project

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Test localization capabilities:
   ```
   npm run test:localization
   ```

## Usage

### In the Demo UI
1. Enter text in the input field
2. Select a locale from the dropdown
3. Click "Compute Breaks" to see the line-breaking results

### In Your Code
```javascript
import { render } from './src/render_as_paragraph.js';

// Render text with locale-specific line breaking
render('これは改行ポイントを見つけるためのテストです。', 400, {
  fontSize: 36,
  locale: 'ja'  // Specify the locale
});

// Using just the localization module
import { processTextForLineBreaking } from './src/localization/segmenter.js';

async function example() {
  const text = "Jean-Luc Godard revient avec un film culte.";
  const locale = "fr";
  
  // Get word metrics with line-breaking constraints
  const wordMetrics = await processTextForLineBreaking(text, locale);
  
  // Use these metrics to make line-breaking decisions
}
```

## Adding New Languages

To add support for additional languages:
1. Create a new rule file in `src/localization/rules/`
2. Define language-specific rules and constraints
3. Add the language to `ruleConfigs.js`

## License

This project is licensed under the MIT License - see the LICENSE file for details.
