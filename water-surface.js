// ── Water Surface エンジン（k-eis DESIGN FILTER 008・ステージ1）
// 水面の全ての効果は「波の高さマップ」から導かれる。ここではその土台である WAVE グループだけを作る。
//   WAVE SCALE     : 重力波（風によるゆっくり大きなうねり）の波長
//   RIPPLE TEXTURE : 毛細管波（表面張力による細かなさざ波）の量
//   WAVE DIRECTION : 重力波の進行方向
//   WAVE AMPLITUDE : 波の高さ（傾きの強さ）
// 確認用に、写真を波の傾きでずらして見せる（屈折の最小版）＋高さマップの白黒表示を備える。

const $ = (id) => document.getElementById(id);
const cv = $('outputCanvas');
const ctx = cv.getContext('2d', { willReadFrequently: true });
const downloadBtn = $('downloadBtn');
const sliders = ['waveScale', 'ripple', 'waveDir', 'waveAmp'].map($);

// ── THEME（body.theme-xxx クラス方式）
const THEME_CLASS_MAP = { asagiri: null, fukami: 'theme-fukami' };
function applyTheme(key) {
  if (!(key in THEME_CLASS_MAP)) return;
  Object.values(THEME_CLASS_MAP).forEach((c) => c && document.body.classList.remove(c));
  if (THEME_CLASS_MAP[key]) document.body.classList.add(THEME_CLASS_MAP[key]);
  document.querySelectorAll('.theme-btn').forEach((b) => b.classList.toggle('active', b.dataset.theme === key));
  try { localStorage.setItem('watersurface-theme', key); } catch (e) {}
}
document.querySelectorAll('.theme-btn').forEach((b) => b.addEventListener('click', () => applyTheme(b.dataset.theme)));
try { const t = localStorage.getItem('watersurface-theme'); if (t) applyTheme(t); } catch (e) {}

// ── 2枚の写真：SURFACE（水面に映り込む）／BELOW（水底・透けて見える）。片方だけでも動く
const photos = { below: null, surf: null };
const srcData = { below: null, surf: null };
const WATER_BASE = [38, 98, 120];   // 水底の写真がないときの水の色（WATER TINT 実装までの仮値）

function seeded(i, salt) { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }

function coverData(im, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const ir = im.width / im.height, cr = w / h;
  let sw, sh, sx, sy;
  if (ir > cr) { sh = im.height; sw = sh * cr; sx = (im.width - sw) / 2; sy = 0; }
  else { sw = im.width; sh = sw / cr; sx = 0; sy = (im.height - sh) / 2; }
  g.drawImage(im, sx, sy, sw, sh, 0, 0, w, h);
  return g.getImageData(0, 0, w, h);
}

function setupCanvas() {
  const ref = photos.below || photos.surf;
  let w = ref ? ref.width : 900, h = ref ? ref.height : 600;
  if (w > 900) { h = Math.round(h * 900 / w); w = 900; }
  cv.width = w; cv.height = h;
  srcData.below = photos.below ? coverData(photos.below, w, h) : null;
  srcData.surf = photos.surf ? coverData(photos.surf, w, h) : null;
}

// ── 波の合成：正弦波の重ね合わせ（解析的に傾きも求まる）
function buildWaves(p) {
  const waves = [];
  const base = (p.waveDir - 90) * Math.PI / 180;
  const lamG = 60 + p.waveScale / 100 * 340;          // 重力波の波長 60〜400px
  for (let i = 0; i < 5; i++) {                        // 重力波：方向がそろう
    const ang = base + (seeded(i, 1) - 0.5) * 1.2;
    const lam = lamG * (0.7 + seeded(i, 2) * 0.7), k = 2 * Math.PI / lam;
    const slope = 0.30;                                 // 各波の傾き（高さ = 傾き / k）
    waves.push({ kx: Math.cos(ang) * k, ky: Math.sin(ang) * k, a: slope / k, ph: seeded(i, 3) * 6.283 });
  }
  const rip = p.ripple / 100;
  for (let i = 0; i < 6; i++) {                        // 毛細管波：短く、方向はばらける
    const ang = seeded(i, 4) * 6.283;
    const lam = 9 + seeded(i, 5) * 16, k = 2 * Math.PI / lam;
    waves.push({ kx: Math.cos(ang) * k, ky: Math.sin(ang) * k, a: (0.22 * rip) / k, ph: seeded(i, 6) * 6.283 });
  }
  return waves;
}

function sample(d, w, h, x, y) {                       // 双一次補間
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x; y = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = x | 0, y0 = y | 0, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0, fy = y - y0;
  const i00 = (y0 * w + x0) * 4, i10 = (y0 * w + x1) * 4, i01 = (y1 * w + x0) * 4, i11 = (y1 * w + x1) * 4;
  return [0, 1, 2].map((c) => (d[i00 + c] * (1 - fx) + d[i10 + c] * fx) * (1 - fy) + (d[i01 + c] * (1 - fx) + d[i11 + c] * fx) * fy);
}

