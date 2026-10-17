/* ===================== 淡黄日记 PWA ===================== */
'use strict';

/* ---------- IndexedDB ---------- */
const DB_NAME = 'diaryDB', DB_VER = 1;
let db;
function openDB(){
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, DB_VER);
    r.onupgradeneeded = e => {
      const d = e.target.result;
      if(!d.objectStoreNames.contains('entries')) d.createObjectStore('entries', { keyPath: 'id' });
      if(!d.objectStoreNames.contains('settings')) d.createObjectStore('settings', { keyPath: 'key' });
    };
    r.onsuccess = e => { db = e.target.result; res(db); };
    r.onerror = e => rej(e.target.error);
  });
}
function tx(store, mode){ return db.transaction(store, mode).objectStore(store); }
function put(store, val){ return new Promise((res, rej) => { const r = tx(store,'readwrite').put(val); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }
function get(store, key){ return new Promise((res, rej) => { const r = tx(store,'readonly').get(key); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
function getAll(store){ return new Promise((res, rej) => { const r = tx(store,'readonly').getAll(); r.onsuccess=()=>res(r.result||[]); r.onerror=()=>rej(r.error); }); }
function del(store, key){ return new Promise((res, rej) => { const r = tx(store,'readwrite').delete(key); r.onsuccess=()=>res(); r.onerror=()=>rej(r.error); }); }

/* ---------- 工具 ---------- */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const pad = n => (n<10?'0':'')+n;
function todayStr(){ const d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function dateFromStr(s){ const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d); }
function fmtCN(s){ const d=dateFromStr(s); return d.getFullYear()+'年'+pad(d.getMonth()+1)+'月'+pad(d.getDate())+'日'; }
function weekCN(s){ const w='日一二三四五六'[dateFromStr(s).getDay()]; return '星期'+w; }
function shiftDate(s, days){ const d=dateFromStr(s); d.setDate(d.getDate()+days); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function monthStr(s){ const d=dateFromStr(s); return d.getFullYear()+'-'+pad(d.getMonth()+1); }

const MOODS = {
  '喜': {emo:'😊', color:'#f2a65a'},
  '怒': {emo:'😠', color:'#e06363'},
  '静': {emo:'😌', color:'#6fb1a0'},
  '忧': {emo:'😟', color:'#7c92c4'},
  '__custom__': {emo:'✏️', color:'#b3a98a'}
};
function moodDisplay(m){
  if(!m) return {emo:'·', color:'#b3a98a', text:''};
  if(typeof m === 'string') return {...MOODS[m], text:m};
  if(m.custom) return {emo:'✏️', color:'#b3a98a', text:m.custom};
  return {emo:'·', color:'#b3a98a', text:''};
}
function moodKey(m){
  if(m && typeof m==='string') return m;
  if(m && m.custom) return 'custom';
  return '';
}
function moodText(m){
  if(!m) return '';
  if(typeof m==='string') return m;
  if(m.custom) return m.custom;
  return '';
}

function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(()=>t.classList.add('hidden'), 1800);
}

function showView(id){
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#'+id).classList.remove('hidden');
}

/* ---------- 状态 ---------- */
const state = {
  writeDate: todayStr(),
  mood: null,            // '喜' | '怒' | '静' | '忧' | {custom:'...'}
  images: [],            // dataURL[]
  calMonth: monthStr(todayStr()),
  detailId: null,
  search: '',            // 列表搜索关键词
  filterMood: 'all'      // 列表筛选：all | 喜 | 怒 | 静 | 忧 | img
};

const ENCOURAGES = ['把今天留下来吧','三行也行，记一笔就好','今天也辛苦了','写下来，就记住了','给未来的自己留句话','哪怕只写一句心情','今天的你也值得被记录','慢慢说，不急'];

/* ===================== 封面页 ===================== */
async function renderCover(){
  $('#cover-encourage').textContent = ENCOURAGES[Math.floor(Math.random()*ENCOURAGES.length)];
  const entries = await getAll('entries');
  const count = entries.length;
  if(count === 0){
    $('#cover-stats').innerHTML = '<div>还没有日记，写下第一篇吧</div>';
  }else{
    const dates = entries.map(e=>e.id).sort();
    const last = dates[dates.length-1];
    // 连续天数
    let streak = 0; let cur = todayStr();
    if(dates.includes(cur)){ streak=1; cur=shiftDate(cur,-1);
      while(dates.includes(cur)){ streak++; cur=shiftDate(cur,-1); }
    }
    $('#cover-stats').innerHTML = '<div>已写下 '+count+' 篇日记</div>'+
      (streak>0?'<div>连续记录 '+streak+' 天 🔥</div>':'')+
      '<div>上次：'+fmtCN(last)+'</div>';
  }
  applyIcon();
}

/* ===================== 写日记页 ===================== */
function openWrite(dateStr){
  state.writeDate = dateStr || todayStr();
  state.mood = null;
  state.images = [];
  loadEntryIntoForm(state.writeDate);
  showView('view-write');
}
function loadEntryIntoForm(id){
  get('entries', id).then(e => {
    if(e){
      state.mood = e.mood || null;
      state.images = e.images || [];
      $('#title-input').value = e.title || '';
      $('#content-input').value = e.content || '';
      $('#tags-input').value = (e.tags||[]).join(' ');
    }else{
      state.mood = null; state.images = [];
      $('#title-input').value=''; $('#content-input').value=''; $('#tags-input').value='';
    }
    $('#custom-mood-box').classList.add('hidden');
    $('#custom-mood-input').value='';
    renderMoodChips();
    renderWriteDate();
    renderImages();
    updateWordCount();
  });
}
function renderWriteDate(){
  $('#write-date').textContent = fmtCN(state.writeDate);
  $('#write-week').textContent = weekCN(state.writeDate);
}
function renderMoodChips(){
  $$('#mood-row .mood-chip').forEach(chip=>{
    const m = chip.dataset.mood;
    const active = (m==='__custom__')
      ? (state.mood && typeof state.mood==='object' && state.mood.custom)
      : (state.mood === m);
    chip.classList.toggle('active', !!active);
  });
}
function updateWordCount(){
  const n = $('#content-input').value.trim().length;
  $('#word-count').textContent = n+' 字';
}
function renderImages(){
  const box = $('#img-thumbs'); box.innerHTML='';
  state.images.forEach((src,i)=>{
    const d = document.createElement('div'); d.className='img-thumb';
    d.innerHTML = '<img src="'+src+'"/><button class="del">×</button>';
    d.querySelector('.del').onclick = ()=>{ state.images.splice(i,1); renderImages(); };
    box.appendChild(d);
  });
}

function saveEntry(){
  const content = $('#content-input').value.trim();
  const title = $('#title-input').value.trim();
  const tags = $('#tags-input').value.trim().split(/\s+/).filter(Boolean);
  if(!state.mood && !content && !title){
    toast('写点什么再保存吧'); return;
  }
  const now = Date.now();
  const existing = { id: state.writeDate };
  get('entries', state.writeDate).then(e => {
    const rec = Object.assign({}, e, existing, {
      date: state.writeDate,
      mood: state.mood,
      title, content,
      images: state.images,
      tags,
      updatedAt: now,
      createdAt: e ? e.createdAt : now
    });
    return put('entries', rec);
  }).then(()=>{
    toast('已记下 '+fmtCN(state.writeDate));
    renderCover();
  });
}

/* ===================== 我的日记 ===================== */
function renderList(){
  getAll('entries').then(entries=>{
    entries.sort((a,b)=> b.id < a.id ? -1 : 1);
    // 心情统计（全量）
    const stat = {喜:0,怒:0,静:0,忧:0,custom:0};
    entries.forEach(e=>{ const k = moodKey(e.mood); if(k in stat) stat[k]++; });
    const order = [['喜','喜'],['怒','怒'],['静','静'],['忧','忧'],['__custom__','自定义']];
    $('#mood-stats').innerHTML = order.map(([k,lab])=>{
      const md = MOODS[k];
      return '<div class="mood-stat"><div class="ms-emo">'+md.emo+'</div><div class="ms-num">'+stat[k]+'</div><div class="ms-lab">'+lab+'</div></div>';
    }).join('');
    // 过滤：筛选 + 搜索
    const kw = state.search.trim().toLowerCase();
    const fm = state.filterMood;
    let view = entries.slice();
    if(fm==='img') view = view.filter(e=>(e.images||[]).length>0);
    else if(fm && fm!=='all') view = view.filter(e=> moodKey(e.mood)===fm);
    if(kw){
      view = view.filter(e=>{
        const mtext = moodText(e.mood);
        const hay = ((e.title||'')+' '+(e.content||'')+' '+(e.tags||[]).join(' ')+' '+mtext).toLowerCase();
        return hay.indexOf(kw)>=0;
      });
    }
    // 渲染
    const list = $('#entry-list');
    if(entries.length===0){
      $('#list-empty').classList.remove('hidden');
      $('#search-empty').classList.add('hidden');
      list.innerHTML='';
    }else if(view.length===0){
      $('#list-empty').classList.add('hidden');
      $('#search-empty').classList.remove('hidden');
      list.innerHTML='';
    }else{
      $('#list-empty').classList.add('hidden');
      $('#search-empty').classList.add('hidden');
      list.innerHTML = view.map(e=>{
        const md = moodDisplay(e.mood);
        const prev = (e.content||'').slice(0,60).replace(/\n/g,' ');
        const imgs = e.images||[];
        const imgHtml = imgs.length
          ? '<div class="ec-imgs"><img src="'+imgs[0]+'"/>'+(imgs.length>1?'<div class="more">+'+(imgs.length-1)+'</div>':'')+'</div>'
          : '';
        return '<div class="entry-card" data-id="'+e.id+'">'+
          '<div class="ec-mood">'+md.emo+'</div>'+
          '<div class="ec-main"><div class="ec-date">'+fmtCN(e.id)+' '+weekCN(e.id)+'</div>'+
          '<div class="ec-title">'+(e.title||'(无标题)')+'</div>'+
          '<div class="ec-prev">'+prev+'</div></div>'+ imgHtml +'</div>';
      }).join('');
      $$('#entry-list .entry-card').forEach(c=> c.onclick = ()=> openDetail(c.dataset.id));
    }
  });
}

function renderCalendar(){
  const [y,m] = state.calMonth.split('-').map(Number);
  $('#cal-title').textContent = y+'年'+pad(m)+'月';
  const first = new Date(y, m-1, 1);
  const startW = first.getDay();
  const days = new Date(y, m, 0).getDate();
  const grid = $('#cal-grid'); grid.innerHTML='';
  for(let i=0;i<startW;i++){ const e=document.createElement('div'); e.className='cal-cell empty'; grid.appendChild(e); }
  getAll('entries').then(entries=>{
    const map = {}; entries.forEach(e=> map[e.id]=e);
    const tStr = todayStr();
    for(let d=1; d<=days; d++){
      const ds = y+'-'+pad(m)+'-'+pad(d);
      const cell = document.createElement('div');
      cell.className = 'cal-cell';
      const has = !!map[ds];
      if(has) cell.classList.add('done');
      if(ds === tStr) cell.classList.add('today');
      cell.innerHTML = '<span>'+d+'</span>';
      if(has){
        const md = moodDisplay(map[ds].mood);
        if(md.color){
          const dot = document.createElement('span'); dot.className='dot';
          dot.style.background = md.color; cell.appendChild(dot);
        }
      }
      cell.onclick = ()=> openWrite(ds);
      grid.appendChild(cell);
    }
  });
}

/* ===================== 回顾页 ===================== */
async function renderReview(){
  const entries = (await getAll('entries')).slice().sort((a,b)=> a.id < b.id ? -1 : 1);
  const count = entries.length;
  if(count===0){
    $('#review-overview').innerHTML = '<div class="rev-empty">还没有日记，先去写几篇再来回顾吧 ✍️</div>';
    $('#mood-dist').innerHTML=''; $('#heatmap').innerHTML='';
    return;
  }
  const dates = entries.map(e=>e.id);
  const first = dates[0], last = dates[dates.length-1];
  let streak=0, cur=todayStr();
  if(dates.includes(cur)){ streak=1; cur=shiftDate(cur,-1); while(dates.includes(cur)){ streak++; cur=shiftDate(cur,-1);} }
  const thisYear = new Date().getFullYear();
  const yc = entries.filter(e=> e.id.indexOf(thisYear+'-')===0).length;
  $('#review-overview').innerHTML = '<div class="ov-grid">'+
    ovItem(count,'总篇数')+ ovItem(streak+' 天','连续')+ ovItem(yc,'今年')+
    ovItem(fmtCN(first),'首篇')+ ovItem(fmtCN(last),'最近')+'</div>';

  // 心情分布条形
  const stat={喜:0,怒:0,静:0,忧:0,custom:0};
  entries.forEach(e=>{ const k=moodKey(e.mood); if(k in stat) stat[k]++; });
  const order=[['喜','喜'],['怒','怒'],['静','静'],['忧','忧'],['custom','自定义']];
  const maxv = Math.max(1,...order.map(([k])=>stat[k]));
  $('#mood-dist').innerHTML = order.map(([k,lab])=>{
    const md = MOODS[k==='custom'?'__custom__':k];
    const v=stat[k]; const pct=Math.round(v/maxv*100);
    return '<div class="dist-row"><span class="dist-lab">'+md.emo+' '+lab+'</span>'+
      '<div class="dist-bar"><i style="width:'+pct+'%;background:'+md.color+'"></i></div>'+
      '<span class="dist-num">'+v+'</span></div>';
  }).join('');

  // 年度情绪热力图
  renderHeatmap(entries);
}
function ovItem(v,l){ return '<div class="ov-item"><div class="ov-num">'+v+'</div><div class="ov-lab">'+l+'</div></div>'; }
function renderHeatmap(entries){
  const map={}; entries.forEach(e=> map[e.id]=e.mood);
  const year = new Date().getFullYear();
  const grid = $('#heatmap'); grid.innerHTML='';
  const today = new Date(); today.setHours(0,0,0,0);
  let d = new Date(year,0,1);
  d.setDate(d.getDate() - d.getDay()); // 回退到本周周日，让首列对齐星期
  while(d.getFullYear()<=year){
    const ds = d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    const cell=document.createElement('div'); cell.className='hm-cell';
    if(d.getFullYear()===year){
      const m = map[ds];
      if(m){ const md=moodDisplay(m); cell.style.background=md.color; cell.title=ds+' · '+md.text; }
      else { const isFuture = d>today; cell.style.background = isFuture?'transparent':'#efe6c8'; }
    }else{
      cell.style.background='transparent';
    }
    grid.appendChild(cell);
    d.setDate(d.getDate()+1);
  }
}

/* ===================== 详情弹层 ===================== */
function openDetail(id){
  state.detailId = id;
  get('entries', id).then(e=>{
    if(!e){ return; }
    const md = moodDisplay(e.mood);
    const tags = (e.tags||[]).map(t=>'<span class="d-tag">'+t+'</span>').join('');
    const imgs = (e.images||[]).map(s=>'<img src="'+s+'"/>').join('');
    $('#detail-body').innerHTML =
      '<div class="d-date">'+fmtCN(e.id)+' '+weekCN(e.id)+'</div>'+
      '<div class="d-title">'+(e.title||'(无标题)')+'</div>'+
      '<div class="d-mood">'+md.emo+' '+(md.text||'')+'</div>'+
      '<div class="d-content">'+(e.content||'(没有文字)')+'</div>'+
      (imgs?'<div class="d-imgs">'+imgs+'</div>':'')+
      (tags?'<div class="d-tags">'+tags+'</div>':'');
    $('#detail-mask').classList.remove('hidden');
  });
}
function closeDetail(){ $('#detail-mask').classList.add('hidden'); state.detailId=null; }

/* ===================== 设置 ===================== */
const ICON_PRESETS = [
  {key:'book', emo:'📔'},
  {key:'pen',  emo:'📝'},
  {key:'star', emo:'⭐'},
  {key:'moon', emo:'🌙'},
  {key:'sun',  emo:'☀️'}
];
let curIcon = {type:'book'};
let currentAppName = '今天写日记了吗';
async function loadSettings(){
  const a = await get('settings','icon'); if(a) curIcon = a.value;
  const c = await get('settings','customIcon'); if(c) curIcon.data = c.value;
  const an = await get('settings','appName'); if(an) currentAppName = an.value;
  applyIcon();
  renderIconPicker();
  $('#appname-input').value = currentAppName;
  const n = (await getAll('entries')).length;
  $('#stat-count').textContent = n;
}
function renderIconPicker(){
  const box = $('#icon-picker'); box.innerHTML='';
  ICON_PRESETS.forEach(p=>{
    const b = document.createElement('div');
    b.className = 'icon-opt'+(curIcon.type===p.key?' active':'');
    b.textContent = p.emo;
    b.onclick = ()=> setIcon({type:p.key});
    box.appendChild(b);
  });
  if(curIcon.type==='custom' && curIcon.data){
    const b = document.createElement('div');
    b.className='icon-opt active';
    b.innerHTML = '<img src="'+curIcon.data+'"/>';
    box.appendChild(b);
  }
}
function applyIcon(){
  const el = $('#cover-icon');
  el.style.cssText = '';
  if(curIcon.type==='custom' && curIcon.data){
    el.textContent = '';
    el.style.backgroundImage = 'url('+curIcon.data+')';
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
    el.style.borderRadius = '18px';
  }else{
    const p = ICON_PRESETS.find(x=>x.key===curIcon.type) || ICON_PRESETS[0];
    el.textContent = p.emo;
  }
}
async function setIcon(icon){
  curIcon = icon;
  await put('settings', {key:'icon', value:icon});
  if(icon.data) await put('settings', {key:'customIcon', value:icon.data});
  applyIcon(); renderIconPicker(); updateManifestIcon(icon);
  toast('已选图标，重新添加到主屏生效');
}
function updateManifestIcon(icon){
  let draw = ()=>{};
  const size = 512;
  const canvas = document.createElement('canvas'); canvas.width=canvas.height=size;
  const ctx = canvas.getContext('2d');
  // 背景：淡黄圆角
  ctx.fillStyle = '#fbf3d6'; roundRect(ctx,0,0,size,size,110); ctx.fill();
  if(icon.type==='custom' && icon.data){
    const img = new Image();
    img.onload = ()=>{ ctx.save(); roundRect(ctx,40,40,size-80,size-80,80); ctx.clip(); ctx.drawImage(img,40,40,size-80,size-80); ctx.restore(); finish(); };
    img.onerror = finish;
    img.src = icon.data;
  }else{
    const p = ICON_PRESETS.find(x=>x.key===icon.type)||ICON_PRESETS[0];
    ctx.font = (size*0.5)+'px serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillText(p.emo, size/2, size/2+10);
    finish();
  }
  async function finish(){
    const dataURL = canvas.toDataURL('image/png');
    // 存进 IndexedDB，Service Worker 会在安装时通过 /dynamic-icon.png 提供这张图
    await put('settings', {key:'manifestIconData', value:dataURL});
    await put('settings', {key:'hasCustomIcon', value:true});
  }
}
async function setAppName(name){
  currentAppName = name || '今天写日记了吗';
  await put('settings', {key:'appName', value:currentAppName});
  toast('名字已更新，重新添加到主屏生效');
}
function roundRect(ctx,x,y,w,h,r){ ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
function dataURLToBlob(d){ const a=d.split(','), m=a[0].match(/:(.*?);/)[1], b=atob(a[1]), n=b.length, u=new Uint8Array(n); for(let i=0;i<n;i++)u[i]=b.charCodeAt(i); return new Blob([u],{type:m}); }

/* 导出 / 导入 */
function exportBackup(){
  getAll('entries').then(entries=>{
    const data = { app:'huang-diary', version:1, exportedAt:Date.now(), entries };
    const blob = new Blob([JSON.stringify(data)],{type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'diary-backup-'+todayStr()+'.json';
    a.click();
    toast('已导出备份文件');
  });
}
function importBackup(file){
  const reader = new FileReader();
  reader.onload = ()=>{
    try{
      const data = JSON.parse(reader.result);
      const entries = data.entries||[];
      Promise.all(entries.map(e=>put('entries',e))).then(()=>{
        toast('已导入 '+entries.length+' 篇');
        renderCover(); loadSettings();
      });
    }catch(err){ toast('文件格式不对'); }
  };
  reader.readAsText(file);
}

/* 导出日记书（PDF） */
async function exportPDF(){
  const range = $('#pdf-range').value;
  let entries = (await getAll('entries')).slice();
  const y = new Date().getFullYear();
  if(range==='thisYear') entries = entries.filter(e=> e.id.indexOf(y+'-')===0);
  else if(range==='lastYear') entries = entries.filter(e=> e.id.indexOf((y-1)+'-')===0);
  entries.sort((a,b)=> a.id < b.id ? -1 : 1);
  if(entries.length===0){ toast('该范围还没有日记'); return; }
  const book = $('#pdf-book');
  let html = '<div class="pdf-cover"><h1>'+escapeHtml(currentAppName)+'</h1>'+
    '<div class="pdf-sub">共 '+entries.length+' 篇 · '+fmtCN(entries[0].id)+' — '+fmtCN(entries[entries.length-1].id)+'</div></div>';
  entries.forEach(e=>{
    const md=moodDisplay(e.mood);
    const imgs=(e.images||[]).map(s=>'<img src="'+s+'"/>').join('');
    const tags=(e.tags||[]).map(t=>'<span>'+escapeHtml(t)+'</span>').join('');
    html += '<div class="pdf-entry">'+
      '<div class="pe-head"><span class="pe-date">'+fmtCN(e.id)+' '+weekCN(e.id)+'</span>'+
      '<span class="pe-mood">'+md.emo+' '+(md.text||'')+'</span></div>'+
      (e.title?'<div class="pe-title">'+escapeHtml(e.title)+'</div>':'')+
      (e.content?'<div class="pe-content">'+escapeHtml(e.content)+'</div>':'')+
      (imgs?'<div class="pe-imgs">'+imgs+'</div>':'')+
      (tags?'<div class="pe-tags">'+tags+'</div>':'')+
      '</div>';
  });
  book.innerHTML = html;
  book.style.display = 'block';
  setTimeout(()=>{ window.print(); setTimeout(()=>{ book.style.display='none'; book.innerHTML=''; }, 800); }, 120);
}
function escapeHtml(s){ return (s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* ===================== 事件绑定 ===================== */
function bind(){
  // 封面
  $('#btn-start').onclick = ()=> openWrite(todayStr());
  $('#btn-to-journal').onclick = ()=>{ switchJournal('list'); showView('view-journal'); };
  $('#btn-to-settings').onclick = ()=>{ loadSettings(); showView('view-settings'); };
  // 写日记
  $('#write-back').onclick = ()=> showView('view-cover');
  $('#write-save').onclick = saveEntry;
  $('#write-save-top').onclick = saveEntry;
  $('#write-prev').onclick = ()=>{ renderCover(); showView('view-cover'); };
  $('#write-next').onclick = ()=>{ switchJournal('list'); showView('view-journal'); };
  $('#date-prev').onclick = ()=>{ state.writeDate=shiftDate(state.writeDate,-1); loadEntryIntoForm(state.writeDate); };
  $('#date-next').onclick = ()=>{ state.writeDate=shiftDate(state.writeDate,1); loadEntryIntoForm(state.writeDate); };
  $$('#mood-row .mood-chip').forEach(chip=>{
    chip.onclick = ()=>{
      const m = chip.dataset.mood;
      if(m==='__custom__'){
        const box = $('#custom-mood-box'); box.classList.toggle('hidden');
        if(!box.classList.contains('hidden')){ state.mood={custom:''}; setTimeout(()=>$('#custom-mood-input').focus(),50); }
        else state.mood=null;
      }else{
        state.mood = m; $('#custom-mood-box').classList.add('hidden'); $('#custom-mood-input').value='';
      }
      renderMoodChips();
    };
  });
  $('#custom-mood-input').oninput = (e)=>{ state.mood = {custom: e.target.value.trim()}; renderMoodChips(); };
  $('#content-input').oninput = updateWordCount;
  $('#img-add').onclick = ()=> $('#img-input').click();
  $('#img-input').onchange = (e)=>{
    const files = Array.from(e.target.files||[]);
    files.forEach(f=>{
      const r = new FileReader();
      r.onload = ()=>{ state.images.push(r.result); renderImages(); };
      r.readAsDataURL(f);
    });
    e.target.value='';
  };
  // 我的日记
  $('#journal-back').onclick = ()=> showView('view-cover');
  $('#journal-new').onclick = ()=> openWrite(todayStr());
  $('#tab-list').onclick = ()=> switchJournal('list');
  $('#tab-calendar').onclick = ()=> switchJournal('calendar');
  $('#tab-review').onclick = ()=> switchJournal('review');
  $('#cal-prev').onclick = ()=>{ const [y,m]=state.calMonth.split('-').map(Number); const nd=new Date(y,m-2,1); state.calMonth=nd.getFullYear()+'-'+pad(nd.getMonth()+1); renderCalendar(); };
  $('#cal-next').onclick = ()=>{ const [y,m]=state.calMonth.split('-').map(Number); const nd=new Date(y,m,1); state.calMonth=nd.getFullYear()+'-'+pad(nd.getMonth()+1); renderCalendar(); };
  // 列表：搜索 + 筛选
  $('#search-input').oninput = (e)=>{ state.search=e.target.value; renderList(); };
  $$('#filter-row .filter-chip').forEach(ch=>{
    ch.onclick = ()=>{
      state.filterMood = ch.dataset.filter;
      $$('#filter-row .filter-chip').forEach(x=> x.classList.toggle('active', x===ch));
      renderList();
    };
  });
  // 设置
  $('#settings-back').onclick = ()=> showView('view-cover');
  $('#appname-input').oninput = (e)=> setAppName(e.target.value.trim() || '今天写日记了吗');
  $('#icon-pick').onclick = ()=> $('#icon-input').click();
  $('#icon-camera').onclick = ()=> $('#icon-input-cam').click();
  const onIconFile = (e)=>{
    const f = e.target.files[0]; if(!f) return;
    const r = new FileReader();
    r.onload = ()=> setIcon({type:'custom', data:r.result});
    r.readAsDataURL(f);
    e.target.value='';
  };
  $('#icon-input').onchange = onIconFile;
  $('#icon-input-cam').onchange = onIconFile;
  $('#btn-export').onclick = exportBackup;
  $('#btn-import').onclick = ()=> $('#import-input').click();
  $('#import-input').onchange = (e)=>{ if(e.target.files[0]) importBackup(e.target.files[0]); e.target.value=''; };
  $('#btn-export-pdf').onclick = exportPDF;
  // 详情
  $('#detail-close').onclick = closeDetail;
  $('#detail-mask').onclick = (e)=>{ if(e.target===$('#detail-mask')) closeDetail(); };
  $('#detail-edit').onclick = ()=>{ const id=state.detailId; closeDetail(); openWrite(id); };
  $('#detail-delete').onclick = ()=>{
    if(state.detailId && confirm('确定删除这篇日记？')){
      del('entries', state.detailId).then(()=>{ closeDetail(); toast('已删除'); renderList(); renderCover(); });
    }
  };
}
function switchJournal(mode){
  $$('.tab').forEach(t=> t.classList.toggle('active', t.dataset.mode===mode));
  $('#journal-list').classList.toggle('hidden', mode!=='list');
  $('#journal-calendar').classList.toggle('hidden', mode!=='calendar');
  $('#journal-review').classList.toggle('hidden', mode!=='review');
  if(mode==='list') renderList();
  else if(mode==='calendar'){ state.calMonth = monthStr(todayStr()); renderCalendar(); }
  else if(mode==='review') renderReview();
}

/* ===================== 启动 ===================== */
openDB().then(()=>{
  bind();
  renderCover();
  loadSettings();
  if('serviceWorker' in navigator){ navigator.serviceWorker.register('sw.js').catch(()=>{}); }
});
