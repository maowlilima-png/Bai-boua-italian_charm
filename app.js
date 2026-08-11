// ============================================================
// Bai Boua Italian Charm — upgraded version
// Fast image catalog, unique charm codes, search/favorites,
// autosave, undo/redo, customer form and clean export.
// ============================================================

const WA = '8562099809749';
const IG = 'https://www.instagram.com/maliluv_bb';
const CUSTOMER_KEY = 'bai_boua_customer_v2';
const FAVORITES_KEY = 'bai_boua_favorites_v2';
const INTRO_KEY = 'bai_boua_intro_seen_v2';
const SOUND_KEY = 'bai_boua_sound_muted_v2';

let charms = [];
let selId = null;
let uidN = 0;
let activeCat = CHARM_DATA[0]?.cat || '';
let activeSubIndex = -1; // -1 = show all set covers first
let drag = null;
let dragChanged = false;
let dox = 0;
let doy = 0;
let pinching = false;
let pinchD0 = 0;
let pinchS0 = 0;
let layerOpen = false;
let canvasSnapshot = null;
let lastCanvasW = 0;
let lastCanvasH = 0;
let searchTerm = '';
let maxPrice = 0;
let favoritesOnly = false;
let favorites = new Set(readJSON(FAVORITES_KEY, []));
let muted = localStorage.getItem(SOUND_KEY) === '1';
let soundCtx = null;
let introIdx = 0;
let introBuilt = false;
let history = [];
let historyIndex = -1;
let applyingHistory = false;
let setGridScrollMemory = {};
let restoreSetScrollOnNextGrid = false;

const IMGS = {};
const BG_CACHE = {};
const TRIM_CACHE = {};
const SPRITE_SRC_CACHE = {};
const CATALOG = buildCatalog();

function readJSON(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return value ?? fallback;
  } catch (_) {
    return fallback;
  }
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function buildCatalog() {
  let number = 0;
  const list = [];
  CHARM_DATA.forEach((cat, catIndex) => {
    cat.items = [];
    cat.subs.forEach((sub, subIndex) => {
      sub.imgs.forEach((src, imageIndex) => {
        number += 1;
        const item = {
          code: sub.codes?.[imageIndex] || `BB-${String(number).padStart(4, '0')}`,
          cat: cat.cat,
          catIndex,
          subIndex,
          setId: sub.id || `${catIndex}-${subIndex}`,
          imageIndex,
          subname: sub.subname,
          price: Number(sub.price) || 0,
          src
        };
        cat.items.push(item);
        list.push(item);
      });
    });
  });
  return list;
}

// ===== INTRO =====
const introKeys = Object.keys(INTRO_IMGS).sort();

function buildIntro() {
  if (introBuilt) return;
  const wrap = document.getElementById('introWrap');
  const dots = document.getElementById('introDots');
  wrap.innerHTML = '';
  dots.innerHTML = '';
  introKeys.forEach((key, index) => {
    const img = document.createElement('img');
    img.src = INTRO_IMGS[key];
    img.alt = `ວິທີໃຊ້ ${index + 1}`;
    img.className = `intro-img${index === 0 ? ' active' : ''}`;
    wrap.appendChild(img);

    const dot = document.createElement('span');
    dot.className = `intro-dot${index === 0 ? ' active' : ''}`;
    dots.appendChild(dot);
  });
  introBuilt = true;
}

function showIntro(force = false) {
  if (!force && localStorage.getItem(INTRO_KEY) === '1') return;
  buildIntro();
  introIdx = 0;
  document.querySelectorAll('.intro-img').forEach((img, i) => img.classList.toggle('active', i === 0));
  document.querySelectorAll('.intro-dot').forEach((dot, i) => dot.classList.toggle('active', i === 0));
  document.getElementById('introBtn').textContent = introKeys.length > 1 ? 'ຕໍ່ໄປ →' : 'ເລີ່ມເລີຍ ✦';
  document.getElementById('intro').hidden = false;
}

function nextIntro() {
  const imgs = document.querySelectorAll('.intro-img');
  const dots = document.querySelectorAll('.intro-dot');
  if (introIdx < introKeys.length - 1) {
    imgs[introIdx].classList.remove('active');
    dots[introIdx].classList.remove('active');
    introIdx += 1;
    imgs[introIdx].classList.add('active');
    dots[introIdx].classList.add('active');
    if (introIdx === introKeys.length - 1) {
      document.getElementById('introBtn').textContent = 'ເລີ່ມເລີຍ ✦';
    }
    return;
  }
  closeIntro();
}

function closeIntro() {
  document.getElementById('intro').hidden = true;
  localStorage.setItem(INTRO_KEY, '1');
}

// ===== NAVIGATION =====
function goScreen(id) {
  if (id === 'summary') {
    if (!charms.length) {
      showToast('ກະລຸນາເລືອກຊາມກ່ອນ');
      id = 'designer';
    } else {
      canvasSnapshot = createCleanCanvas();
    }
  }

  document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
  document.getElementById(`screen-${id}`).classList.add('active');
  document.getElementById(`tab-${id}`).classList.add('active');

  if (id === 'designer') {
    requestAnimationFrame(() => {
      setupCanvas(true);
      draw();
    });
  }
  if (id === 'summary') buildSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== SOUND + FEEDBACK =====
function updateSoundButton() {
  document.getElementById('soundBtn').textContent = muted ? '🔇' : '🔊';
}

function toggleSound() {
  muted = !muted;
  localStorage.setItem(SOUND_KEY, muted ? '1' : '0');
  updateSoundButton();
  showToast(muted ? 'ປິດສຽງແລ້ວ' : 'ເປີດສຽງແລ້ວ');
}

function playTick() {
  if (muted) return;
  try {
    soundCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = soundCtx.createOscillator();
    const gain = soundCtx.createGain();
    oscillator.connect(gain);
    gain.connect(soundCtx.destination);
    oscillator.frequency.value = 760;
    oscillator.type = 'sine';
    gain.gain.setValueAtTime(0.045, soundCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, soundCtx.currentTime + 0.08);
    oscillator.start();
    oscillator.stop(soundCtx.currentTime + 0.08);
  } catch (_) {}
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 1900);
}

