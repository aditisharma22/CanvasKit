/**
 * Break Tree Visualizer
 * Provides visualization and analysis of line breaking candidates
 */

/**
 * Build a grouped tree structure from line breaking candidates
 * @param {Array} candidates - Array of line breaking candidates
 * @returns {Object} - Grouped tree structure
 */
export function buildGroupedTree(candidates) {
  if (!candidates || !Array.isArray(candidates)) {
    return { children: [], summary: { totalCandidates: 0 } };
  }

  const tree = {
    children: [],
    summary: {
      totalCandidates: candidates.length,
      bestScore: candidates.length > 0 ? Math.min(...candidates.map(c => c.score || 0)) : 0,
      worstScore: candidates.length > 0 ? Math.max(...candidates.map(c => c.score || 0)) : 0
    }
  };

  candidates.forEach((candidate, index) => {
    const node = {
      id: `candidate-${index}`,
      type: 'candidate',
      rank: index + 1,
      score: candidate.score || 0,
      scoreBreakdown: candidate.scoreBreakdown || {},
      lines: candidate.lines || [],
      breaks: candidate.breaks || [],
      lineWidths: candidate.lineWidths || [],
      children: []
    };

    // Add line details as children
    if (candidate.lines) {
      candidate.lines.forEach((line, lineIndex) => {
        const lineNode = {
          id: `line-${index}-${lineIndex}`,
          type: 'line',
          number: lineIndex + 1,
          text: Array.isArray(line) ? line.join(' ') : line,
          words: Array.isArray(line) ? line : line.split(' '),
          width: candidate.lineWidths ? candidate.lineWidths[lineIndex] : 0,
          children: []
        };
        node.children.push(lineNode);
      });
    }

    tree.children.push(node);
  });

  return tree;
}

/**
 * Render the tree structure to HTML
 * @param {Object} tree - Tree structure to render
 * @param {Element} container - Container element
 */
export function renderTree(tree, container) {
  if (!container) {
    console.error('Container element not provided');
    return;
  }

  container.innerHTML = '';

  if (!tree || !tree.children || tree.children.length === 0) {
    container.innerHTML = '<div class="waiting-message">No data to display</div>';
    return;
  }

  const treeElement = document.createElement('div');
  treeElement.className = 'tree-root';

  tree.children.forEach(candidate => {
    const candidateElement = renderCandidateNode(candidate);
    treeElement.appendChild(candidateElement);
  });

  container.appendChild(treeElement);
}

/**
 * Render a candidate node
 * @param {Object} candidate - Candidate data
 * @returns {Element} - Rendered candidate element
 */
function renderCandidateNode(candidate) {
  const element = document.createElement('div');
  element.className = 'node candidate-node';
  
  const header = document.createElement('div');
  header.className = 'node-header';
  header.innerHTML = `
    <span class="rank">Candidate ${candidate.rank}</span>
    <span class="score">Score: ${candidate.score.toFixed(2)}</span>
  `;
  
  const details = document.createElement('div');
  details.className = 'node-details';
  
  if (candidate.scoreBreakdown) {
    const breakdown = Object.entries(candidate.scoreBreakdown)
      .map(([key, value]) => `${key}: ${typeof value === 'number' ? value.toFixed(2) : value}`)
      .join(' | ');
    details.innerHTML = `<div class="score-breakdown">${breakdown}</div>`;
  }

  element.appendChild(header);
  element.appendChild(details);

  // Add lines
  if (candidate.children && candidate.children.length > 0) {
    const linesContainer = document.createElement('div');
    linesContainer.className = 'lines-container';
    
    candidate.children.forEach(line => {
      const lineElement = renderLineNode(line);
      linesContainer.appendChild(lineElement);
    });
    
    element.appendChild(linesContainer);
  }

  return element;
}

/**
 * Render a line node
 * @param {Object} line - Line data
 * @returns {Element} - Rendered line element
 */
function renderLineNode(line) {
  const element = document.createElement('div');
  element.className = 'node line-node';
  
  element.innerHTML = `
    <div class="line-header">
      <span class="line-number">Line ${line.number}</span>
      <span class="line-width">Width: ${line.width}px</span>
    </div>
    <div class="line-text">"${line.text}"</div>
  `;
  
  return element;
}

/**
 * Render summary information
 * @param {Object} tree - Tree structure
 * @param {Element} container - Container element
 */
export function renderSummary(tree, container) {
  if (!container || !tree || !tree.summary) {
    return;
  }

  container.innerHTML = `
    <div class="summary">
      <h3>Summary</h3>
      <div class="summary-stats">
        <div class="stat">
          <label>Total Candidates:</label>
          <span>${tree.summary.totalCandidates}</span>
        </div>
        <div class="stat">
          <label>Best Score:</label>
          <span class="score">${tree.summary.bestScore.toFixed(2)}</span>
        </div>
        <div class="stat">
          <label>Worst Score:</label>
          <span class="score">${tree.summary.worstScore.toFixed(2)}</span>
        </div>
      </div>
    </div>
  `;
}
