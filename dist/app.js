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
  function sampleMap(kind = 'website') {
    const map = { id: uid(), title: kind === 'brainstorm' ? 'The next big idea' : kind === 'project' ? 'Product launch' : 'Website redesign', favorite: false, updated: Date.now(), palette: defaultPaletteId, nodes: [] };
    const root = { id: 'root', parent: null, text: map.title, x: 560, y: 360, color: 'sage', shape: 'rounded', size: 18 };
    map.nodes.push(root);
    const branches = kind === 'brainstorm' ? [
      ['explore', 'Explore', 325, 220, 'lavender', ['What if…', 'Inspiration', 'Opportunities']],
      ['create', 'Create', 795, 220, 'peach', ['First concepts', 'Fresh perspectives', 'Make it tangible']],
      ['refine', 'Refine', 325, 500, 'yellow', ['Ask for feedback', 'Connect the dots', 'Keep it simple']],
      ['next', 'Next steps', 795, 500, 'blue', ['Try something small', 'Learn & iterate', 'Make it happen']],
    ] : kind === 'project' ? [
      ['strategy', 'Strategy', 325, 220, 'lavender', ['Audience', 'Positioning', 'Success metrics']],
      ['product', 'Product', 795, 220, 'peach', ['Key features', 'User experience', 'Roadmap']],
      ['marketing', 'Marketing', 325, 500, 'yellow', ['Launch campaign', 'Content plan', 'Community']],
      ['delivery', 'Delivery', 795, 500, 'blue', ['Timeline', 'Responsibilities', 'Launch checklist']],
    ] : [
      ['strategy', 'Strategy', 325, 220, 'lavender', ['Target audience', 'Goals & objectives', 'Competitor research']],
      ['design', 'Design', 795, 220, 'peach', ['Moodboard', 'Wireframes', 'Visual identity']],
      ['launch', 'Launch', 325, 500, 'yellow', ['QA & testing', 'Content migration', 'Go live!']],
      ['development', 'Development', 795, 500, 'blue', ['Frontend', 'CMS integration', 'Performance']],
    ];
    branches.forEach(([id, text, x, y, color, children]) => {
      map.nodes.push({ id, parent: 'root', text, x, y, color, shape: 'rounded', size: 16 });
      children.forEach((text, i) => map.nodes.push({ id: `${id}-${i}`, parent: id, text, x: x < 560 ? 100 : 1030, y: y + (i - 1) * 61, color, shape: 'rounded', size: 15 }));
    });
    return map;
  }
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
  let maps = [], currentId, selected = 'design', history = [], future = [], tool = 'select', view = {x:0,y:0,scale:1}, editing = null, panelOpen = innerWidth >= 1400, spaceHeld = false, noteSession = null, titleSession = false;
  let removedMaps = [];
  let loadedWorkspace = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (Array.isArray(saved?.maps)) {
      maps = saved.maps.map(validateMap);
      currentId = saved.currentId;
      loadedWorkspace = true;
      for (const removed of Array.isArray(saved.removedMaps) ? saved.removedMaps : []) {
        try { removedMaps.push(validateMap(removed)); }
        catch { /* A malformed removed map must not affect active maps. */ }
      }
    }
  } catch { maps=[]; }
  if (!loadedWorkspace) maps = [sampleMap()];
  currentId = maps.some(m => m.id === currentId) ? currentId : maps[0]?.id ?? null;
  const map = () => maps.find(m=>m.id===currentId);
  const root = () => map()?.nodes.find(n=>n.parent===null);
  const node = () => map()?.nodes.find(n => n.id === selected);
  if (!map()?.nodes.some(n => n.id === selected)) selected = root()?.id ?? null;
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
    if (selected !== null && !node()) selected = root().id;
    persist();
    render();
    if (node()) ensureVisible(node());
  }
  function redo() {
    if (!future.length) return;
    history.push(clone(map()));
    maps[maps.findIndex(m => m.id === currentId)] = future.pop();
    if (selected !== null && !node()) selected = root().id;
    persist();
    render();
    if (node()) ensureVisible(node());
  }
  function switchMap(id) {
    finishEdit();
    currentId = id;
    history = [];
    future = [];
    selected = root()?.id ?? null;
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
  function makeMap(kind) {
    finishEdit();
    const fresh = kind === 'blank' ? {
      id: uid(), title: 'Untitled mind map', favorite: false, updated: Date.now(), palette: defaultPaletteId,
      nodes: [{ id: 'root', parent: null, text: 'Your big idea', x: 560, y: 360, color: 'sage', shape: 'rounded', size: 18 }],
    } : sampleMap(kind);
    maps.unshift(fresh);
    closeDialog();
    switchMap(fresh.id);
    if (kind === 'blank') setTimeout(() => {
      if (currentId === fresh.id && !$('appDialog').open) startEdit(selected);
    }, 120);
  }
  function dimensions(n){return {w:n.parent===null?232:map().nodes.find(p=>p.id===n.parent)?.parent===null?155:185,h:n.parent===null?68:map().nodes.find(p=>p.id===n.parent)?.parent===null?53:47};}
  function appearance(n) {
    return nodeStyle(n, map().palette, map().nodes.find(parent => parent.id === n.parent)?.parent === null);
  }
  function renderNodes(){
    stopLayoutMotion();
    const all = map().nodes;
    $('nodes').innerHTML = all.map(n => {
      const d = dimensions(n);
      const isRoot = n.parent === null;
      const isMain = all.find(parent => parent.id === n.parent)?.parent === null;
      const style = nodeStyle(n, map().palette, isMain);
      const boxStyle = `left:${n.x-d.w/2}px;top:${n.y-d.h/2}px;width:${d.w}px;height:${d.h}px`;
      const themeStyle = `--node-bg:${style.background};--node-border:${style.border};--node-ink:${style.ink};--node-accent:${style.accent}`;
      const fontStyle = `font-family:${style.family};font-size:${style.size}px;font-weight:${style.weight};font-style:${style.italic ? 'italic' : 'normal'}`;
      return `<div class="node ${isRoot ? 'root-node' : isMain ? 'main-node' : ''} ${n.id === selected ? 'selected' : ''} shape-${n.shape}" data-id="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.text)}. Double-click to edit" aria-pressed="${n.id === selected}" style="${boxStyle};${themeStyle};${fontStyle}">
        ${isRoot ? icon('spark','root-spark') : ''}<span class="node-text">${esc(n.text)}</span>${n.note ? icon('note','node-note') : ''}
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
    if (document.activeElement !== $('mapTitle')) $('mapTitle').value = current?.title ?? '';
    document.title = current ? `${current.title} — Mindo` : 'My mind maps — Mindo';
    $('favoriteBtn').classList.toggle('favorite-on', Boolean(current?.favorite));
    $('favoriteBtn').setAttribute('aria-label', current?.favorite ? 'Remove from favorites' : 'Add to favorites');
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
    $('noteTool').disabled = !n;
    $('undoBtn').disabled = !history.length;
    $('redoBtn').disabled = !future.length;
    $('nodeCount').textContent = `${map().nodes.length} ${map().nodes.length === 1 ? 'idea' : 'ideas'}`;
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
  function select(id){if(editing)finishEdit();selected=id;document.querySelectorAll('.node').forEach(el=>{const active=el.dataset.id===id;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});renderInspector();}
  function applyTransform(offsetX = 0, offsetY = 0){$('world').style.transform=`translate(${view.x + offsetX}px,${view.y + offsetY}px) scale(${view.scale})`;$('zoomLabel').textContent=`${Math.round(view.scale*100)}%`;}
  function fit(overview = false){
    if (!map()) return;
    stopLayoutMotion();
    const rect=$('viewport').getBoundingClientRect();const side=panelOpen&&!document.body.classList.contains('focus-mode')? (innerWidth>1200?266:245):20;
    const dims=map().nodes.map(n=>({...dimensions(n),x:n.x,y:n.y}));const minX=Math.min(...dims.map(n=>n.x-n.w/2)),maxX=Math.max(...dims.map(n=>n.x+n.w/2)),minY=Math.min(...dims.map(n=>n.y-n.h/2)),maxY=Math.max(...dims.map(n=>n.y+n.h/2));
    const left=innerWidth<=720?66:88,top=100,bottom=112,availW=Math.max(180,rect.width-left-side-24),availH=Math.max(180,rect.height-top-bottom);
    const fittedScale = Math.min(1.08, availW / (maxX - minX + 30), availH / (maxY - minY + 30));
    view.scale = !overview && innerWidth <= 720 ? Math.max(.45, fittedScale) : fittedScale;
    view.x=left+availW/2-(minX+maxX)/2*view.scale;view.y=top+availH/2-(minY+maxY)/2*view.scale;applyTransform();
  }
  function zoom(factor,point){stopLayoutMotion();const r=$('viewport').getBoundingClientRect(),c=point||{x:r.width/2,y:r.height/2},next=Math.max(Math.min(.12,view.scale),Math.min(2.5,view.scale*factor)),ratio=next/view.scale;view.x=c.x-(c.x-view.x)*ratio;view.y=c.y-(c.y-view.y)*ratio;view.scale=next;applyTransform();}
  function setTool(value){tool=value;$('selectTool').classList.toggle('active',value==='select');$('panTool').classList.toggle('active',value==='pan');$('viewport').classList.toggle('pan-mode',value==='pan'||spaceHeld);}
  function addNode(parentId=selected,sibling=false){
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
      selected = added.id;
    });
    ensureVisible(added);
    startEdit(added.id);
    animateAddedIdea(previous, previousView, added);
  }
  function ensureVisible(n) {
    const canvas = $('viewport').getBoundingClientRect();
    const inspector = $('inspector').getBoundingClientRect();
    const left = innerWidth <= 720 ? 62 : 80;
    const rightWithInspector = inspector.left - canvas.left - 12;
    const right = inspector.width && rightWithInspector - left > 120 ? rightWithInspector : canvas.width - 16;
    const top = 74;
    const bottom = canvas.height - 65;
    const size = dimensions(n);
    const padX = Math.min((right - left) / 2, size.w * view.scale / 2 + 10);
    const padY = Math.min((bottom - top) / 2, size.h * view.scale / 2 + 10);
    const x = n.x * view.scale + view.x;
    const y = n.y * view.scale + view.y;
    view.x += Math.min(right - padX, Math.max(left + padX, x)) - x;
    view.y += Math.min(bottom - padY, Math.max(top + padY, y)) - y;
    applyTransform();
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
      selected = n.parent;
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
      selected = copy.id;
    });
    ensureVisible(copy);
  }
  function startEdit(id){
    if (!map()?.nodes.some(n => n.id === id)) return;
    if(tool==='pan')setTool('select');finishEdit();select(id);const n=node(),el=[...document.querySelectorAll('.node')].find(e=>e.dataset.id===id);if(!el)return;
    const input=document.createElement('input');input.value=n.text;input.maxLength=120;input.setAttribute('aria-label','Idea text');el.append(input);editing={id,input,original:n.text};input.focus({preventScroll:true});input.select();
    input.addEventListener('pointerdown',e=>e.stopPropagation());input.addEventListener('dblclick',e=>e.stopPropagation());input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finishEdit();}else if(e.key==='Escape'){e.preventDefault();finishEdit(true);}else if(e.key==='Tab'){e.preventDefault();finishEdit();addNode(id);}});input.addEventListener('blur',()=>finishEdit());
  }
  function finishEdit(cancel=false){if(!editing)return;const edit=editing;editing=null;const n=map().nodes.find(n=>n.id===edit.id);const next=edit.input.value.trim()||'Untitled idea';edit.input.remove();if(n&&!cancel&&next!==edit.original){applyChange(()=>n.text=next);}else renderNodes();}
  let drag=null;
  $('viewport').addEventListener('pointerdown',e=>{
    if (!map() || (e.button !== 0 && e.button !== 1) || e.target.closest('input,.add-node')) return;
    stopLayoutMotion();
    const el=e.target.closest('.node'),pan=tool==='pan'||spaceHeld||e.button===1||!el;
    if(editing)finishEdit();
    if(!pan){select(el.dataset.id);el.focus({preventScroll:true});}else if(!el){$('viewport').focus({preventScroll:true});}
    drag={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:pan?view.x:node().x,y:pan?view.y:node().y,pan,id:pan?null:selected,background:!el&&e.button===0,moved:false,snapshot:null};
    if(pan)$('viewport').classList.add('panning');
  });
  $('viewport').addEventListener('pointermove',e=>{
    if(!drag||drag.pointer!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    if(!drag.moved){if(!drag.pan)drag.snapshot=clone(map());$('viewport').setPointerCapture(e.pointerId);}drag.moved=true;
    if(drag.pan){view.x=drag.x+dx;view.y=drag.y+dy;applyTransform();}else{const n=map().nodes.find(n=>n.id===drag.id);n.x=drag.x+dx/view.scale;n.y=drag.y+dy/view.scale;const el=[...document.querySelectorAll('.node')].find(e=>e.dataset.id===n.id),d=dimensions(n);el.style.left=`${n.x-d.w/2}px`;el.style.top=`${n.y-d.h/2}px`;renderEdges();}
  });
  function endDrag(e) {
    if (!drag || e.pointerId !== drag.pointer) return;
    const last = drag;
    drag = null;
    $('viewport').classList.remove('panning');
    if ($('viewport').hasPointerCapture(e.pointerId)) $('viewport').releasePointerCapture(e.pointerId);
    if (last.moved && !last.pan) {
      history.push(last.snapshot);
      if (history.length > 80) history.shift();
      future = [];
      commit();
    }
    if (e.type === 'pointerup' && last.background && !last.moved && !e.target.closest('.node')) select(null);
  }
  $('viewport').addEventListener('pointerup',endDrag);$('viewport').addEventListener('pointercancel',endDrag);
  $('nodes').addEventListener('dblclick',e=>{const el=e.target.closest('.node');if(el&&!e.target.closest('.add-node'))startEdit(el.dataset.id);});
  $('nodes').addEventListener('click',e=>{if(e.target.closest('.add-node')){const id=e.target.closest('.node').dataset.id;select(id);addNode(id);}});
  $('nodes').addEventListener('focusin',e=>{if(e.target.classList.contains('node'))select(e.target.dataset.id);});
  $('viewport').addEventListener('wheel',e=>{e.preventDefault();const r=$('viewport').getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  function setPanel(value){panelOpen=value;document.body.classList.toggle('panel-hidden',!value);document.body.classList.toggle('panel-open',value);$('panelBtn').setAttribute('aria-pressed',String(value));if(!$('outlinePanel').hidden)renderOutline();}
  function renderOutline(){const all=map().nodes, colors=palettes[map().palette].colors;function tree(parent){return `<ul>${all.filter(n=>n.parent===parent).map(n=>`<li><button data-outline="${esc(n.id)}"><span class="outline-dot" style="--dot:${colors[n.color].line}"></span>${esc(n.text)}</button>${tree(n.id)}</li>`).join('')}</ul>`;}const r=root();$('outlinePanel').innerHTML=`<h2>${esc(map().title)}</h2><div class="outline-tree"><button data-outline="${esc(r.id)}"><span class="outline-dot" style="--dot:${colors[r.color].rootBg}"></span><strong>${esc(r.text)}</strong></button>${tree(r.id)}</div>`;}
  function setView(outline){$('outlinePanel').hidden=!outline;$('mapViewBtn').classList.toggle('active',!outline);$('outlineViewBtn').classList.toggle('active',outline);if(outline)renderOutline();}
  $('outlinePanel').addEventListener('click',e=>{const target=e.target.closest('[data-outline]');if(target){select(target.dataset.outline);setView(false);ensureVisible(node());startEdit(selected);}});
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

  function templates(){dialog('A fresh place to start','Choose a starting point. Make it your own.',[
    ['blank','Your own blank canvas','One central idea. Endless possibilities.','plus'],['website','Website redesign','From your first insight to your next launch.','map'],['brainstorm','A little brainstorm','Explore, create, and connect your ideas.','spark'],['project','Product launch','Bring your next big thing into the world.','template']
    ].map(([kind,title,desc,ico])=>`<button class="template-card" data-template="${kind}"><span class="template-icon">${icon(ico)}</span><span><strong>${title}</strong><small>${desc}</small></span></button>`).join(''));}
  $('dialogContent').addEventListener('click', e => {
    const target = e.target.closest('[data-template], [data-open-map], [data-remove-map], [data-restore-map], [data-new-map]');
    if (!target) return;
    if (target.hasAttribute('data-template')) {
      makeMap(target.dataset.template);
    } else if (target.hasAttribute('data-open-map')) {
      const { openMap, idea } = target.dataset;
      closeDialog();
      switchMap(openMap);
      if (idea) {
        select(idea);
        ensureVisible(node());
      }
    } else if (target.hasAttribute('data-new-map')) {
      templates();
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
  function search(){dialog('Find a thought','Search your maps and all the ideas inside them.','<input class="dialog-input" id="searchInput" placeholder="What are you looking for?" aria-label="Search maps and ideas"><div class="search-results" id="searchResults"></div>');const input=$('searchInput');const results=()=>{const query=input.value.trim().toLowerCase();const found=[];maps.forEach(m=>{if(!query||m.title.toLowerCase().includes(query))found.push({m});if(query)m.nodes.filter(n=>n.text.toLowerCase().includes(query)).forEach(n=>found.push({m,n}));});$('searchResults').innerHTML=found.slice(0,30).map(({m,n})=>`<button class="search-result" data-open-map="${esc(m.id)}" ${n?`data-idea="${esc(n.id)}"`:''}>${icon(n?'search':'map')}<span><strong>${esc(n?n.text:m.title)}</strong><small>${n?esc(m.title):`${m.nodes.length} ideas · Mind map`}</small></span></button>`).join('')||'<div class="empty-state">No ideas found. Try another thought.</div>';};input.addEventListener('input',results);results();setTimeout(()=>input.focus(),40);}
  function shortcuts(){dialog('A few helpful shortcuts','More flow. Fewer clicks.',[['Add a child idea','Tab'],['Add a sibling idea','Enter'],['Edit selected idea','F2'],['Delete idea & its children','Delete'],['Undo','Ctrl Z'],['Redo','Ctrl Shift Z'],['Duplicate idea','Ctrl D'],['Find maps & ideas','Ctrl K'],['Pan the canvas','Space + drag'],['Select / pan tool','V / H'],['Fit map to screen','Ctrl 0'],['Exit focus mode','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join(''));}
  function exportSvg(){
    const all=map().nodes,ds=all.map(n=>({...dimensions(n),x:n.x,y:n.y}));const minX=Math.min(...ds.map(n=>n.x-n.w/2))-45,minY=Math.min(...ds.map(n=>n.y-n.h/2))-45,width=Math.max(...ds.map(n=>n.x+n.w/2))-minX+45,height=Math.max(...ds.map(n=>n.y+n.h/2))-minY+45;
    const colors = palettes[map().palette].colors;
    const byId = new Map(all.map(n => [n.id, n]));
    const edges = all.filter(n => n.parent !== null).map(n =>
      `<path d="${connectionPath(byId.get(n.parent), n)}" fill="none" stroke="${colors[n.color].line}" stroke-width="2" opacity=".7"/>`
    ).join('');
    const measure = document.createElement('canvas').getContext('2d');
    const boxes = all.map(n => {
      const style = appearance(n);
      const d = dimensions(n);
      const isRoot = n.parent === null;
      const fontStyle = style.italic ? 'italic' : 'normal';
      const radius = n.shape === 'pill' ? 30 : n.shape === 'square' ? 2 : isRoot ? 12 : 10;
      measure.font = `${fontStyle} ${style.weight} ${style.size}px ${style.family}`;
      const iconSpace = isRoot ? 29 : 0;
      const labelWidth = d.w - 28 - iconSpace;
      const characters = Array.from(n.text);
      let label = n.text;
      while (characters.length && measure.measureText(label).width > labelWidth) {
        characters.pop();
        label = `${characters.join('')}…`;
      }
      const labelX = n.x + iconSpace / 2;
      const iconX = n.x - (measure.measureText(label).width + iconSpace) / 2;
      const spark = isRoot ? `<path transform="translate(${iconX},${n.y-10.5}) scale(.875)" d="m12 3 2.6 6.4L21 12l-6.4 2.6L12 21l-2.6-6.4L3 12l6.4-2.6Z" fill="none" stroke="${style.accent}" stroke-width="1.65" stroke-linejoin="round"/>` : '';
      return `<rect x="${n.x-d.w/2}" y="${n.y-d.h/2}" width="${d.w}" height="${d.h}" rx="${radius}" fill="${style.background}" stroke="${style.border}"/>${spark}<text x="${labelX}" y="${n.y}" dominant-baseline="central" text-anchor="middle" font-family="${esc(style.family)}" font-size="${style.size}" fill="${style.ink}" font-weight="${style.weight}" font-style="${fontStyle}">${esc(label)}</text>`;
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
  $('newMapBtn').onclick=templates;$('emptyNewMapBtn').onclick=templates;$('templatesBtn').onclick=templates;$('inspirationBtn').onclick=templates;$('allMapsBtn').onclick=()=>library();$('favoritesBtn').onclick=()=>library(true);
  $('recentMaps').onclick = e => {
    const target = e.target.closest('[data-map], [data-remove-map]');
    if (!target) return;
    if (target.hasAttribute('data-remove-map')) requestMapRemoval(target);
    else switchMap(target.dataset.map);
  };
  document.querySelector('.brand').onclick=e=>{e.preventDefault();library();};
  $('favoriteBtn').onclick=()=>{map().favorite=!map().favorite;persist();renderSidebar();toast(map().favorite?'Added to favorites':'Removed from favorites');};
  $('workspaceBtn').onclick=()=>dialog('Your personal workspace','A little space, just for you.',`<p>You have <strong>${maps.length} ${maps.length===1?'mind map':'mind maps'}</strong> and <strong>${maps.reduce((sum,m)=>sum+m.nodes.length,0)} ideas</strong> in this browser.</p><p>Maps save automatically on this device. Export an editable JSON file to keep a backup or move to another browser.</p>${map() ? `<button class="button secondary" id="workspaceExport">${icon('download')}Export current map</button>` : ''}`);
  $('dialogContent').addEventListener('click',e=>{if(e.target.closest('#workspaceExport'))exportMap('json');});
  $('mapTitle').addEventListener('focus',()=>{titleSession=false;});
  $('mapTitle').addEventListener('input',()=>{if(!titleSession){record();titleSession=true;}map().title=$('mapTitle').value.trim()||'Untitled mind map';map().updated=Date.now();persist();renderSidebar();renderInspector();});
  $('mapTitle').addEventListener('blur',()=>{titleSession=false;$('mapTitle').value=map()?.title ?? '';});
  $('searchBtn').onclick=search;$('helpBtn').onclick=shortcuts;$('shareBtn').onclick=share;
  $('exportBtn').onclick=e=>{e.stopPropagation();$('exportMenu').hidden=!$('exportMenu').hidden;};
  $('exportMenu').onclick=e=>{const target=e.target.closest('[data-export]');if(target)exportMap(target.dataset.export);};
  document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap'))$('exportMenu').hidden=true;});
  $('selectTool').onclick=()=>setTool('select');$('panTool').onclick=()=>setTool('pan');$('addTool').onclick=()=>addNode();$('addChildBtn').onclick=()=>{if(node())addNode();};$('noteTool').onclick=()=>{if(node()){setPanel(true);$('nodeNote').focus();}};
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('duplicateBtn').onclick=duplicate;$('deleteBtn').onclick=deleteNode;
  function setNodeOption(field, value) {
    const n = node();
    if (n && n[field] !== value) applyChange(() => { n[field] = value; });
  }
  $('mapPalette').innerHTML = Object.entries(palettes).map(([id, theme]) => `<option value="${id}">${theme.name}</option>`).join('');
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
  $('nodeNote').addEventListener('focus',()=>{$('nodeNote').dataset.node=selected;noteSession=null;});
  $('nodeNote').addEventListener('input',()=>{const n=map().nodes.find(n=>n.id===$('nodeNote').dataset.node);if(!n)return;if(noteSession!==n.id){record();noteSession=n.id;}n.note=$('nodeNote').value;map().updated=Date.now();persist();renderNodes();renderInspector();});
  $('nodeNote').addEventListener('blur',()=>{noteSession=null;});
  $('zoomOutBtn').onclick=()=>zoom(1/1.2);$('zoomInBtn').onclick=()=>zoom(1.2);$('fitBtn').onclick=()=>fit(true);$('zoomLabel').onclick=()=>zoom(1/view.scale);
  $('panelBtn').onclick=()=>setPanel(!panelOpen);$('closePanelBtn').onclick=()=>setPanel(false);
  $('mapViewBtn').onclick=()=>setView(false);$('outlineViewBtn').onclick=()=>setView(true);
  $('focusBtn').onclick=()=>{document.body.classList.toggle('focus-mode');requestAnimationFrame(()=>fit());};
  $('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
  document.addEventListener('pointerdown',e=>{if(innerWidth<=720&&!e.target.closest('.sidebar,#menuBtn'))$('sidebar').classList.remove('open');});
  document.addEventListener('keydown',e=>{
    const input=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
    if($('appDialog').open||removalDialog.open)return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='k'&&!editing){e.preventDefault();search();return;}
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
    else if (e.key === 'Enter' && node()) { e.preventDefault(); addNode(selected, true); }
    else if (e.key === 'F2' && node()) { e.preventDefault(); startEdit(selected); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && node()) { e.preventDefault(); deleteNode(); }
    else if (e.key === ' ') { e.preventDefault(); spaceHeld = true; setTool(tool); }
    else if (e.key.toLowerCase() === 'h') setTool('pan');
    else if (e.key.toLowerCase() === 'v') setTool('select');
    else if (e.key === '?') shortcuts();
  });
  document.addEventListener('keyup',e=>{if(e.key===' '){spaceHeld=false;setTool(tool);}});
  window.addEventListener('blur',()=>{spaceHeld=false;setTool(tool);});
  window.addEventListener('resize',()=>{clearTimeout(window.resizeTimer);window.resizeTimer=setTimeout(()=>{if(innerWidth<=980&&panelOpen){setPanel(false);}fit();},120);});
  if(location.hash.startsWith('#map=')){
    try{const binary=atob(location.hash.slice(5));const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const shared=validateMap(JSON.parse(new TextDecoder().decode(bytes)));shared.id=uid();shared.title=`${shared.title} (shared)`.slice(0,70);shared.updated=Date.now();maps.unshift(shared);currentId=shared.id;selected=root().id;}
    catch{setTimeout(()=>toast('This snapshot link could not be opened.'),300);}
    // Remove the snapshot after importing so a refresh does not create a second copy.
    window.history.replaceState({},'',location.pathname+location.search);
  }
  setPanel(panelOpen);render();persist();requestAnimationFrame(()=>fit());
  window.addEventListener('beforeunload',()=>{if(editing)finishEdit();persist();});
})();