document.addEventListener('click', event => {
  if (event.target.closest('button, .cat-card, .charm-item')) playTick();
});

// ===== HOME =====
function buildHome() {
  const tabs = document.getElementById('homeGroupTabs');
  const grid = document.getElementById('catGrid');
  tabs.innerHTML = '';
  grid.innerHTML = '';

  CHARM_DATA.forEach(cat => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `home-group-btn${cat.cat === activeCat ? ' active' : ''}`;
    button.textContent = `${cat.cat} · ${cat.subs.length} ຊຸດ`;
    button.addEventListener('click', () => {
      activeCat = cat.cat;
      activeSubIndex = -1;
      buildHome();
    });
    tabs.appendChild(button);
  });

  const cat = CHARM_DATA.find(item => item.cat === activeCat) || CHARM_DATA[0];
  if (!cat) return;
  cat.subs.forEach((sub, subIndex) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'cat-card';
    card.innerHTML = `
      <img class="cat-img" alt="${escapeHTML(sub.subname)}" loading="lazy" decoding="async">
      <div class="cat-info">
        <div class="cat-name">${escapeHTML(sub.subname)}</div>
        <div class="cat-meta"><span>${sub.imgs.length} ແບບ</span><strong>${Number(sub.price).toLocaleString()} ກີບ</strong></div>
      </div>`;
    enhanceThumbImage(card.querySelector('.cat-img'), sub.cover || sub.imgs[0] || '');
    card.addEventListener('click', () => {
      activeCat = cat.cat;
      activeSubIndex = subIndex;
      searchTerm = '';
      const search = document.getElementById('charmSearch');
      if (search) search.value = '';
      renderPickerCats();
      renderPickerSets();
      renderCharmGrid();
      goScreen('designer');
    });
    grid.appendChild(card);
  });
}

// ===== IMAGE LOADING / BACKGROUND CLEANING =====
function parseSpriteRef(src) {
  if (typeof src !== 'string' || !src.startsWith('spr|')) return null;
  const parts = src.split('|');
  if (parts.length !== 6) return null;
  return { sheet: parts[1], x: Number(parts[2]), y: Number(parts[3]), w: Number(parts[4]), h: Number(parts[5]) };
}

function loadRawImg(src) {
  return new Promise(resolve => {
    if (IMGS[src]) return resolve(IMGS[src]);
    const image = new Image();
    image.decoding = 'async';
    image.onload = () => { IMGS[src] = image; resolve(image); };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function resolveAssetSrc(src) {
  const sprite = parseSpriteRef(src);
  if (!sprite) return Promise.resolve(src);
  if (SPRITE_SRC_CACHE[src]) return Promise.resolve(SPRITE_SRC_CACHE[src]);
  return loadRawImg(sprite.sheet).then(sheetImage => {
    if (!sheetImage) return '';
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, sprite.w);
    canvas.height = Math.max(1, sprite.h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(sheetImage, sprite.x, sprite.y, sprite.w, sprite.h, 0, 0, sprite.w, sprite.h);
    const resolved = canvas.toDataURL('image/webp', 0.94);
    SPRITE_SRC_CACHE[src] = resolved;
    return resolved;
  });
}

function loadImg(src) {
  if (IMGS[src]) return Promise.resolve(IMGS[src]);
  return resolveAssetSrc(src).then(resolved => {
    if (!resolved) return null;
    return loadRawImg(resolved).then(image => { if (image) IMGS[src] = image; return image; });
  });
}

function colorDistance(data, pointer, sample) {
  const dr = data[pointer] - sample[0];
  const dg = data[pointer + 1] - sample[1];
  const db = data[pointer + 2] - sample[2];
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function borderSamples(data, width, height) {
  const points = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)]
  ];
  return points.map(([x, y]) => {
    const pointer = (y * width + x) * 4;
    return [data[pointer], data[pointer + 1], data[pointer + 2]];
  });
}

function removeBG(src, tolerance = 44) {
  const cacheKey = `${src}::bg::${tolerance}`;
  if (BG_CACHE[cacheKey]) return Promise.resolve(BG_CACHE[cacheKey]);
  return loadImg(src).then(image => {
    if (!image) return src;
    try {
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const samples = borderSamples(data, width, height);
      const visited = new Uint8Array(width * height);
      const queue = [];

      const bgDistance = pointer => {
        let nearest = Infinity;
        for (const sample of samples) nearest = Math.min(nearest, colorDistance(data, pointer, sample));
        return nearest;
      };

      const isBackground = pointer => {
        if (data[pointer + 3] === 0) return true;
        return bgDistance(pointer) <= tolerance;
      };

      for (let x = 0; x < width; x += 1) queue.push(x, 0, x, height - 1);
      for (let y = 1; y < height - 1; y += 1) queue.push(0, y, width - 1, y);

      for (let i = 0; i < queue.length; i += 2) {
        const x = queue[i];
        const y = queue[i + 1];
        if (x < 0 || x >= width || y < 0 || y >= height) continue;
        const position = y * width + x;
        if (visited[position]) continue;
        visited[position] = 1;
        const pointer = position * 4;
        if (!isBackground(pointer)) continue;
        data[pointer + 3] = 0;
        queue.push(
          x - 1, y, x + 1, y, x, y - 1, x, y + 1,
          x - 1, y - 1, x + 1, y - 1, x - 1, y + 1, x + 1, y + 1
        );
      }

      const feather = 18;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pointer = (y * width + x) * 4;
          if (data[pointer + 3] === 0) continue;
          const nearest = bgDistance(pointer);
          if (nearest <= tolerance) {
            data[pointer + 3] = 0;
          } else if (nearest < tolerance + feather) {
            const alphaFactor = Math.max(0, Math.min(1, (nearest - tolerance) / feather));
            data[pointer + 3] = Math.round(data[pointer + 3] * alphaFactor);
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const result = offscreen.toDataURL('image/png');
      BG_CACHE[cacheKey] = result;
      return loadImg(result).then(() => result);
    } catch (_) {
      return src;
    }
  });
}


function trimImageSource(src, tolerance = 36, padding = 10) {
  const cacheKey = `${src}::trim::${tolerance}::${padding}`;
  if (TRIM_CACHE[cacheKey]) return Promise.resolve(TRIM_CACHE[cacheKey]);
  return loadImg(src).then(image => {
    if (!image) return src;
    try {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;
      if (!width || !height) return src;

      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(image, 0, 0, width, height);
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;
      const samples = borderSamples(data, width, height);
      const isForeground = pointer => {
        const alpha = data[pointer + 3];
        if (alpha <= 10) return false;
        let nearest = Infinity;
        for (const sample of samples) nearest = Math.min(nearest, colorDistance(data, pointer, sample));
        return nearest > tolerance;
      };

      let minX = width, minY = height, maxX = -1, maxY = -1;
      for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
          const pointer = (y * width + x) * 4;
          if (!isForeground(pointer)) continue;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x > maxX) maxX = x;
          if (y > maxY) maxY = y;
        }
      }

      if (maxX < minX || maxY < minY) return src;

      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX = Math.min(width - 1, maxX + padding);
      maxY = Math.min(height - 1, maxY + padding);
      const cropW = Math.max(1, maxX - minX + 1);
      const cropH = Math.max(1, maxY - minY + 1);

      if (cropW >= width - 2 && cropH >= height - 2) return src;

      const trimmed = document.createElement('canvas');
      trimmed.width = cropW;
      trimmed.height = cropH;
      trimmed.getContext('2d').drawImage(offscreen, minX, minY, cropW, cropH, 0, 0, cropW, cropH);
      const result = trimmed.toDataURL('image/png');
      TRIM_CACHE[cacheKey] = result;
      loadImg(result).catch?.(() => {});
      return result;
    } catch (_) {
      return src;
    }
  });
}

