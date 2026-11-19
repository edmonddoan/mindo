(() => {
  'use strict';

  const colorSlots = ['sage', 'peach', 'lavender', 'blue', 'yellow', 'rose'];
  const defaultPaletteId = 'bright';
  const legacyPaletteId = 'soft';
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

  function makePalette(name, entries) {
    const colors = Object.fromEntries(entries.map(([label, color], index) => [colorSlots[index], {
      label,
      bg: mix(color, '#ffffff', .73),
      border: mix(color, '#ffffff', .42),
      ink: mix(color, '#18271e', .69),
      line: color,
      chip: mix(color, '#ffffff', .13),
      rootBg: mix(color, '#1a2831', .66),
    }]));
    return { name, colors };
  }

  const palettes = {
    bright: makePalette('Bright', [
      ['Jade', '#19a566'], ['Tangerine', '#f36d41'], ['Orchid', '#9761ec'],
      ['Azure', '#459bfa'], ['Marigold', '#edb310'], ['Fuchsia', '#e34c9f'],
    ]),
    ocean: makePalette('Ocean', [
      ['Mint', '#19b28f'], ['Lagoon', '#1295a2'], ['Indigo', '#6e68da'],
      ['Cerulean', '#3a98e2'], ['Sea glass', '#7ac231'], ['Periwinkle', '#8c8be9'],
    ]),
    sunset: makePalette('Sunset', [
      ['Honey', '#dd9b1b'], ['Papaya', '#f5813d'], ['Mulberry', '#a652b2'],
      ['Twilight', '#7e70dd'], ['Canary', '#e9bd20'], ['Watermelon', '#e83f72'],
    ]),
    orchard: makePalette('Orchard', [
      ['Clover', '#58ad32'], ['Apricot', '#ea8547'], ['Blueberry', '#6f75d3'],
      ['Eucalyptus', '#36a79d'], ['Pear', '#98b929'], ['Cherry', '#dd5472'],
    ]),
    soft: { name: 'Soft', colors: {
      sage: { label: 'Sage', bg: '#e6eddc', border: '#cfdcbd', ink: '#526b3d', line: '#aec593', chip: '#dbe6c6', rootBg: '#315c48' },
      peach: { label: 'Peach', bg: '#f7e6dc', border: '#ead0be', ink: '#906d54', line: '#dfb79b', chip: '#f1d7c4', rootBg: '#724d38' },
      lavender: { label: 'Lavender', bg: '#eeebf7', border: '#dcd4ed', ink: '#75628f', line: '#b9a7d6', chip: '#ddd5ef', rootBg: '#52406d' },
      blue: { label: 'Blue', bg: '#e4edf5', border: '#cbdcea', ink: '#5d7e99', line: '#a6c4db', chip: '#d4e3ee', rootBg: '#355a75' },
      yellow: { label: 'Butter', bg: '#f7f0d9', border: '#eadfb4', ink: '#8c7d44', line: '#d3c38b', chip: '#eee3b9', rootBg: '#625321' },
      rose: { label: 'Rose', bg: '#f4e4e7', border: '#e9cdd3', ink: '#956a78', line: '#d6aab5', chip: '#edcfd7', rootBg: '#6d4451' },
    } },
  };

  function validColor(color) {
    return typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : null;
  }

  function paletteId(value) {
    return typeof value === 'string' && Object.hasOwn(palettes, value) ? value : legacyPaletteId;
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
