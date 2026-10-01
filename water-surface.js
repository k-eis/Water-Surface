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
const fileInput = $('fileInput');
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

// ── 写真（未読み込み時は空と太陽のプレースホルダー）
let img = null;
let source = null; // 出力サイズの ImageData

function seeded(i, salt) { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); }

function buildSource() {
  const w = cv.width, h = cv.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (img) {
    const ir = img.width / img.height, cr = w / h;
    let sw, sh, sx, sy;
    if (ir > cr) { sh = img.height; sw = sh * cr; sx = (img.width - sw) / 2; sy = 0; }
    else { sw = img.width; sh = sw / cr; sx = 0; sy = (img.height - sh) / 2; }
    g.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2c4a6b'); grad.addColorStop(0.55, '#e9b98a'); grad.addColorStop(1, '#f6e3c4');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 14; i++) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(((i * 97) % w), 40 + (i * 37) % (h * 0.4), 60 + (i * 13) % 80, 3); }
    const sun = g.createRadialGradient(w * 0.5, h * 0.55, 0, w * 0.5, h * 0.55, h * 0.18);
    sun.addColorStop(0, '#fffbe8'); sun.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
  }
  source = g.getImageData(0, 0, w, h);
}

function setupCanvas() {
  const MAX_W = 900;
  let w = img ? img.width : 900, h = img ? img.height : 600;
  if (w > MAX_W) { h = Math.round(h * MAX_W / w); w = MAX_W; }
  cv.width = w; cv.height = h;
  buildSource();
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
  if (!source) return;
  const w = cv.width, h = cv.height;
  const p = { waveScale: +$('waveScale').value, ripple: +$('ripple').value, waveDir: +$('waveDir').value, waveAmp: +$('waveAmp').value };
  const waves = buildWaves(p);
  const hMax = waves.reduce((s, v) => s + v.a, 0) || 1;
  const disp = p.waveAmp / 100 * 48;                    // 傾き→ずれ(px)
  const showHeight = $('showHeight').checked;
  const out = ctx.createImageData(w, h);
  const o = out.data, s = source.data;

  for (let y = 0; y < h; y++) {
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
        const px = sample(s, w, h, x + gx * disp, y + gy * disp);
        o[i] = px[0]; o[i + 1] = px[1]; o[i + 2] = px[2];
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

// ── 写真の読み込み
cv.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const f = e.target.files[0];
  if (!f) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const im = new Image();
    im.onload = () => {
      img = im; setupCanvas(); render();
      downloadBtn.disabled = false;
      $('canvasHint').style.display = 'none';
    };
    im.src = ev.target.result;
  };
  reader.readAsDataURL(f);
});

// ── 保存（iOSは長押し保存オーバーレイ）
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
downloadBtn.addEventListener('click', () => {
  if (!img) return;
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
  img = null; fileInput.value = '';
  downloadBtn.disabled = true;
  $('canvasHint').style.display = 'block';
  setupCanvas(); render();
});

setupCanvas();
render();
