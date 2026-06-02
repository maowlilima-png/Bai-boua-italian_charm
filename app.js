// ============================================================
// Bai Boua Italian Charm — app.js (clean rewrite)
// ============================================================

// ===== INTRO =====
let introIdx = 0;
const introKeys = Object.keys(INTRO_IMGS).sort();

function buildIntro() {
  const wrap = document.getElementById('introWrap');
  const dots = document.getElementById('introDots');
  introKeys.forEach((k, i) => {
    const img = document.createElement('img');
    img.src = INTRO_IMGS[k]; img.style.width = '100%';
    img.className = 'intro-img' + (i === 0 ? ' active' : '');
    wrap.appendChild(img);
    const d = document.createElement('div');
    d.className = 'intro-dot' + (i === 0 ? ' active' : '');
    dots.appendChild(d);
  });
}
function nextIntro() {
  const imgs = document.querySelectorAll('.intro-img');
  const dots = document.querySelectorAll('.intro-dot');
  if (introIdx < introKeys.length - 1) {
    imgs[introIdx].classList.remove('active'); dots[introIdx].classList.remove('active');
    introIdx++;
    imgs[introIdx].classList.add('active'); dots[introIdx].classList.add('active');
    if (introIdx === introKeys.length - 1) document.getElementById('introBtn').textContent = 'ເລີ່ມເລີຍ ✦';
  } else closeIntro();
}
function closeIntro() { document.getElementById('intro').style.display = 'none'; }

// ===== NAV =====
function goScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('screen-' + id).classList.add('active');
  document.getElementById('tab-' + id).classList.add('active');
  if (id === 'summary') buildSummary();
}

// ===== SOUND + RIPPLE =====
function playTick() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.frequency.value = 700 + Math.random() * 300; o.type = 'sine';
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(); o.stop(ctx.currentTime + 0.15);
  } catch(e) {}
}
document.addEventListener('click', e => {
  playTick();
  const r = document.createElement('div'); r.className = 'ripple';
  r.style.left = e.clientX + 'px'; r.style.top = e.clientY + 'px';
  document.body.appendChild(r); setTimeout(() => r.remove(), 400);
});

// ===== HOME =====
function buildHome() {
  const grid = document.getElementById('catGrid');
  CHARM_DATA.forEach(cat => {
    const minP = Math.min(...cat.subs.map(s => s.price));
    const card = document.createElement('div'); card.className = 'cat-card';
    card.innerHTML = `<img class="cat-img" src="${cat.subs[0].imgs[0]}" loading="lazy">
      <div class="cat-info"><div class="cat-name">${cat.cat}</div>
      <div class="cat-price">ເລີ່ມ ${(minP/1000).toFixed(0)}K</div></div>`;
    card.onclick = () => { activeCat = cat.cat; goScreen('designer'); renderPickerCats(); renderCharmGrid(); };
    grid.appendChild(card);
  });
}

// ===== IMAGE LOADER =====
const IMGS = {}; // src -> HTMLImageElement (fully loaded)
function loadImg(src) {
  return new Promise(resolve => {
    if (IMGS[src]) { resolve(IMGS[src]); return; }
    const el = new Image();
    el.onload = () => { IMGS[src] = el; resolve(el); };
    el.onerror = () => resolve(null);
    el.src = src;
  });
}

// ===== BG REMOVAL (flood-fill from edges, skip PNG) =====
const BG_CACHE = {};
function removeBG(src) {
  if (BG_CACHE[src]) return Promise.resolve(BG_CACHE[src]);
  // PNG already transparent — skip
  if (src.startsWith('data:image/png')) { BG_CACHE[src]=src; return Promise.resolve(src); }
  return loadImg(src).then(el => {
    if (!el) { BG_CACHE[src]=src; return src; }
    try {
      const oc = document.createElement('canvas');
      oc.width = el.naturalWidth; oc.height = el.naturalHeight;
      const ox = oc.getContext('2d'); ox.drawImage(el,0,0);
      const id = ox.getImageData(0,0,oc.width,oc.height);
      const d = id.data, W = oc.width, H = oc.height;
      // Only remove truly neutral white/light-grey pixels (low saturation)
      function isBG(p) {
        const r=d[p],g=d[p+1],b=d[p+2];
        const mx=Math.max(r,g,b), mn=Math.min(r,g,b);
        return r>210 && g>210 && b>210 && (mx-mn)<25;
      }
      const vis = new Uint8Array(W*H), q = [];
      for(let x=0;x<W;x++){q.push(x,0);q.push(x,H-1);}
      for(let y=1;y<H-1;y++){q.push(0,y);q.push(W-1,y);}
      for(let i=0;i<q.length;i+=2){
        const x=q[i],y=q[i+1];
        if(x<0||x>=W||y<0||y>=H) continue;
        const pos=y*W+x; if(vis[pos]) continue; vis[pos]=1;
        const p=pos*4; if(!isBG(p)) continue;
        d[p+3]=0;
        q.push(x-1,y);q.push(x+1,y);q.push(x,y-1);q.push(x,y+1);
      }
      ox.putImageData(id,0,0);
      const res = oc.toDataURL('image/png');
      BG_CACHE[src] = res;
      return loadImg(res).then(()=>res);
    } catch(e) { BG_CACHE[src]=src; return src; }
  });
}