function cleanImageSource(src) {
  if (!src) return Promise.resolve(src);
  return removeBG(src).then(bgRemoved => trimImageSource(bgRemoved, 24, 6));
}

function enhanceThumbImage(imgEl, src) {
  if (!imgEl || !src) return;
  imgEl.dataset.src = src;
  resolveAssetSrc(src).then(resolved => {
    if (!resolved || !imgEl.isConnected || imgEl.dataset.src !== src) return;
    imgEl.src = resolved;
  });
}

// Use the automatic background remover only for individual Charm images.
// Set-cover images stay untouched so the customer still sees the full set preview.
function enhanceCharmThumbImage(imgEl, src) {
  if (!imgEl || !src) return;
  imgEl.dataset.src = src;
  cleanImageSource(src).then(cleaned => {
    if (!cleaned || !imgEl.isConnected || imgEl.dataset.src !== src) return;
    imgEl.src = cleaned;
  });
}

function migrateAssetPath(src) {
  if (!src) return src;
  return src.replace('assets/images/', 'assets/images-v3/');
}

// New catalog images are pre-optimized and pre-cleaned. Load only on demand.
function prepareCharmImage(charm) {
  const original = charm.originalSrc || charm.src;
  charm.originalSrc = original;
  cleanImageSource(original).then(cleaned => {
    charm.src = cleaned || original;
    loadImg(charm.src).then(() => draw());
  });
}


// ===== CANVAS =====
function getCV() {
  return document.getElementById('freeCanvas');
}

function getDPR() {
  return Math.min(window.devicePixelRatio || 1, 2);
}

function cvW() {
  return getCV().offsetWidth || getCV().parentElement.offsetWidth || 320;
}

function cvH() {
  return getCV().offsetHeight || Math.max(getCV().parentElement.offsetHeight - 48, 180);
}

function getCharmDrawMetrics(charm, image = null) {
  const srcImage = image || IMGS[charm.src] || IMGS[charm.originalSrc];
  const base = Number(charm.sz) || 62;
  if (!srcImage || !(srcImage.naturalWidth || srcImage.width) || !(srcImage.naturalHeight || srcImage.height)) {
    return {
      drawW: base,
      drawH: base,
      left: charm.x - base / 2,
      top: charm.y - base / 2,
      right: charm.x + base / 2,
      bottom: charm.y + base / 2
    };
  }
  const iw = srcImage.naturalWidth || srcImage.width;
  const ih = srcImage.naturalHeight || srcImage.height;
  const fit = base / Math.max(iw, ih);
  const drawW = Math.max(1, iw * fit);
  const drawH = Math.max(1, ih * fit);
  const left = charm.x - drawW / 2;
  const top = charm.y - drawH / 2;
  return {
    drawW,
    drawH,
    left,
    top,
    right: left + drawW,
    bottom: top + drawH
  };
}

function setupCanvas(scaleExisting = false) {
  const canvas = getCV();
  if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;

  if (scaleExisting && lastCanvasW > 0 && lastCanvasH > 0 && (width !== lastCanvasW || height !== lastCanvasH)) {
    const scaleX = width / lastCanvasW;
    const scaleY = height / lastCanvasH;
    charms.forEach(charm => {
      charm.x *= scaleX;
      charm.y *= scaleY;
      charm.sz *= Math.min(scaleX, scaleY);
      clampCharm(charm);
    });
  }

  lastCanvasW = width;
  lastCanvasH = height;
  const dpr = getDPR();
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
}

function clampCharm(charm) {
  const metrics = getCharmDrawMetrics(charm);
  const halfW = metrics.drawW / 2;
  const halfH = metrics.drawH / 2;
  charm.x = Math.max(halfW, Math.min(cvW() - halfW, charm.x));
  charm.y = Math.max(halfH, Math.min(cvH() - halfH, charm.y));
}

