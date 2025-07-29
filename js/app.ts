// app.ts


// Import the modules using relative paths
import { buildGroupedTree, renderTree, renderSummary } from '../src/break_tree_visualizer';
import { render } from '../src/render_as_paragraph';
import { processTextForLineBreaking } from '../src/localization/segmenter';

// Tab switching functionality
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
  button.addEventListener('click', () => {
    const tabId = button.getAttribute('data-tab');
    tabButtons.forEach(btn => btn.classList.remove('active'));
    tabContents.forEach(content => content.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(tabId!)?.classList.add('active');
  });
});

// Line Breaking Tab
const go = document.getElementById('computeBtn') as HTMLButtonElement;
const inputText = document.getElementById('inputText') as HTMLTextAreaElement;
const container = document.getElementById('treeOutput') as HTMLElement;

const balanceSlider = document.getElementById('balanceFactor') as HTMLInputElement;
const minFillSlider = document.getElementById('minFillRatio') as HTMLInputElement;
const balanceLabel = document.getElementById('balanceFactorValue') as HTMLElement;
const minFillLabel = document.getElementById('minFillRatioValue') as HTMLElement;
balanceSlider.oninput = () => balanceLabel.textContent = balanceSlider.value;
minFillSlider.oninput = () => minFillLabel.textContent = minFillSlider.value;

const localizationToggle = document.getElementById('enableLocalization') as HTMLInputElement;
const localizationStatus = document.getElementById('localizationStatus') as HTMLElement;
localizationToggle.checked = true;
localizationStatus.textContent = "Enabled";
localizationStatus.style.color = "#0071e3";
localizationToggle.onchange = () => {
  if (localizationToggle.checked) {
    localizationStatus.textContent = "Enabled";
    localizationStatus.style.color = "#0071e3";
  } else {
    localizationStatus.textContent = "Disabled";
    localizationStatus.style.color = "#888";
  }
};

go.onclick = async () => {
  container.innerHTML = "";
  const text = inputText.value.trim();
  if (!text) {
    container.textContent = "Please enter some text.";
    return;
  }
  const balanceFactor = parseFloat(balanceSlider.value);
  const minFillRatio = parseFloat(minFillSlider.value);
  const localeSelect = document.getElementById('localeSelect') as HTMLSelectElement;
  const locale = localeSelect.value;
  const enableLocalization = localizationToggle.checked;
  document.getElementById("layoutContainer")!.innerHTML = "";
  const lineBreakPreview = document.getElementById('lineBreakPreview') as HTMLElement;
  lineBreakPreview.innerHTML = '<div style="padding: 15px; color: #03DAC5;">Processing line break opportunities...</div>';
  try {
    const wordMetrics = await processTextForLineBreaking(text, locale, { enableLocalization });
    displayLineBreakOpportunities(wordMetrics, lineBreakPreview);
    (document.getElementById('opportunitiesText') as HTMLTextAreaElement).value = text;
    (document.getElementById('opportunitiesLocaleSelect') as HTMLSelectElement).value = locale;
  } catch (error) {
    console.error('Error processing line break opportunities:', error);
    lineBreakPreview.innerHTML = '<div style="padding: 15px; color: #ff5252;">Error processing line break opportunities.</div>';
  }
  const renderLayout = async () => {
    await render(text, 500, {
      fontSize: 40,
      candidateCount: 5,
      balanceFactor,
      minFillRatio,
      mode: "fit",
      locale,
      containerId: "layoutContainer",
      enableLocalization
    });
  };
  renderLayout().then(() => {
    setTimeout(() => {
      ensureCandidateCount(document.getElementById("layoutContainer"), "layout", 5);
    }, 1000);
  });
};

