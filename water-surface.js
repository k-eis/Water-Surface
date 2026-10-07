// ── Water Surface エンジン（k-eis DESIGN FILTER 008・無料版 / Canvas 2D）
// 全ての効果は「波の高さマップ」から導く。正弦波の重ね合わせなので傾きも解析的に求まり、位相を進めるだけで波が流れる。
//   WAVE      : SCALE / RIPPLE / DIRECTION / AMPLITUDE / FLOW（手動。自動再生はしない）
//   REFLECTION: HORIZON（水平線の位置。上は水面の写真そのまま、下は水で、映り込みは水平線で上下反転）
//   LIGHT     : LIGHT DIRECTION（光源の方向。波の傾きがその向きを向いた所がきらめく）
//   WATER     : DEPTH（吸収：赤から先に減る）/ TURBIDITY（濁り）/ WATER TINT（水自体の色味）
const $ = (id) => document.getElementById(id);
const cv = $('outputCanvas');
const ctx = cv.getContext('2d', { willReadFrequently: true });
const downloadBtn = $('downloadBtn');

const DEFAULTS = { waveScale: 5, ripple: 1, waveDir: 9, waveAmp: 42, waveSpeed: 12, horizon: 49, lightDir: 136, depth: 6, tint: 0, turbidity: 49, timeOfDay: 70, timeInt: 55, mood: 35, vig: 25 };
const IDS = Object.keys(DEFAULTS);
const UNIT = { waveDir: '°', lightDir: '°' };

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

// ── 2枚の写真：SURFACE（水平線より上＝空／映り込み）・BELOW（水底）。片方だけでも動く
const photos = { below: null, surf: null };
const srcData = { below: null, surf: null };

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

// ── 波：重力波（方向がそろう5本）＋毛細管波（短くばらける6本）。流れは位相を進めて作る
let tAcc = 0;
function buildWaves(p) {
  const waves = [], base = (p.waveDir - 90) * Math.PI / 180;
  const lamG = 60 + p.waveScale / 100 * 340, rip = p.ripple / 100;
  const add = (ang, lam, slope, ph) => {
    const k = 2 * Math.PI / lam;
    waves.push({ kx: Math.cos(ang) * k, ky: Math.sin(ang) * k, a: slope / k, ph: ph - 12 * Math.sqrt(k) * tAcc }); // 短い波ほど速い
  };
  for (let i = 0; i < 5; i++) add(base + (seeded(i, 1) - 0.5) * 1.2, lamG * (0.7 + seeded(i, 2) * 0.7), 0.30, seeded(i, 3) * 6.283);
  for (let i = 0; i < 6; i++) add(seeded(i, 4) * 6.283, 9 + seeded(i, 5) * 16, 0.22 * rip, seeded(i, 6) * 6.283);
  return waves;
}

function sample(d, w, h, x, y, T) {   // 双一次補間（結果をTへ書き込む）
  x = x < 0 ? 0 : x > w - 1 ? w - 1 : x; y = y < 0 ? 0 : y > h - 1 ? h - 1 : y;
  const x0 = x | 0, y0 = y | 0, x1 = x0 + 1 < w ? x0 + 1 : x0, y1 = y0 + 1 < h ? y0 + 1 : y0;
  const fx = x - x0, fy = y - y0;
  const a = (y0 * w + x0) * 4, b = (y0 * w + x1) * 4, c = (y1 * w + x0) * 4, e = (y1 * w + x1) * 4;
  for (let k = 0; k < 3; k++) T[k] = (d[a + k] * (1 - fx) + d[b + k] * fx) * (1 - fy) + (d[c + k] * (1 - fx) + d[e + k] * fx) * fy;
}

function hsl(h, s, l) {
  const f = (n) => { const k = (n + h / 30) % 12, a = s * Math.min(l, 1 - l); return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); };
  return [f(0), f(8), f(4)];
}

// ── 時間帯の光：夜明け(0)→朝→昼(50)→夕方→夕暮れ(100)。太陽の高さ・光の色・水平線のにじみ・全体の色味と明るさを一緒に動かす
const TK = [[0, 8, [1, .78, .72], [1, .70, .62], [1.02, .95, 1.00], .95], [.25, 28, [1, .94, .84], [.95, .88, .78], [1.00, .98, .94], 1.0], [.5, 62, [1, 1, 1], [.80, .90, 1], [.98, 1.00, 1.03], 1.05], [.75, 14, [1, .72, .42], [1, .62, .30], [1.08, .94, .80], .95], [1, 3, [.95, .50, .60], [.85, .40, .55], [1.00, .84, .92], .82]];
function timeParams(t, k) {   // t:0〜1（時間帯）、k:0〜1（TIME INTENSITY＝どれだけ効かせるか）
  t = Math.min(1, Math.max(0, t)); const i = Math.min(3, Math.floor(t * 4)), f = t * 4 - i, a = TK[i], b = TK[i + 1];
  const m = (x, y) => x + (y - x) * f, v = (x, y) => x.map((q, j) => m(q, y[j])), mix = (n, x) => n + (x - n) * k;
  return { elev: mix(35, m(a[1], b[1])), light: v(a[2], b[2]).map((q) => mix(1, q)), glow: v(a[3], b[3]).map((q) => mix(.9, q)), tint: v(a[4], b[4]).map((q) => mix(1, q)), expo: mix(1, m(a[5], b[5])) };
}