function draw() {
  const canvas = getCV();
  if (!canvas.offsetWidth || !canvas.offsetHeight) return;
  const dpr = getDPR();
  const physicalW = Math.round(canvas.offsetWidth * dpr);
  const physicalH = Math.round(canvas.offsetHeight * dpr);
  if (canvas.width !== physicalW || canvas.height !== physicalH) setupCanvas(true);

  const ctx = canvas.getContext('2d');
  const width = canvas.offsetWidth;
  const height = canvas.offsetHeight;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(dpr, dpr);

  // bracelet guide
  ctx.strokeStyle = 'rgba(200,169,110,0.30)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(18, height / 2);
  ctx.lineTo(width - 18, height / 2);
  ctx.stroke();
  ctx.setLineDash([]);

  charms.forEach(charm => {
    const image = IMGS[charm.src] || IMGS[charm.originalSrc];
    if (!image) return;
    const metrics = getCharmDrawMetrics(charm, image);
    ctx.drawImage(image, metrics.left, metrics.top, metrics.drawW, metrics.drawH);

    if (charm.id === selId) {
      const x = metrics.left;
      const y = metrics.top;
      const width = metrics.drawW;
      const height = metrics.drawH;
      const corner = Math.min(10, Math.min(width, height) / 4);
      ctx.strokeStyle = '#a07840';
      ctx.lineWidth = 2.4;
      ctx.beginPath();
      ctx.moveTo(x, y + corner); ctx.lineTo(x, y); ctx.lineTo(x + corner, y);
      ctx.moveTo(x + width - corner, y); ctx.lineTo(x + width, y); ctx.lineTo(x + width, y + corner);
      ctx.moveTo(x, y + height - corner); ctx.lineTo(x, y + height); ctx.lineTo(x + corner, y + height);
      ctx.moveTo(x + width - corner, y + height); ctx.lineTo(x + width, y + height); ctx.lineTo(x + width, y + height - corner);
      ctx.stroke();
    }
  });

  ctx.restore();
}

function relPos(event, element) {
  const rect = element.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function hitTest(x, y) {
  for (let i = charms.length - 1; i >= 0; i -= 1) {
    const charm = charms[i];
    const metrics = getCharmDrawMetrics(charm);
    if (x >= metrics.left && x <= metrics.right && y >= metrics.top && y <= metrics.bottom) return charm;
  }
  return null;
}

function initCanvas() {
  const canvas = getCV();
  setupCanvas();

  canvas.addEventListener('mousedown', event => {
    const position = relPos(event, canvas);
    const hit = hitTest(position.x, position.y);
    if (!hit) return;
    drag = hit;
    dragChanged = false;
    selId = hit.id;
    dox = position.x - hit.x;
    doy = position.y - hit.y;
    renderLayers();
    draw();
  });

  window.addEventListener('mousemove', event => {
    if (!drag) return;
    const position = relPos(event, canvas);
    const nextX = position.x - dox;
    const nextY = position.y - doy;
    if (Math.abs(nextX - drag.x) > 0.5 || Math.abs(nextY - drag.y) > 0.5) dragChanged = true;
    drag.x = nextX;
    drag.y = nextY;
    clampCharm(drag);
    draw();
  });

  window.addEventListener('mouseup', () => {
    if (drag && dragChanged) commitChange();
    drag = null;
    dragChanged = false;
  });

  canvas.addEventListener('touchstart', event => {
    if (event.touches.length === 1) {
      const position = relPos(event.touches[0], canvas);
      const hit = hitTest(position.x, position.y);
      if (hit) {
        drag = hit;
        dragChanged = false;
        selId = hit.id;
        dox = position.x - hit.x;
        doy = position.y - hit.y;
        renderLayers();
        draw();
      }
    } else if (event.touches.length === 2) {
      pinching = true;
      dragChanged = false;
      drag = null;
      pinchD0 = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      const selected = charms.find(charm => charm.id === selId);
      pinchS0 = selected?.sz || 62;
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchmove', event => {
    if (event.touches.length === 1 && drag && !pinching) {
      const position = relPos(event.touches[0], canvas);
      drag.x = position.x - dox;
      drag.y = position.y - doy;
      clampCharm(drag);
      dragChanged = true;
      draw();
    } else if (event.touches.length === 2 && pinching) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY
      );
      const selected = charms.find(charm => charm.id === selId);
      if (selected) {
        selected.sz = Math.max(24, Math.min(160, pinchS0 * (distance / pinchD0)));
        clampCharm(selected);
        dragChanged = true;
        draw();
      }
    }
    event.preventDefault();
  }, { passive: false });

  canvas.addEventListener('touchend', event => {
    if (event.touches.length < 2) pinching = false;
    if (event.touches.length === 0) {
      if (dragChanged) commitChange();
      drag = null;
      dragChanged = false;
    }
  });

  window.addEventListener('resize', () => {
    setupCanvas(true);
    draw();
    });
}

// ===== DESIGN STATE / HISTORY =====
function serializableCharms() {
  return charms.map(charm => ({
    id: charm.id,
    code: charm.code,
    name: charm.name,
    price: charm.price,
    originalSrc: charm.originalSrc || charm.src,
    x: Number(charm.x),
    y: Number(charm.y),
    sz: Number(charm.sz)
  }));
}

function snapshotString() {
  return JSON.stringify(serializableCharms());
}

function pushHistory() {
  if (applyingHistory) return;
  const snapshot = snapshotString();
  if (history[historyIndex] === snapshot) return;
  history = history.slice(0, historyIndex + 1);
  history.push(snapshot);
  if (history.length > 40) history.shift();
  historyIndex = history.length - 1;
  updateHistoryButtons();
}

function applyHistorySnapshot(snapshot) {
  applyingHistory = true;
  const parsed = JSON.parse(snapshot || '[]');
  charms = parsed.map(item => ({
    ...item,
    src: item.originalSrc,
    originalSrc: item.originalSrc
  }));
  uidN = Math.max(0, ...charms.map(charm => Number(String(charm.id).replace(/\D/g, '')) || 0));
  selId = charms.at(-1)?.id || null;
  charms.forEach(prepareCharmImage);
  applyingHistory = false;
  afterDesignChange(false);
}

function undoDesign() {
  if (historyIndex <= 0) return;
  historyIndex -= 1;
  applyHistorySnapshot(history[historyIndex]);
  updateHistoryButtons();
  showToast('Undo ແລ້ວ');
}

function redoDesign() {
  if (historyIndex >= history.length - 1) return;
  historyIndex += 1;
  applyHistorySnapshot(history[historyIndex]);
  updateHistoryButtons();
  showToast('Redo ແລ້ວ');
}

function updateHistoryButtons() {
  document.getElementById('undoBtn').disabled = historyIndex <= 0;
  document.getElementById('redoBtn').disabled = historyIndex >= history.length - 1;
}

