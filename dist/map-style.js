(() => {
  'use strict';

  const colorSlots = ['sage', 'peach', 'lavender', 'blue', 'yellow', 'rose'];
  const defaultPaletteId = 'quiet';
  const defaultFontId = 'system';
  const fontSizes = [14, 15, 16, 18, 20];
  const fonts = {
    system: { name: 'System Sans', stack: 'system-ui, sans-serif' },
    humanist: { name: 'Trebuchet', stack: 'Trebuchet MS, Arial, sans-serif' },
    serif: { name: 'Georgia', stack: 'Georgia, Times New Roman, serif' },
    rounded: { name: 'Verdana', stack: 'Verdana, Geneva, sans-serif' },
    mono: { name: 'Monospace', stack: 'Consolas, Courier New, monospace' },
  };
  const weights = { 400: 'Regular', 500: 'Medium', 600: 'Semibold', 700: 'Bold', 800: 'Extra bold' };

  function mix(first, second, proportion) {
    const parts = [1, 3, 5].map(offset => {
      const from = parseInt(first.slice(offset, offset + 2), 16);
      const to = parseInt(second.slice(offset, offset + 2), 16);
      return Math.round(from + (to - from) * proportion).toString(16).padStart(2, '0');
    });
    return `#${parts.join('')}`;
  }

  function makePalette(name, entries, rootShade = '#1a2831') {
    const colors = Object.fromEntries(entries.map(([label, color], index) => [colorSlots[index], {
      label,
      bg: mix(color, '#ffffff', .79),
      border: mix(color, '#ffffff', .28),
      ink: '#202b2a',
      line: color,
      chip: mix(color, '#ffffff', .13),
      rootBg: mix(color, rootShade, .66),
    }]));
    return { name, colors };
  }

  const palettes = {
    quiet: makePalette('Quiet Pastels', [
      ['Sage', '#527365'], ['Clay', '#946b58'], ['Heather', '#756888'],
      ['Slate blue', '#55758d'], ['Olive', '#777444'], ['Dusty rose', '#906579'],
    ]),
    mist: makePalette('Cool Mist', [
      ['Sea glass', '#4c726d'], ['Storm gray', '#636d7b'], ['Aster', '#74708e'],
      ['River blue', '#4b6d84'], ['Eucalyptus', '#637a6b'], ['Periwinkle', '#64749a'],
    ]),
    sand: makePalette('Warm Paper', [
      ['Linen', '#786957'], ['Terracotta', '#91624f'], ['Plum gray', '#78667c'],
      ['Pewter', '#64737a'], ['Wheat', '#85733f'], ['Rosewood', '#8d6065'],
    ]),
    forest: makePalette('Woodland', [
      ['Fern', '#55704e'], ['Cedar', '#865f4f'], ['Thistle', '#75647b'],
      ['Spruce', '#4d6e73'], ['Moss', '#6c753f'], ['Mulberry', '#825e6a'],
    ]),
    mono: makePalette('Monochrome', [
      ['Graphite', '#505050'], ['Ash', '#626262'], ['Slate', '#555555'],
      ['Pewter', '#676767'], ['Stone', '#707070'], ['Charcoal', '#474747'],
    ], '#242424'),
  };
  const legacyPalettes = { bright: 'quiet', soft: 'quiet', ocean: 'mist', sunset: 'sand', orchard: 'forest' };

  function validColor(color) {
    return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
  }

  function paletteId(value) {
    if (typeof value === 'string') {
      if (Object.hasOwn(palettes, value)) return value;
      if (Object.hasOwn(legacyPalettes, value)) return legacyPalettes[value];
    }
    return defaultPaletteId;
  }

  function restoreNodeStyle(node) {
    return {
      color: colorSlots.includes(node.color) ? node.color : colorSlots[0],
      size: fontSizes.includes(node.size) ? node.size : 15,
      font: typeof node.font === 'string' && Object.hasOwn(fonts, node.font) ? node.font : defaultFontId,
      weight: Number.isInteger(node.weight) && Object.hasOwn(weights, node.weight) ? node.weight : node.bold ? 700 : null,
      textColor: validColor(node.textColor),
      italic: Boolean(node.italic),
    };
  }

  function nodeStyle(node, palette, isMain) {
    const theme = palettes[paletteId(palette)];
    const colors = theme.colors[node.color] || theme.colors.sage;
    const isRoot = node.parent === null;
    const background = isRoot ? colors.rootBg : colors.bg;
    const paletteInk = isRoot ? '#ffffff' : colors.ink;
    return {
      background,
      border: isRoot ? mix(background, '#000000', .16) : colors.border,
      ink: node.textColor || paletteInk,
      paletteInk,
      line: colors.line,
      accent: isRoot ? mix(colors.chip, '#ffffff', .45) : colors.line,
      family: (fonts[node.font] || fonts[defaultFontId]).stack,
      size: node.size || 15,
      weight: node.weight || (node.bold ? 700 : isRoot ? 700 : isMain ? 600 : 500),
      italic: Boolean(node.italic),
    };
  }

  window.MindoMapStyle = { colorSlots, defaultPaletteId, defaultFontId, fontSizes, fonts, weights, palettes, paletteId, restoreNodeStyle, nodeStyle, validColor };
})();