// ===== CANVAS =====
function getCV() { return document.getElementById('freeCanvas'); }
function getDPR() { return window.devicePixelRatio || 1; }

// Logical size (CSS pixels) — all coordinates use these
function cvW() { return getCV().offsetWidth; }
function cvH() { return getCV().offsetHeight; }

function setupCanvas() {
  const c = getCV(), dpr = getDPR();
  c.width  = Math.round(cvW() * dpr);
  c.height = Math.round(cvH() * dpr);
}

function draw() {
  const c = getCV();
  if (!c.offsetWidth) return;

  // Re-sync physical size if layout changed
  const dpr = getDPR();
  const pw = Math.round(c.offsetWidth * dpr);
  const ph = Math.round(c.offsetHeight * dpr);
  if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }

  const ctx = c.getContext('2d');
  const W = c.offsetWidth, H = c.offsetHeight;

  // Clear physical canvas
  ctx.clearRect(0, 0, c.width, c.height);

  // Scale once so all drawing uses CSS pixel coords
  ctx.save();
  ctx.scale(dpr, dpr);

  // Chain guide line
  ctx.save();
  ctx.strokeStyle = 'rgba(200,169,110,0.25)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([5, 5]);
  ctx.beginPath(); ctx.moveTo(0, H / 2); ctx.lineTo(W, H / 2); ctx.stroke();
  ctx.restore();

  // Draw each charm
  charms.forEach(ch => {
    const img = IMGS[ch.src];
    if (!img) return;
    const half = ch.sz / 2;
    ctx.save();
    ctx.drawImage(img, ch.x - half, ch.y - half, ch.sz, ch.sz);
    // Selection corners
    if (ch.id === selId) {
      const t = 9, x = ch.x - half, y = ch.y - half, s = ch.sz;
      ctx.strokeStyle = '#c8a96e'; ctx.lineWidth = 2.5; ctx.setLineDash([]);
      ctx.beginPath(); ctx.moveTo(x, y+t); ctx.lineTo(x, y); ctx.lineTo(x+t, y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s-t, y); ctx.lineTo(x+s, y); ctx.lineTo(x+s, y+t); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, y+s-t); ctx.lineTo(x, y+s); ctx.lineTo(x+t, y+s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x+s-t, y+s); ctx.lineTo(x+s, y+s); ctx.lineTo(x+s, y+s-t); ctx.stroke();
    }
    ctx.restore();
  });

  ctx.restore(); // remove dpr scale
}

// ===== TOUCH + MOUSE =====
let charms = [], selId = null, activeCat = CHARM_DATA[0]?.cat || '', uidN = 0;
let drag = null, dox = 0, doy = 0;
let pinching = false, pinchD0 = 0, pinchS0 = 0;