function post(o, lw, lh, sc, w, h, hy, p, TP) {   // 仕上げ：光のにじみ（固定・控えめ）→時間帯の色味→MOOD→VIGNETTE
  const mood = p.mood / 100, vig = p.vig / 100, glow = 0.30, G = TP.glow, Li = TP.light, Ti = TP.tint, k = TP.expo;
  for (let ly = 0; ly < lh; ly++) {
    const y = ly / sc, band = Math.exp(-Math.abs(y - hy) / h * 5.5), dy = (y / h - 0.5) * 2;
    for (let lx = 0; lx < lw; lx++) {
      const i = (ly * lw + lx) * 4, dx = (lx / sc / w - 0.5) * 2;
      let r = o[i], g = o[i + 1], b = o[i + 2];
      const lum = (0.3 * r + 0.59 * g + 0.11 * b) / 255, gl = (glow * band * 0.22 + glow * Math.max(0, lum - 0.72) * 0.55) * 255;
      r = (r + G[0] * gl) * Ti[0] * k; g = (g + G[1] * gl) * Ti[1] * k; b = (b + G[2] * gl) * Ti[2] * k;
      const sh = (1 - lum) * mood, hi = lum * mood, c = 1 + 0.5 * mood;
      r = ((r - 115) * c + 115) * (1 - 0.28 * sh) + Li[0] * 28 * hi; g = ((g - 115) * c + 115) * (1 - 0.08 * sh) + Li[1] * 20 * hi; b = ((b - 115) * c + 115) * (1 + 0.10 * sh) + Li[2] * 10 * hi;
      const v = Math.min(1, Math.max(0, (Math.sqrt(dx * dx + dy * dy) - 0.55) / 0.9)), f = 1 - vig * 0.7 * v * v;
      o[i] = r * f; o[i + 1] = g * f; o[i + 2] = b * f;
    }
  }
}

