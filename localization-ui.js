/**
 * CanvasKit Line Breaking Visualization Tool
 * 
 * This file provides the interactive UI for visualizing line breaking opportunities
 * with localization support. It shows:
 * 
 * 1. Line break visualization for both "best fit" and "most uniform" layouts
 * 2. Word metrics with line breaking constraints (allow/avoid)
 * 3. JSON output with detailed information about line breaking decisions
 * 4. Statistics about constraint violations and line break quality
 * 
 * The visualization includes color coding and symbols:
 * - Green dashed border: Line break allowed after word
 * - Red solid border: Line break not allowed after word
 * - ⚠️ Symbol: Indicates a constraint violation (line break occurs where it should be avoided)
 * - ↵ Symbol: Indicates an actual line break point in the layout
 */

// Import necessary CanvasKit modules
import { enhanceWordMetricsWithLocalization } from './src/localized_line_breaking.js';
import { computeBreaks } from './src/optimize_linebreaks.js';
import { createLocalizedLineBreakOptimizer } from './src/localized_line_breaking.js';
import { processTextForLineBreaking } from './src/localization/segmenter.js';
import { buildGroupedTree, renderTree, renderSummary } from './src/break_tree_visualizer.js';
import { render } from './src/render_as_paragraph.js';

// Create localized optimizer
const localizedComputeBreaks = createLocalizedLineBreakOptimizer(computeBreaks);

// DOM Elements for Enhanced UI
const inputText = document.getElementById('input-text');
const localeSelect = document.getElementById('locale-select');
const widthInput = document.getElementById('width-input');
const balanceFactor = document.getElementById('balance-factor');
const balanceFactorValue = document.getElementById('balance-factor-value');
const minFillRatio = document.getElementById('min-fill-ratio');
const minFillRatioValue = document.getElementById('min-fill-ratio-value');
const analyzeBtn = document.getElementById('analyze-btn');
const bestFitVisualization = document.getElementById('best-fit-visualization');
const mostUniformVisualization = document.getElementById('most-uniform-visualization');
const wordMetricsContainer = document.getElementById('word-metrics-container');
const jsonOutputContainer = document.getElementById('json-output-container');
const candidatesContainer = document.getElementById('candidates-container');
const treeOutput = document.getElementById('tree-output');

// We now have a single UI structure with tabbed content

// Tab functionality for main tabs
const tabItems = document.querySelectorAll('.tab-item');
const tabContents = document.querySelectorAll('.main-tab-content');

tabItems.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.getAttribute('data-tab');
    
    // Remove active class from all tabs and contents
    tabItems.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    // Add active class to current tab and content
    tab.classList.add('active');
    document.getElementById(tabId).classList.add('active');
  });
});

// Default configuration
const CONFIG = {
  spaceWidth: 4,
  candidateCount: 5,
  balanceFactor: 0.5,
  minFillRatio: 0.7,
  fontSize: 16,
  fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif",
};

// Keep slider labels in sync
balanceFactor.oninput = () => {
  balanceFactorValue.textContent = balanceFactor.value;
  CONFIG.balanceFactor = parseFloat(balanceFactor.value);
};

minFillRatio.oninput = () => {
  minFillRatioValue.textContent = minFillRatio.value;
  CONFIG.minFillRatio = parseFloat(minFillRatio.value);
};

// Helper function to measure text width
function measureTextWidth(text, fontSize) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  context.font = `${fontSize}px ${CONFIG.fontFamily}`;
  return context.measureText(text).width;
}

// Helper function to create word metrics from text
function createWordMetrics(text) {
  const words = text.split(/\s+/);
  const wordWidths = words.map(word => measureTextWidth(word, CONFIG.fontSize));
  const spaceWidth = measureTextWidth(' ', CONFIG.fontSize);
  
  return {
    words,
    wordWidths,
    spaceWidth
  };
}