function commitChange() {
  afterDesignChange(true);
}

function afterDesignChange(addHistory = true) {
  draw();
  renderLayers();
  updateSumbar();
  if (addHistory) pushHistory();
  document.getElementById('baHint').hidden = charms.length > 0;
}

// ===== ADD / REMOVE / CONTROLS =====
async function addCharm(item) {
  const image = await loadImg(item.src);
  if (!image) {
    showToast('ຮູບນີ້ໂຫຼດບໍ່ໄດ້');
    return;
  }
  const count = charms.length;
  const width = cvW();
  const height = cvH();
  const size = Math.max(38, Math.min(62, (width - 36) / Math.max(count + 1, 5)));
  const charm = {
    id: `c${++uidN}`,
    code: item.code,
    name: item.subname,
    price: item.price,
    src: item.src,
    originalSrc: item.src,
    x: Math.min(width - size / 2, 28 + count * Math.min(58, size)),
    y: height / 2,
    sz: size
  };
  clampCharm(charm);
  charms.push(charm);
  selId = charm.id;
  prepareCharmImage(charm);
  commitChange();
}

function delCharm(id) {
  charms = charms.filter(charm => charm.id !== id);
  if (selId === id) selId = charms.at(-1)?.id || null;
  commitChange();
}

function selectedCharm() {
  return charms.find(charm => charm.id === selId);
}

function mCharm(dx, dy) {
  const charm = selectedCharm();
  if (!charm) return;
  charm.x += dx * 8;
  charm.y += dy * 8;
  clampCharm(charm);
  commitChange();
}

function cCenter() {
  const charm = selectedCharm();
  if (!charm) return;
  charm.x = cvW() / 2;
  charm.y = cvH() / 2;
  commitChange();
}

function rSize(delta) {
  const charm = selectedCharm();
  if (!charm) return;
  charm.sz = Math.max(24, Math.min(160, charm.sz + delta));
  clampCharm(charm);
  commitChange();
}

function lFwd() {
  const index = charms.findIndex(charm => charm.id === selId);
  if (index < 0 || index >= charms.length - 1) return;
  [charms[index], charms[index + 1]] = [charms[index + 1], charms[index]];
  commitChange();
}

function lBack() {
  const index = charms.findIndex(charm => charm.id === selId);
  if (index <= 0) return;
  [charms[index], charms[index - 1]] = [charms[index - 1], charms[index]];
  commitChange();
}

function autoArrange() {
  if (!charms.length) return;
  const width = cvW();
  const height = cvH();
  const margin = 22;
  const slot = Math.max(28, Math.min(66, (width - margin * 2) / charms.length));
  const size = Math.max(26, Math.min(62, slot * 0.92));
  const totalWidth = slot * charms.length;
  const startX = (width - totalWidth) / 2 + slot / 2;
  charms.forEach((charm, index) => {
    charm.sz = size;
    charm.x = startX + index * slot;
    charm.y = height / 2;
    clampCharm(charm);
  });
  commitChange();
  showToast('ຈັດຊາມອັດຕະໂນມັດໃຫ້ແລ້ວ ✓');
}

function clearDesign() {
  if (!charms.length) return;
  if (!window.confirm('ຕ້ອງການລ້າງຊາມທັງໝົດບໍ?')) return;
  charms = [];
  selId = null;
  commitChange();
  showToast('ລ້າງທັງໝົດແລ້ວ');
}

function updateSumbar() {
  const total = charms.reduce((sum, charm) => sum + charm.price, 0);
  document.getElementById('sumCount').textContent = `${charms.length} ຊິ້ນ`;
  document.getElementById('sumPrice').textContent = `${total.toLocaleString()} ກີບ`;
  document.getElementById('saveBtn').disabled = charms.length === 0;
}

// ===== LAYERS =====
function renderLayers() {
  const container = document.getElementById('layerList');
  if (!charms.length) {
    container.innerHTML = '<div class="lp-empty">ຍັງບໍ່ມີຊາມ</div>';
    return;
  }
  container.innerHTML = '';
  [...charms].reverse().forEach((charm, reverseIndex) => {
    const originalIndex = charms.length - 1 - reverseIndex;
    const row = document.createElement('button');
    row.type = 'button';
    row.className = `lp-item${charm.id === selId ? ' sel' : ''}`;
    row.innerHTML = `
      <span class="lp-num">${originalIndex + 1}</span>
      <img alt="" loading="lazy">
      <span class="lp-name">${escapeHTML(charm.code)}</span>
      <span class="lp-del" role="button" aria-label="ລຶບ">✕</span>`;
    row.addEventListener('click', event => {
      if (event.target.closest('.lp-del')) {
        event.stopPropagation();
        delCharm(charm.id);
        return;
      }
      selId = charm.id;
      renderLayers();
      draw();
    });
    enhanceThumbImage(row.querySelector('img'), charm.src);
    container.appendChild(row);
  });
}

function toggleLayer() {
  layerOpen = !layerOpen;
  document.getElementById('layerBody').hidden = !layerOpen;
  document.getElementById('layerToggleIcon').textContent = layerOpen ? '▲' : '▼';
}

document.addEventListener('click', event => {
  if (layerOpen && !event.target.closest('.tb-layer-wrap')) {
    layerOpen = false;
    document.getElementById('layerBody').hidden = true;
    document.getElementById('layerToggleIcon').textContent = '▼';
  }
}, true);

// ===== PICKER / SEARCH / FAVORITES =====
function renderPickerCats() {
  const container = document.getElementById('pickerCats');
  container.innerHTML = '';
  CHARM_DATA.forEach(cat => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `pcat${cat.cat === activeCat ? ' active' : ''}`;
    button.textContent = `${cat.cat} (${cat.subs.length} ຊຸດ)`;
    button.addEventListener('click', () => {
      activeCat = cat.cat;
      activeSubIndex = -1;
      searchTerm = '';
      restoreSetScrollOnNextGrid = false;
      setGridScrollMemory[activeCat] = 0;
      const search = document.getElementById('charmSearch');
      if (search) search.value = '';
      renderPickerCats();
      renderPickerSets();
      renderCharmGrid();
    });
    container.appendChild(button);
  });
}