function relPos(e, el) {
  const r = el.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
function hitTest(px, py) {
  for (let i = charms.length - 1; i >= 0; i--) {
    const c = charms[i], h = c.sz / 2;
    if (px >= c.x-h && px <= c.x+h && py >= c.y-h && py <= c.y+h) return c;
  }
  return null;
}

function initCanvas() {
  const c = getCV();
  setupCanvas();

  c.addEventListener('mousedown', e => {
    const p = relPos(e, c), h = hitTest(p.x, p.y);
    if (h) { drag = h; selId = h.id; dox = p.x - h.x; doy = p.y - h.y; renderLayers(); draw(); }
  });
  window.addEventListener('mousemove', e => {
    if (!drag) return;
    const p = relPos(e, c); drag.x = p.x - dox; drag.y = p.y - doy; draw();
  });
  window.addEventListener('mouseup', () => { drag = null; });

  c.addEventListener('touchstart', e => {
    if (e.touches.length === 1) {
      const p = relPos(e.touches[0], c), h = hitTest(p.x, p.y);
      if (h) { drag = h; selId = h.id; dox = p.x - h.x; doy = p.y - h.y; renderLayers(); draw(); }
    } else if (e.touches.length === 2) {
      pinching = true; drag = null;
      pinchD0 = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ch = charms.find(c => c.id === selId); pinchS0 = ch ? ch.sz : 65;
    }
    e.preventDefault();
  }, { passive: false });

  c.addEventListener('touchmove', e => {
    if (e.touches.length === 1 && drag && !pinching) {
      const p = relPos(e.touches[0], c); drag.x = p.x - dox; drag.y = p.y - doy; draw();
    } else if (e.touches.length === 2 && pinching) {
      const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
      const ch = charms.find(c => c.id === selId);
      if (ch) { ch.sz = Math.max(20, Math.min(180, pinchS0 * (d / pinchD0))); draw(); }
    }
    e.preventDefault();
  }, { passive: false });

  c.addEventListener('touchend', e => {
    if (e.touches.length < 2) pinching = false;
    if (e.touches.length === 0) drag = null;
  });

  window.addEventListener('resize', () => { setupCanvas(); draw(); });
}

// ===== ADD CHARM =====
async function addCharm(name, price, src) {
  await loadImg(src);
  const W = cvW(), H = cvH();
  const n = charms.length;
  const spacing = Math.min(65, (W - 80) / Math.max(n + 1, 1));
  const x = Math.min(40 + (n + 1) * spacing, W - 40);
  const y = H / 2;
  const ch = { id: 'c' + (++uidN), name, price, src, x, y, sz: 62 };
  charms.push(ch); selId = ch.id;
  draw(); renderLayers(); updateSumbar();
  document.getElementById('baHint').style.display = 'none';
  // Remove BG in background then redraw (only for JPEG)
  if (!src.startsWith('data:image/png')) {
    removeBG(src).then(processed => {
      if (processed !== src) {
        ch.src = processed;
        loadImg(processed).then(() => draw());
      }
    });
  }
}

// ===== LAYERS =====
function renderLayers() {
  const el = document.getElementById('layerList');
  if (!charms.length) { el.innerHTML = '<div class="lp-empty">ຍັງບໍ່ມີ</div>'; return; }
  el.innerHTML = '';
  [...charms].reverse().forEach((c, ri) => {
    const i = charms.length - 1 - ri;
    const d = document.createElement('div');
    d.className = 'lp-item' + (c.id === selId ? ' sel' : '');
    d.innerHTML = `<span class="lp-num">${i+1}</span>
      <img src="${c.src}" style="width:18px;height:18px;object-fit:contain;border-radius:3px;flex-shrink:0;background:var(--cream)">
      <span style="font-size:9px;max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      <button class="lp-del" onclick="event.stopPropagation();delCharm('${c.id}')">✕</button>`;
    d.onclick = () => { selId = c.id; renderLayers(); draw(); };
    el.appendChild(d);
  });
}
function delCharm(id) {
  charms = charms.filter(c => c.id !== id);
  if (selId === id) selId = charms.length ? charms[charms.length - 1].id : null;
  draw(); renderLayers(); updateSumbar();
  if (!charms.length) document.getElementById('baHint').style.display = '';
}

// ===== CONTROLS =====
function mCharm(dx, dy) {
  const c = charms.find(c => c.id === selId); if (!c) return;
  c.x += dx * 8; c.y += dy * 8; draw();
}
function cCenter() {
  const c = charms.find(c => c.id === selId); if (!c) return;
  c.x = cvW() / 2; c.y = cvH() / 2; draw();
}
function rSize(d) {
  const c = charms.find(c => c.id === selId); if (!c) return;
  c.sz = Math.max(20, Math.min(180, c.sz + d)); draw();
}
function lFwd() {
  const i = charms.findIndex(c => c.id === selId);
  if (i < charms.length - 1) { [charms[i], charms[i+1]] = [charms[i+1], charms[i]]; draw(); renderLayers(); }
}
function lBack() {
  const i = charms.findIndex(c => c.id === selId);
  if (i > 0) { [charms[i], charms[i-1]] = [charms[i-1], charms[i]]; draw(); renderLayers(); }
}
function updateSumbar() {
  const n = charms.length, total = charms.reduce((s, c) => s + c.price, 0);
  document.getElementById('sumCount').textContent = n + ' ຊິ້ນ';
  document.getElementById('sumPrice').textContent = total.toLocaleString() + ' ກີບ';
  document.getElementById('saveBtn').disabled = n === 0;
}

// ===== PICKER =====
function renderPickerCats() {
  const el = document.getElementById('pickerCats'); el.innerHTML = '';
  CHARM_DATA.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'pcat' + (cat.cat === activeCat ? ' active' : '');
    btn.textContent = cat.cat;
    btn.onclick = () => {
      activeCat = cat.cat;
      document.querySelectorAll('.pcat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active'); renderCharmGrid();
    };
    el.appendChild(btn);
  });
}
function renderCharmGrid() {
  const wrap = document.getElementById('charmGridWrap'); wrap.innerHTML = '';
  const inner = document.createElement('div'); inner.className = 'charm-grid-inner';
  const cat = CHARM_DATA.find(c => c.cat === activeCat);
  if (cat) {
    cat.subs.forEach(sub => {
      sub.imgs.forEach(src => {
        const item = document.createElement('div'); item.className = 'charm-item';
        item.innerHTML = `<div class="charm-img-wrap"><img src="${src}" loading="lazy"></div>
          <div class="charm-iname">${cat.cat}</div>
          <div class="charm-iprice">${(sub.price/1000).toFixed(0)}K</div>`;
        item.onclick = () => addCharm(cat.cat, sub.price, src);
        inner.appendChild(item);
      });
    });
  }
  wrap.appendChild(inner); wrap.scrollTop = 0;
}