function render() {
  const w = cv.width, h = cv.height;
  const p = { waveScale: +$('waveScale').value, ripple: +$('ripple').value, waveDir: +$('waveDir').value, waveAmp: +$('waveAmp').value };
  const waves = buildWaves(p);
  const hMax = waves.reduce((s, v) => s + v.a, 0) || 1;
  const disp = p.waveAmp / 100 * 48;                    // 傾き→ずれ(px)
  const showHeight = $('showHeight').checked;
  const B = srcData.below, S = srcData.surf;
  const out = ctx.createImageData(w, h);
  const o = out.data;

  for (let y = 0; y < h; y++) {
    // フレネル：上（水平線側）ほど反射率が高く、手前（下）は約2%（反射と透過の混ざり具合は仮の固定カーブ）
    const R = 0.02 + 0.98 * Math.pow(1 - y / h, 2.6);
    for (let x = 0; x < w; x++) {
      let hh = 0, gx = 0, gy = 0;
      for (let n = 0; n < waves.length; n++) {
        const v = waves[n], t = v.kx * x + v.ky * y + v.ph;
        hh += v.a * Math.sin(t);
        const c = v.a * Math.cos(t);
        gx += c * v.kx; gy += c * v.ky;
      }
      const i = (y * w + x) * 4;
      if (showHeight) {
        const g = 127 + (hh / hMax) * 127 * (0.4 + p.waveAmp / 100 * 0.6) * 1.6;
        o[i] = o[i + 1] = o[i + 2] = g < 0 ? 0 : g > 255 ? 255 : g;
      } else {
        let c = B ? sample(B.data, w, h, x + gx * disp, y + gy * disp) : WATER_BASE;       // 水底（屈折でずれる）
        if (S) {                                                                          // 水面（上下反転した映り込み）
          const r = sample(S.data, w, h, x + gx * disp, (h - 1 - y) + gy * disp);
          c = [c[0] * (1 - R) + r[0] * R, c[1] * (1 - R) + r[1] * R, c[2] * (1 - R) + r[2] * R];
        }
        o[i] = c[0]; o[i + 1] = c[1]; o[i + 2] = c[2];
      }
      o[i + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

let raf = 0;
function requestRender() { cancelAnimationFrame(raf); raf = requestAnimationFrame(render); }

const labelOf = { waveScale: ['waveScaleVal', ''], ripple: ['rippleVal', ''], waveDir: ['waveDirVal', '°'], waveAmp: ['waveAmpVal', ''] };
sliders.forEach((el) => el.addEventListener('input', () => {
  $(labelOf[el.id][0]).textContent = el.value + labelOf[el.id][1];
  requestRender();
}));
$('showHeight').addEventListener('change', requestRender);

// ── 写真の読み込み（2つのドロップゾーン）
function wireDrop(dropId, fileId, key) {
  const drop = $(dropId), file = $(fileId);
  drop.addEventListener('click', () => file.click());
  file.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const im = new Image();
      im.onload = () => {
        photos[key] = im;
        drop.classList.add('filled');
        drop.style.backgroundImage = `url(${ev.target.result})`;
        setupCanvas(); render();
        downloadBtn.disabled = false;
      };
      im.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}
wireDrop('dropSurf', 'fileSurf', 'surf');
wireDrop('dropBelow', 'fileBelow', 'below');

// ── 保存（iOSは長押し保存オーバーレイ）
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
downloadBtn.addEventListener('click', () => {
  if (!photos.below && !photos.surf) return;
  const dataUrl = cv.toDataURL('image/png');
  if (isIOS()) {
    $('saveOverlayImg').src = dataUrl;
    $('saveOverlay').style.display = 'flex';
  } else {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = 'water-surface.png'; a.click();
  }
});
$('saveOverlayClose').addEventListener('click', () => { $('saveOverlay').style.display = 'none'; });

// ── RESET：パラメータを初期値へ、画像もクリア（シリーズ共通仕様）
$('resetBtn').addEventListener('click', () => {
  $('waveScale').value = 50; $('ripple').value = 40; $('waveDir').value = 0; $('waveAmp').value = 50;
  $('showHeight').checked = false;
  sliders.forEach((el) => el.dispatchEvent(new Event('input')));
  photos.below = photos.surf = null;
  ['dropSurf', 'dropBelow'].forEach((id) => { $(id).classList.remove('filled'); $(id).style.backgroundImage = ''; });
  $('fileSurf').value = ''; $('fileBelow').value = '';
  downloadBtn.disabled = true;
  setupCanvas(); render();
});

setupCanvas();
render();
