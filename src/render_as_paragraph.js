import { computeBreaks } from './optimize_linebreaks';

export async function render(text, targetWidth, userOptions = {}) {
  const options = {
    fontSize: 40,
    candidateCount: 5,
    balanceFactor: 0.5,
    minFillRatio: 0.5,
    mode: 'fit',
    ...userOptions
  };

  console.log("RENDER OPTIONS:", options);
  const fontSize = options.fontSize;

  const CanvasKit = await CanvasKitInit({
    locateFile: (file) =>
      `https://unpkg.com/canvaskit-wasm@0.40.0/bin/${file}`,
  });

  const fontBytes = await fetch("/NewYorkMedium-Regular.woff2").then(res => res.arrayBuffer());
  const fontData = new Uint8Array(fontBytes);
  const typeface = CanvasKit.Typeface.MakeFreeTypeFaceFromData(fontData);
  const font = new CanvasKit.Font(typeface, fontSize);

  const sfProFontData = await fetch("/sf-pro-display_regular.woff2").then(res => res.arrayBuffer());
  const fontProvider = CanvasKit.TypefaceFontProvider.Make();
  fontProvider.registerFont(sfProFontData, 'TEST');
  fontProvider.registerFont(fontBytes, 'New York Medium');

  const words = text.split(/\s+/);
  const wordWidths = words.map(word => {
    const glyphs = font.getGlyphIDs(word);
    const widths = font.getGlyphWidths(glyphs);
    return widths.reduce((sum, w) => sum + w, 0);
  });
  const spaceWidth = (() => {
    const glyphs = font.getGlyphIDs(" ");
    const widths = font.getGlyphWidths(glyphs);
    return widths[0] || 10;
  })();

  const debugElement = document.getElementById('treeOutput');
  const candidates = computeBreaks(
    words,
    wordWidths,
    spaceWidth,
    targetWidth,
    options.candidateCount,
    debugElement,
    options.balanceFactor,
    options.minFillRatio,
    options.mode
  );

  const bestScore = candidates[0].score;
  const worstScore = candidates[candidates.length - 1].score;
  const scoreRange = Math.max(1, worstScore - bestScore); 

  const containerId = userOptions.containerId || "layoutContainer";
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  const dpr = window.devicePixelRatio || 1;
  const cssWidth = targetWidth + 20;

  candidates.forEach((candidate, index) => {
    const wrapper = document.createElement("div");
    wrapper.className = "candidate-block";

    const input = document.createElement("input");
    input.type = "radio";
    input.name = "layoutChoice";
    input.value = index;
    input.id = `candidate-${index}`;
    if (index === 0) input.checked = true;

    input.onclick = () => {
      console.log(`Selected layout ${index}`, candidate);
    };

  const label = document.createElement("label");
  label.setAttribute("for", `candidate-${index}`);
  const percentage = 100 - ((candidate.score - bestScore) / scoreRange) * 100;
  label.innerText = `Candidate ${index + 1}: ${percentage.toFixed(1)}% match`;

    const breakdown = candidate.scoreBreakdown;
    const breakdownText = document.createElement("div");
    breakdownText.style.fontSize = "0.9em";
    breakdownText.style.color = "#555";
    breakdownText.innerHTML = `
      Raggedness: ${breakdown.raggedness.toFixed(1)} |
      Evenness: ${breakdown.evenness.toFixed(1)} |
      Fill: ${breakdown.fillPenalty.toFixed(2)} |
      Widows: ${breakdown.widowsOrphans} |
      Protected: ${breakdown.protectedBreaks}
    `;
    wrapper.appendChild(breakdownText);

    const canvas = document.createElement("canvas");
    const lineCount = candidate.lines.length;
    const canvasHeight = lineCount * (fontSize * 1.5);
    canvas.width = cssWidth * dpr;
    canvas.height = canvasHeight * dpr;
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${canvasHeight}px`;

    const surface = CanvasKit.MakeCanvasSurface(canvas);
    const skCanvas = surface.getCanvas();
    skCanvas.scale(dpr, dpr);
    skCanvas.clear(CanvasKit.Color4f(1, 1, 1, 1));

    const paragraphStyle = new CanvasKit.ParagraphStyle({
      textStyle: {
        fontSize,
        fontFamilies: ['New York Medium']
      }
    });

    let yOffset = 0;
    if (candidate.scoreBreakdown.protectedBreaks > 0) {
      wrapper.style.border = "2px solid red";
      wrapper.title = "⚠ Contains protected phrase breaks";
    }
    
    candidate.lines.forEach((line) => {
      const builder = CanvasKit.ParagraphBuilder.MakeFromFontProvider(paragraphStyle, fontProvider);
      builder.addText(line.join(" "));
      const paragraph = builder.build();
      paragraph.layout(cssWidth);
      skCanvas.drawParagraph(paragraph, 10, yOffset);
      yOffset += fontSize * 1.4;
    });

    surface.flush();

    wrapper.appendChild(input);
    wrapper.appendChild(label);
    wrapper.appendChild(canvas);
    container.appendChild(wrapper);
  });
}