function renderPickerSets() {
  const back = document.getElementById('backToSets');
  const title = document.getElementById('setViewTitle');
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  if (!cat) return;

  if (activeSubIndex >= cat.subs.length) activeSubIndex = -1;
  const current = activeSubIndex >= 0 ? cat.subs[activeSubIndex] : null;

  if (back) back.hidden = !current;
  if (title) {
    title.textContent = current
      ? `${current.subname} · ${current.imgs.length} ແບບ · ${Number(current.price).toLocaleString()} ກີບ / ຊິ້ນ`
      : `${cat.cat} · ${cat.subs.length} ເຊັດຊາມ`;
  }
}

function openCharmSet(index) {
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  if (!cat || !cat.subs[index]) return;
  const wrap = document.getElementById('charmGridWrap');
  if (wrap) setGridScrollMemory[activeCat] = wrap.scrollTop || 0;
  restoreSetScrollOnNextGrid = false;
  activeSubIndex = index;
  searchTerm = '';
  const search = document.getElementById('charmSearch');
  if (search) search.value = '';
  renderPickerSets();
  renderCharmGrid();
}

function showAllSets() {
  activeSubIndex = -1;
  searchTerm = '';
  restoreSetScrollOnNextGrid = true;
  const search = document.getElementById('charmSearch');
  if (search) search.value = '';
  renderPickerSets();
  renderCharmGrid();
}

function getFilteredSets() {
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  if (!cat) return [];
  const q = searchTerm.trim().toLowerCase();
  return cat.subs.map((sub, index) => ({ sub, index })).filter(({ sub }) => {
    if (maxPrice && Number(sub.price) > maxPrice) return false;
    if (favoritesOnly) {
      const hasFavorite = (sub.codes || []).some(code => favorites.has(code));
      if (!hasFavorite) return false;
    }
    if (!q) return true;
    return String(sub.id || '').toLowerCase().includes(q)
      || String(sub.subname || '').toLowerCase().includes(q)
      || String(sub.price || '').includes(q);
  });
}

function getFilteredItems() {
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  if (!cat || activeSubIndex < 0) return [];
  const normalizedSearch = searchTerm.trim().toLowerCase();
  return cat.items.filter(item => {
    if (item.subIndex !== activeSubIndex) return false;
    if (maxPrice && item.price > maxPrice) return false;
    if (favoritesOnly && !favorites.has(item.code)) return false;
    if (!normalizedSearch) return true;
    return item.code.toLowerCase().includes(normalizedSearch)
      || item.cat.toLowerCase().includes(normalizedSearch)
      || String(item.price).includes(normalizedSearch)
      || item.subname.toLowerCase().includes(normalizedSearch);
  });
}

function renderSetGrid() {
  const wrap = document.getElementById('charmGridWrap');
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  const sets = getFilteredSets();
  document.getElementById('resultsLine').textContent = cat
    ? `${cat.cat} · ${sets.length} ເຊັດ — ກົດເລືອກເຊັດເພື່ອເບິ່ງ Charm ຂ້າງໃນ`
    : '';
  wrap.innerHTML = '';

  if (!sets.length) {
    wrap.innerHTML = '<div class="empty-results">ບໍ່ພົບເຊັດຊາມຕາມທີ່ຄົ້ນຫາ</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'set-grid-inner';
  sets.forEach(({ sub, index }) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'set-card';
    const cover = sub.cover || sub.imgs?.[0] || '';
    card.innerHTML = `
      <div class="set-cover-wrap">
        <img alt="${escapeHTML(sub.subname)}" loading="lazy" decoding="async">
        <span class="set-count-badge">${sub.imgs.length} ແບບ</span>
      </div>
      <div class="set-card-info">
        <div class="set-card-name">${escapeHTML(sub.subname)}</div>
        <div class="set-card-meta">
          <span>${escapeHTML(sub.id || '')}</span>
          <strong>${Number(sub.price).toLocaleString()} ກີບ</strong>
        </div>
        <div class="set-open-label">ເບິ່ງ Charm ໃນເຊັດ →</div>
      </div>`;
    card.addEventListener('click', () => openCharmSet(index));
    enhanceThumbImage(card.querySelector('img'), cover);
    card.querySelector('img').addEventListener('error', event => {
      event.currentTarget.closest('.set-cover-wrap').classList.add('img-error');
      event.currentTarget.alt = 'ຮູບໂຫຼດບໍ່ໄດ້';
    });
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  const targetTop = restoreSetScrollOnNextGrid ? (setGridScrollMemory[activeCat] || 0) : 0;
  restoreSetScrollOnNextGrid = false;
  requestAnimationFrame(() => {
    wrap.scrollTop = targetTop;
  });
}

function renderCharmGrid() {
  if (activeSubIndex < 0) {
    renderSetGrid();
    return;
  }

  const wrap = document.getElementById('charmGridWrap');
  const cat = CHARM_DATA.find(item => item.cat === activeCat);
  const currentSet = cat?.subs?.[activeSubIndex];
  if (!currentSet) {
    activeSubIndex = -1;
    renderPickerSets();
    renderSetGrid();
    return;
  }
  const items = getFilteredItems();
  document.getElementById('resultsLine').textContent = `${currentSet.subname} · ${items.length} ແບບ · ${Number(currentSet.price).toLocaleString()} ກີບ / ຊິ້ນ`;
  wrap.innerHTML = '';

  if (!items.length) {
    wrap.innerHTML = '<div class="empty-results">ບໍ່ພົບຊາມຕາມທີ່ຄົ້ນຫາ</div>';
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'charm-grid-inner';
  items.forEach(item => {
    const card = document.createElement('article');
    card.className = 'charm-item';
    card.innerHTML = `
      <button class="fav-btn${favorites.has(item.code) ? ' active' : ''}" type="button" aria-label="ຖືກໃຈ">${favorites.has(item.code) ? '♥' : '♡'}</button>
      <button class="charm-add" type="button" aria-label="ເພີ່ມ ${escapeHTML(item.code)}">
        <div class="charm-img-wrap"><img alt="${escapeHTML(item.code)}" loading="lazy" decoding="async"></div>
        <div class="charm-code">${escapeHTML(item.code)}</div>
        <div class="charm-bottom"><span>${escapeHTML(item.subname)}</span><strong>${(item.price / 1000).toFixed(0)}K</strong></div>
      </button>`;

    card.querySelector('.fav-btn').addEventListener('click', event => {
      event.stopPropagation();
      toggleFavorite(item.code);
    });
    card.querySelector('.charm-add').addEventListener('click', () => addCharm(item));
    const img = card.querySelector('img');
    img.addEventListener('error', event => {
      event.currentTarget.closest('.charm-img-wrap').classList.add('img-error');
      event.currentTarget.alt = 'ຮູບໂຫຼດບໍ່ໄດ້';
    });
    enhanceCharmThumbImage(img, item.src);
    grid.appendChild(card);
  });
  wrap.appendChild(grid);
  wrap.scrollTop = 0;
}

function toggleFavorite(code) {
  if (favorites.has(code)) favorites.delete(code);
  else favorites.add(code);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites]));
  renderCharmGrid();
}