// Helper function to visualize line breaks with detailed word-level information
function visualizeLineBreaks(container, words, breaks, className, wordMetrics) {
  container.innerHTML = '';
  
  // Add info tooltip at the top
  const infoDiv = document.createElement('div');
  infoDiv.style.marginBottom = '15px';
  infoDiv.style.padding = '10px';
  infoDiv.style.backgroundColor = '#f5f5f5';
  infoDiv.style.borderRadius = '4px';
  infoDiv.style.border = '1px solid #ddd';
  infoDiv.innerHTML = `
    <strong>Line Break Visualization</strong>
    <p>Colored borders show where line breaks are allowed or avoided based on locale rules.</p>
  `;
  container.appendChild(infoDiv);

  // Statistics for constraint violations
  let violationCount = 0;
  
  // Process breaks into lines
  let currentLineIndex = 0;
  let currentWords = [];
  const lines = [];
  
  words.forEach((word, i) => {
    currentWords.push({
      word: word,
      index: i,
      isBreak: (breaks.indexOf(i) !== -1),
      metric: wordMetrics[i] || { lineBreaking: 'allow' } // Default to allow if no metric
    });
    
    if (breaks.indexOf(i) !== -1) {
      lines.push(currentWords);
      currentWords = [];
      currentLineIndex++;
    }
  });
  
  // Add remaining words as the last line
  if (currentWords.length > 0) {
    lines.push(currentWords);
  }
  
  // Render each line
  lines.forEach((lineWords, lineIndex) => {
    const lineDiv = document.createElement('div');
    lineDiv.className = `line ${className}-line`;
    
    lineWords.forEach((item, wordIndex) => {
      const wordSpan = document.createElement('span');
      wordSpan.className = 'word';
      
      // Add appropriate class based on line breaking constraints
      const metric = item.metric;
      if (metric) {
        // Brand name check
        if (metric.isBrandName) {
          wordSpan.classList.add('brand-name');
        } 
        // Line breaking constraint
        else if (metric.lineBreaking === 'avoid') {
          wordSpan.classList.add('avoid-break');
          
          // Check for constraint violation
          if (item.isBreak) {
            wordSpan.innerHTML = `${item.word}<span style="color: red; font-weight: bold;">⚠️</span>`;
            violationCount++;
          } else {
            wordSpan.textContent = item.word;
          }
        } else {
          wordSpan.classList.add('allow-break');
          wordSpan.textContent = item.word;
        }
      } else {
        // Default to allow if no metric
        wordSpan.classList.add('allow-break');
        wordSpan.textContent = item.word;
      }
      
      // Add line break indicator
      if (item.isBreak) {
        const breakIndicator = document.createElement('span');
        breakIndicator.textContent = ' ↵';
        breakIndicator.className = 'linebreak-marker';
        wordSpan.appendChild(breakIndicator);
      }
      
      lineDiv.appendChild(wordSpan);
      
      // Add space between words
      if (wordIndex < lineWords.length - 1) {
        const space = document.createElement('span');
        space.innerHTML = '&nbsp;';
        lineDiv.appendChild(space);
      }
    });
    
    container.appendChild(lineDiv);
  });
  
  // Add statistics
  const statsDiv = document.createElement('div');
  statsDiv.style.marginTop = '15px';
  statsDiv.style.padding = '10px';
  statsDiv.style.backgroundColor = violationCount > 0 ? '#fff3cd' : '#d4edda';
  statsDiv.style.borderRadius = '4px';
  statsDiv.style.border = `1px solid ${violationCount > 0 ? '#ffeeba' : '#c3e6cb'}`;
  statsDiv.style.color = violationCount > 0 ? '#856404' : '#155724';
  
  statsDiv.innerHTML = `
    <strong>Statistics:</strong>
    <ul style="margin: 5px 0;">
      <li>Total lines: ${lines.length}</li>
      <li>Constraint violations: ${violationCount}</li>
      <li>Line break quality: ${violationCount > 0 ? 'Suboptimal' : 'Optimal'}</li>
    </ul>
  `;
  
  container.appendChild(statsDiv);
}