let outBuf = null, offCv = null;
function render(scale = 1) {
  const w = cv.width, h = cv.height;
  const p = {}; IDS.forEach((id) => { p[id] = +$(id).value; });
  const TP = timeParams(p.timeOfDay / 100, p.timeInt / 100);
  tAcc = p.waveSpeed / 100 * 25;                          // 手動の位置 → 波の位相
  const waves = buildWaves(p), nW = waves.length;
  const hMax = waves.reduce((s, v) => s + v.a, 0) || 1;
  const slopeK = 0.4 + p.waveAmp / 100 * 1.2;
  const d = p.depth / 100, u = p.turbidity / 100 * 0.8;
  const disp = p.waveAmp / 100 * 48 * (1 + d * 0.8);
  const hy = Math.round(p.horizon / 100 * h);
  const mAxis = hy + Math.max(0, Math.min(1, 1 - hy / (0.15 * h))) * (0.5 * h - hy);   // 水平線15%以下で、反射の軸を中央へ寄せる（0%＝写真を上下反転して水面全体に映す）
  const tc = hsl(215 - p.tint / 100 * 180, 0.5, 0.32);               // 青→青緑→緑→茶
  const haze = tc.map((v) => v * 0.55 + 130);
  const trans = [Math.exp(-d * 3.2), Math.exp(-d * 1.2), Math.exp(-d * 0.45)]; // 赤から先に吸収
  const mixT = 1 - Math.exp(-d * 2.2);
  const lr = (p.lightDir - 90) * Math.PI / 180;
  const sunK = Math.min(1, Math.max(0.33, 1 - (TP.elev - 35) / 40));   // 太陽が高いほど、きらめきの面積が広がりすぎないよう抑える
  const el = TP.elev * Math.PI / 180;   // 時間帯で決まる太陽の高さ
  let Hx = Math.cos(lr) * Math.cos(el), Hy = Math.sin(lr) * Math.cos(el), Hz = 1 + Math.sin(el);   // 光と視線の中間ベクトル
  const hn = Math.hypot(Hx, Hy, Hz); Hx /= hn; Hy /= hn; Hz /= hn;
  const showHeight = $('showHeight').checked;
  const B = srcData.below, S = srcData.surf;

  const lw = Math.max(1, Math.round(w * scale)), lh = Math.max(1, Math.round(h * scale));
  if (!outBuf || outBuf.width !== lw || outBuf.height !== lh) outBuf = ctx.createImageData(lw, lh);
  const o = outBuf.data, T = [0, 0, 0];

  for (let ly = 0; ly < lh; ly++) {
    const y = ly / scale;
    const water = y >= hy;
    const R = water ? 0.02 + 0.98 * Math.pow(Math.max(0, 1 - (y - hy) / Math.max(1, h - hy)), 2.6) : 0;
    for (let lx = 0; lx < lw; lx++) {
      const x = lx / scale, i = (ly * lw + lx) * 4;
      let r, g, b;
      if (!water) {                                                    // 水平線より上：水面の写真そのまま（無ければ淡い空）
        if (S && !showHeight) { sample(S.data, w, h, x, y, T); r = T[0]; g = T[1]; b = T[2]; }
        else { const k = y / Math.max(1, hy); r = 205 + 25 * k; g = 224 + 12 * k; b = 232 + 6 * k; }
        if (showHeight) r = g = b = 20;
      } else {
        let hh = 0, gx = 0, gy = 0;
        for (let n = 0; n < nW; n++) {
          const v = waves[n], t = v.kx * x + v.ky * y + v.ph;
          hh += v.a * Math.sin(t);
          const c = v.a * Math.cos(t); gx += c * v.kx; gy += c * v.ky;
        }
        if (showHeight) {
          r = g = b = 127 + (hh / hMax) * 127 * (0.4 + p.waveAmp / 100 * 0.6) * 1.6;
        } else {
          if (B) { sample(B.data, w, h, x + gx * disp, y + gy * disp, T);   // 水底（屈折）→深さで吸収・水色へ
            r = T[0] * trans[0] + tc[0] * mixT; g = T[1] * trans[1] + tc[1] * mixT; b = T[2] * trans[2] + tc[2] * mixT; }
          else { const k = 1 - 0.45 * d; r = tc[0] * k; g = tc[1] * k; b = tc[2] * k; }
          r = r * (1 - u) + haze[0] * u; g = g * (1 - u) + haze[1] * u; b = b * (1 - u) + haze[2] * u; // 濁り
          if (S) { sample(S.data, w, h, x + gx * disp, 2 * mAxis - y + gy * disp, T);   // 映り込み（水平線で反転）
            r = r * (1 - R) + T[0] * R; g = g * (1 - R) + T[1] * R; b = b * (1 - R) + T[2] * R; }
          const nx = -gx * slopeK, ny = -gy * slopeK;                       // きらめき：法線が光の方向を向く所
          const dt = (nx * Hx + ny * Hy + Hz) / Math.sqrt(nx * nx + ny * ny + 1);
          if (dt > 0.8) { const sp = Math.pow(dt, 90) * (0.35 + R * 0.9) * 230 * (1 - u * 0.5) * sunK; r += sp * TP.light[0]; g += sp * TP.light[1]; b += sp * TP.light[2]; }
        }
      }
      o[i] = r; o[i + 1] = g; o[i + 2] = b; o[i + 3] = 255;
    }
  }
  post(o, lw, lh, scale, w, h, hy, p, TP);
  if (scale === 1) { ctx.putImageData(outBuf, 0, 0); return; }
  if (!offCv) offCv = document.createElement('canvas');
  offCv.width = lw; offCv.height = lh;
  offCv.getContext('2d').putImageData(outBuf, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(offCv, 0, 0, w, h);
}

// ── 再描画：自動では動かない。WAVE FLOW のスライダーを手で動かしたときだけ、波の位置が変わる（動画のようには再生されない）
let raf = 0;
function requestRender() { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => render(1)); }
function updateMode() { render(1); }

IDS.forEach((id) => $(id).addEventListener('input', () => {
  $(id + 'Val').textContent = $(id).value + (UNIT[id] || '');
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
        setupCanvas(); updateMode();
        downloadBtn.disabled = false;
      };
      im.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}
wireDrop('dropSurf', 'fileSurf', 'surf');
wireDrop('dropBelow', 'fileBelow', 'below');

// ── 保存（動いている間はその瞬間のコマを高解像度で。iOSは長押し保存オーバーレイ）
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream; }
downloadBtn.addEventListener('click', () => {
  if (!photos.below && !photos.surf) return;
  render(1);
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
  IDS.forEach((id) => { $(id).value = DEFAULTS[id]; $(id + 'Val').textContent = DEFAULTS[id] + (UNIT[id] || ''); });
  $('showHeight').checked = false;
  photos.below = photos.surf = null; tAcc = 0;
  ['dropSurf', 'dropBelow'].forEach((id) => { $(id).classList.remove('filled'); $(id).style.backgroundImage = ''; });
  $('fileSurf').value = ''; $('fileBelow').value = '';
  downloadBtn.disabled = true;
  setupCanvas(); updateMode();
});

setupCanvas();
updateMode();