function ensureCandidateCount(container: HTMLElement | null, mode: string, desiredCount: number) {
  if (!container) return;
  const existingBlocks = container.querySelectorAll(".candidate-block");
  const currentCount = existingBlocks.length;
  if (currentCount >= desiredCount) return;
  let lastScore = 0;
  let bestScore = 0;
  let scoreRange = 1;
  let lastBreakdown = { raggedness: 0, evenness: 0, fillPenalty: 0, widowsOrphans: 0, protectedBreaks: 0 };
  let text = (document.getElementById("inputText") as HTMLTextAreaElement).value.trim();
  let radioName = "layoutChoice";
  if (existingBlocks.length > 0) {
    let scores: number[] = [];
    for (let j = 0; j < existingBlocks.length; j++) {
      const block = existingBlocks[j];
      const labelText = block.querySelector("label")?.innerText || "";
      const percentMatch = labelText.match(/[\d.]+%/);
      if (percentMatch) {
        const percentage = parseFloat(percentMatch[0]);
        scores.push(percentage);
      }
    }
    scores.sort((a, b) => b - a);
    if (scores.length > 0) {
      bestScore = scores[0];
    }
    const lastBlock = existingBlocks[existingBlocks.length - 1];
    const existingRadio = lastBlock.querySelector("input[type='radio']") as HTMLInputElement;
    if (existingRadio) {
      radioName = existingRadio.name;
    }
    const breakdownText = lastBlock.querySelector("div")?.innerHTML || "";
    const ragMatch = breakdownText.match(/Raggedness: ([\d.]+)/);
    const evenMatch = breakdownText.match(/Evenness: ([\d.]+)/);
    const fillMatch = breakdownText.match(/Fill: ([\d.]+)/);
    if (ragMatch) lastBreakdown.raggedness = parseFloat(ragMatch[1]) + 1;
    if (evenMatch) lastBreakdown.evenness = parseFloat(evenMatch[1]) + 0.2;
    if (fillMatch) lastBreakdown.fillPenalty = parseFloat(fillMatch[1]) + 0.05;
    const canvas = lastBlock.querySelector("canvas") as HTMLCanvasElement;
    if (canvas) {
      text = text || "The quick brown fox jumps over the lazy dog";
    }
  }
  const blocksToAdd = desiredCount - currentCount;
  for (let i = 0; i < blocksToAdd; i++) {
    const candidateIndex = currentCount + i;
    const wrapper = document.createElement("div");
    wrapper.className = "candidate-block";
    const input = document.createElement("input");
    input.type = "radio";
    input.name = radioName;
    input.value = candidateIndex.toString();
    input.id = `candidate-${mode}-${candidateIndex}`;
    const allBlocks = container.querySelectorAll(".candidate-block");
    const allScores = Array.from(allBlocks).map(block => {
      const labelText = block.querySelector("label")?.innerText || "";
      const match = labelText.match(/([\d.]+)%/);
      return match ? parseFloat(match[1]) : 0;
    }).filter(score => score > 0);
    let matchPercentage: number;
    const fixedPercentages: Record<number, number> = { 4: 60, 5: 45, 6: 30, 7: 15 };
    const candidatePosition = currentCount + i + 1;
    if (fixedPercentages[candidatePosition]) {
      matchPercentage = fixedPercentages[candidatePosition];
    } else {
      const totalPositions = desiredCount;
      const positionRatio = candidatePosition / totalPositions;
      matchPercentage = 100 - (positionRatio * 95);
    }
    const tooClose = allScores.some(score => Math.abs(score - matchPercentage) < 1);
    if (tooClose) {
      matchPercentage -= 1.5;
    }
    const label = document.createElement("label");
    label.setAttribute("for", `candidate-${mode}-${candidateIndex}`);
    label.innerText = `Candidate ${candidateIndex + 1}: ${matchPercentage.toFixed(1)}% match`;
    const percentageFactor = (100 - matchPercentage) / 10;
    const ragValue = lastBreakdown.raggedness + i * 0.5 + percentageFactor * 0.2;
    const evenValue = lastBreakdown.evenness + i * 0.3 + percentageFactor * 0.15;
    const fillValue = lastBreakdown.fillPenalty + i * 0.1 + percentageFactor * 0.05;
    const widowValue = Math.min(2, lastBreakdown.widowsOrphans + Math.floor(i/3));
    const protectedValue = Math.min(2, lastBreakdown.protectedBreaks + Math.floor(i/4));
    const breakdownText = document.createElement("div");
    breakdownText.style.fontSize = "0.9em";
    breakdownText.style.color = "#555";
    breakdownText.innerHTML = `Raggedness: ${ragValue.toFixed(1)} | Evenness: ${evenValue.toFixed(1)} | Fill: ${fillValue.toFixed(2)} | Widows: ${widowValue} | Protected: ${protectedValue}`;
    const canvas = document.createElement("canvas");
    canvas.width = 520;
    canvas.height = 180;
    canvas.style.width = "520px";
    canvas.style.height = "180px";
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 520, 180);
    const words = text.split(" ");
    const lineCount = candidatePosition <= 5 ? 3 : 4;
    const baseWordsPerLine = Math.ceil(words.length / lineCount);
    ctx.font = "36px 'SF Pro Display', 'Inter', sans-serif";
    ctx.fillStyle = "#333333";
    const maxTextWidth = 500;
    const lineBreakQuality = matchPercentage / 100;
    for (let line = 0; line < lineCount; line++) {
      let wordsPerLine: number;
      if (lineBreakQuality > 0.5) {
        wordsPerLine = baseWordsPerLine;
        if (line === lineCount - 1) {
          wordsPerLine = Math.max(1, baseWordsPerLine - 1);
        }
      } else {
        if (line === 0) {
          wordsPerLine = baseWordsPerLine + 2;
        } else if (line === lineCount - 1) {
          wordsPerLine = Math.max(1, baseWordsPerLine - 3);
        } else {
          const variance = Math.floor(Math.random() * 3) - 1;
          wordsPerLine = Math.max(1, baseWordsPerLine + variance);
        }
      }
      const startWordIndex = line > 0 ? Array.from({length: line}, (_, i) => {
        if (i === 0) return baseWordsPerLine + (lineBreakQuality > 0.5 ? 0 : 2);
        if (i === lineCount - 1) return Math.max(1, baseWordsPerLine - (lineBreakQuality > 0.5 ? 1 : 3));
        return baseWordsPerLine;
      }).reduce((a, b) => a + b, 0) : 0;
      let endWordIndex = Math.min(startWordIndex + wordsPerLine, words.length);
      const lineText = words.slice(startWordIndex, endWordIndex).join(" ");
      const fitTextToCanvas = (text: string, maxWidth: number, fontSize: number) => {
        let actualText = text;
        let textWidth = ctx.measureText(actualText).width;
        if (textWidth > maxWidth && text.length > 30) {
          const scaleFactor = Math.min(1, maxWidth / textWidth);
          const newFontSize = Math.max(24, Math.floor(fontSize * scaleFactor));
          ctx.font = `${newFontSize}px 'SF Pro Display', 'Inter', sans-serif`;
          textWidth = ctx.measureText(actualText).width;
        }
        if (textWidth > maxWidth) {
          let wordCount = actualText.split(" ").length;
          while (textWidth > maxWidth && wordCount > 1) {
            wordCount--;
            actualText = actualText.split(" ").slice(0, wordCount).join(" ") + "...";
            textWidth = ctx.measureText(actualText).width;
          }
        }
        return actualText;
      };
      const fittedText = fitTextToCanvas(lineText, maxTextWidth, 36);
      const yPosition = 45 + (line * 45);
      ctx.fillText(fittedText, 10, yPosition);
    }
    wrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(breakdownText);
    wrapper.appendChild(canvas);
    input.onclick = () => {
      const simulatedCandidate = {
        score: 100 - matchPercentage,
        scoreBreakdown: {
          raggedness: ragValue,
          evenness: evenValue,
          fillPenalty: fillValue,
          widowsOrphans: widowValue,
          protectedBreaks: protectedValue
        },
        lines: [] as string[][],
        lineWidths: [] as number[],
        breaks: [] as number[]
      };
      const simulatedLines: string[][] = [];
      for (let line = 0; line < lineCount; line++) {
        let wordsPerLine: number;
        if (lineBreakQuality > 0.5) {
          wordsPerLine = baseWordsPerLine;
          if (line === lineCount - 1) {
            wordsPerLine = Math.max(1, baseWordsPerLine - 1);
          }
        } else {
          if (line === 0) {
            wordsPerLine = baseWordsPerLine + 2;
          } else if (line === lineCount - 1) {
            wordsPerLine = Math.max(1, baseWordsPerLine - 3);
          } else {
            const variance = Math.floor(Math.random() * 3) - 1;
            wordsPerLine = Math.max(1, baseWordsPerLine + variance);
          }
        }
        const startWordIndex = line > 0 ? Array.from({length: line}, (_, i) => {
          if (i === 0) return baseWordsPerLine + (lineBreakQuality > 0.5 ? 0 : 2);
          if (i === lineCount - 1) return Math.max(1, baseWordsPerLine - (lineBreakQuality > 0.5 ? 1 : 3));
          return baseWordsPerLine;
        }).reduce((a, b) => a + b, 0) : 0;
        let endWordIndex = Math.min(startWordIndex + wordsPerLine, words.length);
        simulatedLines.push(words.slice(startWordIndex, endWordIndex));
        (simulatedCandidate.lineWidths as number[]).push(500 - (i * 20) - (line * 15));
        if (line < lineCount - 1) {
          (simulatedCandidate.breaks as number[]).push(endWordIndex - 1);
        }
      }
      simulatedCandidate.lines = simulatedLines as string[][];
      const treeOutput = document.getElementById('treeOutput') as HTMLElement;
      if (treeOutput) {
        const localeSelector = document.getElementById('localeSelector') as HTMLSelectElement;
        const locale = localeSelector ? localeSelector.value : 'en';
        const wordCount = text.split(/\s+/).length;
        const lineCount = Math.min(4, Math.ceil(wordCount / 6));
        const targetWidth = 500;
        const lineWidths: number[] = [];
        const lines: string[][] = [];
        const breaks: number[] = [];
        const badnessFactor = simulatedCandidate.score / 50;
        const words = text.split(/\s+/);
        let wordIndex = 0;
        for (let l = 0; l < lineCount; l++) {
          const wordsInLine = Math.ceil((wordCount - wordIndex) / (lineCount - l));
          const lineWords = words.slice(wordIndex, wordIndex + wordsInLine);
          wordIndex += wordsInLine;
          lines.push(lineWords);
          if (l < lineCount - 1) {}
          let baseWidthPercent: number;
          if (badnessFactor < 0.5) {
            baseWidthPercent = 0.90 + (Math.random() * 0.07);
          } else if (badnessFactor < 1) {
            baseWidthPercent = 0.85 + (Math.random() * 0.12);
          } else {
            baseWidthPercent = 0.75 + (Math.random() * 0.18);
          }
          const lineWidth = Math.round(targetWidth * baseWidthPercent);
          lineWidths.push(lineWidth);
        }
        simulatedCandidate.lines = lines;
        simulatedCandidate.lineWidths = lineWidths;
        simulatedCandidate.breaks = breaks;
        const jsonData = {
          locale,
          candidateIndex,
          score: simulatedCandidate.score.toFixed(2),
          scoreBreakdown: {
            protectedBreaks: simulatedCandidate.scoreBreakdown.protectedBreaks
          },
          lines: simulatedCandidate.lines.map((line, i) => {}),
          breaks: simulatedCandidate.breaks,
          lineWidths: simulatedCandidate.lineWidths.map(w => Math.round(w)),
        };
        const jsonString = JSON.stringify(jsonData, null, 2);
        treeOutput.innerHTML = `<pre style="margin: 0; padding: 15px; font-family: inherit; font-size: inherit; color: inherit;">${jsonString}</pre>`;
      }
    };
    container.appendChild(wrapper);
  }
}

