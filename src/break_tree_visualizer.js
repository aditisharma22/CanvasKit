/**
 * Calculates the total width of a text segment from start index to end index
 * Takes into account both word widths and the spaces between words
 *
 * @param {string[]} words - Array of words
 * @param {number[]} wordWidths - Array of word widths in pixels
 * @param {number} spaceWidth - Width of space character in pixels
 * @param {number} start - Starting word index (inclusive)
 * @param {number} end - Ending word index (inclusive)
 * @returns {number} Total width of the text segment in pixels
 */
function calcWidth(words, wordWidths, spaceWidth, start, end) {
  let width = 0;
  for (let i = start; i <= end; i++) {
    width += wordWidths[i];
    if (i > start) width += spaceWidth;
  }
  return width;
}

/**
 * Find the longest common prefix of multiple arrays of break indices
 * Used to identify shared line breaks among different layout candidates
 *
 * @param {Array<Array<number>>} arrays - Arrays of break indices to compare
 * @returns {Array<number>} - The longest common prefix shared by all arrays
 */
function commonPrefix(arrays) {
  // Handle empty input
  if (!arrays.length) return [];
  
  let prefix = [];
  for (let i = 0; ; i++) {
    // Get value from first array at current position
    const firstVal = arrays[0][i];
    
    // Stop if we've reached the end of the first array
    if (firstVal === undefined) break;
    
    // Stop if any array has a different value at this position
    if (arrays.some(arr => arr[i] !== firstVal)) break;
    
    // Add to prefix if all arrays share this value
    prefix.push(firstVal);
  }
  
  return prefix;
}

/**
 * Build a hierarchical tree structure from line breaking candidates
 * Organizes candidates into a tree based on shared break points for visualization
 *
 * @param {string[]} words - Array of words in the text
 * @param {Array} candidates - Line breaking candidates to organize
 * @returns {Object} - Tree structure with common prefix and hierarchical nodes
 */
function buildGroupedTree(words, candidates) {
  // Extract break points from each candidate
  const breaksList = candidates.map(c => c.breaks);
  
  // Find common prefix shared by all candidates
  const prefix = commonPrefix(breaksList);

  /**
   * Recursively build tree nodes from remaining candidates
   * 
   * @param {number} start - Starting word index
   * @param {Array} remainingCandidates - Candidates that share breaks up to this point
   * @returns {Array|null} - Array of child nodes or null if at end
   */
  function buildNode(start, remainingCandidates) {
    // Base case: reached end of text
    if (start >= words.length) return null;

    // Group candidates by their next break point
    const groups = new Map();
    for (const candidate of remainingCandidates) {
      // Find next break point at or after current position
      let nextBreak = candidate.breaks.find(b => b >= start);
      
      // If no more breaks, use end of text
      if (nextBreak === undefined) nextBreak = words.length - 1;
      
      // Create group for this break point if needed
      if (!groups.has(nextBreak)) groups.set(nextBreak, []);
      
      // Add candidate to appropriate group
      groups.get(nextBreak).push(candidate);
    }

    // Build nodes for each group
    const nodes = [];
    for (const [end, groupCandidates] of groups.entries()) {
      nodes.push({
        start,          // Start word index
        end,            // End word index for this line
        candidates: groupCandidates,  // Candidates using this break
        children: buildNode(end + 1, groupCandidates)  // Continue with next line
      });
    }
    
    return nodes;
  }

  // Start building tree from beginning of text with all candidates
  const rootNodes = buildNode(0, candidates);
  
  // Return tree structure with common prefix and nodes
  return { prefix, rootNodes };
}

/**
 * Render the interactive line breaking tree visualization into a container
 * Creates an expandable/collapsible tree visualization of line breaking candidates
 *
 * @param {HTMLElement} container - DOM element to render the tree into
 * @param {string[]} words - Array of words in the text
 * @param {number[]} wordWidths - Array of word widths
 * @param {number} spaceWidth - Width of space character
 * @param {Object} treeData - Tree structure from buildGroupedTree
 */
