(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const icon = (name, cls = '') => `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const esc = (text) => String(text).replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const palette = {
    sage: { bg: '#e6eddc', border: '#cfdcbd', ink: '#526b3d', line: '#aec593', chip: '#dbe6c6' },
    peach: { bg: '#f7e6dc', border: '#ead0be', ink: '#906d54', line: '#dfb79b', chip: '#f1d7c4' },
    lavender: { bg: '#eeebf7', border: '#dcd4ed', ink: '#75628f', line: '#b9a7d6', chip: '#ddd5ef' },
    blue: { bg: '#e4edf5', border: '#cbdcea', ink: '#5d7e99', line: '#a6c4db', chip: '#d4e3ee' },
    yellow: { bg: '#f7f0d9', border: '#eadfb4', ink: '#8c7d44', line: '#d3c38b', chip: '#eee3b9' },
    rose: { bg: '#f4e4e7', border: '#e9cdd3', ink: '#956a78', line: '#d6aab5', chip: '#edcfd7' },
  };
  function sampleMap(kind = 'website') {
    const map = { id: uid(), title: kind === 'brainstorm' ? 'The next big idea' : kind === 'project' ? 'Product launch' : 'Website redesign', favorite: false, updated: Date.now(), nodes: [] };
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
      return { id: n.id, parent: n.parent == null ? null : String(n.parent), text: n.text.slice(0, 120) || 'Untitled idea', x:n.x, y:n.y, color: palette[n.color] ? n.color : 'sage', shape: ['rounded','square','pill'].includes(n.shape) ? n.shape : 'rounded', size: [14,15,16,18,20].includes(n.size) ? n.size : 15, bold: !!n.bold, italic: !!n.italic, note: String(n.note || '').slice(0,2000) };
    });
    if (nodes.filter(n=>n.parent===null).length !== 1) throw new Error('A mind map needs one central idea.');
    const lookup = new Map(nodes.map(n=>[n.id,n]));
    nodes.forEach(n=>{
      const seen = new Set([n.id]); let p=n.parent;
      while(p!==null){if(!lookup.has(p)||seen.has(p))throw new Error('The map has an invalid connection.');seen.add(p);p=lookup.get(p).parent;}
    });
    return { id: typeof raw.id === 'string' ? raw.id : uid(), title: raw.title.slice(0,70) || 'Untitled mind map', favorite: !!raw.favorite, updated: Number(raw.updated) || Date.now(), nodes };
  }
  const STORAGE = 'mindo.workspace.v1';
  let maps = [], currentId, selected = 'design', history = [], future = [], tool = 'select', view = {x:0,y:0,scale:1}, editing = null, panelOpen = innerWidth >= 1400, spaceHeld = false, noteSession = null, titleSession = false;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null');
    if (saved && Array.isArray(saved.maps)) { maps = saved.maps.map(validateMap); currentId=saved.currentId; }
  } catch { maps=[]; }
  if(!maps.length)maps=[sampleMap()];
  currentId = maps.some(m=>m.id===currentId) ? currentId : maps[0].id;
  const map = () => maps.find(m=>m.id===currentId);
  const root = () => map().nodes.find(n=>n.parent===null);
  const node = () => map().nodes.find(n=>n.id===selected) || root();
  if(!map().nodes.some(n=>n.id===selected))selected=root().id;
  function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').classList.remove('visible'),2600);}
  function persist(){
    try { localStorage.setItem(STORAGE,JSON.stringify({maps,currentId})); $('saveStatus').innerHTML=`${icon('cloud')}All changes saved`; }
    catch { $('saveStatus').textContent='Storage full · export to save'; if(!persist.warned){toast('Browser storage is unavailable. Export your map to keep a copy.');persist.warned=true;} }
  }
  function record(){history.push(clone(map()));if(history.length>80)history.shift();future=[];}
  function commit(){map().updated=Date.now();persist();render();}
  function applyChange(fn){record();fn();commit();}
  function undo(){if(!history.length)return;finishEdit();future.push(clone(map()));maps[maps.findIndex(m=>m.id===currentId)]=history.pop();if(!map().nodes.some(n=>n.id===selected))selected=root().id;persist();render();}
  function redo(){if(!future.length)return;history.push(clone(map()));maps[maps.findIndex(m=>m.id===currentId)]=future.pop();if(!map().nodes.some(n=>n.id===selected))selected=root().id;persist();render();}
  function switchMap(id){finishEdit();currentId=id;history=[];future=[];selected=root().id;$('sidebar').classList.remove('open');persist();render();requestAnimationFrame(fit);}
  function makeMap(kind){finishEdit();const fresh=kind==='blank'?{id:uid(),title:'Untitled mind map',favorite:false,updated:Date.now(),nodes:[{id:'root',parent:null,text:'Your big idea',x:560,y:360,color:'sage',shape:'rounded',size:18}]}:sampleMap(kind);maps.unshift(fresh);closeDialog();switchMap(fresh.id);if(kind==='blank')setTimeout(()=>startEdit(selected),120);}
  function dimensions(n){return {w:n.parent===null?232:map().nodes.find(p=>p.id===n.parent)?.parent===null?155:185,h:n.parent===null?68:map().nodes.find(p=>p.id===n.parent)?.parent===null?53:47};}
  function renderNodes(){
    const all=map().nodes;
    $('nodes').innerHTML=all.map(n=>{const p=palette[n.color],d=dimensions(n),isRoot=n.parent===null,isMain=all.find(x=>x.id===n.parent)?.parent===null;
      return `<div class="node ${isRoot?'root-node':isMain?'main-node':''} ${n.id===selected?'selected':''} shape-${n.shape}" data-id="${esc(n.id)}" role="button" tabindex="0" aria-label="${esc(n.text)}. Double-click to edit" aria-pressed="${n.id===selected}" style="left:${n.x-d.w/2}px;top:${n.y-d.h/2}px;width:${d.w}px;height:${d.h}px;--node-bg:${p.bg};--node-border:${p.border};--node-ink:${p.ink};font-size:${n.size||15}px;${n.bold?'font-weight:700;':''}${n.italic?'font-style:italic;':''}">${isRoot?icon('spark','root-spark'):''}<span class="node-text">${esc(n.text)}</span>${n.note?icon('note','node-note'):''}<button class="add-node" aria-label="Add child to ${esc(n.text)}" title="Add child idea">${icon('plus')}</button></div>`;
    }).join('');
    renderEdges();
  }
  function renderEdges(){
    const all=map().nodes;
    $('connections').innerHTML=all.filter(n=>n.parent!==null).map(n=>{const p=all.find(x=>x.id===n.parent);if(!p)return '';const pd=dimensions(p),nd=dimensions(n),right=n.x>=p.x,from=p.x+(right?pd.w/2:-pd.w/2),to=n.x+(right?-nd.w/2:nd.w/2),mid=(from+to)/2;return `<path class="connection" stroke="${palette[n.color].line}" d="M${from},${p.y} C${mid},${p.y} ${mid},${n.y} ${to},${n.y}"/>`;}).join('');
  }
  function renderSidebar(){
    $('recentMaps').innerHTML=[...maps].sort((a,b)=>b.updated-a.updated).slice(0,7).map(m=>`<button class="recent-map ${m.id===currentId?'active':''}" data-map="${esc(m.id)}"><span class="map-marker"></span><span>${esc(m.title)}</span>${m.favorite?icon('star'):''}</button>`).join('');
    $('mapCount').textContent=maps.length;
    if(document.activeElement!==$('mapTitle'))$('mapTitle').value=map().title;
    document.title=`${map().title} — Mindo`;
    $('favoriteBtn').classList.toggle('favorite-on',map().favorite);
    $('favoriteBtn').setAttribute('aria-label',map().favorite?'Remove from favorites':'Add to favorites');
  }
  function renderInspector(){
    const n=node(),p=palette[n.color];$('selectedLabel').textContent=n.text;$('selectedDot').style.background=p.line;
    $('colorSwatches').innerHTML=Object.entries(palette).map(([name,c])=>`<button class="swatch ${n.color===name?'selected':''}" data-color="${name}" style="background:${c.chip}" aria-label="${name} color" title="${name}">${n.color===name?icon('check'):''}</button>`).join('');
    document.querySelectorAll('[data-shape]').forEach(b=>b.classList.toggle('active',b.dataset.shape===n.shape));
    $('textSizeBtn').innerHTML=`${n.size||15} ${icon('chevron','small')}`;$('boldBtn').classList.toggle('active',!!n.bold);$('italicBtn').classList.toggle('active',!!n.italic);
    if(document.activeElement!==$('nodeNote')||$('nodeNote').dataset.node!==n.id){$('nodeNote').value=n.note||'';$('nodeNote').dataset.node=n.id;noteSession=null;}
    $('deleteBtn').disabled=n.parent===null;$('duplicateBtn').disabled=n.parent===null;
    $('undoBtn').disabled=!history.length;$('redoBtn').disabled=!future.length;
    $('nodeCount').textContent=`${map().nodes.length} ${map().nodes.length===1?'idea':'ideas'}`;
  }
  function render(){renderNodes();renderSidebar();renderInspector();if(!$('outlinePanel').hidden)renderOutline();}
  function select(id){if(editing)finishEdit();selected=id;document.querySelectorAll('.node').forEach(el=>{const active=el.dataset.id===id;el.classList.toggle('selected',active);el.setAttribute('aria-pressed',String(active));});renderInspector();}
  function applyTransform(){$('world').style.transform=`translate(${view.x}px,${view.y}px) scale(${view.scale})`;$('zoomLabel').textContent=`${Math.round(view.scale*100)}%`;}
  function fit(){
    const rect=$('viewport').getBoundingClientRect();const side=panelOpen&&!document.body.classList.contains('focus-mode')? (innerWidth>1200?266:245):20;
    const dims=map().nodes.map(n=>({...dimensions(n),x:n.x,y:n.y}));const minX=Math.min(...dims.map(n=>n.x-n.w/2)),maxX=Math.max(...dims.map(n=>n.x+n.w/2)),minY=Math.min(...dims.map(n=>n.y-n.h/2)),maxY=Math.max(...dims.map(n=>n.y+n.h/2));
    const left=innerWidth<=720?66:88,top=100,bottom=112,availW=Math.max(180,rect.width-left-side-24),availH=Math.max(180,rect.height-top-bottom);
    view.scale=Math.max(innerWidth<=720?.45:.12,Math.min(1.08,availW/(maxX-minX+30),availH/(maxY-minY+30)));
    view.x=left+availW/2-(minX+maxX)/2*view.scale;view.y=top+availH/2-(minY+maxY)/2*view.scale;applyTransform();
  }
  function zoom(factor,point){const r=$('viewport').getBoundingClientRect(),c=point||{x:r.width/2,y:r.height/2},next=Math.max(.12,Math.min(2.5,view.scale*factor)),ratio=next/view.scale;view.x=c.x-(c.x-view.x)*ratio;view.y=c.y-(c.y-view.y)*ratio;view.scale=next;applyTransform();}
  function setTool(value){tool=value;$('selectTool').classList.toggle('active',value==='select');$('panTool').classList.toggle('active',value==='pan');$('viewport').classList.toggle('pan-mode',value==='pan'||spaceHeld);}
  function addNode(parentId=selected,sibling=false){
    finishEdit();if(map().nodes.length>=500){toast('This map has 500 ideas. Start a new map to keep exploring.');return;}let parent=map().nodes.find(n=>n.id===parentId)||root();if(sibling){if(parent.parent===null){toast('The central idea has no siblings. Try adding a child.');return;}parent=map().nodes.find(n=>n.id===parent.parent);}
    const children=map().nodes.filter(n=>n.parent===parent.id);let direction=parent.parent===null?(children.length%2===0?1:-1):(parent.x>=root().x?1:-1);
    let x=parent.x+direction*(parent.parent===null?235:225),y=children.length?Math.max(...children.filter(n=>(n.x>=parent.x?1:-1)===direction).map(n=>n.y),parent.y-65)+72:parent.y;
    if(parent.parent===null&&children.length<2)y=parent.y;
    const added={id:uid(),parent:parent.id,text:'New idea',x,y,color:parent.parent===null?Object.keys(palette)[children.length%6]:parent.color,shape:'rounded',size:15};
    applyChange(()=>{map().nodes.push(added);selected=added.id;});ensureVisible(added);startEdit(added.id);
  }
  function ensureVisible(n){const r=$('viewport').getBoundingClientRect(),side=panelOpen?250:20;const x=n.x*view.scale+view.x,y=n.y*view.scale+view.y;if(x>r.width-side-100)view.x-=x-(r.width-side-100);if(x<130)view.x+=130-x;if(y>r.height-95)view.y-=y-(r.height-95);if(y<120)view.y+=120-y;applyTransform();}
  function deleteNode(){const n=node();if(n.parent===null){toast('Keep the central idea. You can edit its text.');return;}finishEdit();const ids=new Set([n.id]);let changed=true;while(changed){changed=false;map().nodes.forEach(c=>{if(ids.has(c.parent)&&!ids.has(c.id)){ids.add(c.id);changed=true;}});}applyChange(()=>{map().nodes=map().nodes.filter(c=>!ids.has(c.id));selected=n.parent;});toast(`${ids.size===1?'Idea':'Branch'} deleted · Ctrl Z to undo`);}
  function duplicate(){finishEdit();const n=node();if(n.parent===null)return;if(map().nodes.length>=500){toast('This map has reached 500 ideas.');return;}const copy={...clone(n),id:uid(),text:`${n.text} copy`.slice(0,120),y:n.y+75};applyChange(()=>{map().nodes.push(copy);selected=copy.id;});ensureVisible(copy);}
  function startEdit(id){
    if(tool==='pan')setTool('select');finishEdit();select(id);const n=node(),el=[...document.querySelectorAll('.node')].find(e=>e.dataset.id===id);if(!el)return;
    const input=document.createElement('input');input.value=n.text;input.maxLength=120;input.setAttribute('aria-label','Idea text');el.append(input);editing={id,input,original:n.text};input.focus();input.select();
    input.addEventListener('pointerdown',e=>e.stopPropagation());input.addEventListener('dblclick',e=>e.stopPropagation());input.addEventListener('keydown',e=>{e.stopPropagation();if(e.key==='Enter'){e.preventDefault();finishEdit();}else if(e.key==='Escape'){e.preventDefault();finishEdit(true);}else if(e.key==='Tab'){e.preventDefault();finishEdit();addNode(id);}});input.addEventListener('blur',()=>finishEdit());
  }
  function finishEdit(cancel=false){if(!editing)return;const edit=editing;editing=null;const n=map().nodes.find(n=>n.id===edit.id);const next=edit.input.value.trim()||'Untitled idea';edit.input.remove();if(n&&!cancel&&next!==edit.original){applyChange(()=>n.text=next);}else renderNodes();}
  let drag=null;
  $('viewport').addEventListener('pointerdown',e=>{
    if(e.button!==0&&e.button!==1)return;if(e.target.closest('input,.add-node'))return;
    const el=e.target.closest('.node'),pan=tool==='pan'||spaceHeld||e.button===1||!el;
    if(editing)finishEdit();
    if(!pan){select(el.dataset.id);el.focus({preventScroll:true});}else if(!el){$('viewport').focus({preventScroll:true});}
    drag={pointer:e.pointerId,startX:e.clientX,startY:e.clientY,x:pan?view.x:node().x,y:pan?view.y:node().y,pan,id:pan?null:selected,moved:false,snapshot:null};
    if(pan)$('viewport').classList.add('panning');
  });
  $('viewport').addEventListener('pointermove',e=>{
    if(!drag||drag.pointer!==e.pointerId)return;const dx=e.clientX-drag.startX,dy=e.clientY-drag.startY;if(!drag.moved&&Math.hypot(dx,dy)<4)return;
    if(!drag.moved){if(!drag.pan)drag.snapshot=clone(map());$('viewport').setPointerCapture(e.pointerId);}drag.moved=true;
    if(drag.pan){view.x=drag.x+dx;view.y=drag.y+dy;applyTransform();}else{const n=map().nodes.find(n=>n.id===drag.id);n.x=drag.x+dx/view.scale;n.y=drag.y+dy/view.scale;const el=[...document.querySelectorAll('.node')].find(e=>e.dataset.id===n.id),d=dimensions(n);el.style.left=`${n.x-d.w/2}px`;el.style.top=`${n.y-d.h/2}px`;renderEdges();}
  });
  function endDrag(e){if(!drag||e.pointerId!==drag.pointer)return;const last=drag;drag=null;$('viewport').classList.remove('panning');if($('viewport').hasPointerCapture(e.pointerId))$('viewport').releasePointerCapture(e.pointerId);if(last.moved&&!last.pan){history.push(last.snapshot);if(history.length>80)history.shift();future=[];commit();}}
  $('viewport').addEventListener('pointerup',endDrag);$('viewport').addEventListener('pointercancel',endDrag);
  $('nodes').addEventListener('dblclick',e=>{const el=e.target.closest('.node');if(el&&!e.target.closest('.add-node'))startEdit(el.dataset.id);});
  $('nodes').addEventListener('click',e=>{if(e.target.closest('.add-node')){const id=e.target.closest('.node').dataset.id;select(id);addNode(id);}});
  $('nodes').addEventListener('focusin',e=>{if(e.target.classList.contains('node'))select(e.target.dataset.id);});
  $('viewport').addEventListener('wheel',e=>{e.preventDefault();const r=$('viewport').getBoundingClientRect();zoom(Math.exp(-e.deltaY*.0015),{x:e.clientX-r.left,y:e.clientY-r.top});},{passive:false});
  function setPanel(value){panelOpen=value;document.body.classList.toggle('panel-hidden',!value);document.body.classList.toggle('panel-open',value);$('panelBtn').setAttribute('aria-pressed',String(value));if(!$('outlinePanel').hidden)renderOutline();}
  function renderOutline(){const all=map().nodes;function tree(parent){return `<ul>${all.filter(n=>n.parent===parent).map(n=>`<li><button data-outline="${esc(n.id)}"><span class="outline-dot" style="--dot:${palette[n.color].line}"></span>${esc(n.text)}</button>${tree(n.id)}</li>`).join('')}</ul>`;}const r=root();$('outlinePanel').innerHTML=`<h2>${esc(map().title)}</h2><div class="outline-tree"><button data-outline="${esc(r.id)}"><span class="outline-dot" style="--dot:#315c48"></span><strong>${esc(r.text)}</strong></button>${tree(r.id)}</div>`;}
  function setView(outline){$('outlinePanel').hidden=!outline;$('mapViewBtn').classList.toggle('active',!outline);$('outlineViewBtn').classList.toggle('active',outline);if(outline)renderOutline();}
  $('outlinePanel').addEventListener('click',e=>{const target=e.target.closest('[data-outline]');if(target){select(target.dataset.outline);setView(false);ensureVisible(node());startEdit(selected);}});
  function dialog(title,sub,body){finishEdit();$('dialogContent').innerHTML=`<div class="dialog-head"><div><h2>${title}</h2>${sub?`<p>${sub}</p>`:''}</div><button class="icon-button" data-close aria-label="Close dialog">${icon('close')}</button></div><div class="dialog-body">${body}</div>`;if(!$('appDialog').open)$('appDialog').showModal();}
  function closeDialog(){$('appDialog').close();}
  $('appDialog').addEventListener('click',e=>{if(e.target.closest('[data-close]')||e.target===$('appDialog'))closeDialog();});
  function templates(){dialog('A fresh place to start','Choose a starting point. Make it your own.',[
    ['blank','Your own blank canvas','One central idea. Endless possibilities.','plus'],['website','Website redesign','From your first insight to your next launch.','map'],['brainstorm','A little brainstorm','Explore, create, and connect your ideas.','spark'],['project','Product launch','Bring your next big thing into the world.','template']
    ].map(([kind,title,desc,ico])=>`<button class="template-card" data-template="${kind}"><span class="template-icon">${icon(ico)}</span><span><strong>${title}</strong><small>${desc}</small></span></button>`).join(''));}
  $('dialogContent').addEventListener('click',e=>{const template=e.target.closest('[data-template]'),result=e.target.closest('[data-open-map]');if(template)makeMap(template.dataset.template);if(result){const id=result.dataset.openMap,idea=result.dataset.idea;closeDialog();switchMap(id);if(idea){select(idea);ensureVisible(node());}}});
  function library(favorites=false){const items=maps.filter(m=>!favorites||m.favorite).sort((a,b)=>b.updated-a.updated);dialog(favorites?'Your favorites':'Your mind maps',favorites?'Keep your favorite ideas close.':`${maps.length} ${maps.length===1?'map':'maps'}. A world of possibilities.`,items.length?items.map(m=>`<button class="template-card" data-open-map="${esc(m.id)}"><span class="template-icon">${icon('map')}</span><span><strong>${esc(m.title)}</strong><small>${m.nodes.length} ideas · Saved on this device</small></span></button>`).join(''):'<div class="empty-state">Star a map to give it a home here.</div>');}
  function search(){dialog('Find a thought','Search your maps and all the ideas inside them.','<input class="dialog-input" id="searchInput" placeholder="What are you looking for?" aria-label="Search maps and ideas"><div class="search-results" id="searchResults"></div>');const input=$('searchInput');const results=()=>{const query=input.value.trim().toLowerCase();const found=[];maps.forEach(m=>{if(!query||m.title.toLowerCase().includes(query))found.push({m});if(query)m.nodes.filter(n=>n.text.toLowerCase().includes(query)).forEach(n=>found.push({m,n}));});$('searchResults').innerHTML=found.slice(0,30).map(({m,n})=>`<button class="search-result" data-open-map="${esc(m.id)}" ${n?`data-idea="${esc(n.id)}"`:''}>${icon(n?'search':'map')}<span><strong>${esc(n?n.text:m.title)}</strong><small>${n?esc(m.title):`${m.nodes.length} ideas · Mind map`}</small></span></button>`).join('')||'<div class="empty-state">No ideas found. Try another thought.</div>';};input.addEventListener('input',results);results();setTimeout(()=>input.focus(),40);}
  function shortcuts(){dialog('A few helpful shortcuts','More flow. Fewer clicks.',[['Add a child idea','Tab'],['Add a sibling idea','Enter'],['Edit selected idea','F2'],['Delete idea & its children','Delete'],['Undo','Ctrl Z'],['Redo','Ctrl Shift Z'],['Duplicate idea','Ctrl D'],['Find maps & ideas','Ctrl K'],['Pan the canvas','Space + drag'],['Select / pan tool','V / H'],['Fit map to screen','Ctrl 0'],['Exit focus mode','Esc']].map(([label,key])=>`<div class="shortcut-row"><span>${label}</span><kbd>${key}</kbd></div>`).join(''));}
  function exportSvg(){
    const all=map().nodes,ds=all.map(n=>({...dimensions(n),x:n.x,y:n.y}));const minX=Math.min(...ds.map(n=>n.x-n.w/2))-45,minY=Math.min(...ds.map(n=>n.y-n.h/2))-45,width=Math.max(...ds.map(n=>n.x+n.w/2))-minX+45,height=Math.max(...ds.map(n=>n.y+n.h/2))-minY+45;
    const edges=all.filter(n=>n.parent!==null).map(n=>{const p=all.find(x=>x.id===n.parent),pd=dimensions(p),nd=dimensions(n),sign=n.x>=p.x?1:-1,a=p.x+sign*pd.w/2,b=n.x-sign*nd.w/2,m=(a+b)/2;return `<path d="M${a},${p.y} C${m},${p.y} ${m},${n.y} ${b},${n.y}" fill="none" stroke="${palette[n.color].line}" stroke-width="2"/>`;}).join('');
    const boxes=all.map(n=>{const p=palette[n.color],d=dimensions(n),r=n.parent===null;let text=n.text;if(text.length>23)text=text.slice(0,21)+'…';return `<rect x="${n.x-d.w/2}" y="${n.y-d.h/2}" width="${d.w}" height="${d.h}" rx="${n.shape==='pill'?30:n.shape==='square'?2:10}" fill="${r?'#315c48':p.bg}" stroke="${r?'#294f3c':p.border}"/><text x="${n.x}" y="${n.y}" dominant-baseline="middle" text-anchor="middle" font-family="Arial,sans-serif" font-size="${n.size||15}" fill="${r?'#ffffff':p.ink}" font-weight="${n.bold||r?600:400}" ${n.italic?'font-style="italic"':''}>${esc(text)}</text>`;}).join('');
    return {svg:`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(width)}" height="${Math.ceil(height)}" viewBox="${minX} ${minY} ${width} ${height}"><title>${esc(map().title)}</title><rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#fafbf8"/>${edges}${boxes}</svg>`,width:Math.ceil(width),height:Math.ceil(height)};
  }
  function download(blob,ext){const a=document.createElement('a');const url=URL.createObjectURL(blob);a.href=url;a.download=`${map().title.replace(/[^a-z0-9]+/gi,'-').toLowerCase()||'mind-map'}.${ext}`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(`Your ${ext.toUpperCase()} export is ready`);}
  function exportMap(type){finishEdit();$('exportMenu').hidden=true;if(type==='json'){download(new Blob([JSON.stringify(map(),null,2)],{type:'application/json'}),'json');return;}const data=exportSvg(),blob=new Blob([data.svg],{type:'image/svg+xml'});if(type==='svg'){download(blob,'svg');return;}const image=new Image(),url=URL.createObjectURL(blob);image.onload=()=>{const canvas=document.createElement('canvas');const scale=Math.min(2,4096/Math.max(data.width,data.height));canvas.width=data.width*scale;canvas.height=data.height*scale;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0,canvas.width,canvas.height);canvas.toBlob(png=>{if(png)download(png,'png');else toast('Could not create PNG. Try SVG export.');});URL.revokeObjectURL(url);};image.onerror=()=>{URL.revokeObjectURL(url);toast('Could not create PNG. Try SVG export.');};image.src=url;}
  function encodeMap(m){const bytes=new TextEncoder().encode(JSON.stringify(m));let binary='';bytes.forEach(b=>binary+=String.fromCharCode(b));return btoa(binary);}
  function share(){finishEdit();const url=`${location.origin}${location.pathname}#map=${encodeMap(map())}`;dialog('Good ideas are worth sharing','Send a snapshot of this map to someone.',`<p>Anyone with the link can open their own editable copy.</p><div class="share-link"><input id="shareUrl" aria-label="Snapshot link" readonly><button class="button primary" id="copyLinkBtn">${icon('copy')}Copy link</button></div><p class="privacy-note">This shares the map as it is right now, including notes. Future edits stay in your own workspace. The recipient needs access to this app.</p>`);$('shareUrl').value=url;$('copyLinkBtn').onclick=async()=>{try{await navigator.clipboard.writeText(url);$('copyLinkBtn').innerHTML=`${icon('check')}Copied!`;toast('Snapshot link copied');}catch{$('shareUrl').select();toast('Select and copy the snapshot link');}};}
  async function importFile(file){try{const imported=validateMap(JSON.parse(await file.text()));imported.id=uid();imported.updated=Date.now();maps.unshift(imported);switchMap(imported.id);toast('Your mind map is ready');}catch(error){toast(error.message||'That file could not be opened. Try a Mindo JSON export.');}$('fileInput').value='';}
  $('fileInput').addEventListener('change',e=>{if(e.target.files[0])importFile(e.target.files[0]);});
  $('importBtn').onclick=()=>$('fileInput').click();
  $('newMapBtn').onclick=templates;$('templatesBtn').onclick=templates;$('inspirationBtn').onclick=templates;$('allMapsBtn').onclick=()=>library();$('favoritesBtn').onclick=()=>library(true);
  $('recentMaps').onclick=e=>{const target=e.target.closest('[data-map]');if(target)switchMap(target.dataset.map);};
  document.querySelector('.brand').onclick=e=>{e.preventDefault();library();};
  $('favoriteBtn').onclick=()=>{map().favorite=!map().favorite;persist();renderSidebar();toast(map().favorite?'Added to favorites':'Removed from favorites');};
  $('workspaceBtn').onclick=()=>dialog('Your personal workspace','A little space, just for you.',`<p>You have <strong>${maps.length} ${maps.length===1?'mind map':'mind maps'}</strong> and <strong>${maps.reduce((sum,m)=>sum+m.nodes.length,0)} ideas</strong> in this browser.</p><p>Maps save automatically on this device. Export an editable JSON file to keep a backup or move to another browser.</p><button class="button secondary" id="workspaceExport">${icon('download')}Export current map</button>`);
  $('dialogContent').addEventListener('click',e=>{if(e.target.closest('#workspaceExport'))exportMap('json');});
  $('mapTitle').addEventListener('focus',()=>{titleSession=false;});
  $('mapTitle').addEventListener('input',()=>{if(!titleSession){record();titleSession=true;}map().title=$('mapTitle').value.trim()||'Untitled mind map';map().updated=Date.now();persist();renderSidebar();renderInspector();});
  $('mapTitle').addEventListener('blur',()=>{titleSession=false;$('mapTitle').value=map().title;});
  $('searchBtn').onclick=search;$('helpBtn').onclick=shortcuts;$('shareBtn').onclick=share;
  $('exportBtn').onclick=e=>{e.stopPropagation();$('exportMenu').hidden=!$('exportMenu').hidden;};
  $('exportMenu').onclick=e=>{const target=e.target.closest('[data-export]');if(target)exportMap(target.dataset.export);};
  document.addEventListener('click',e=>{if(!e.target.closest('.export-wrap'))$('exportMenu').hidden=true;});
  $('selectTool').onclick=()=>setTool('select');$('panTool').onclick=()=>setTool('pan');$('addTool').onclick=()=>addNode();$('addChildBtn').onclick=()=>addNode();$('noteTool').onclick=()=>{setPanel(true);$('nodeNote').focus();};
  $('undoBtn').onclick=undo;$('redoBtn').onclick=redo;$('duplicateBtn').onclick=duplicate;$('deleteBtn').onclick=deleteNode;
  $('colorSwatches').onclick=e=>{const target=e.target.closest('[data-color]');if(target)applyChange(()=>node().color=target.dataset.color);};
  document.querySelectorAll('[data-shape]').forEach(b=>b.onclick=()=>applyChange(()=>node().shape=b.dataset.shape));
  $('boldBtn').onclick=()=>applyChange(()=>node().bold=!node().bold);$('italicBtn').onclick=()=>applyChange(()=>node().italic=!node().italic);
  $('textSizeBtn').onclick=()=>applyChange(()=>{const sizes=[14,15,16,18,20];node().size=sizes[(sizes.indexOf(node().size||15)+1)%sizes.length];});
  $('nodeNote').addEventListener('focus',()=>{$('nodeNote').dataset.node=selected;noteSession=null;});
  $('nodeNote').addEventListener('input',()=>{const n=map().nodes.find(n=>n.id===$('nodeNote').dataset.node);if(!n)return;if(noteSession!==n.id){record();noteSession=n.id;}n.note=$('nodeNote').value;map().updated=Date.now();persist();renderNodes();renderInspector();});
  $('nodeNote').addEventListener('blur',()=>{noteSession=null;});
  $('zoomOutBtn').onclick=()=>zoom(1/1.2);$('zoomInBtn').onclick=()=>zoom(1.2);$('fitBtn').onclick=fit;$('zoomLabel').onclick=()=>zoom(1/view.scale);
  $('panelBtn').onclick=()=>setPanel(!panelOpen);$('closePanelBtn').onclick=()=>setPanel(false);
  $('mapViewBtn').onclick=()=>setView(false);$('outlineViewBtn').onclick=()=>setView(true);
  $('focusBtn').onclick=()=>{document.body.classList.toggle('focus-mode');requestAnimationFrame(fit);};
  $('menuBtn').onclick=()=>$('sidebar').classList.toggle('open');
  document.addEventListener('pointerdown',e=>{if(innerWidth<=720&&!e.target.closest('.sidebar,#menuBtn'))$('sidebar').classList.remove('open');});
  document.addEventListener('keydown',e=>{
    const input=/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)||e.target.isContentEditable;
    if($('appDialog').open)return;
    const mod=e.ctrlKey||e.metaKey;
    if(mod&&e.key.toLowerCase()==='k'&&!editing){e.preventDefault();search();return;}
    if(input)return;
    if(mod&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?redo():undo();return;}
    if(mod&&e.key.toLowerCase()==='y'){e.preventDefault();redo();return;}
    if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicate();return;}
    if(mod&&e.key==='0'){e.preventDefault();fit();return;}
    if(mod&&e.key.toLowerCase()==='s'){e.preventDefault();exportMap('json');return;}
    if(e.key==='Escape'){document.body.classList.remove('focus-mode');$('sidebar').classList.remove('open');$('exportMenu').hidden=true;fit();return;}
    if(e.target!==document.body&&!e.target.closest('.node')&&e.target!==$('viewport'))return;
    if(e.key==='Tab'){e.preventDefault();addNode();}else if(e.key==='Enter'){e.preventDefault();addNode(selected,true);}else if(e.key==='F2'){e.preventDefault();startEdit(selected);}else if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteNode();}else if(e.key===' '){e.preventDefault();spaceHeld=true;setTool(tool);}else if(e.key.toLowerCase()==='h')setTool('pan');else if(e.key.toLowerCase()==='v')setTool('select');else if(e.key==='?')shortcuts();
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
  setPanel(panelOpen);render();persist();requestAnimationFrame(fit);
  window.addEventListener('beforeunload',()=>{if(editing)finishEdit();persist();});
})();
