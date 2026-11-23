(() => {
  'use strict';

  const context = document.createElement('canvas').getContext('2d');
  const segmenter = typeof Intl.Segmenter === 'function' ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
  const cache = new WeakMap();
  const sizes = {
    root: { minWidth: 142, maxWidth: 336, minHeight: 60, iconSpace: 29 },
    branch: { minWidth: 96, maxWidth: 300, minHeight: 46, iconSpace: 0 },
    leaf: { minWidth: 80, maxWidth: 300, minHeight: 40, iconSpace: 0 },
  };

  function wrapParagraph(paragraph, limit, measure) {
    const lines = [];
    let line = '';
    for (const word of paragraph.trim().split(/\s+/u)) {
      const candidate = line ? `${line} ${word}` : word;
      if (measure(candidate) <= limit) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      if (measure(word) <= limit) continue;

      line = '';
      const characters = segmenter ? Array.from(segmenter.segment(word), item => item.segment) : Array.from(word);
      for (const character of characters) {
        if (line && measure(line + character) > limit) {
          lines.push(line);
          line = '';
        }
        line += character;
      }
    }
    lines.push(line);
    return lines;
  }

  window.measureMindoNode = (node, style, tier, label = node.text) => {
    const font = `${style.italic ? 'italic' : 'normal'} ${style.weight} ${style.size}px ${style.family}`;
    const key = `${tier}\0${font}\0${label}`;
    const saved = cache.get(node);
    if (saved?.key === key) return saved.size;

    const { minWidth, maxWidth, minHeight, iconSpace } = sizes[tier];
    const horizontalSpace = 34 + iconSpace;
    const lineHeight = Math.ceil(style.size * 1.35);
    if (context) context.font = font;
    const measure = text => context ? context.measureText(text).width : Array.from(text).length * style.size;
    const lines = label.replace(/\r\n?/g, '\n').split('\n')
      .flatMap(paragraph => wrapParagraph(paragraph, maxWidth - horizontalSpace, measure));
    const textWidth = Math.max(...lines.map(measure));
    const size = {
      w: Math.max(minWidth, Math.min(maxWidth, Math.ceil(textWidth + horizontalSpace))),
      h: Math.max(minHeight, lines.length * lineHeight + 24),
      lines,
      lineHeight,
      textWidth,
      iconSpace,
    };
    cache.set(node, { key, size });
    return size;
  };
})();
