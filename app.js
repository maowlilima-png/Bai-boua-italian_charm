// ===== INTRO =====
let introIdx = 0;
const introKeys = Object.keys(INTRO_IMGS).sort();

function buildIntro() {
  const wrap = document.getElementById('introWrap');
  const dots = document.getElementById('introDots');
  introKeys.forEach((k, i) => {
    const img = document.createElement('img');
    img.src = INTRO_IMGS[k];
    img.className = 'intro-img' + (i === 0 ? ' active' : '');
    img.style.width = '100%';
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
    imgs[introIdx].classList.remove('active');
    dots[introIdx].classList.remove('active');
    introIdx++;
    imgs[introIdx].classList.add('active');
    dots[introIdx].classList.add('active');
    if (introIdx === introKeys.length - 1)
      document.getElementById('introBtn').textContent = 'ເລີ່ມເລີຍ ✦';
  } else {
    closeIntro();
  }
}

function closeIntro() {
  document.getElementById('intro').style.display = 'none';
}

// ===== NAVIGATION =====
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
    o.frequency.value = 700 + Math.random() * 300;
    o.type = 'sine';
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    o.start(); o.stop(ctx.currentTime + 0.15);
  } catch (e) {}
}

document.addEventListener('click', function (e) {
  playTick();
  const r = document.createElement('div');
  r.className = 'ripple';
  r.style.left = e.clientX + 'px';
  r.style.top = e.clientY + 'px';
  document.body.appendChild(r);
  setTimeout(() => r.remove(), 400);
});

// ===== HOME =====
function buildHome() {
  const grid = document.getElementById('catGrid');
  CHARM_DATA.forEach(catObj => {
    const minP = Math.min(...catObj.subs.map(s => s.price));
    const img = catObj.subs[0].imgs[0];
    const card = document.createElement('div');
    card.className = 'cat-card';
    card.innerHTML = `<img class="cat-img" src="${img}" loading="lazy">
      <div class="cat-info">
        <div class="cat-name">${catObj.cat}</div>
        <div class="cat-price">ເລີ່ມ ${(minP / 1000).toFixed(0)}K</div>
      </div>`;
    card.onclick = () => {
      activeCat = catObj.cat;
      goScreen('designer');
      renderPickerCats();
      renderCharmGrid();
    };
    grid.appendChild(card);
  });
}

// ===== DESIGNER STATE =====
let selectedCharms = [], selectedLayer = null;
let activeCat = CHARM_DATA[0]?.cat || '';
let charmPos = {}, charmUID = 0;

// ===== PICKER =====
function renderPickerCats() {
  const el = document.getElementById('pickerCats');
  el.innerHTML = '';
  CHARM_DATA.forEach(catObj => {
    const btn = document.createElement('button');
    btn.className = 'pcat' + (catObj.cat === activeCat ? ' active' : '');
    btn.textContent = catObj.cat;
    btn.onclick = () => {
      activeCat = catObj.cat;
      document.querySelectorAll('.pcat').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderCharmGrid();
    };
    el.appendChild(btn);
  });
}

function renderCharmGrid() {
  const el = document.getElementById('charmScroll');
  el.innerHTML = '';
  const catObj = CHARM_DATA.find(c => c.cat === activeCat);
  if (!catObj) return;
  catObj.subs.forEach(sub => {
    sub.imgs.forEach(imgSrc => {
      const item = document.createElement('div');
      item.className = 'charm-item';
      item.innerHTML = `<div class="charm-img-wrap"><img src="${imgSrc}" loading="lazy"></div>
        <div class="charm-iname">${catObj.cat}</div>
        <div class="charm-iprice">${(sub.price / 1000).toFixed(0)}K</div>`;
      item.onclick = () => addCharm(catObj.cat, sub.price, imgSrc);
      el.appendChild(item);
    });
  });
}

// ===== BRACELET LOGIC =====
function addCharm(name, price, imgSrc) {
  const uid = 'c' + (++charmUID);
  selectedCharms.push({ uid, name, price, imgSrc });
  charmPos[uid] = { x: 0, y: 0, size: 40 };
  selectedLayer = uid;
  renderBracelet();
  renderLayers();
  updateSumbar();
  document.getElementById('joystick').classList.add('vis');
  document.getElementById('hint').style.display = 'none';
}

function renderBracelet() {
  const el = document.getElementById('bracelet');
  el.innerHTML = '<div class="clasp"></div>';
  selectedCharms.forEach(c => {
    const pos = charmPos[c.uid];
    const div = document.createElement('div');
    div.className = 'charm-on-rail' + (c.uid === selectedLayer ? ' selected' : '');
    div.style.width = pos.size + 'px';
    div.style.height = pos.size + 'px';
    div.style.transform = `translate(${pos.x}px,${pos.y}px)`;
    const img = document.createElement('img');
    img.src = c.imgSrc;
    img.style.width = (pos.size - 8) + 'px';
    img.style.height = (pos.size - 8) + 'px';
    img.style.objectFit = 'contain';
    div.appendChild(img);
    div.onclick = (e) => {
      e.stopPropagation();
      selectedLayer = c.uid;
      renderBracelet();
      renderLayers();
      document.getElementById('joystick').classList.add('vis');
    };
    el.appendChild(div);
    const ch = document.createElement('div');
    ch.className = 'chain';
    el.appendChild(ch);
  });
  el.innerHTML += '<div class="clasp"></div>';
}

