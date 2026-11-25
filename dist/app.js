(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const {
    colorSlots, defaultPaletteId, defaultFontId, fontSizes, fonts, weights,
    palettes, paletteId, restoreNodeStyle, nodeStyle, validColor,
  } = window.MindoMapStyle;
  function validateMap(raw) {
    if (!raw || typeof raw.title !== 'string' || !Array.isArray(raw.nodes) || !raw.nodes.length || raw.nodes.length > 500) throw new Error('This is not a supported mind map.');
    const ids = new Set();
    const nodes = raw.nodes.map(n => {
      if (!n || typeof n.id !== 'string' || ids.has(n.id) || typeof n.text !== 'string' || !Number.isFinite(n.x) || !Number.isFinite(n.y) || Math.abs(n.x)>100000 || Math.abs(n.y)>100000) throw new Error('The map contains invalid ideas.');
      ids.add(n.id);
      return {
        id: n.id,
        parent: n.parent == null ? null : String(n.parent),
        text: n.text.slice(0, 120) || 'Untitled idea',
        x: n.x,
        y: n.y,
        shape: ['rounded', 'square', 'pill'].includes(n.shape) ? n.shape : 'rounded',
        note: String(n.note || '').slice(0, 2000),
        ...restoreNodeStyle(n),
      };
    });
    if (nodes.filter(n=>n.parent===null).length !== 1) throw new Error('A mind map needs one central idea.');
    const lookup = new Map(nodes.map(n=>[n.id,n]));
    nodes.forEach(n=>{
      const seen = new Set([n.id]); let p=n.parent;
      while(p!==null){if(!lookup.has(p)||seen.has(p))throw new Error('The map has an invalid connection.');seen.add(p);p=lookup.get(p).parent;}
    });
    return { id: typeof raw.id === 'string' ? raw.id : uid(), title: raw.title.slice(0,70) || 'Untitled mind map', favorite: !!raw.favorite, updated: Number(raw.updated) || Date.now(), palette: paletteId(raw.palette), nodes };
  }
  const STORAGE = 'mindo.workspace.v1';
  let maps = [], currentId, selection = new Set(), history = [], future = [], tool = 'select', view = {x:0,y:0,scale:1}, editing = null, panelOpen = innerWidth >= 1400, spaceHeld = false, noteSession = null;
  let removedMaps = [];
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (Array.isArray(saved?.maps)) {
      maps = saved.maps.map(validateMap);
      currentId = saved.currentId;
      for (const removed of Array.isArray(saved.removedMaps) ? saved.removedMaps : []) {
        try { removedMaps.push(validateMap(removed)); }
        catch { /* A malformed removed map must not affect active maps. */ }
      }
    }
  } catch { maps=[]; }
  currentId = maps.some(m => m.id === currentId) ? currentId : maps[0]?.id ?? null;
  const map = () => maps.find(m=>m.id===currentId);
  const root = () => map()?.nodes.find(n=>n.parent===null);
  const node = () => selection.size === 1 ? map()?.nodes.find(n => selection.has(n.id)) : undefined;
  const resetSelection = (id = root()?.id) => { selection = new Set(id == null ? [] : [id]); };
  if (!node()) resetSelection();
  function toast(message, removedMapId = null) {
    const banner = $('toast');
    const undoButton = $('undoRemoveBtn');
    const dismissButton = $('dismissToastBtn');
    const canUndo = removedMapId !== null;
    $('toastText').textContent = message;
    undoButton.hidden = dismissButton.hidden = !canUndo;
    undoButton.onclick = canUndo ? () => restoreMap(removedMapId) : null;
    dismissButton.onclick = () => {
      banner.classList.remove('visible');
      undoButton.hidden = dismissButton.hidden = true;
    };
    banner.classList.add('visible');
    clearTimeout(toast.timer);
    if (canUndo) undoButton.focus({ preventScroll: true });
    else toast.timer = setTimeout(() => banner.classList.remove('visible'), 2600);
  }
  function persist(){
    try { localStorage.setItem(STORAGE,JSON.stringify({maps,currentId,removedMaps})); $('saveStatus').innerHTML=`${icon('cloud')}All changes saved`; }
    catch { $('saveStatus').textContent='Storage full · export to save'; if(!persist.warned){toast('Browser storage is unavailable. Export your map to keep a copy.');persist.warned=true;} }
  }
  function record(){history.push(clone(map()));if(history.length>80)history.shift();future=[];}
  function commit(){map().updated=Date.now();persist();render();}
  function applyChange(fn){record();fn();commit();}
  function undo() {
    if (!history.length) return;
    finishEdit();
    future.push(clone(map()));
    maps[maps.findIndex(m => m.id === currentId)] = history.pop();
    selection = new Set(map().nodes.filter(n => selection.has(n.id)).map(n => n.id));
    persist();
    render();
    if (node()) ensureVisible(node());
  }
  function redo() {
    if (!future.length) return;
    history.push(clone(map()));
    maps[maps.findIndex(m => m.id === currentId)] = future.pop();
    selection = new Set(map().nodes.filter(n => selection.has(n.id)).map(n => n.id));
    persist();
    render();
    if (node()) ensureVisible(node());
  }
  function switchMap(id) {
    finishEdit();
    finishCanvasRename(true);
    finishGesture();
    currentId = id;
    history = [];
    future = [];
    resetSelection();
    $('sidebar').classList.remove('open');
    persist();
    render();
    if (map()) requestAnimationFrame(() => fit());
  }
  function recentOrder(items) {
    return [...items].sort((a, b) => b.updated - a.updated);
  }
  function removeMap(id, { inLibrary = false } = {}) {
    const index = maps.findIndex(item => item.id === id);
    if (index === -1) return;
    finishEdit();
    const [removed] = maps.splice(index, 1);
    removedMaps.unshift(removed);
    if (currentId === id) switchMap(recentOrder(maps)[0]?.id ?? null);
    else {
      persist();
      renderSidebar();
    }
    if (!inLibrary) toast(`“${removed.title}” removed from your workspace`, removed.id);
    return removed;
  }
  function restoreMap(id, { inLibrary = false } = {}) {
    const index = removedMaps.findIndex(item => item.id === id);
    if (index === -1) return;
    const [restored] = removedMaps.splice(index, 1);
    maps.unshift(restored);
    if (!map()) switchMap(restored.id);
    else {
      persist();
      renderSidebar();
    }
    if (!inLibrary) toast(`“${restored.title}” restored`);
    return restored;
  }
  function makeMap() {
    finishEdit();
    const fresh = {
      id: uid(), title: 'Untitled mind map', favorite: false, updated: Date.now(), palette: defaultPaletteId,
      nodes: [{ id: 'root', parent: null, text: 'Your big idea', x: 560, y: 360, color: 'sage', shape: 'rounded', size: 18 }],
    };
    maps.unshift(fresh);
    closeDialog();
    switchMap(fresh.id);
    startEdit(fresh.nodes[0].id);
  }
  function nodeTier(n) {
    if (n.parent === null) return 'root';
    return map().nodes.find(parent => parent.id === n.parent)?.parent === null ? 'branch' : 'leaf';
  }
  function dimensions(n, tier = nodeTier(n), style = appearance(n, tier)) {
    const label = editing?.id === n.id ? editing.input.value : n.text;
    return window.measureMindoNode(n, style, tier, label);
  }
  function appearance(n, tier = nodeTier(n)) {
    return nodeStyle(n, map().palette, tier === 'branch');
  }
  function renderNodes(){
    stopLayoutMotion();
    const all = map().nodes;
    $('nodes').innerHTML = all.map(n => {
      const tier = nodeTier(n);
      const isRoot = tier === 'root';
      const isMain = tier === 'branch';
      const style = appearance(n, tier);
      const d = dimensions(n, tier, style);
      const boxStyle = `left:${n.x-d.w/2}px;top:${n.y-d.h/2}px;width:${d.w}px;height:${d.h}px`;
      const themeStyle = `--node-bg:${style.background};--node-border:${style.border};--node-ink:${style.ink};--node-accent:${style.accent};--node-line-height:${d.lineHeight}px`;
      const fontStyle = `font-family:${style.family};font-size:${style.size}px;font-weight:${style.weight};font-style:${style.italic ? 'italic' : 'normal'}`;
      const text = d.lines.map(line => `<span class="node-line">${esc(line)}</span>`).join('');
      return `<div class="node ${isRoot ? 'root-node' : isMain ? 'main-node' : ''} ${selection.has(n.id) ? 'selected' : ''} shape-${n.shape}" data-id="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.text)}. Double-click to edit" aria-pressed="${selection.has(n.id)}" style="${boxStyle};${themeStyle};${fontStyle}">
        ${isRoot ? icon('spark','root-spark') : ''}<span class="node-text">${text}</span>${n.note ? icon('note','node-note') : ''}
        <button class="add-node" aria-label="Add child to ${esc(n.text)}" title="Add child idea">${icon('plus')}</button>
      </div>`;
    }).join('');
    renderEdges();
  }
  function renderEdges(){
    const all=map().nodes;
    const colors = palettes[map().palette].colors;
    const byId = new Map(all.map(n => [n.id, n]));
    $('connections').innerHTML = all.filter(n => n.parent !== null).map(n =>
      `<path class="connection" stroke="${colors[n.color].line}" d="${connectionPath(byId.get(n.parent), n)}"/>`
    ).join('');
  }
  function connectionPath(parent, child) {
    return curvePath(connectionPoints(parent, child, dimensions(parent).w, dimensions(child).w));
  }
  function connectionPoints(parent, child, parentWidth, childWidth) {
    const direction = child.x >= parent.x ? 1 : -1;
    return [parent.x + direction * parentWidth / 2, parent.y, child.x - direction * childWidth / 2, child.y];
  }
  function curvePath([startX, startY, endX, endY]) {
    const middle = (startX + endX) / 2;
    return `M${startX},${startY} C${middle},${startY} ${middle},${endY} ${endX},${endY}`;
  }
  let layoutMotion = null;
  function stopLayoutMotion() {
    if (!layoutMotion) return;
    cancelAnimationFrame(layoutMotion.frame);
    layoutMotion.paint(1);
    layoutMotion = null;
  }
  function animateAddedIdea(previous, previousView, added) {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return;

    // Keep the saved coordinates at their final values and animate only the rendered scene.
    const all = map().nodes;
    const elements = new Map([...$('nodes').children].map(el => [el.dataset.id, el]));
    const positions = new Map(all.map(n => [n.id, {
      el: elements.get(n.id),
      start: previous.get(n.id),
      end: { x: n.x, y: n.y },
      width: dimensions(n).w,
    }]));
    const child = positions.get(added.id);
    const parent = positions.get(added.parent);
    const direction = child.end.x >= parent.end.x ? 1 : -1;
    child.start = { x: parent.start.x + direction * (parent.width + child.width) / 2, y: parent.start.y };

    const paths = $('connections').children;
    const edges = all.filter(n => n.parent !== null).map((n, index) => {
      const from = positions.get(n.parent);
      const to = positions.get(n.id);
      return {
        el: paths[index],
        start: connectionPoints(from.start, to.start, from.width, to.width),
        end: connectionPoints(from.end, to.end, from.width, to.width),
      };
    }).filter(({ start, end }) => start.some((value, index) => value !== end[index]));
    const moved = [...positions.values()].filter(({ start, end }) => start.x !== end.x || start.y !== end.y);
    const cameraX = previousView.x - view.x;
    const cameraY = previousView.y - view.y;
    const paint = (progress) => {
      const remaining = 1 - progress;
      for (const { el, start, end } of moved) {
        const dx = (start.x - end.x) * remaining;
        const dy = (start.y - end.y) * remaining;
        el.style.transform = dx || dy ? `translate(${dx}px,${dy}px)` : '';
      }
      for (const { el, start, end } of edges) {
        el.setAttribute('d', curvePath(end.map((value, index) => value + (start[index] - value) * remaining)));
      }
      child.el.style.opacity = remaining ? String(progress) : '';
      if (cameraX || cameraY) applyTransform(cameraX * remaining, cameraY * remaining);
    };
    const duration = 320;
    const startTime = performance.now();
    const tick = (time) => {
      const elapsed = Math.max(0, Math.min(1, (time - startTime) / duration));
      paint(1 - (1 - elapsed) ** 3);
      if (elapsed < 1) layoutMotion.frame = requestAnimationFrame(tick);
      else layoutMotion = null;
    };
    paint(0);
    layoutMotion = { paint, frame: requestAnimationFrame(tick) };
  }
  function renderSidebar(){
    $('recentMaps').innerHTML = recentOrder(maps).slice(0, 7).map(m => `<div class="recent-map-row"><button class="recent-map ${m.id === currentId ? 'active' : ''}" data-map="${esc(m.id)}"><span class="map-marker"></span><span>${esc(m.title)}</span>${m.favorite ? icon('star') : ''}</button><button type="button" class="icon-button remove-map" data-remove-map="${esc(m.id)}" aria-label="Remove map: ${esc(m.title)}" title="Remove map">${icon('trash')}</button></div>`).join('');
    $('mapCount').textContent = maps.length;
    const current = map();
    renderCanvasTitle(current);
    const isFavorite = Boolean(current?.favorite);
    $('favoriteBtn').classList.toggle('favorite-on', isFavorite);
    $('favoriteBtn').setAttribute('aria-pressed', String(isFavorite));
    $('favoriteHint').textContent = isFavorite ? 'Remove from favorites' : 'Add to favorites';
  }
  function renderCanvasTitle(current) {
    $('mapTitle').textContent = current?.title ?? '';
    $('canvasTitleTrigger').setAttribute('aria-label', current ? `Rename canvas: ${current.title}` : 'Rename canvas');
    document.title = current ? `${current.title} — Mindo` : 'My mind maps — Mindo';
  }
  function renderInspector(){
    const n = node();
    const theme = map().palette;
    if ($('colorSwatches').dataset.palette !== theme) {
      const colors = palettes[theme].colors;
      $('mapPalette').value = theme;
      $('palettePreview').innerHTML = ['lavender', 'peach', 'yellow', 'blue'].map(slot => `<span style="--chip:${colors[slot].chip}"></span>`).join('');
      $('colorSwatches').dataset.palette = theme;
      $('colorSwatches').innerHTML = colorSlots.map(slot => {
        const color = colors[slot];
        return `<button class="swatch" data-color="${slot}" style="background:${color.chip}" aria-label="Node color: ${color.label}" title="${color.label}"></button>`;
      }).join('');
    }
    $('nodeStyleFields').hidden = !n;
    $('nodeStyleEmpty').hidden = Boolean(n);
    $('nodeStyleEmpty').textContent = selection.size > 1
      ? `${selection.size} ideas selected. Drag any selected idea to move them together.`
      : 'Select a node to edit its style or notes.';
    $('viewport').classList.toggle('group-selected', selection.size > 1);
    $('noteTool').disabled = !n;
    $('editNodeTool').disabled = !n;
    $('addTool').disabled = selection.size > 1;
    $('undoBtn').disabled = !history.length;
    $('redoBtn').disabled = !future.length;
    const count = map().nodes.length;
    $('nodeCount').textContent = selection.size > 1 ? `${selection.size} of ${count} selected` : `${count} ${count === 1 ? 'idea' : 'ideas'}`;
    if (!n) return;
    const style = appearance(n);
    $('selectedLabel').textContent = n.text;
    $('selectedDot').style.background = style.line;
    $('colorSwatches').querySelectorAll('[data-color]').forEach(button => {
      const isSelected = button.dataset.color === n.color;
      button.classList.toggle('selected', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
      button.innerHTML = isSelected ? icon('check') : '';
    });
    document.querySelectorAll('[data-shape]').forEach(button => {
      const isSelected = button.dataset.shape === n.shape;
      button.classList.toggle('active', isSelected);
      button.setAttribute('aria-pressed', String(isSelected));
    });
    $('fontFamily').value = n.font || defaultFontId;
    $('fontWeight').value = String(style.weight);
    $('fontSize').value = String(style.size);
    $('textColor').value = style.ink;
    $('resetTextColor').disabled = !n.textColor;
    $('italicBtn').setAttribute('aria-pressed', String(style.italic));
    if(document.activeElement!==$('nodeNote')||$('nodeNote').dataset.node!==n.id){$('nodeNote').value=n.note||'';$('nodeNote').dataset.node=n.id;noteSession=null;}
    $('deleteBtn').disabled=n.parent===null;$('duplicateBtn').disabled=n.parent===null;
  }
  function render() {
    const current = map();
    document.body.classList.toggle('workspace-empty', !current);
    $('workspaceEmpty').hidden = $('workspaceTitle').hidden = Boolean(current);
    renderSidebar();
    if (!current) {
      stopLayoutMotion();
      $('nodes').replaceChildren();
      $('connections').replaceChildren();
      setView(false);
      return;
    }
    renderNodes();
    renderInspector();
    if (!$('outlinePanel').hidden) renderOutline();
  }
  function updateSelection(ids) {
    if (ids.size === selection.size && [...ids].every(id => selection.has(id))) return;
    selection = ids;
    for (const element of $('nodes').children) {
      const active = selection.has(element.dataset.id);
      element.classList.toggle('selected', active);
      element.setAttribute('aria-pressed', String(active));
    }
    renderInspector();
  }
  function select(id) {
    finishEdit();
    updateSelection(new Set(id == null ? [] : [id]));
  }
  function applyTransform(offsetX = 0, offsetY = 0){$('world').style.transform=`translate(${view.x + offsetX}px,${view.y + offsetY}px) scale(${view.scale})`;$('zoomLabel').textContent=`${Math.round(view.scale*100)}%`;}
  const compactLayout = window.matchMedia('(max-width: 720px)');

  function availableCanvas() {
    const canvas = $('viewport').getBoundingClientRect();
    const inspector = $('inspector').getBoundingClientRect();
    const compact = compactLayout.matches;
    const left = compact ? 14 : 85;
    const top = Math.min(compact ? 63 : 74, canvas.height / 4);
    let right = canvas.width - 14;
    let bottom = canvas.height - Math.min(compact ? 114 : 66, canvas.height * .35);
    if (inspector.width) {
      if (compact) bottom = Math.min(bottom, inspector.top - canvas.top - 8);
      else right = Math.min(right, inspector.left - canvas.left - 12);
    }
    return { left, top, right: Math.max(right, left + 50), bottom: Math.max(bottom, top + 50) };
  }

  function fit(overview = false) {
    if (!map()) return;
    stopLayoutMotion();
    const { left, top, right, bottom } = availableCanvas();
    const boxes = map().nodes.map(n => ({ ...dimensions(n), x: n.x, y: n.y }));
    const minX = Math.min(...boxes.map(n => n.x - n.w / 2));
    const maxX = Math.max(...boxes.map(n => n.x + n.w / 2));
    const minY = Math.min(...boxes.map(n => n.y - n.h / 2));
    const maxY = Math.max(...boxes.map(n => n.y + n.h / 2));
    const fittedScale = Math.min(1.08, (right - left) / (maxX - minX + 24), (bottom - top) / (maxY - minY + 24));
    view.scale = !overview && compactLayout.matches ? Math.max(.5, fittedScale) : fittedScale;
    view.x = (left + right) / 2 - (minX + maxX) / 2 * view.scale;
    view.y = (top + bottom) / 2 - (minY + maxY) / 2 * view.scale;
    applyTransform();
  }
  function zoom(factor,point){stopLayoutMotion();const r=$('viewport').getBoundingClientRect(),c=point||{x:r.width/2,y:r.height/2},next=Math.max(Math.min(.12,view.scale),Math.min(2.5,view.scale*factor)),ratio=next/view.scale;view.x=c.x-(c.x-view.x)*ratio;view.y=c.y-(c.y-view.y)*ratio;view.scale=next;applyTransform();}
  function setTool(value){tool=value;$('selectTool').classList.toggle('active',value==='select');$('panTool').classList.toggle('active',value==='pan');$('viewport').classList.toggle('pan-mode',value==='pan'||spaceHeld);}
  function addNode(parentId = node()?.id, sibling = false){
    finishEdit();
    stopLayoutMotion();
    const nodes = map()?.nodes;
    if (!nodes) return;
    if (nodes.length >= 500) {
      toast('This map has 500 ideas. Start a new map to keep exploring.');
      return;
    }
    const original = nodes.find(n => n.id === parentId) || root();
    if (sibling && original.parent === null) {
      toast('The central idea has no siblings. Try adding a child.');
      return;
    }
    if (!$('outlinePanel').hidden) setView(false);
    const parent = sibling ? nodes.find(n => n.id === original.parent) : original;
    const children = nodes.filter(n => n.parent === parent.id);
    const branchColors = colorSlots;
    const added = {
      id: uid(),
      parent: parent.id,
      text: 'New idea',
      x: sibling ? original.x : parent.x,
      y: sibling ? original.y : Math.max(parent.y, ...children.map(n => n.y)) + 1,
      color: parent.parent === null ? branchColors[children.length % branchColors.length] : parent.color,
      shape: 'rounded',
      size: 15,
    };
    const previous = new Map(nodes.map(({ id, x, y }) => [id, { x, y }]));
    const previousView = { x: view.x, y: view.y };
    applyChange(() => {
      const insertAt = sibling ? nodes.indexOf(original) + 1 : nodes.length;
      nodes.splice(insertAt, 0, added);
      globalThis.arrangeMindMap(nodes, dimensions);
      resetSelection(added.id);
    });
    ensureVisible(added);
    startEdit(added.id);
    animateAddedIdea(previous, previousView, added);
  }
  function ensureVisible(n) {
    const { left, top, right, bottom } = availableCanvas();
    const size = dimensions(n);
    const padX = Math.min((right - left) / 2, size.w * view.scale / 2 + 10);
    const padY = Math.min((bottom - top) / 2, size.h * view.scale / 2 + 10);
    const x = n.x * view.scale + view.x;
    const y = n.y * view.scale + view.y;
    view.x += Math.min(right - padX, Math.max(left + padX, x)) - x;
    view.y += Math.min(bottom - padY, Math.max(top + padY, y)) - y;
    applyTransform();
  }
  function fitPhoneEditor(n, minimumZoom = 0) {
    if (compactLayout.matches) {
      const { left, right } = availableCanvas();
      const maxZoom = (right - left - 12) / dimensions(n).w;
      const scale = Math.min(maxZoom, Math.max(minimumZoom, view.scale));
      if (scale !== view.scale) zoom(scale / view.scale, { x: n.x * view.scale + view.x, y: n.y * view.scale + view.y });
    }
    ensureVisible(n);
  }
  function deleteNode(){
    const n = node();
    if (!n) return;
    if (n.parent === null) {
      toast('Keep the central idea. You can edit its text.');
      return;
    }
    finishEdit();
    const removed = new Set([n.id]);
    for (const id of removed) {
      for (const child of map().nodes) {
        if (child.parent === id) removed.add(child.id);
      }
    }
    applyChange(() => {
      map().nodes = map().nodes.filter(child => !removed.has(child.id));
      globalThis.arrangeMindMap(map().nodes, dimensions);
      resetSelection(n.parent);
    });
    ensureVisible(node());
    toast(`${removed.size === 1 ? 'Idea' : 'Branch'} deleted · Ctrl Z to undo`);
  }
  function duplicate(){
    finishEdit();
    const n = node();
    if (!n || n.parent === null) return;
    const nodes = map().nodes;
    if (nodes.length >= 500) {
      toast('This map has reached 500 ideas.');
      return;
    }
    const copy = { ...clone(n), id: uid(), text: `${n.text} copy`.slice(0, 120) };
    applyChange(() => {
      nodes.splice(nodes.indexOf(n) + 1, 0, copy);
      globalThis.arrangeMindMap(nodes, dimensions);
      resetSelection(copy.id);
    });
    ensureVisible(copy);
  }
  function startEdit(id) {
    if (!map()?.nodes.some(n => n.id === id)) return;
    if (tool === 'pan') setTool('select');
    select(id);
    const n = node();
    const element = [...$('nodes').children].find(el => el.dataset.id === id);
    if (!element) return;

    const input = document.createElement('textarea');
    input.className = 'node-editor';
    input.value = n.text;
    input.maxLength = 120;
    input.rows = 1;
    input.setAttribute('aria-label', 'Idea text');
    element.classList.add('is-editing');
    element.append(input);
    editing = { id, input };

    function resizeEditor() {
      stopLayoutMotion();
      const size = dimensions(n);
      element.style.left = `${n.x - size.w / 2}px`;
      element.style.top = `${n.y - size.h / 2}px`;
      element.style.width = `${size.w}px`;
      element.style.height = `${size.h}px`;
      input.style.paddingTop = `${Math.max(4, (size.h - size.lines.length * size.lineHeight) / 2 - 5)}px`;
      fitPhoneEditor(n);
      renderEdges();
    }

    input.addEventListener('input', resizeEditor);
    input.addEventListener('pointerdown', event => event.stopPropagation());
    input.addEventListener('dblclick', event => event.stopPropagation());
    input.addEventListener('keydown', event => {
      event.stopPropagation();
      if (event.isComposing || !['Enter', 'Escape', 'Tab'].includes(event.key)) return;
      if (event.shiftKey && (event.key === 'Enter' || event.key === 'Tab')) return;
      event.preventDefault();
      finishEdit(event.key === 'Escape');
      if (event.key === 'Tab') addNode(id);
    });
    input.addEventListener('blur', () => finishEdit());
    input.focus({ preventScroll: true });
    input.select();
    const size = dimensions(n);
    input.style.paddingTop = `${Math.max(4, (size.h - size.lines.length * size.lineHeight) / 2 - 5)}px`;
  }

  function updateNodeGeometry(n, change) {
    const before = dimensions(n);
    applyChange(() => {
      change();
      const after = dimensions(n);
      if (after.w <= before.w && after.h <= before.h) return;
      const nodes = map().nodes;
      const touches = (size, other, otherSize) => (
        Math.abs(n.x - other.x) < (size.w + otherSize.w) / 2 + 6 &&
        Math.abs(n.y - other.y) < (size.h + otherSize.h) / 2 + 6
      );
      const newlyOverlaps = nodes.some(other => {
        if (other === n) return false;
        const size = dimensions(other);
        return touches(after, other, size) && !touches(before, other, size);
      });
      if (newlyOverlaps) window.arrangeMindMap(nodes, dimensions);
    });
    ensureVisible(n);
  }

  function finishEdit(cancel = false) {
    if (!editing) return;
    const { id, input } = editing;
    editing = null;
    const n = map()?.nodes.find(n => n.id === id);
    const next = input.value.trim() || 'Untitled idea';
    input.remove();
    if (n && !cancel && next !== n.text) updateNodeGeometry(n, () => { n.text = next; });
    else if (map()) renderNodes();
  }
  const viewport = $('viewport');
  const selectionBox = $('selectionBox');
  let gesture = null;

  viewport.addEventListener('pointerdown', event => {
    if (gesture || !map() || ![0, 1].includes(event.button) || event.target.closest('textarea,.add-node')) return;
    const clickedId = event.target.closest('.node')?.dataset.id;
    const mode = tool === 'pan' || spaceHeld || event.button === 1 ? 'pan' : clickedId === undefined ? 'box' : 'move';
    stopLayoutMotion();
    finishEdit();
    gesture = {
      pointer: event.pointerId, startX: event.clientX, startY: event.clientY,
      mode, clickedId, primary: event.button === 0, moved: false,
      viewX: view.x, viewY: view.y, originalSelection: selection,
    };
    if (mode === 'move') {
      if (!selection.has(clickedId)) select(clickedId);
      [...$('nodes').children].find(el => el.dataset.id === clickedId)?.focus({ preventScroll: true });
    } else {
      viewport.focus({ preventScroll: true });
      if (mode === 'pan') viewport.classList.add('panning');
    }
  });

  function updateSelectionBox(drag, x, y) {
    const { bounds } = drag;
    const endX = Math.max(bounds.left, Math.min(bounds.right, x));
    const endY = Math.max(bounds.top, Math.min(bounds.bottom, y));
    const left = Math.min(drag.startX, endX);
    const top = Math.min(drag.startY, endY);
    const right = Math.max(drag.startX, endX);
    const bottom = Math.max(drag.startY, endY);
    selectionBox.style.left = `${left - bounds.left}px`;
    selectionBox.style.top = `${top - bounds.top}px`;
    selectionBox.style.width = `${right - left}px`;
    selectionBox.style.height = `${bottom - top}px`;
    selectionBox.hidden = false;
    const hits = drag.targets.filter(({ rect }) => (
      rect.left <= right && rect.right >= left && rect.top <= bottom && rect.bottom >= top
    ));
    updateSelection(new Set(hits.map(({ id }) => id)));
  }

  viewport.addEventListener('pointermove', event => {
    const drag = gesture;
    if (!drag || drag.pointer !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (!drag.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      viewport.setPointerCapture(event.pointerId);
      if (drag.mode === 'box') {
        drag.bounds = viewport.getBoundingClientRect();
        drag.targets = [...$('nodes').children].map(el => ({ id: el.dataset.id, rect: el.getBoundingClientRect() }));
      } else if (drag.mode === 'move') {
        const elements = new Map([...$('nodes').children].map(el => [el.dataset.id, el]));
        drag.snapshot = clone(map());
        drag.targets = map().nodes.filter(n => selection.has(n.id)).map(n => ({
          node: n, element: elements.get(n.id), x: n.x, y: n.y, size: dimensions(n),
        }));
      }
    }
    if (drag.mode === 'box') {
      updateSelectionBox(drag, event.clientX, event.clientY);
    } else if (drag.mode === 'pan') {
      view.x = drag.viewX + dx;
      view.y = drag.viewY + dy;
      applyTransform();
    } else {
      for (const { node: n, element, x, y, size } of drag.targets) {
        n.x = x + dx / view.scale;
        n.y = y + dy / view.scale;
        element.style.left = `${n.x - size.w / 2}px`;
        element.style.top = `${n.y - size.h / 2}px`;
      }
      renderEdges();
    }
  });

  function finishGesture(event) {
    const drag = gesture;
    if (!drag || (event && drag.pointer !== event.pointerId)) return;
    const released = event?.type === 'pointerup';
    gesture = null;
    if (released && drag.moved && drag.mode === 'box') updateSelectionBox(drag, event.clientX, event.clientY);
    selectionBox.hidden = true;
    viewport.classList.remove('panning');
    if (viewport.hasPointerCapture(drag.pointer)) viewport.releasePointerCapture(drag.pointer);
    if (drag.moved && drag.mode === 'move') {
      history.push(drag.snapshot);
      if (history.length > 80) history.shift();
      future = [];
      commit();
    } else if (drag.moved && drag.mode === 'box' && !released) {
      updateSelection(drag.originalSelection);
    } else if (!drag.moved && released && drag.primary && viewport.contains(event.target)) {
      if (drag.mode === 'move') select(drag.clickedId);
      else if (drag.clickedId === undefined && !event.target.closest('.node')) select(null);
    }
  }
  window.addEventListener('pointerup', finishGesture);
  window.addEventListener('pointercancel', finishGesture);
  viewport.addEventListener('lostpointercapture', finishGesture);
  $('nodes').addEventListener('dblclick',e=>{const el=e.target.closest('.node');if(el&&!e.target.closest('.add-node'))startEdit(el.dataset.id);});
  $('nodes').addEventListener('click',e=>{if(e.target.closest('.add-node')){const id=e.target.closest('.node').dataset.id;select(id);addNode(id);}});
  $('nodes').addEventListener('focusin',e=>{if(!gesture&&e.target.classList.contains('node'))select(e.target.dataset.id);});
  viewport.addEventListener('wheel',e=>{e.preventDefault();if(gesture)return;const r=viewport.getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  function setPanel(value){panelOpen=value;document.body.classList.toggle('panel-hidden',!value);document.body.classList.toggle('panel-open',value);$('panelBtn').setAttribute('aria-pressed',String(value));if(!$('outlinePanel').hidden)renderOutline();}
  function renderOutline(){const all=map().nodes, colors=palettes[map().palette].colors;function tree(parent){return `<ul>${all.filter(n=>n.parent===parent).map(n=>`<li><button data-outline="${esc(n.id)}"><span class="outline-dot" style="--dot:${colors[n.color].line}"></span>${esc(n.text)}</button>${tree(n.id)}</li>`).join('')}</ul>`;}const r=root();$('outlinePanel').innerHTML=`<h2>${esc(map().title)}</h2><div class="outline-tree"><button data-outline="${esc(r.id)}"><span class="outline-dot" style="--dot:${colors[r.color].rootBg}"></span><strong>${esc(r.text)}</strong></button>${tree(r.id)}</div>`;}
  function setView(outline){$('outlinePanel').hidden=!outline;$('mapViewBtn').classList.toggle('active',!outline);$('outlineViewBtn').classList.toggle('active',outline);if(outline)renderOutline();}
  $('outlinePanel').addEventListener('click',e=>{const target=e.target.closest('[data-outline]');if(target){const id=target.dataset.outline;select(id);setView(false);ensureVisible(node());startEdit(id);}});
  function dialog(title,sub,body){finishEdit();$('dialogContent').innerHTML=`<div class="dialog-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!$('appDialog').open)$('appDialog').showModal();}
  function closeDialog(){$('appDialog').close();}
  $('appDialog').addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target===$('appDialog'))closeDialog();});
  const removalDialog = $('removeMapDialog');
  let pendingMapRemoval = null;
  let removalStartedOnBackdrop = false;

  function requestMapRemoval(trigger) {
    const item = maps.find(entry => entry.id === trigger.dataset.removeMap);
    if (!item || removalDialog.open) return;
    const libraryView = trigger.closest('[data-library]');
    pendingMapRemoval = { id: item.id, trigger, libraryView };
    removalStartedOnBackdrop = false;
    $('removeMapTitle').textContent = `“${item.title}”`;
    removalDialog.showModal();
    $('cancelMapRemoval').focus({ preventScroll: true });
  }

  function cancelMapRemoval() {
    const trigger = pendingMapRemoval?.trigger;
    pendingMapRemoval = null;
    removalDialog.close();
    trigger?.focus({ preventScroll: true });
  }

  removalDialog.addEventListener('cancel', event => {
    event.preventDefault();
    cancelMapRemoval();
  });
  removalDialog.addEventListener('pointerdown', event => {
    event.stopPropagation();
    removalStartedOnBackdrop = event.target === removalDialog;
  });
  removalDialog.addEventListener('click', event => {
    if (removalStartedOnBackdrop && event.target === removalDialog) cancelMapRemoval();
  });
  $('cancelMapRemoval').onclick = cancelMapRemoval;
  $('confirmMapRemoval').onclick = () => {
    if (!pendingMapRemoval) return;
    const { id, libraryView } = pendingMapRemoval;
    pendingMapRemoval = null;
    removalDialog.close();
    const removed = removeMap(id, { inLibrary: Boolean(libraryView) });
    if (removed && libraryView) {
      library(libraryView.dataset.library === 'favorites', {
        notice: `“${removed.title}” removed`,
        undoId: removed.id,
        showRemoved: Boolean(libraryView.querySelector('details[open]')),
      });
    }
  };

  function renameCanvas() {
    const current = map();
    if (!current) return;
    finishEdit();
    const input = $('canvasName');
    input.value = current.title;
    $('canvasTitleTrigger').hidden = true;
    input.hidden = false;
    input.focus();
    input.select();
  }

  function finishCanvasRename(save) {
    const input = $('canvasName');
    if (input.hidden) return;
    input.hidden = true;
    $('canvasTitleTrigger').hidden = false;
    const title = input.value.trim();
    const current = map();
    if (!save || !current || !title || title === current.title) return;

    // Keep controls mounted so clicking away from the rename field still activates the clicked control.
    record();
    current.title = title;
    current.updated = Date.now();
    persist();
    renderCanvasTitle(current);
    const row = $('recentMaps').querySelector('.recent-map.active')?.parentElement;
    if (row) {
      row.querySelector('.recent-map span:nth-child(2)').textContent = title;
      row.querySelector('[data-remove-map]').setAttribute('aria-label', `Remove map: ${title}`);
    }
    const outlineTitle = $('outlinePanel').querySelector('h2');
    if (outlineTitle) outlineTitle.textContent = title;
    $('undoBtn').disabled = false;
    $('redoBtn').disabled = true;
  }
  $('dialogContent').addEventListener('click', e => {
    const target = e.target.closest('[data-open-map], [data-remove-map], [data-restore-map], [data-new-map]');
    if (!target) return;
    if (target.hasAttribute('data-open-map')) {
      closeDialog();
      switchMap(target.dataset.openMap);
    } else if (target.hasAttribute('data-new-map')) {
      makeMap();
    } else if (target.hasAttribute('data-remove-map')) {
      requestMapRemoval(target);
    } else {
      const favorites = target.closest('[data-library]').dataset.library === 'favorites';
      const restored = restoreMap(target.dataset.restoreMap, { inLibrary: true });
      if (restored) library(favorites, { notice: `“${restored.title}” restored`, showRemoved: Boolean(target.closest('details')) });
    }
  });
  function library(favorites = false, { notice = '', undoId = null, showRemoved = false } = {}) {
    const items = recentOrder(maps.filter(item => !favorites || item.favorite));
    const rows = items.map(item => `
      <div class="map-library-row">
        <button type="button" class="template-card" data-open-map="${esc(item.id)}">
          <span class="template-icon">${icon('map')}</span>
          <span class="map-library-label"><strong>${esc(item.title)}</strong><small>${item.nodes.length} ${item.nodes.length === 1 ? 'idea' : 'ideas'}</small></span>
        </button>
        <button type="button" class="icon-button remove-map" data-remove-map="${esc(item.id)}" aria-label="Remove map: ${esc(item.title)}" title="Remove map">${icon('trash')}</button>
      </div>`).join('');
    const empty = favorites ? '<div class="empty-state">Star a map to add it to Favorites.</div>' : `<div class="empty-state"><p>Your workspace has no mind maps.</p><button type="button" class="button primary" data-new-map>${icon('plus')}New mind map</button></div>`;
    const feedback = notice ? `
      <div class="map-library-notice" id="mapLibraryNotice" tabindex="-1">
        <span role="status">${esc(notice)}</span>
        ${undoId !== null ? `<button type="button" class="button secondary" id="libraryUndoBtn" data-restore-map="${esc(undoId)}" aria-label="Undo map removal">Undo</button>` : ''}
      </div>` : '';
    const removed = !favorites && removedMaps.length ? `
      <details class="removed-maps" ${showRemoved ? 'open' : ''}>
        <summary>Removed maps <span aria-label="${removedMaps.length} removed">${removedMaps.length}</span></summary>
        ${removedMaps.map(item => `<div class="removed-map-row"><span>${esc(item.title)}</span><button type="button" class="button secondary" data-restore-map="${esc(item.id)}" aria-label="Restore map: ${esc(item.title)}">Restore</button></div>`).join('')}
      </details>` : '';
    dialog(favorites ? 'Your favorites' : 'Your mind maps', `${items.length} ${items.length === 1 ? 'map' : 'maps'}`, `
      <div data-library="${favorites ? 'favorites' : 'maps'}">${feedback}${rows || empty}${removed}</div>`);
    if (notice) ($('libraryUndoBtn') || $('mapLibraryNotice')).focus({ preventScroll: true });
  }
  function shortcuts(){dialog('A few helpful shortcuts','',[['Add a child idea','Tab'],['Add a sibling idea','Enter'],['Edit selected idea','F2'],['Delete idea & its children','Delete'],['Undo','Ctrl Z'],['Redo','Ctrl Shift Z'],['Duplicate idea','Ctrl D'],['Pan the canvas','Space + drag'],['Select / pan tool','V / H'],['Fit map to screen','Ctrl 0'],['Exit focus mode','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join(''));}
  function exportSvg(){
    const all=map().nodes,ds=all.map(n=>({...dimensions(n),x:n.x,y:n.y}));const minX=Math.min(...ds.map(n=>n.x-n.w/2))-45,minY=Math.min(...ds.map(n=>n.y-n.h/2))-45,width=Math.max(...ds.map(n=>n.x+n.w/2))-minX+45,height=Math.max(...ds.map(n=>n.y+n.h/2))-minY+45;
    const colors = palettes[map().palette].colors;
    const byId = new Map(all.map(n => [n.id, n]));
    const edges = all.filter(n => n.parent !== null).map(n =>
      `<path d="${connectionPath(byId.get(n.parent), n)}" fill="none" stroke="${colors[n.color].line}" stroke-width="2" opacity=".7"/>`
    ).join('');
    const boxes = all.map(n => {
      const style = appearance(n);
      const d = dimensions(n);
      const isRoot = n.parent === null;
      const fontStyle = style.italic ? 'italic' : 'normal';
      const radius = n.shape === 'pill' ? 30 : n.shape === 'square' ? 2 : isRoot ? 12 : 10;
      const labelX = n.x + d.iconSpace / 2;
      const iconX = n.x - (d.textWidth + d.iconSpace) / 2;
      const lines = d.lines.map((line, index) => {
        const y = n.y + (index - (d.lines.length - 1) / 2) * d.lineHeight;
        return `<tspan x="${labelX}" y="${y}">${esc(line)}</tspan>`;
      }).join('');
      const spark = isRoot ? `<path transform="translate(${iconX},${n.y-10.5}) scale(.875)" d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" fill="none" stroke="${style.accent}" stroke-width="1.65" stroke-linejoin="round"/>` : '';
      return `<rect x="${n.x-d.w/2}" y="${n.y-d.h/2}" width="${d.w}" height="${d.h}" rx="${radius}" fill="${style.background}" stroke="${style.border}"/>${spark}<text dominant-baseline="central" text-anchor="middle" font-family="${esc(style.family)}" font-size="${style.size}" fill="${style.ink}" font-weight="${style.weight}" font-style="${fontStyle}">${lines}</text>`;
    }).join('');
    return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="${minX} ${minY} ${width} ${height}"><title>${esc(map().title)}</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#fafbf8"/>${edges}${boxes}</svg>`,width:Math.ceil(width),height:Math.ceil(height)};
  }
  function download(blob,ext){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`${map().title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'mind-map'}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Your ${ext.toUpperCase()} export is ready`);}
  function exportMap(type){finishEdit();$('exportMenu').hidden=true;if(type==='json'){download(new Blob([JSON.stringify(map(),null,2)],{type:'application/json'}),'json');return;}const data=exportSvg(),blob=new Blob([data.svg],{type:'image/svg+xml'});if(type==='svg'){download(blob,'svg');return;}const image=new Image(),url=URL.createObjectURL(blob);image.onload=()=>{const canvas=document.createElement('canvas');const scale=Math.min(2,4096/Math.max(data.width,data.height));canvas.width=data.width*scale;canvas.height=data.height*scale;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(png=>{if(png)download(png,'png');else toast('Could not create PNG. Try SVG export.');});URL.revokeObjectURL(url);};image.onerror=()=>{URL.revokeObjectURL(url);toast('Could not create PNG. Try SVG export.');};image.src=url;}
  function encodeMap(m){const bytes=new TextEncoder().encode(JSON.stringify(m));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary);}
  function share(){finishEdit();const url=`${location.origin}${location.pathname}#map=${encodeMap(map())}`;dialog('Good ideas are worth sharing','Send a snapshot of this map to someone.',`<p>Anyone with the link can open their own editable copy.</p><div class="share-link"><input id="shareUrl" aria-label="Snapshot link" readonly><button class="button primary" id="copyLinkBtn">${icon('copy')}Copy link</button></div><p class="privacy-note">This shares the map as it is right now, including notes. Future edits stay in your own workspace. The recipient needs access to this app.</p>`);$('shareUrl').value=url;$('copyLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText(url);$('copyLinkBtn').innerHTML=`${icon('check')}Copied!`;toast('Snapshot link copied');}catch{$('shareUrl').select();toast('Select and copy the snapshot link');}};}
  async function importFile(file){try{const imported=validateMap(JSON.parse(await file.text()));imported.id=uid();imported.updated=Date.now();maps.unshift(imported);switchMap(imported.id);toast('Your mind map is ready');}catch(error){toast(error.message||'That file could not be opened. Try a Mindo JSON export.');}$('fileInput').value='';}
  $('fileInput').addEventListener('change',e=>{if(e.target.files[0])importFile(e.target.files[0]);});
  $('importBtn').onclick=()=>$('fileInput').click();
  $('newMapBtn').onclick = makeMap;
  $('emptyNewMapBtn').onclick = makeMap;
  $('allMapsBtn').onclick = () => library();
  $('favoritesBtn').onclick = () => library(true);
  $('recentMaps').onclick = e => {
    const target = e.target.closest('[data-map], [data-remove-map]');
    if (!target) return;
    if (target.hasAttribute('data-remove-map')) requestMapRemoval(target);
    else switchMap(target.dataset.map);
  };
  document.querySelector('.brand').onclick=e=>{e.preventDefault();library();};
  $('favoriteBtn').onclick=()=>{map().favorite=!map().favorite;persist();renderSidebar();toast(map().favorite?'Added to favorites':'Removed from favorites');};
  $('canvasTitleTrigger').onclick = renameCanvas;
  $('canvasName').addEventListener('blur', () => finishCanvasRename(true));
  $('canvasName').addEventListener('keydown', event => {
    if (event.isComposing || (event.key !== 'Enter' && event.key !== 'Escape')) return;
    event.preventDefault();
    event.stopPropagation();
    finishCanvasRename(event.key === 'Enter');
    $('canvasTitleTrigger').focus({ preventScroll: true });
  });
  $('helpBtn').onclick=shortcuts;$('shareBtn').onclick=share;
  $('exportBtn').onclick=e=>{e.stopPropagation();$('exportMenu').hidden=!$('exportMenu').hidden;};
  $('exportMenu').onclick=e=>{const target=e.target.closest('[data-export]');if(target)exportMap(target.dataset.export);};
  document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap'))$('exportMenu').hidden=true;});
  $('selectTool').onclick=()=>setTool('select');$('panTool').onclick=()=>setTool('pan');$('addTool').onclick=()=>addNode();$('addChildBtn').onclick=()=>{if(node())addNode();};$('noteTool').onclick=()=>{if(node()){setPanel(true);$('nodeNote').focus();}};
  $('editNodeTool').onclick = () => {
    const item = node();
    if (!item) return;
    setView(false);
    fitPhoneEditor(item, .9);
    startEdit(item.id);
  };
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('duplicateBtn').onclick=duplicate;$('deleteBtn').onclick=deleteNode;
  function setNodeOption(field, value) {
    const n = node();
    if (!n || n[field] === value) return;
    const change = () => { n[field] = value; };
    if (['font', 'weight', 'size', 'italic'].includes(field)) updateNodeGeometry(n, change);
    else applyChange(change);
  }
  $('mapPalette').innerHTML = ['Bright', 'Muted and neutral'].map(group => {
    const options = Object.entries(palettes)
      .filter(([, theme]) => theme.vivid === (group === 'Bright'))
      .map(([id, theme]) => `<option value="${id}">${theme.name}</option>`).join('');
    return `<optgroup label="${group}">${options}</optgroup>`;
  }).join('');
  $('mapPalette').onchange = e => applyChange(() => { map().palette = e.target.value; });
  $('colorSwatches').onclick = e => {
    const target = e.target.closest('[data-color]');
    if (target) setNodeOption('color', target.dataset.color);
  };
  document.querySelectorAll('[data-shape]').forEach(button => {
    button.onclick = () => setNodeOption('shape', button.dataset.shape);
  });
  $('fontFamily').innerHTML = Object.entries(fonts).map(([id, font]) => `<option value="${id}">${font.name}</option>`).join('');
  $('fontWeight').innerHTML = Object.entries(weights).map(([weight, label]) => `<option value="${weight}">${label}</option>`).join('');
  $('fontSize').innerHTML = fontSizes.map(size => `<option value="${size}">${size}</option>`).join('');
  $('fontFamily').onchange = e => setNodeOption('font', e.target.value);
  $('fontWeight').onchange = e => setNodeOption('weight', Number(e.target.value));
  $('fontSize').onchange = e => setNodeOption('size', Number(e.target.value));
  $('italicBtn').onclick = () => setNodeOption('italic', !node()?.italic);
  $('textColor').onchange = e => setNodeOption('textColor', validColor(e.target.value));
  $('resetTextColor').onclick = () => setNodeOption('textColor', null);
  $('nodeNote').addEventListener('focus',()=>{$('nodeNote').dataset.node=node()?.id ?? '';noteSession=null;});
  $('nodeNote').addEventListener('input',()=>{const n=map().nodes.find(n=>n.id===$('nodeNote').dataset.node);if(!n)return;if(noteSession!==n.id){record();noteSession=n.id;}n.note=$('nodeNote').value;map().updated=Date.now();persist();renderNodes();renderInspector();});
  $('nodeNote').addEventListener('blur',()=>{noteSession=null;});
  $('zoomOutBtn').onclick=()=>zoom(1/1.2);$('zoomInBtn').onclick=()=>zoom(1.2);$('fitBtn').onclick=()=>fit(true);$('zoomLabel').onclick=()=>zoom(1/view.scale);
  $('panelBtn').onclick = () => {
    setPanel(!panelOpen);
    if (panelOpen && node()) ensureVisible(node());
  };
  $('closePanelBtn').onclick=()=>setPanel(false);
  $('mapViewBtn').onclick=()=>setView(false);$('outlineViewBtn').onclick=()=>setView(true);
  $('focusBtn').onclick=()=>{document.body.classList.toggle('focus-mode');requestAnimationFrame(()=>fit());};
  $('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
  document.addEventListener('pointerdown',e=>{if(innerWidth<=720&&!e.target.closest('.sidebar,#menuBtn'))$('sidebar').classList.remove('open');});
  document.addEventListener('keydown',e=>{
    const input=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
    if($('appDialog').open||removalDialog.open)return;
    if (gesture) {
      if (e.key === 'Escape') finishGesture();
      return;
    }
    const mod=e.ctrlKey||e.metaKey;
    if(input)return;
    if(e.key==='Escape'){document.body.classList.remove('focus-mode');$('sidebar').classList.remove('open');$('exportMenu').hidden=true;fit();return;}
    if(!map())return;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
    if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
    if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return;}
    if(mod&&e.key==='0'){e.preventDefault();fit(true);return;}
    if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();exportMap('json');return;}
    if(e.target!==document.body&&!e.target.closest('.node')&&e.target!==$('viewport'))return;
    if (e.key === 'Tab' && !e.shiftKey && node()) { e.preventDefault(); addNode(); }
    else if (e.key === 'Enter' && node()) { e.preventDefault(); addNode(node().id, true); }
    else if (e.key === 'F2' && node()) { e.preventDefault(); startEdit(node().id); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && node()) { e.preventDefault(); deleteNode(); }
    else if (e.key === ' ') { e.preventDefault(); spaceHeld = true; setTool(tool); }
    else if (e.key.toLowerCase() === 'h') setTool('pan');
    else if (e.key.toLowerCase() === 'v') setTool('select');
    else if (e.key === '?') shortcuts();
  });
  document.addEventListener('keyup',e=>{if(e.key===' '){spaceHeld=false;setTool(tool);}});
  window.addEventListener('blur',()=>{finishGesture();spaceHeld=false;setTool(tool);});
  compactLayout.addEventListener('change', event => { if (event.matches && panelOpen) setPanel(false); });
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (editing || gesture) return;
      fit();
    }, 120);
  });
  if(location.hash.startsWith('#map=')){
    try{const binary=atob(location.hash.slice(5));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const shared=validateMap(JSON.parse(new TextDecoder().decode(bytes)));shared.id=uid();shared.title=`${shared.title} (shared)`.slice(0,70);shared.updated=Date.now();maps.unshift(shared);currentId=shared.id;resetSelection();}
    catch{setTimeout(()=>toast('This snapshot link could not be opened.'),300);}
    // Remove the snapshot after importing so a refresh does not create a second copy.
    window.history.replaceState({},'',location.pathname+location.search);
  }
  setPanel(panelOpen);render();persist();requestAnimationFrame(()=>fit());
  window.addEventListener('beforeunload',()=>{if(editing)finishEdit();finishCanvasRename(true);persist();});
})();