// ===== SUMMARY =====
const WA = '85620 99809749', IG = 'https://www.instagram.com/maliluv_bb';
function buildSummary() {
  const list = document.getElementById('orderList');
  const tot  = document.getElementById('orderTotal');
  list.innerHTML = '';

  // Draw canvas design into preview
  const src = getCV();
  const prev = document.getElementById('previewCanvas');
  // Copy from the live canvas (already rendered correctly with DPR)
  const pw = src.offsetWidth, ph = src.offsetHeight;
  prev.width = Math.round(pw * getDPR());
  prev.height = Math.round(ph * getDPR());
  prev.style.width = '100%';
  prev.style.height = 'auto';
  prev.style.borderRadius = '10px';
  const pctx = prev.getContext('2d');
  // Just copy pixels from the live canvas
  pctx.drawImage(src, 0, 0);

  if (!charms.length) { tot.textContent = '0 ກີບ'; return; }

  // Count by unique image src
  const counts = {};
  charms.forEach(c => {
    const k = c.src + '|' + c.price;
    if (!counts[k]) counts[k] = { ...c, qty: 0 };
    counts[k].qty++;
  });
  let total = 0;
  Object.values(counts).forEach(it => {
    total += it.price * it.qty;
    list.innerHTML += `<div class="order-item">
      <div class="oi-left">
        <img class="oi-img" src="${it.src}">
        <div class="oi-info">
          <div class="oi-name">${it.name}</div>
          <div class="oi-qty">x${it.qty} · ${(it.price/1000).toFixed(0)}K/ຊິ້ນ</div>
        </div>
      </div>
      <div class="oi-price">${(it.price*it.qty).toLocaleString()} ກີບ</div>
    </div>`;
  });
  tot.textContent = total.toLocaleString() + ' ກີບ';
}
function getOrderText() {
  const counts = {};
  charms.forEach(c => { if (!counts[c.name+c.price]) counts[c.name+c.price] = { ...c, qty: 0 }; counts[c.name+c.price].qty++; });
  const total = charms.reduce((s, c) => s + c.price, 0);
  let msg = '🪬 ສັ່ງຊາຍແຂນ Bai Boua\n\n';
  Object.values(counts).forEach(i => { msg += `• ${i.name} x${i.qty} = ${(i.price*i.qty).toLocaleString()} ກີບ\n`; });
  return msg + `\n💰 ລາຄາລວມ: ${total.toLocaleString()} ກີບ`;
}
function sendWA() {
  if (!charms.length) { alert('ກະລຸນາເລືອກຊາມກ່ອນ!'); return; }
  window.open(`https://wa.me/${WA.replace(/\s/g,'')}?text=${encodeURIComponent(getOrderText())}`, '_blank');
}
function openIG() { window.open(IG, '_blank'); }
function dlImg() {
  const c = getCV(), a = document.createElement('a');
  a.href = c.toDataURL('image/png'); a.download = 'bai_boua_design.png'; a.click();
}


// ===== PANEL TOGGLES =====
let ctrlOpen = true, layerOpen = true;
function toggleCtrl() {
  ctrlOpen = !ctrlOpen;
  document.getElementById('ctrlBody').style.display = ctrlOpen ? '' : 'none';
  document.getElementById('ctrlToggleIcon').textContent = ctrlOpen ? '▲' : '▼';
}
function toggleLayer() {
  layerOpen = !layerOpen;
  document.getElementById('layerBody').style.display = layerOpen ? '' : 'none';
  document.getElementById('layerToggleIcon').textContent = layerOpen ? '▲' : '▼';
}

// ===== INIT =====
buildIntro();
buildHome();
renderPickerCats();
renderCharmGrid();
window.addEventListener('load', () => { initCanvas(); draw(); });