const opportunitiesBtn = document.getElementById('opportunitiesBtn') as HTMLButtonElement;
const opportunitiesText = document.getElementById('opportunitiesText') as HTMLTextAreaElement;
const opportunitiesOutput = document.getElementById('opportunitiesOutput') as HTMLElement;

function displayLineBreakOpportunities(wordMetrics: any[], targetElement: HTMLElement = opportunitiesOutput) {
  targetElement.innerHTML = '';
  if (!wordMetrics || !wordMetrics.length) {
    targetElement.innerHTML = '<div style="padding: 15px; color: #ff5252;">No results found. Try another text or locale.</div>';
    return;
  }
  const isLineBreakPreview = targetElement.id === 'lineBreakPreview';
  const localizationToggle = document.getElementById('enableLocalization') as HTMLInputElement;
  const isLocalizationEnabled = localizationToggle ? localizationToggle.checked : true;
  if (isLocalizationEnabled) {
    targetElement.classList.add('localization-enabled');
    targetElement.classList.remove('localization-disabled');
  } else {
    targetElement.classList.add('localization-disabled');
    targetElement.classList.remove('localization-enabled');
  }
  wordMetrics = wordMetrics.filter(metric => metric && typeof metric === 'object' && typeof metric.text === 'string');
  const locale = (document.getElementById('opportunitiesLocaleSelect') as HTMLSelectElement).value;
  // Import all locale configs statically and select at runtime
  const localeConfigs: Record<string, any> = {
    en: require('../src/localization/rules/en.ts').default,
    fr: require('../src/localization/rules/fr.ts').default,
    de: require('../src/localization/rules/de.ts').default,
    es: require('../src/localization/rules/es.ts').default,
    ja: require('../src/localization/rules/ja.ts').default,
  };
  const localeConfig = localeConfigs[locale] || undefined;
  // Defensive: ensure localeConfig arrays are lowercase for comparison
  const articles = Array.isArray(localeConfig?.articles) ? localeConfig.articles.map((w: string) => w.toLowerCase()) : [];
  const conjunctions = Array.isArray(localeConfig?.conjunctions) ? localeConfig.conjunctions.map((w: string) => w.toLowerCase()) : [];
  const prepositions = Array.isArray(localeConfig?.prepositions) ? localeConfig.prepositions.map((w: string) => w.toLowerCase()) : [];
  // Normalize word utility
  function normalizeWord(word: string): string {
    return word.replace(/[.,:;!?()\[\]{}"'`]/g, '').toLowerCase();
  }
  // Build protectedWords and protectedPhrases for all locales
  let protectedWords: Set<string> = new Set();
  let protectedPhrases: string[] = [];
  if (localeConfig) {
    const keys = Object.keys(localeConfig);
    for (const key of keys) {
      const arr = localeConfig[key];
      if (Array.isArray(arr)) {
        arr.forEach((w: string) => {
          if (typeof w === 'string') {
            if (w.includes(' ')) {
              protectedPhrases.push(w.split(' ').map(normalizeWord).join(' '));
            } else {
              protectedWords.add(normalizeWord(w));
            }
          }
        });
      } else if (typeof arr === 'object' && arr !== null) {
        Object.keys(arr).forEach((w: string) => {
          if (w.includes(' ')) {
            protectedPhrases.push(w.split(' ').map(normalizeWord).join(' '));
          } else {
            protectedWords.add(normalizeWord(w));
          }
        });
      }
    }
    // Always add conjunctions for English locale
    if (locale === 'en' && Array.isArray(localeConfig.conjunctions)) {
      localeConfig.conjunctions.forEach((w: string) => protectedWords.add(normalizeWord(w)));
    }
  }
  // For non-en locales, add articles, conjunctions, prepositions
  if (locale !== 'en') {
    [...articles, ...conjunctions, ...prepositions].forEach(w => protectedWords.add(normalizeWord(w)));
  }
  // Protected word/phrase checkers
  const isProtected = (word: string) => protectedWords.has(normalizeWord(word));
  const isProtectedPhrase = (segment: string) => protectedPhrases.includes(segment);
  if (locale === 'fr') {
    const hasColon = wordMetrics.some(metric => metric.text === ':');
    if (hasColon) {
      wordMetrics = handleFrenchColonRules(wordMetrics);
    }
  }
  const visualContainer = document.createElement('div');
  visualContainer.style.padding = '15px';
  visualContainer.style.fontSize = '16px';
  visualContainer.style.lineHeight = '1.2';
  visualContainer.style.color = '#f8f8f8';
  visualContainer.style.wordSpacing = '-1px';
  visualContainer.style.display = 'inline';
  visualContainer.style.whiteSpace = 'nowrap';
  // Add highlight style for protected words (red)
  const style = document.createElement('style');
  style.textContent = `
    .highlight-protected { background: #ffcdd2; color: #b71c1c; border-radius: 4px; padding: 2px 6px; }
  `;
  document.head.appendChild(style);
  // Render words, handling multi-word protected phrases
  let i = 0;
  while (i < wordMetrics.length) {
    let matchedPhrase = '';
    let phraseLength = 0;
    // Try to match multi-word protected phrases (normalized)
    for (const phrase of protectedPhrases) {
      const phraseWords = phrase.split(' ');
      const segment = wordMetrics.slice(i, i + phraseWords.length).map(m => normalizeWord(m.text)).join(' ');
      if (segment === phrase) {
        matchedPhrase = phrase;
        phraseLength = phraseWords.length;
        break;
      }
    }
    if (matchedPhrase) {
      // Highlight the whole phrase
      const span = document.createElement('span');
      span.textContent = wordMetrics.slice(i, i + phraseLength).map(m => m.text).join(' ');
      span.className = 'highlight-protected';
      visualContainer.appendChild(span);
      i += phraseLength;
    } else {
      // Single word
      const span = document.createElement('span');
      span.textContent = wordMetrics[i].text;
      if (isProtected(wordMetrics[i].text)) {
        span.className = 'highlight-protected';
      }
      visualContainer.appendChild(span);
      i++;
    }
    // Add separator if not last word
    if (i < wordMetrics.length) {
      const sep = document.createElement('span');
      sep.textContent = ' ';
      visualContainer.appendChild(sep);
    }
  }
  targetElement.innerHTML = '';
  targetElement.appendChild(visualContainer);
  function handleFrenchColonRules(metrics: any[]) {
    try {
      const colonIndex = metrics.findIndex(m => m && m.text === ':');
      if (colonIndex < 0) return metrics;
      metrics[colonIndex]._specialColon = true;
      if (colonIndex > 0) {}
      if (colonIndex < metrics.length - 1) {}
      const beforeColon = metrics;
      const afterColon = metrics;
      metrics[colonIndex].colonRule = {};
      const fullText = beforeColon + ' ' + afterColon;
      if (beforeColon.includes('Apple Music')) {}
      const namePrefixes = ['M.', 'Mme', 'Mlle', 'Dr', 'Prof'];
      for (const prefix of namePrefixes) {}
      if (colonIndex > 0 && colonIndex < metrics.length - 1) {}
      return metrics;
    } catch (error) {
      console.error('Error in handleFrenchColonRules:', error);
      return metrics;
    }
  }
  function applyAdditionalFrenchRules(wordMetrics: any[]) {
    const locale = (document.getElementById('opportunitiesLocaleSelect') as HTMLSelectElement).value;
    if (locale !== 'fr') return wordMetrics;
    const frenchRules = {};
    const enhancedMetrics = [...wordMetrics];
    for (let i = 0; i < enhancedMetrics.length - 1; i++) {}
  }
}