function toggleFavoritesOnly() {
  favoritesOnly = !favoritesOnly;
  document.getElementById('favFilter').classList.toggle('active', favoritesOnly);
  document.getElementById('favFilter').textContent = favoritesOnly ? '♥' : '♡';
  restoreSetScrollOnNextGrid = false;
  if (activeSubIndex < 0) setGridScrollMemory[activeCat] = 0;
  renderCharmGrid();
}

// ===== CLEAN EXPORT / SUMMARY =====
function createCleanCanvas() {
  // Important: when the summary screen is open, the designer canvas is hidden,
  // so offsetWidth/offsetHeight can become 0. Use the last known designer size first.
  const sourceW = Math.max(lastCanvasW || cvW(), 1);
  const sourceH = Math.max(lastCanvasH || cvH(), 1);
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, '#fbf9f5');
  gradient.addColorStop(1, '#ebe3d7');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#402615';
  ctx.font = 'italic 42px Georgia, serif';
  ctx.textAlign = 'center';
  ctx.fillText('Bai Boua Italian Charm', canvas.width / 2, 68);

  ctx.strokeStyle = 'rgba(160,120,64,0.25)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(75, canvas.height / 2 + 30);
  ctx.lineTo(canvas.width - 75, canvas.height / 2 + 30);
  ctx.stroke();

  const scale = Math.min(canvas.width / sourceW, (canvas.height - 120) / sourceH);
  charms.forEach(charm => {
    const image = IMGS[charm.src] || IMGS[charm.originalSrc];
    if (!image) return;
    const x = (charm.x / sourceW) * canvas.width;
    const y = 100 + (charm.y / sourceH) * (canvas.height - 130);
    const size = charm.sz * scale;
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    const fit = size / Math.max(iw, ih);
    const drawW = iw * fit;
    const drawH = ih * fit;
    ctx.drawImage(image, x - drawW / 2, y - drawH / 2, drawW, drawH);
  });

  ctx.fillStyle = '#7d5e3c';
  ctx.font = '22px Jost, sans-serif';
  ctx.fillText(`${charms.length} charms · ${new Date().toLocaleDateString('en-GB')}`, canvas.width / 2, canvas.height - 28);
  return canvas;
}

function buildSummary() {
  const list = document.getElementById('orderList');
  const totalElement = document.getElementById('orderTotal');
  list.innerHTML = '';

  if (!canvasSnapshot) canvasSnapshot = createCleanCanvas();
  const preview = document.getElementById('previewCanvas');
  preview.width = canvasSnapshot.width;
  preview.height = canvasSnapshot.height;
  preview.getContext('2d').drawImage(canvasSnapshot, 0, 0);

  const counts = new Map();
  charms.forEach(charm => {
    if (!counts.has(charm.code)) counts.set(charm.code, { ...charm, qty: 0 });
    counts.get(charm.code).qty += 1;
  });

  let total = 0;
  counts.forEach(item => {
    total += item.price * item.qty;
    const row = document.createElement('div');
    row.className = 'order-item';
    row.innerHTML = `
      <div class="oi-left">
        <img class="oi-img" alt="${escapeHTML(item.code)}">
        <div class="oi-info">
          <div class="oi-name">${escapeHTML(item.code)} · ${escapeHTML(item.name)}</div>
          <div class="oi-qty">x${item.qty} · ${(item.price / 1000).toFixed(0)}K / ຊິ້ນ</div>
        </div>
      </div>
      <div class="oi-price">${(item.price * item.qty).toLocaleString()} ກີບ</div>`;
    enhanceThumbImage(row.querySelector('.oi-img'), item.src);
    list.appendChild(row);
  });
  totalElement.textContent = `${total.toLocaleString()} ກີບ`;
  restoreCustomerForm();
  updateGrandTotal();
}

function getCustomerData() {
  const nameEl = document.getElementById('customerName');
  const phoneEl = document.getElementById('customerPhone');
  const sizeEl = document.getElementById('braceletSize');
  const deliveryEl = document.getElementById('deliveryMethod');
  const addressEl = document.getElementById('customerAddress');
  const shippingEl = document.getElementById('shippingFee');
  const noteEl = document.getElementById('customerNote');
  return {
    name: nameEl ? nameEl.value.trim() : '',
    phone: phoneEl ? phoneEl.value.trim() : '',
    size: sizeEl ? sizeEl.value : '',
    delivery: deliveryEl ? deliveryEl.value : 'ຮັບເອງ',
    address: addressEl ? addressEl.value.trim() : '',
    shipping: Math.max(0, Number(shippingEl?.value) || 0),
    note: noteEl ? noteEl.value.trim() : ''
  };
}

function saveCustomerForm() {
  if (!document.getElementById('customerName')) return;
  localStorage.setItem(CUSTOMER_KEY, JSON.stringify(getCustomerData()));
  updateGrandTotal();
}