function renderLayers() {
  const el = document.getElementById('layerList');
  if (!selectedCharms.length) { el.innerHTML = '<div class="layer-empty">ຍັງບໍ່ມີ</div>'; return; }
  el.innerHTML = '';
  selectedCharms.forEach((c, i) => {
    const div = document.createElement('div');
    div.className = 'layer-item' + (c.uid === selectedLayer ? ' sel' : '');
    div.innerHTML = `<span class="layer-num">${i + 1}</span>
      <img src="${c.imgSrc}" style="width:18px;height:18px;object-fit:cover;border-radius:3px">
      <span style="font-size:9px;max-width:36px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</span>
      <button class="layer-del" onclick="event.stopPropagation();removeCharm('${c.uid}')">✕</button>`;
    div.onclick = () => {
      selectedLayer = c.uid;
      renderBracelet();
      renderLayers();
      document.getElementById('joystick').classList.add('vis');
    };
    el.appendChild(div);
  });
}

function removeCharm(uid) {
  selectedCharms = selectedCharms.filter(c => c.uid !== uid);
  delete charmPos[uid];
  if (selectedLayer === uid) selectedLayer = selectedCharms.length ? selectedCharms[selectedCharms.length - 1].uid : null;
  renderBracelet(); renderLayers(); updateSumbar();
  if (!selectedCharms.length) {
    document.getElementById('joystick').classList.remove('vis');
    document.getElementById('hint').style.display = '';
  }
}

function moveCharm(dx, dy) {
  if (!selectedLayer || !charmPos[selectedLayer]) return;
  charmPos[selectedLayer].x += dx;
  charmPos[selectedLayer].y += dy;
  renderBracelet();
}

function centerCharm() {
  if (!selectedLayer || !charmPos[selectedLayer]) return;
  charmPos[selectedLayer].x = 0; charmPos[selectedLayer].y = 0;
  renderBracelet();
}

function resizeCharm(d) {
  if (!selectedLayer || !charmPos[selectedLayer]) return;
  const p = charmPos[selectedLayer];
  p.size = Math.max(24, Math.min(70, p.size + d));
  renderBracelet();
}

function updateSumbar() {
  const n = selectedCharms.length;
  const total = selectedCharms.reduce((s, c) => s + c.price, 0);
  document.getElementById('sumCount').textContent = n + ' ຊິ້ນ';
  document.getElementById('sumPrice').textContent = total.toLocaleString() + ' ກີບ';
  document.getElementById('saveBtn').disabled = n === 0;
}

// ===== SUMMARY =====
function buildSummary() {
  const prev = document.getElementById('orderPreview');
  const list = document.getElementById('orderList');
  const totalEl = document.getElementById('orderTotal');
  prev.innerHTML = ''; list.innerHTML = '';
  if (!selectedCharms.length) {
    prev.innerHTML = '<div style="font-size:12px;color:#878679;padding:8px">ຍັງບໍ່ໄດ້ເລືອກຊາມ</div>';
    totalEl.textContent = '0 ກີບ'; return;
  }
  const counts = {};
  selectedCharms.forEach(c => {
    const k = c.imgSrc;
    if (!counts[k]) counts[k] = { ...c, qty: 0 };
    counts[k].qty++;
  });
  selectedCharms.forEach(c => {
    const img = document.createElement('img');
    img.className = 'op-img'; img.src = c.imgSrc;
    prev.appendChild(img);
  });
  let total = 0;
  Object.values(counts).forEach(item => {
    total += item.price * item.qty;
    list.innerHTML += `<div class="order-item">
      <div class="oi-left">
        <img class="oi-img" src="${item.imgSrc}">
        <div><div class="oi-name">${item.name}</div><div class="oi-qty">x${item.qty} · ${(item.price / 1000).toFixed(0)}K/ຊິ້ນ</div></div>
      </div>
      <div class="oi-price">${(item.price * item.qty).toLocaleString()} ກີບ</div>
    </div>`;
  });
  totalEl.textContent = total.toLocaleString() + ' ກີບ';
}

function saveImg() {
  alert('📷 ກະລຸນາ screenshot ໜ້ານີ້ ແລ້ວສົ່ງໃຫ້ຮ້ານ!');
}

function sendOrder() {
  if (!selectedCharms.length) { alert('ກະລຸນາເລືອກຊາມກ່ອນ!'); return; }
  const total = selectedCharms.reduce((s, c) => s + c.price, 0);
  alert('✅ ສຳເລັດ!\n\nລາຄາ: ' + total.toLocaleString() + ' ກີບ\n\nສົ່ງ screenshot ໜ້ານີ້ ຫຼື WhatsApp ໃຫ້ທາງຮ້ານ 📲');
}

// ===== INIT =====
buildIntro();
buildHome();
renderPickerCats();
renderCharmGrid();
renderBracelet();