function renderTree(container, words, wordWidths, spaceWidth, treeData) {
  const { prefix, rootNodes } = treeData;

  // Render common prefix (line breaks shared by all candidates)
  if (prefix.length) {
    // Create header for common prefix section
    const prefixDiv = document.createElement("div");
    prefixDiv.classList.add("node", "shared");
    prefixDiv.textContent = "Common prefix lines:";
    container.appendChild(prefixDiv);

    // Render each line in the common prefix
    let start = 0;
    for (const breakIdx of prefix) {
      // Extract words for this line
      const lineWords = words.slice(start, breakIdx + 1);
      
      // Create line element
      const lineDiv = document.createElement("div");
      lineDiv.classList.add("node", "shared");
      
      // Calculate width and display line content
      const lineWidth = calcWidth(words, wordWidths, spaceWidth, start, breakIdx);
      lineDiv.textContent = `[${lineWords.join(", ")}] (width: ${lineWidth})`;
      
      // Add to container
      container.appendChild(lineDiv);
      
      // Move to next line
      start = breakIdx + 1;
    }
  }

  /**
   * Recursively render tree nodes
   * 
   * @param {HTMLElement} parent - Parent DOM element
   * @param {Array} nodes - Tree nodes to render
   */
  function renderNodes(parent, nodes) {
    // Base case: no nodes to render
    if (!nodes) return;
    
    // Render each node
    for (const node of nodes) {
      // Create container for this node
      const nodeDiv = document.createElement("div");
      nodeDiv.classList.add("node", "diverged");

      // Create toggleable header for node
      const toggleDiv = document.createElement("div");
      toggleDiv.classList.add("toggle");
      
      // Extract words for this line
      const lineWords = words.slice(node.start, node.end + 1);
      
      // Calculate width and display line content
      const lineWidth = calcWidth(words, wordWidths, spaceWidth, node.start, node.end);
      toggleDiv.textContent = `[${lineWords.join(", ")}] (width: ${lineWidth})`;

      // Container for child nodes
      const childrenDiv = document.createElement("div");
      childrenDiv.classList.add("children");

      // Make toggleable by clicking
      toggleDiv.onclick = () => nodeDiv.classList.toggle("open");

      // Assemble node structure
      nodeDiv.appendChild(toggleDiv);
      nodeDiv.appendChild(childrenDiv);

      // Add to parent
      parent.appendChild(nodeDiv);

      // Recursively render children
      renderNodes(childrenDiv, node.children);
    }
  }

  renderNodes(container, rootNodes);
}

/**
 * Render a summary of line breaking candidates with their scores
 * Shows detailed score breakdown for each candidate for comparison
 *
 * @param {HTMLElement} container - DOM element to render the summary into
 * @param {Array} candidates - Line breaking candidates to summarize
 */
function renderSummary(container, candidates) {
  // Create summary container
  const summaryDiv = document.createElement("div");
  summaryDiv.classList.add("summary");
  
  // Create header
  summaryDiv.innerHTML = `<div><strong>Top ${candidates.length} Candidates</strong></div><hr>`;

  // Handle empty candidates case
  if (candidates.length === 0) {
    summaryDiv.innerHTML += "<div>No candidates available</div>";
    container.appendChild(summaryDiv);
    return;
  }

  // Get best score for percentage calculation
  const bestScore = candidates[0].score;

  // Render each candidate's score breakdown
  candidates.forEach((c, i) => {
    // Calculate relative score as percentage of best score
    const percentage = (bestScore / c.score) * 100;
    const pctStr = i === 0 ? '100%' : `${percentage.toFixed(1)}%`;
    
    // Create candidate div
    const cDiv = document.createElement("div");
    
    // Add score breakdown with detailed component scores
    cDiv.innerHTML += `
    <div class="score-breakdown">
      <strong>Candidate ${i+1} (${pctStr} match)</strong><br>
      <strong>Breakdown:</strong><br>
      Raggedness: ${c.scoreBreakdown.raggedness.toFixed(1)}<br>
      Evenness: ${c.scoreBreakdown.evenness.toFixed(1)}<br>
      Fill Penalty: ${c.scoreBreakdown.fillPenalty.toFixed(1)}<br>
      Widows/Orphans: ${c.scoreBreakdown.widowsOrphans}<br>
      Protected Breaks: ${c.scoreBreakdown.protectedBreaks}<br>
    </div><hr>
  `;

    // Add to summary
    summaryDiv.appendChild(cDiv);
  });

  // Add summary to container
  container.appendChild(summaryDiv);
}

/**
 * Exports the line break tree visualization components
 * These functions work together to visualize line breaking candidates as an interactive tree
 */
export {
  calcWidth,        // Calculate width of a text segment
  commonPrefix,     // Find common prefix among arrays
  buildGroupedTree, // Build tree structure from candidates
  renderTree,       // Render interactive tree visualization
  renderSummary     // Render candidate score summary
};