// Helper function to display word metrics
function displayWordMetrics(container, metrics) {
  container.innerHTML = '';
  
  // Clear previous stats if they exist
  const prevStats = document.getElementById('word-metrics-stats');
  if (prevStats) {
    prevStats.remove();
  }
  
  // Group metrics by word
  const table = document.createElement('table');
  table.style.width = '100%';
  table.style.borderCollapse = 'collapse';
  table.style.marginTop = '15px';
  
  // Create header
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
  ['Word', 'Width', 'Line Breaking', 'Is Brand Name', 'Numeric Rule'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    th.style.padding = '8px';
    th.style.textAlign = 'left';
    th.style.borderBottom = '2px solid #ddd';
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);
  
  // Create body
  const tbody = document.createElement('tbody');
  metrics.forEach((metric, i) => {
    const row = document.createElement('tr');
    row.style.backgroundColor = i % 2 === 0 ? '#f9f9f9' : 'white';
    
    // Word
    const tdWord = document.createElement('td');
    tdWord.textContent = metric.text || '';
    tdWord.style.padding = '8px';
    tdWord.style.borderBottom = '1px solid #ddd';
    row.appendChild(tdWord);
    
    // Width
    const tdWidth = document.createElement('td');
    tdWidth.textContent = metric.width !== undefined ? metric.width.toFixed(2) : 'N/A';
    tdWidth.style.padding = '8px';
    tdWidth.style.borderBottom = '1px solid #ddd';
    row.appendChild(tdWidth);
    
    // Line Breaking
    const tdBreaking = document.createElement('td');
    tdBreaking.textContent = metric.lineBreaking || 'allow';
    tdBreaking.style.padding = '8px';
    tdBreaking.style.borderBottom = '1px solid #ddd';
    tdBreaking.style.color = metric.lineBreaking === 'avoid' ? '#dc3545' : '#28a745';
    tdBreaking.style.fontWeight = 'bold';
    row.appendChild(tdBreaking);
    
    // Is Brand Name
    const tdBrand = document.createElement('td');
    tdBrand.textContent = metric.isBrandName ? 'Yes' : 'No';
    tdBrand.style.padding = '8px';
    tdBrand.style.borderBottom = '1px solid #ddd';
    if (metric.isBrandName) {
      tdBrand.style.color = '#ff9800';
      tdBrand.style.fontWeight = 'bold';
    }
    row.appendChild(tdBrand);
    
    // Numeric Rule
    const tdNumeric = document.createElement('td');
    tdNumeric.textContent = metric.numericRule ? 'Yes' : 'No';
    tdNumeric.style.padding = '8px';
    tdNumeric.style.borderBottom = '1px solid #ddd';
    if (metric.numericRule) {
      tdNumeric.style.color = '#9c27b0';
      tdNumeric.style.fontWeight = 'bold';
    }
    row.appendChild(tdNumeric);
    
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  container.appendChild(table);
  
  // Add statistics
  const avoidCount = metrics.filter(m => m.lineBreaking === 'avoid').length;
  const brandCount = metrics.filter(m => m.isBrandName).length;
  const numericCount = metrics.filter(m => m.numericRule).length;
  
  const statsDiv = document.createElement('div');
  statsDiv.id = 'word-metrics-stats';
  statsDiv.style.marginTop = '20px';
  statsDiv.style.padding = '10px';
  statsDiv.style.backgroundColor = '#e9ecef';
  statsDiv.style.borderRadius = '4px';
  statsDiv.style.border = '1px solid #dee2e6';
  
  statsDiv.innerHTML = `
    <strong>Word Metrics Statistics:</strong>
    <ul>
      <li>Total words: ${metrics.length}</li>
      <li>Words with line breaking constraint (avoid): ${avoidCount} (${((avoidCount / metrics.length) * 100).toFixed(2)}%)</li>
      <li>Brand names: ${brandCount} (${((brandCount / metrics.length) * 100).toFixed(2)}%)</li>
      <li>Words affected by numeric rules: ${numericCount} (${((numericCount / metrics.length) * 100).toFixed(2)}%)</li>
    </ul>
  `;
  
  container.appendChild(statsDiv);
}

// Function to analyze line breaks for Enhanced UI
async function analyzeLineBreaks() {
  try {
    const text = inputText.value.trim();
    const locale = localeSelect.value;
    const width = parseInt(widthInput.value);
    
    if (!text) {
      alert('Please enter some text.');
      return;
    }
    
    // Process text to get word metrics with localization rules applied
    const processedText = await processTextForLineBreaking(text, locale);
    const wordMetrics = enhanceWordMetricsWithLocalization(processedText.words, processedText.wordWidths, locale);
    
    // Prepare tree output container
    treeOutput.innerHTML = '<div style="padding: 15px; color: #03DAC5;">Analyzing line break candidates...</div>';
    
    // Compute breaks using the localized optimizer with all candidates
    const result = await localizedComputeBreaks({
      words: processedText.words,
      wordWidths: processedText.wordWidths,
      spaceWidth: processedText.spaceWidth,
      targetWidth: width,
      candidateCount: CONFIG.candidateCount,
      balanceFactor: CONFIG.balanceFactor,
      minFillRatio: CONFIG.minFillRatio,
      wordMetrics: wordMetrics,
      debugContainer: treeOutput,
      returnAllCandidates: true
    });
    
    const { bestFitBreaks, mostUniformBreaks, allCandidates } = result;
    
    // Build tree visualization
    if (allCandidates && allCandidates.length > 0) {
      // Clear the tree output first
      treeOutput.innerHTML = '';
      
      // Build and render the tree
      const tree = buildGroupedTree(processedText.words, allCandidates);
      renderTree(treeOutput, tree);
      renderSummary(treeOutput, allCandidates);
      
      // Display candidate layouts with radio buttons
      displayCandidateLayouts(
        candidatesContainer, 
        processedText.words, 
        processedText.wordWidths,
        processedText.spaceWidth,
        allCandidates, 
        width,
        wordMetrics
      );
    }
    
    // Visualize line breaks
    visualizeLineBreaks(bestFitVisualization, processedText.words, bestFitBreaks, 'optimal', wordMetrics);
    visualizeLineBreaks(mostUniformVisualization, processedText.words, mostUniformBreaks, 'uniform', wordMetrics);
    
    // Display word metrics
    displayWordMetrics(wordMetricsContainer, wordMetrics);
    
    // Display JSON output
    const jsonOutput = {
      input: text,
      locale,
      targetWidth: width,
      wordCount: processedText.words.length,
      bestFitBreaks,
      mostUniformBreaks,
      wordMetrics: wordMetrics.map((metric, i) => ({
        text: processedText.words[i],
        width: processedText.wordWidths[i],
        lineBreaking: metric.lineBreaking,
        isBrandName: metric.isBrandName || false,
        numericRule: metric.numericRule || false
      }))
    };
    
    jsonOutputContainer.textContent = JSON.stringify(jsonOutput, null, 2);
  } catch (error) {
    console.error('Error analyzing line breaks:', error);
    jsonOutputContainer.textContent = `Error: ${error.message}`;
    treeOutput.innerHTML = `<div style="padding: 15px; color: #ff5252;">Error: ${error.message}</div>`;
    document.querySelector('.tab-item[data-tab="json-output-tab"]').click();
  }
}

// We now have a single function to analyze line breaks

// Function to display candidate layouts with radio buttons
function displayCandidateLayouts(container, words, wordWidths, spaceWidth, candidates, targetWidth, wordMetrics) {
  // Clear container first
  container.innerHTML = '';
  
  // Sort candidates by score (best first)
  const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
  
  // Create radio group name
  const radioGroupName = 'candidate-layout-' + Date.now();
  
  // Display each candidate
  sortedCandidates.forEach((candidate, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'candidate-block';
    
    // Create header with radio button and score
    const header = document.createElement('div');
    header.className = 'candidate-block-header';
    
    // Create radio button
    const radio = document.createElement('input');
    radio.type = 'radio';
    radio.name = radioGroupName;
    radio.id = `candidate-${index}`;
    radio.value = index;
    radio.checked = index === 0; // Select first candidate by default
    
    // Create label for the radio
    const label = document.createElement('label');
    label.htmlFor = `candidate-${index}`;
    label.textContent = `Candidate ${index + 1}`;
    
    // Create score display
    const scoreDisplay = document.createElement('div');
    scoreDisplay.className = 'candidate-score';
    
    // Format score details
    const scoreValue = candidate.score.toFixed(2);
    const rank = index === 0 ? '1st' : index === 1 ? '2nd' : index === 2 ? '3rd' : `${index + 1}th`;
    
    scoreDisplay.innerHTML = `
      Score: <span class="score">${scoreValue}</span> 
      (Rank: <span class="rank">${rank}</span>)
    `;
    
    // Assemble header
    header.appendChild(radio);
    header.appendChild(label);
    header.appendChild(scoreDisplay);
    wrapper.appendChild(header);
    
    // Show line breaks
    const linesContainer = document.createElement('div');
    linesContainer.className = 'lines-container';
    
    // Process breaks into lines
    const lines = [];
    let currentLine = [];
    
    words.forEach((word, i) => {
      currentLine.push(word);
      if (candidate.breaks.includes(i)) {
        lines.push([...currentLine]);
        currentLine = [];
      }
    });
    
    // Add remaining words as the last line
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    
    // Show each line
    lines.forEach((line, lineIndex) => {
      const lineDiv = document.createElement('div');
      lineDiv.className = 'line candidate-line';
      lineDiv.textContent = line.join(' ');
      
      // Calculate line width percentage
      const lineWidth = line.reduce((sum, word, i) => {
        return sum + wordWidths[words.indexOf(word)] + (i > 0 ? spaceWidth : 0);
      }, 0);
      
      const fillPercentage = Math.round((lineWidth / targetWidth) * 100);
      
      // Show line stats
      const lineStats = document.createElement('div');
      lineStats.className = 'line-stats';
      lineStats.innerHTML = `
        <small>Width: ${Math.round(lineWidth)}px (${fillPercentage}% of target)</small>
      `;
      
      lineDiv.appendChild(lineStats);
      linesContainer.appendChild(lineDiv);
    });
    
    // Add detailed score breakdown
    const scoreBreakdown = document.createElement('div');
    scoreBreakdown.className = 'score-breakdown';
    scoreBreakdown.innerHTML = `
      <strong>Score breakdown:</strong>
      <ul>
        <li>Raggedness: ${candidate.scoreBreakdown?.raggedness?.toFixed(2) || 'N/A'}</li>
        <li>Evenness: ${candidate.scoreBreakdown?.evenness?.toFixed(2) || 'N/A'}</li>
        <li>Fill penalty: ${candidate.scoreBreakdown?.fillPenalty?.toFixed(2) || 'N/A'}</li>
        ${candidate.scoreBreakdown?.violationPenalty ? 
          `<li>Violation penalty: ${candidate.scoreBreakdown.violationPenalty.toFixed(2)}</li>` : ''}
      </ul>
    `;
    
    wrapper.appendChild(linesContainer);
    wrapper.appendChild(scoreBreakdown);
    
    // Add to container
    container.appendChild(wrapper);
    
    // Add event listener for radio button
    radio.addEventListener('change', function() {
      if (this.checked) {
        // Update the main visualization with this candidate
        visualizeLineBreaks(visualizationContainer, words, candidate.breaks, 'selected-candidate', wordMetrics);
        
        // Update tree visualization if needed
        // This could highlight the selected path in the tree
        highlightCandidateInTree(index);
      }
    });
  });
}

// Function to build a grouped tree for visualization
function buildGroupedTree(words, candidates) {
  // Create root node
  const tree = {
    name: 'Root',
    children: []
  };
  
  // Group candidates by their first break point
  const groupedByFirstBreak = {};
  
  candidates.forEach(candidate => {
    const firstBreak = candidate.breaks[0] || words.length;
    if (!groupedByFirstBreak[firstBreak]) {
      groupedByFirstBreak[firstBreak] = [];
    }
    groupedByFirstBreak[firstBreak].push(candidate);
  });
  
  // For each first break group
  Object.keys(groupedByFirstBreak).sort((a, b) => parseInt(a) - parseInt(b)).forEach(breakPoint => {
    const breakIndex = parseInt(breakPoint);
    const candidates = groupedByFirstBreak[breakPoint];
    
    // Create a node for this break point
    const lineText = words.slice(0, breakIndex + 1).join(' ');
    const node = {
      name: `Break after word ${breakIndex} (${candidates.length} candidate${candidates.length > 1 ? 's' : ''})`,
      lineText: lineText,
      candidates: candidates.length,
      bestScore: Math.max(...candidates.map(c => c.score)),
      children: []
    };
    
    // If there are more breaks, recursively build the subtree
    if (candidates[0].breaks.length > 1) {
      // Group again by second break
      const groupedBySecondBreak = {};
      
      candidates.forEach(candidate => {
        const secondBreak = candidate.breaks[1] || words.length;
        if (!groupedBySecondBreak[secondBreak]) {
          groupedBySecondBreak[secondBreak] = [];
        }
        
        // Create a candidate with remaining breaks
        const remainingCandidate = {
          ...candidate,
          breaks: candidate.breaks.slice(1)
        };
        
        groupedBySecondBreak[secondBreak].push(remainingCandidate);
      });
      
      // Recursively build subtrees
      Object.keys(groupedBySecondBreak).sort((a, b) => parseInt(a) - parseInt(b)).forEach(secondBreakPoint => {
        const secondBreakIndex = parseInt(secondBreakPoint);
        const subCandidates = groupedBySecondBreak[secondBreakPoint];
        
        // Create subtree for this second break
        const subLineText = words.slice(breakIndex + 1, secondBreakIndex + 1).join(' ');
        const subNode = {
          name: `Break after word ${secondBreakIndex} (${subCandidates.length} candidate${subCandidates.length > 1 ? 's' : ''})`,
          lineText: subLineText,
          candidates: subCandidates.length,
          bestScore: Math.max(...subCandidates.map(c => c.score)),
          children: []
        };
        
        // Add leaf nodes for final configurations if needed
        if (subCandidates[0].breaks.length > 0) {
          subCandidates.forEach((candidate, i) => {
            if (i < 3) { // Limit to top 3 for visualization clarity
              const leafNode = {
                name: `Score: ${candidate.score.toFixed(2)}`,
                score: candidate.score,
                lineText: words.slice(secondBreakIndex + 1).join(' '),
                isLeaf: true
              };
              subNode.children.push(leafNode);
            }
          });
          
          if (subCandidates.length > 3) {
            subNode.children.push({
              name: `... ${subCandidates.length - 3} more candidates`,
              isMore: true
            });
          }
        }
        
        node.children.push(subNode);
      });
    } else {
      // These are leaf nodes, add score information
      candidates.forEach((candidate, i) => {
        if (i < 3) { // Limit to top 3 for visualization clarity
          const leafNode = {
            name: `Score: ${candidate.score.toFixed(2)}`,
            score: candidate.score,
            lineText: '',
            isLeaf: true
          };
          node.children.push(leafNode);
        }
      });
      
      if (candidates.length > 3) {
        node.children.push({
          name: `... ${candidates.length - 3} more candidates`,
          isMore: true
        });
      }
    }
    
    tree.children.push(node);
  });
  
  return tree;
}

// Function to render the tree visualization
function renderTree(container, tree) {
  const treeContainer = document.createElement('div');
  treeContainer.className = 'tree-container';
  
  function renderNode(node, level = 0) {
    const nodeEl = document.createElement('div');
    nodeEl.className = 'tree-node';
    nodeEl.style.marginLeft = `${level * 20}px`;
    
    const nodeContent = document.createElement('div');
    nodeContent.className = 'tree-node-content';
    
    // Node icon/expander
    const nodeIcon = document.createElement('span');
    nodeIcon.className = 'tree-node-icon';
    nodeIcon.textContent = node.children && node.children.length > 0 ? '▼' : (node.isMore ? '...' : '•');
    
    // Node name
    const nodeName = document.createElement('span');
    nodeName.className = 'tree-node-name';
    nodeName.textContent = node.name;
    
    if (node.bestScore) {
      nodeName.innerHTML += ` <span class="tree-node-score">Best: ${node.bestScore.toFixed(2)}</span>`;
    }
    
    nodeContent.appendChild(nodeIcon);
    nodeContent.appendChild(nodeName);
    nodeEl.appendChild(nodeContent);
    
    // Display line text if available
    if (node.lineText) {
      const linePreview = document.createElement('div');
      linePreview.className = 'tree-line-preview';
      linePreview.textContent = node.lineText;
      nodeEl.appendChild(linePreview);
    }
    
    // Recursively render children
    if (node.children && node.children.length > 0) {
      const childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      
      node.children.forEach(childNode => {
        childrenContainer.appendChild(renderNode(childNode, level + 1));
      });
      
      nodeEl.appendChild(childrenContainer);
      
      // Toggle functionality
      nodeContent.addEventListener('click', () => {
        childrenContainer.style.display = 
          childrenContainer.style.display === 'none' ? 'block' : 'none';
        nodeIcon.textContent = childrenContainer.style.display === 'none' ? '▶' : '▼';
      });
    }
    
    return nodeEl;
  }
  
  treeContainer.appendChild(renderNode(tree));
  container.appendChild(treeContainer);
}

// Function to render a summary of candidates
function renderSummary(container, candidates) {
  const summaryContainer = document.createElement('div');
  summaryContainer.className = 'tree-summary';
  
  const sortedCandidates = [...candidates].sort((a, b) => b.score - a.score);
  
  summaryContainer.innerHTML = `
    <h3>Summary</h3>
    <p>Total candidate layouts: ${candidates.length}</p>
    <p>Best candidate score: ${sortedCandidates[0].score.toFixed(2)}</p>
    <p>Worst candidate score: ${sortedCandidates[candidates.length - 1].score.toFixed(2)}</p>
    <p>Score range: ${(sortedCandidates[0].score - sortedCandidates[candidates.length - 1].score).toFixed(2)}</p>
  `;
  
  container.appendChild(summaryContainer);
}

// Function to highlight a candidate in the tree
function highlightCandidateInTree(candidateIndex) {
  // This function would highlight the path in the tree for the selected candidate
  // For simplicity, we're just logging the selection for now
  console.log(`Highlighting candidate ${candidateIndex + 1} in tree`);
}

// Attach event listeners
analyzeBtn.addEventListener('click', analyzeLineBreaks);

// Initialize UI on page load
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    analyzeLineBreaks();
  }, 500);
});
