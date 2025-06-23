// Helper: Calculate width of words[start..end]
function calcWidth(words, wordWidths, spaceWidth, start, end) {
  let width = 0;
  for (let i = start; i <= end; i++) {
    width += wordWidths[i];
    if (i > start) width += spaceWidth;
  }
  return width;
}

// Find longest common prefix of arrays of break indices
function commonPrefix(arrays) {
  if (!arrays.length) return [];
  let prefix = [];
  for (let i = 0; ; i++) {
    const firstVal = arrays[0][i];
    if (firstVal === undefined) break;
    if (arrays.some(arr => arr[i] !== firstVal)) break;
    prefix.push(firstVal);
  }
  return prefix;
}

// Build grouped tree from candidates
function buildGroupedTree(words, candidates) {
  const breaksList = candidates.map(c => c.breaks);
  const prefix = commonPrefix(breaksList);

  function buildNode(start, remainingCandidates) {
    if (start >= words.length) return null;

    const groups = new Map();
    for (const candidate of remainingCandidates) {
      let nextBreak = candidate.breaks.find(b => b >= start);
      if (nextBreak === undefined) nextBreak = words.length - 1;
      if (!groups.has(nextBreak)) groups.set(nextBreak, []);
      groups.get(nextBreak).push(candidate);
    }

    const nodes = [];
    for (const [end, groupCandidates] of groups.entries()) {
      nodes.push({
        start,
        end,
        candidates: groupCandidates,
        children: buildNode(end + 1, groupCandidates)
      });
    }
    return nodes;
  }

  const rootNodes = buildNode(0, candidates);
  return { prefix, rootNodes };
}

// Render the interactive tree into container
function renderTree(container, words, wordWidths, spaceWidth, treeData) {
  const { prefix, rootNodes } = treeData;

  if (prefix.length) {
    const prefixDiv = document.createElement("div");
    prefixDiv.classList.add("node", "shared");
    prefixDiv.textContent = "Common prefix lines:";
    container.appendChild(prefixDiv);

    let start = 0;
    for (const breakIdx of prefix) {
      const lineWords = words.slice(start, breakIdx + 1);
      const lineDiv = document.createElement("div");
      lineDiv.classList.add("node", "shared");
      lineDiv.textContent = `[${lineWords.join(", ")}] (width: ${calcWidth(words, wordWidths, spaceWidth, start, breakIdx)})`;
      container.appendChild(lineDiv);
      start = breakIdx + 1;
    }
  }

  function renderNodes(parent, nodes) {
    if (!nodes) return;
    for (const node of nodes) {
      const nodeDiv = document.createElement("div");
      nodeDiv.classList.add("node", "diverged");

      const toggleDiv = document.createElement("div");
      toggleDiv.classList.add("toggle");
      const lineWords = words.slice(node.start, node.end + 1);
      toggleDiv.textContent = `[${lineWords.join(", ")}] (width: ${calcWidth(words, wordWidths, spaceWidth, node.start, node.end)})`;

      const childrenDiv = document.createElement("div");
      childrenDiv.classList.add("children");

      toggleDiv.onclick = () => nodeDiv.classList.toggle("open");

      nodeDiv.appendChild(toggleDiv);
      nodeDiv.appendChild(childrenDiv);

      parent.appendChild(nodeDiv);

      renderNodes(childrenDiv, node.children);
    }
  }

  renderNodes(container, rootNodes);
}

// Render summary of candidates under container
function renderSummary(container, candidates) {
  const summaryDiv = document.createElement("div");
  summaryDiv.classList.add("summary");
  summaryDiv.innerHTML = `<div><strong>Top ${candidates.length} Candidates</strong></div><hr>`;

  if (candidates.length === 0) return;

  const bestScore = candidates[0].score;

  candidates.forEach((c, i) => {
    const percentage = (bestScore / c.score) * 100;
    const pctStr = i === 0 ? '100%' : `${percentage.toFixed(1)}%`;
    const cDiv = document.createElement("div");
    cDiv.innerHTML += `
    <div class="score-breakdown">
      <strong>Breakdown:</strong><br>
      Raggedness: ${c.scoreBreakdown.raggedness.toFixed(1)}<br>
      Evenness: ${c.scoreBreakdown.evenness.toFixed(1)}<br>
      Fill Penalty: ${c.scoreBreakdown.fillPenalty.toFixed(1)}<br>
      Widows/Orphans: ${c.scoreBreakdown.widowsOrphans}<br>
      Protected Breaks: ${c.scoreBreakdown.protectedBreaks}<br>
    </div><hr>
  `;

    summaryDiv.appendChild(cDiv);
  });

  container.appendChild(summaryDiv);
}

// Export for usage
export {
  calcWidth,
  commonPrefix,
  buildGroupedTree,
  renderTree,
  renderSummary
};