function restoreCustomerForm() {
  if (!document.getElementById('customerName')) return;
  const customer = readJSON(CUSTOMER_KEY, {});
  document.getElementById('customerName').value = customer.name || '';
  document.getElementById('customerPhone').value = customer.phone || '';
  document.getElementById('braceletSize').value = customer.size || '';
  document.getElementById('deliveryMethod').value = customer.delivery || 'ຮັບເອງ';
  document.getElementById('customerAddress').value = customer.address || '';
  document.getElementById('shippingFee').value = customer.shipping || 0;
  document.getElementById('customerNote').value = customer.note || '';
}

function updateGrandTotal() {
  const grandTotal = document.getElementById('grandTotal');
  if (!grandTotal) return;
  const charmTotal = charms.reduce((sum, charm) => sum + charm.price, 0);
  const shipping = Math.max(0, Number(document.getElementById('shippingFee')?.value) || 0);
  grandTotal.textContent = `${(charmTotal + shipping).toLocaleString()} ກີບ`;
}

function getOrderText() {
  const customer = getCustomerData();
  const counts = new Map();
  charms.forEach(charm => {
    if (!counts.has(charm.code)) counts.set(charm.code, { ...charm, qty: 0 });
    counts.get(charm.code).qty += 1;
  });
  const charmTotal = charms.reduce((sum, charm) => sum + charm.price, 0);
  const grandTotal = charmTotal + customer.shipping;
  let message = '🪬 Bai Boua Italian Charm\n\n';
  if (customer.name) message += `👤 ຊື່: ${customer.name}\n`;
  if (customer.phone) message += `📱 ເບີ: ${customer.phone}\n`;
  if (customer.size) message += `📏 ຂະໜາດຂໍ້ມື: ${customer.size}\n`;
  if (customer.delivery) message += `🚚 ຮັບສິນຄ້າ: ${customer.delivery}\n`;
  if (customer.address) message += `📍 ທີ່ຢູ່: ${customer.address}\n`;
  message += '\nລາຍການຊາມ:\n';
  counts.forEach(item => {
    message += `• ${item.code} · ${item.name} x${item.qty} = ${(item.price * item.qty).toLocaleString()} ກີບ\n`;
  });
  message += `\n💎 ລາຄາຊາມ: ${charmTotal.toLocaleString()} ກີບ`;
  if (customer.shipping) message += `\n🚚 ຄ່າສົ່ງ: ${customer.shipping.toLocaleString()} ກີບ`;
  if (customer.shipping) message += `\n💰 ຍອດລວມ: ${grandTotal.toLocaleString()} ກີບ`;
  if (customer.note) message += `\n📝 ໝາຍເຫດ: ${customer.note}`;
  message += '\n\n📸 ຈະສົ່ງຮູບແບບສາຍແຂນຕາມຫຼັງ';
  return message;
}

function validateOrder() {
  if (!document.getElementById('customerName')) return true;

  const customer = getCustomerData();
  const required = [
    ['customerName', customer.name, 'ກະລຸນາໃສ່ຊື່'],
    ['customerPhone', customer.phone, 'ກະລຸນາໃສ່ເບີໂທ'],
    ['braceletSize', customer.size, 'ກະລຸນາເລືອກຂະໜາດຂໍ້ມື']
  ];
  const missing = required.find(([, value]) => !value);
  if (missing) {
    const element = document.getElementById(missing[0]);
    element.focus();
    element.classList.add('field-error');
    setTimeout(() => element.classList.remove('field-error'), 1600);
    showToast(missing[2]);
    return false;
  }
  if (customer.delivery === 'ຈັດສົ່ງ' && !customer.address) {
    document.getElementById('customerAddress').focus();
    showToast('ກະລຸນາໃສ່ທີ່ຢູ່ຈັດສົ່ງ');
    return false;
  }
  return true;
}

function sendWA() {
  if (!charms.length) {
    showToast('ກະລຸນາເລືອກຊາມກ່ອນ');
    return;
  }
  if (!validateOrder()) return;
  saveCustomerForm();
  window.open(`https://wa.me/${WA}?text=${encodeURIComponent(getOrderText())}`, '_blank', 'noopener');
}

function openIG() {
  window.open(IG, '_blank', 'noopener');
}

function dlImg() {
  const cleanCanvas = createCleanCanvas();
  cleanCanvas.toBlob(blob => {
    if (!blob) {
      showToast('ບັນທຶກຮູບບໍ່ໄດ້');
      return;
    }
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `bai-boua-${Date.now()}.png`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast('ດາວໂຫຼດຮູບແລ້ວ');
  }, 'image/png');
}

// ===== INITIALIZATION =====
function bindInputs() {
  const search = document.getElementById('charmSearch');
  search.addEventListener('input', event => {
    searchTerm = event.target.value;
    restoreSetScrollOnNextGrid = false;
    if (activeSubIndex < 0) setGridScrollMemory[activeCat] = 0;
    renderCharmGrid();
  });
  document.getElementById('priceFilter').addEventListener('change', event => {
    maxPrice = Number(event.target.value) || 0;
    restoreSetScrollOnNextGrid = false;
    if (activeSubIndex < 0) setGridScrollMemory[activeCat] = 0;
    renderCharmGrid();
  });
  const backToSets = document.getElementById('backToSets');
  if (backToSets) backToSets.addEventListener('click', showAllSets);

  ['customerName', 'customerPhone', 'braceletSize', 'deliveryMethod', 'customerAddress', 'shippingFee', 'customerNote']
    .forEach(id => {
      const element = document.getElementById(id);
      if (!element) return;
      element.addEventListener('input', saveCustomerForm);
      element.addEventListener('change', saveCustomerForm);
    });
}

function initApp() {
  updateSoundButton();
  buildHome();
  renderPickerCats();
  renderPickerSets();
  renderCharmGrid();
  bindInputs();
  initCanvas();
  try {
    localStorage.removeItem('bai_boua_design_v2');
    localStorage.removeItem('bai_boua_design_v3');
  } catch (_) {}
  pushHistory();
  updateSumbar();
  renderLayers();
  updateHistoryButtons();
  showIntro(false);
  requestAnimationFrame(() => {
    document.getElementById('startup').classList.add('hide');
    setTimeout(() => document.getElementById('startup').remove(), 500);
  });
}

window.addEventListener('load', initApp);
