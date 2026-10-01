// ── Woven Grain エフェクトエンジン（k-eis DESIGN FILTER・新規アプリコンセプト）
// 網籠の構造原理（張力・光と影・不均一さ・密度など）を、2枚（オプションで3枚）の写真の
// 編み込みに翻訳するアプリ。既存シリーズ（Silver Gelatin等）とは異なり、単一写真の色調フィルターではなく
// 2枚の写真の関係性そのものをデザインする構造系アプリ
//
// BASIC PARAMETERS: MESH SIZE / DIRECTION（Stripe・Basket・Diagonal）
// CHARACTER PARAMETERS: WEAVE DEPTH / WARP / IMPERFECTION / DENSITY / TENSION
// BACK LIGHT MODE: 3枚目の写真（Photo C）を背景に敷き、TENSION/IMPERFECTIONで生まれる
//                  隙間から透けて見えるようにする（光そのものではなく、奥に透ける景色）

const outputCanvas = document.getElementById('outputCanvas');
const ctx = outputCanvas.getContext('2d');
const canvasHint = document.getElementById('canvasHint');

// THEME SWITCH: matches the series convention (body.theme-xxx class swap),
// two beige palettes only — Sarashi（晒し布×真鍮、既定）／Touki（陶器×抹茶）
const themeBtns = document.querySelectorAll('.theme-btn');
const THEME_CLASS_MAP = { sarashi: null, touki: 'theme-touki' };

function applyTheme(themeKey) {
  if (!(themeKey in THEME_CLASS_MAP)) return;
  Object.values(THEME_CLASS_MAP).forEach(cls => { if (cls) document.body.classList.remove(cls); });
  const cls = THEME_CLASS_MAP[themeKey];
  if (cls) document.body.classList.add(cls);
  themeBtns.forEach(b => b.classList.toggle('active', b.dataset.theme === themeKey));
  try { localStorage.setItem('wovengrain-theme', themeKey); } catch (e) {}
}

themeBtns.forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

(function initTheme() {
  let savedTheme = null;
  try { savedTheme = localStorage.getItem('wovengrain-theme'); } catch (e) {}
  if (savedTheme && (savedTheme in THEME_CLASS_MAP)) {
    applyTheme(savedTheme);
  } else if (savedTheme) {
    try { localStorage.removeItem('wovengrain-theme'); } catch (e) {}
  }
})();

const imgA = new Image();
const imgB = new Image();
const imgC = new Image();
let hasA = false, hasB = false, hasC = false;

const meshSlider = document.getElementById('mesh');
const meshVal = document.getElementById('meshVal');
const zoomWithMeshToggle = document.getElementById('zoomWithMesh');
const strandLengthSlider = document.getElementById('strandLength');
const strandLengthVal = document.getElementById('strandLengthVal');
const directionBtns = document.querySelectorAll('[data-direction]');
let currentDirection = 'basket';
const profileBtns = document.querySelectorAll('[data-profile]');
let currentProfile = 'round';
const reliefSlider = document.getElementById('relief');
const reliefVal = document.getElementById('reliefVal');
const contactShadowSlider = document.getElementById('contactShadow');
const contactShadowVal = document.getElementById('contactShadowVal');
const specularSlider = document.getElementById('specular');
const specularVal = document.getElementById('specularVal');
const surfaceBendSlider = document.getElementById('surfaceBend');
const surfaceBendVal = document.getElementById('surfaceBendVal');

const exposureASlider = document.getElementById('exposureA');
const exposureAVal = document.getElementById('exposureAVal');
const brillianceASlider = document.getElementById('brillianceA');
const brillianceAVal = document.getElementById('brillianceAVal');
const exposureBSlider = document.getElementById('exposureB');
const exposureBVal = document.getElementById('exposureBVal');
const brillianceBSlider = document.getElementById('brillianceB');
const brillianceBVal = document.getElementById('brillianceBVal');

const depthAmtSlider = document.getElementById('depthAmt');
const depthAmtVal = document.getElementById('depthAmtVal');
const shadowReachSlider = document.getElementById('shadowReach');
const shadowReachVal = document.getElementById('shadowReachVal');
const lightDirectionSlider = document.getElementById('lightDirection');
const lightDirectionVal = document.getElementById('lightDirectionVal');
const grainSlider = document.getElementById('grain');
const grainVal = document.getElementById('grainVal');
const warpSlider = document.getElementById('warp');
const warpVal = document.getElementById('warpVal');
const imperfectionSlider = document.getElementById('imperfection');
const imperfectionVal = document.getElementById('imperfectionVal');
const densitySlider = document.getElementById('density');
const densityVal = document.getElementById('densityVal');
const tensionSlider = document.getElementById('tension');
const tensionVal = document.getElementById('tensionVal');
const backlightToggle = document.getElementById('backlight');
const lightIntensitySlider = document.getElementById('lightIntensity');
const lightIntensityVal = document.getElementById('lightIntensityVal');

const downloadBtn = document.getElementById('downloadBtn');
const resetBtn = document.getElementById('resetBtn');
const animateBtn = document.getElementById('animateBtn');
const playOverlayBtn = document.getElementById('playOverlayBtn');
const animationStage = document.getElementById('animationStage');
const animationStageLabel = document.getElementById('animationStageLabel');
const animationStageProgress = document.getElementById('animationStageProgress');

let animationProgress = null;
let animationFrame = 0;
let animationPlaying = false;
let compositionReady = false;
let hasAnimatedOnce = false;

function updateAnimationUI() {
  const ready = hasA && hasB;
  if (animateBtn) animateBtn.disabled = !ready || animationPlaying;
  if (playOverlayBtn) {
    playOverlayBtn.disabled = !ready || animationPlaying;
    playOverlayBtn.style.display = compositionReady ? 'none' : 'block';
  }
  if (downloadBtn) downloadBtn.disabled = !ready || !compositionReady;
}

function animationStageInfo(p) {
  if (p < 0.12) return ['INPUT', p / 0.12];
  if (p < 0.25) return ['CUT', (p - 0.12) / 0.13];
  if (p < 0.67) return ['WEAVE', (p - 0.25) / 0.42];
  if (p < 0.84) return ['FORM', (p - 0.67) / 0.17];
  if (p < 0.96) return ['LIGHT', (p - 0.84) / 0.12];
  return ['FINAL', (p - 0.96) / 0.04];
}

function shouldRevealCell(row, col, maxRow, maxCol, p, salt = 0) {
  // A deterministic serpentine reveal: neighboring cells appear in a woven order,
  // rather than the finished image simply fading in.
  const rr = Math.max(0, row), cc = Math.max(0, col);
  const serp = (rr % 2 === 0) ? cc : (maxCol - cc);
  const path = rr * (maxCol + 1) + serp;
  const total = Math.max(1, (maxRow + 1) * (maxCol + 1) - 1);
  const threshold = path / total;
  const jitter = (seededRandom(rr, cc, 900 + salt) - 0.5) * 0.025;
  return threshold <= p + jitter;
}

function stopAnimation() {
  if (animationFrame) cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  animationPlaying = false;
  animationProgress = null;
  compositionReady = false;
  hasAnimatedOnce = false;
  if (animationStage) animationStage.style.display = 'none';
  updateAnimationUI();
  render();
}

function playWeaveAnimation() {
  if (!hasA || !hasB || animationPlaying) return;
  if (animationFrame) cancelAnimationFrame(animationFrame);

  animationPlaying = true;
  animationProgress = 0;
  compositionReady = false;
  if (animationStage) animationStage.style.display = 'block';
  if (playOverlayBtn) playOverlayBtn.style.display = 'none';
  updateAnimationUI();

  const start = performance.now();
  const duration = 7000;

  function tick(now) {
    const p = Math.min(1, (now - start) / duration);
    animationProgress = p;
    const [label, local] = animationStageInfo(p);
    if (animationStageLabel) animationStageLabel.textContent = label;
    if (animationStageProgress) animationStageProgress.textContent = Math.round(local * 100) + '%';
    render();

    if (p < 1) {
      animationFrame = requestAnimationFrame(tick);
    } else {
      animationFrame = 0;
      animationPlaying = false;
      animationProgress = null;
      compositionReady = true;
      hasAnimatedOnce = true;
      if (animationStageLabel) animationStageLabel.textContent = 'FINAL';
      if (animationStageProgress) animationStageProgress.textContent = '100%';
      updateAnimationUI();
      render();
      setTimeout(() => {
        if (!animationPlaying && animationStage) animationStage.style.display = 'none';
      }, 900);
    }
  }
  animationFrame = requestAnimationFrame(tick);
}

if (animateBtn) animateBtn.addEventListener('click', playWeaveAnimation);
if (playOverlayBtn) playOverlayBtn.addEventListener('click', playWeaveAnimation);

const previewA = document.getElementById('previewA');
const previewB = document.getElementById('previewB');

// iOS/Safari does not support CanvasRenderingContext2D.filter, so Photo A/B
// adjustments must not rely on ctx.filter. We build small, output-sized filtered
// source canvases once per slider value and reuse them for every weave cell.
let filteredSourceA = null, filteredSourceB = null;
let filteredKeyA = '', filteredKeyB = '';

function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }

function buildFilteredSource(img, exposureVal, brillianceVal, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const cctx = c.getContext('2d', { willReadFrequently: true });
  // First make the same cover crop used by the app.
  drawCover(img, w, h, cctx);
  const imageData = cctx.getImageData(0, 0, w, h);
  const d = imageData.data;
  const brightness = 1 + exposureVal / 100;
  const contrast = 1 + brillianceVal / 130;
  const saturate = 1 + brillianceVal / 100;
  for (let i = 0; i < d.length; i += 4) {
    let r = d[i] * brightness;
    let g = d[i + 1] * brightness;
    let b = d[i + 2] * brightness;
    r = (r - 128) * contrast + 128;
    g = (g - 128) * contrast + 128;
    b = (b - 128) * contrast + 128;
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * saturate;
    g = lum + (g - lum) * saturate;
    b = lum + (b - lum) * saturate;
    d[i] = clamp255(r);
    d[i + 1] = clamp255(g);
    d[i + 2] = clamp255(b);
  }
  cctx.putImageData(imageData, 0, 0);
  return c;
}

function getFilteredSources(w, h) {
  const aExp = parseInt(exposureASlider.value, 10);
  const aBri = parseInt(brillianceASlider.value, 10);
  const bExp = parseInt(exposureBSlider.value, 10);
  const bBri = parseInt(brillianceBSlider.value, 10);
  const keyA = `${aExp}/${aBri}/${w}/${h}`;
  const keyB = `${bExp}/${bBri}/${w}/${h}`;
  if (!filteredSourceA || filteredKeyA !== keyA) {
    filteredSourceA = buildFilteredSource(imgA, aExp, aBri, w, h);
    filteredKeyA = keyA;
  }
  if (!filteredSourceB || filteredKeyB !== keyB) {
    filteredSourceB = buildFilteredSource(imgB, bExp, bBri, w, h);
    filteredKeyB = keyB;
  }
  return { A: filteredSourceA, B: filteredSourceB };
}

function sampleOutputSpace(gx, gy, cw, ch, warpX, warpY, zoomFactor, w, h) {
  const sx = (gx + warpX - w / 2) * zoomFactor + w / 2;
  const sy = (gy + warpY - h / 2) * zoomFactor + h / 2;
  return { sx, sy, sw: cw * zoomFactor, sh: ch * zoomFactor };
}

// Safari/iOS can behave badly when drawImage() receives a source rectangle
// that extends outside a canvas. DIAGONAL reaches beyond the source edges by
// design (the rotated diamonds at the four corners), so clamp the source rect
// and keep the destination rect geometrically aligned.
function drawClampedSource(source, sx, sy, sw, sh, dx, dy, dw, dh) {
  const srcW = Number(source.width) || 0;
  const srcH = Number(source.height) || 0;
  if (!srcW || !srcH || sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;

  const x0 = Math.max(0, sx);
  const y0 = Math.max(0, sy);
  const x1 = Math.min(srcW, sx + sw);
  const y1 = Math.min(srcH, sy + sh);
  if (x1 <= x0 || y1 <= y0) return;

  const rx0 = (x0 - sx) / sw;
  const ry0 = (y0 - sy) / sh;
  const rx1 = (x1 - sx) / sw;
  const ry1 = (y1 - sy) / sh;
  const ddx = dx + dw * rx0;
  const ddy = dy + dh * ry0;
  const ddw = dw * (rx1 - rx0);
  const ddh = dh * (ry1 - ry0);
  if (ddw <= 0 || ddh <= 0) return;
  ctx.drawImage(source, x0, y0, x1 - x0, y1 - y0, ddx, ddy, ddw, ddh);
}

function wireDrop(dropId, fileId, img, onLoaded, useBackgroundImage) {
  const drop = document.getElementById(dropId);
  const file = document.getElementById(fileId);
  drop.addEventListener('click', () => file.click());
  file.addEventListener('change', (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        onLoaded();
        drop.classList.add('filled');
        if (useBackgroundImage) drop.style.backgroundImage = `url(${ev.target.result})`;
        render();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(f);
  });
}

wireDrop('dropA', 'fileA', imgA, () => { hasA = true; compositionReady = false; hasAnimatedOnce = false; updateAnimationUI(); }, false);
wireDrop('dropB', 'fileB', imgB, () => { hasB = true; compositionReady = false; hasAnimatedOnce = false; updateAnimationUI(); }, false);
wireDrop('dropC', 'fileC', imgC, () => { hasC = true; }, true);

directionBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    directionBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDirection = btn.dataset.direction;
    if (!hasAnimatedOnce) compositionReady = false;
    updateAnimationUI();
    render();
  });
});

profileBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    profileBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentProfile = btn.dataset.profile;
    if (!hasAnimatedOnce) compositionReady = false;
    updateAnimationUI();
    render();
  });
});

zoomWithMeshToggle.addEventListener('change', () => { if (!hasAnimatedOnce) compositionReady = false; updateAnimationUI(); render(); });

function seededRandom(row, col, salt) {
  let x = Math.sin(row * 127.1 + col * 311.7 + salt * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

// EXPOSURE(露出) -> brightness / BRILLIANCE(鮮やかさ) -> contrast+saturate combined,
// applied per photo (A/B independently) before that photo's cells are drawn.
// レンジは-100〜100、露出は0〜2倍（-100で真っ黒）、鮮やかさは彩度0〜2倍＋コントラスト強調
function photoFilter(exposureVal, brillianceVal) {
  const brightness = 1 + exposureVal / 100;
  const contrast = 1 + brillianceVal / 130;
  const saturate = 1 + brillianceVal / 100;
  return `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})`;
}

function imageNaturalSize(img) {
  // HTMLImageElement uses naturalWidth/naturalHeight; our mobile-safe filtered
  // sources are canvases, which use width/height instead. Keep both paths here
  // so the animation can render the filtered sources without producing NaN
  // coordinates on iOS Safari.
  const nw = Number(img.naturalWidth) || Number(img.width) || 0;
  const nh = Number(img.naturalHeight) || Number(img.height) || 0;
  return { width: nw, height: nh };
}

function drawCover(img, w, h, destCtx) {
  const targetCtx = destCtx || ctx;
  const size = imageNaturalSize(img);
  if (!size.width || !size.height || !w || !h) return;
  const ir = size.width / size.height;
  const cr = w / h;
  let sx, sy, sw, sh;
  if (ir > cr) { sh = size.height; sw = sh * cr; sx = (size.width - sw) / 2; sy = 0; }
  else { sw = size.width; sh = sw / cr; sx = 0; sy = (size.height - sh) / 2; }
  targetCtx.drawImage(img, sx, sy, sw, sh, 0, 0, w, h);
}

// keeps the Photo A/B dropzone thumbnails in sync with their own EXPOSURE/BRILLIANCE —
// so adjusting a photo's sliders visibly changes that photo's own preview, not just the
// woven output
function updatePreviews(filterA, filterB) {
  if (hasA && previewA) {
    const w = previewA.clientWidth || 160, h = previewA.clientHeight || 160;
    // only reset the canvas backing store when the on-screen size actually changed —
    // resizing every render() call forces a layout reflow each time, which is cheap
    // on desktop but can visibly lag/stall on mobile hardware during slider drags
    if (previewA.width !== w) previewA.width = w;
    if (previewA.height !== h) previewA.height = h;
    const pctx = previewA.getContext('2d');
    pctx.clearRect(0, 0, w, h);
    drawCover(imgA, w, h, pctx);
    previewA.style.filter = filterA;
    previewA.style.webkitFilter = filterA;
  }
  if (hasB && previewB) {
    const w = previewB.clientWidth || 160, h = previewB.clientHeight || 160;
    if (previewB.width !== w) previewB.width = w;
    if (previewB.height !== h) previewB.height = h;
    const pctx = previewB.getContext('2d');
    pctx.clearRect(0, 0, w, h);
    drawCover(imgB, w, h, pctx);
    previewB.style.filter = filterB;
    previewB.style.webkitFilter = filterB;
  }
}

// Cuts the four corners of a rect off (an octagon rather than a rounded rect) —
// unlike rounding, this keeps every edge razor-straight along its own length,
// so neighboring cells still touch cleanly edge-to-edge. The gap this opens up
// when TENSION loosens is then concentrated right at the 4-way crossing point
// (a small diamond), matching how a real loose weave actually gaps — instead
// of a uniform hairline gap running the full length of every edge, which is
// what was reading as ruled "graph paper" rather than a woven surface.
function octagonPath(x, y, w, h, cut) {
  const c = Math.max(0, Math.min(cut, Math.min(w, h) / 2 - 0.5));
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function render() {
  const w = outputCanvas.width, h = outputCanvas.height;
  ctx.clearRect(0, 0, w, h);

  const filterA = photoFilter(parseInt(exposureASlider.value, 10), parseInt(brillianceASlider.value, 10));
  const filterB = photoFilter(parseInt(exposureBSlider.value, 10), parseInt(brillianceBSlider.value, 10));
  updatePreviews(filterA, filterB);

  if (!hasA || !hasB) {
    canvasHint.style.display = 'block';
    if (playOverlayBtn) playOverlayBtn.style.display = 'block';
    downloadBtn.disabled = true;
    updateAnimationUI();
    return;
  }
  if (!animationPlaying && !compositionReady && !hasAnimatedOnce) {
    canvasHint.style.display = 'none';
    if (playOverlayBtn) playOverlayBtn.style.display = 'block';
    downloadBtn.disabled = true;
    updateAnimationUI();
    return;
  }
  canvasHint.style.display = 'none';
  if (playOverlayBtn) playOverlayBtn.style.display = 'none';
  downloadBtn.disabled = false;

  const filteredSources = getFilteredSources(w, h);
  const sourceA = filteredSources.A;
  const sourceB = filteredSources.B;

  const mesh = parseInt(meshSlider.value, 10);
  const zoomWithMesh = zoomWithMeshToggle.checked;
  const zoomFactor = zoomWithMesh ? Math.max(1, mesh / 40) : 1; // 既定はOFF：MESH SIZEを変えても写真サイズは変わらない
  const strandLength = parseInt(strandLengthSlider.value, 10);
  const profile = currentProfile;
  const depthAmt = parseInt(depthAmtSlider.value, 10) / 100;
  const shadowReach = parseInt(shadowReachSlider.value, 10) / 100;
  const lightDirectionDeg = parseInt(lightDirectionSlider.value, 10);
  // 0°=top, 90°=right, 180°=bottom, 270°=left (clockwise from top), matching the compass feel of the slider
  const lightRad = (lightDirectionDeg - 90) * Math.PI / 180;
  const lightVec = { x: Math.cos(lightRad), y: Math.sin(lightRad) };
  const warpAmt = parseInt(warpSlider.value, 10) / 100 * 18;
  const imperfAmt = parseInt(imperfectionSlider.value, 10) / 100 * mesh * 0.3;
  const density = parseInt(densitySlider.value, 10);
  const tension = parseInt(tensionSlider.value, 10);
  const tensionFactor = (tension - 50) / 50;
  const tensionSizeAdjust = tensionFactor * mesh * 0.30;
  const tensionDepthMul = 1 + tensionFactor * 0.9;
  const backlightOn = backlightToggle.checked && hasC;
  const lightIntensity = parseInt(lightIntensitySlider.value, 10) / 100;
  const grainAmt = parseInt(grainSlider.value, 10) / 100;
  const reliefAmt = Math.max(parseInt(reliefSlider.value, 10) / 100, depthAmt * 0.72);
  const contactShadowAmt = parseInt(contactShadowSlider.value, 10) / 100;
  const specularAmt = parseInt(specularSlider.value, 10) / 100;
  const surfaceBendAmt = parseInt(surfaceBendSlider.value, 10) / 100;

  // Animation phases:
  // INPUT/CUT: establish the material and cutting idea;
  // WEAVE: progressively reveal the actual cells in a serpentine woven order;
  // FORM: increase depth/overlap;
  // LIGHT: progressively introduce directional relief lighting.
  const ap = animationProgress;
  const weaveP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.25) / 0.42));
  const formP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.67) / 0.17));
  const lightP = ap == null ? 1 : Math.max(0, Math.min(1, (ap - 0.84) / 0.12));
  const profileDepthMul = profile === 'round' ? 1.15 : profile === 'ribbon' ? 1.0 : profile === 'beveled' ? 1.08 : 0.72;
  const visualDepthAmt = depthAmt * profileDepthMul * (ap == null ? 1 : formP);
  const visualLightIntensity = lightIntensity * (ap == null ? 1 : lightP);

  if (ap != null && ap < 0.25) {
    // Give INPUT/CUT a clear visual identity instead of showing the finished weave.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.globalAlpha = ap < 0.12 ? ap / 0.12 : 1;
    drawCover(sourceA, w * 0.46, h);
    ctx.restore();
    ctx.save();
    ctx.globalAlpha = ap < 0.12 ? ap / 0.12 : 1;
    ctx.translate(w * 0.54, 0);
    drawCover(sourceB, w * 0.46, h);
    ctx.restore();
    if (ap >= 0.12) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (ap - 0.12) / 0.13);
      ctx.strokeStyle = 'rgba(255,248,232,.75)';
      ctx.lineWidth = 1;
      const step = Math.max(12, mesh);
      for (let x = 0; x <= w; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y <= h; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.restore();
    }
    return;
  }

  if (backlightOn) {
    ctx.save();
    ctx.filter = `brightness(${0.6 + visualLightIntensity * 1.1})`;
    drawCover(imgC, w, h);
    ctx.restore();
  } else {
    // no Photo C loaded — gaps from a loose TENSION should reveal plain black,
    // not the app's transparent canvas background (which would export as a hole
    // in the saved PNG). Filled explicitly here so it's part of the actual pixels.
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, w, h);
  }

  if (currentDirection === 'diagonal') {
    renderDiagonalWeave({ sourceA, sourceB, mesh, zoomFactor, strandLength, depthAmt: visualDepthAmt, shadowReach, lightVec, lightIntensity: visualLightIntensity, warpAmt, imperfAmt, density, tensionFactor, tensionSizeAdjust, tensionDepthMul, reliefAmt, contactShadowAmt, specularAmt, surfaceBendAmt, filterA, filterB, animationProgress: ap, weaveProgress: weaveP, lightProgress: lightP });
    if (ap == null || ap >= 0.96) applyGrain(grainAmt);
    return;
  }

  // ── PASS 1 (UNDER layer): every cell's crossing photo, drawn near its full
  // grid size but with its own light jitter + partial TENSION response — NOT
  // perfectly tiled edge-to-edge. A perfectly tiled under layer was the bug:
  // it fully covered the canvas by itself, so black/Photo C could never show
  // through and loosening TENSION did nothing visible at all.
  // TENSION now drives the octagon corner-cut directly (see cornerCut below) —
  // the under layer itself stays close to full size regardless of TENSION, so
  // it isn't also compounding into oversized gaps.
  const underShrink = 0;
  // TENSION's single, bounded gap mechanism: at neutral/tight it's a small
  // corner nick (cells read as almost-touching squares); toward LOOSE it grows
  // into a visible diamond gap at the 4-way crossings — capped well short of
  // swallowing the whole cell, so it never becomes a "grate" of mostly black.
  const cornerCut = mesh * (0.05 + Math.max(0, -tensionFactor) * 0.24);
  for (let gy = 0; gy < h; gy += mesh) {
    for (let gx = 0; gx < w; gx += mesh) {
      const col = Math.floor(gx / mesh);
      const row = Math.floor(gy / mesh);
      if (ap != null && !shouldRevealCell(row, col, Math.ceil(h / mesh) - 1, Math.ceil(w / mesh) - 1, weaveP, 1)) continue;
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      let baseUseA = currentDirection === 'stripe' ? col % 2 === 0 : (gRow + gCol) % 2 === 0;
      let useA = baseUseA;
      if (density > 50 && !baseUseA) { if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true; }
      else if (density < 50 && baseUseA) { if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false; }

      const cw = Math.min(mesh, w - gx);
      const ch = Math.min(mesh, h - gy);
      const warpX = warpAmt * Math.sin(gy * 0.05 + col);
      const warpY = warpAmt * Math.sin(gx * 0.05 + row);
      const underImg = useA ? sourceB : sourceA;
      const underSample = sampleOutputSpace(gx, gy, cw, ch, warpX, warpY, zoomFactor, w, h);
      const usx = underSample.sx, usy = underSample.sy;

      // own jitter (different salt from the OVER pass) so the two layers don't
      // move in lockstep — that's what actually opens small, organic gaps
      const ujx = (seededRandom(row, col, 31) - 0.5) * 2 * imperfAmt;
      const ujy = (seededRandom(row, col, 32) - 0.5) * 2 * imperfAmt;
      const ujw = cw + (seededRandom(row, col, 33) - 0.5) * imperfAmt + underShrink;
      const ujh = ch + (seededRandom(row, col, 34) - 0.5) * imperfAmt + underShrink;
      const ufx = gx + ujx - underShrink / 2;
      const ufy = gy + ujy - underShrink / 2;

      ctx.save();
      octagonPath(ufx, ufy, ujw, ujh, cornerCut);
      ctx.clip();
      drawClampedSource(underImg, usx, usy, underSample.sw, underSample.sh, ufx, ufy, ujw, ujh);
      ctx.restore();
    }
  }

  // ── PASS 2 (OVER layer): the crossing-winning photo. TIGHT tension grows a
  // real overlap onto the neighbor (the "folded over" edge); LOOSE no longer
  // shrinks this layer's own size — the visible gap at loose settings comes
  // entirely from the octagon corner-cut above, kept to one bounded mechanism
  // instead of several shrinks compounding into an oversized void.
  const baseOverlap = mesh * 0.12;
  for (let gy = 0; gy < h; gy += mesh) {
    for (let gx = 0; gx < w; gx += mesh) {
      const col = Math.floor(gx / mesh);
      const row = Math.floor(gy / mesh);
      if (ap != null && !shouldRevealCell(row, col, Math.ceil(h / mesh) - 1, Math.ceil(w / mesh) - 1, weaveP, 2)) continue;
      let baseUseA;
      // STRAND LENGTH groups multiple cells into one continuous-looking strand segment
      // (real basket weave doesn't alternate every single tiny square — see basket weave
      // grouping pairs of threads), instead of a fine 1×1 checkerboard reading as disconnected tiles.
      const gRow = Math.floor(row / strandLength);
      const gCol = Math.floor(col / strandLength);
      if (currentDirection === 'stripe') baseUseA = col % 2 === 0;
      else baseUseA = (gRow + gCol) % 2 === 0;

      let useA = baseUseA;
      if (density > 50 && !baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true;
      } else if (density < 50 && baseUseA) {
        if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false;
      }

      const cw = Math.min(mesh, w - gx);
      const ch = Math.min(mesh, h - gy);

      const warpX = warpAmt * Math.sin(gy * 0.05 + col);
      const warpY = warpAmt * Math.sin(gx * 0.05 + row);

      // per-photo sample rect, independent of tension/imperfection sizing
      function sampleFor(img) {
        return sampleOutputSpace(gx, gy, cw, ch, warpX, warpY, zoomFactor, w, h);
      }

      const srcImg = useA ? sourceA : sourceB;
      const fg = sampleFor(srcImg);
      const sx = fg.sx, sy = fg.sy, sw = fg.sw, sh = fg.sh;

      const jx = (seededRandom(row, col, 1) - 0.5) * 2 * imperfAmt;
      const jy = (seededRandom(row, col, 2) - 0.5) * 2 * imperfAmt;
      const jw = cw + (seededRandom(row, col, 3) - 0.5) * imperfAmt;
      const jh = ch + (seededRandom(row, col, 4) - 0.5) * imperfAmt;

      const overlapAdjust = baseOverlap + Math.max(0, tensionFactor) * mesh * 0.30;
      const fx = gx + jx - overlapAdjust / 2;
      const fy = gy + jy - overlapAdjust / 2;
      const fw = jw + overlapAdjust;
      const fh = jh + overlapAdjust;

      ctx.save();
      octagonPath(fx, fy, fw, fh, cornerCut);
      ctx.clip();
      drawClampedSource(srcImg, sx, sy, sw, sh, fx, fy, fw, fh);
      ctx.restore();

      // draw the strand-segment's shadow/highlight only ONCE per group, from its
      // top-left anchor cell — not once per constituent cell — so the four edge
      // glows aren't stacked on top of each other inside the same group
      const isGroupAnchor = currentDirection === 'stripe'
        ? (row === 0)
        : (row % strandLength === 0 && col % strandLength === 0);
      if (depthAmt > 0 && isGroupAnchor) {
        let gx0, gy0, gw0, gh0;
        if (currentDirection === 'stripe') {
          gx0 = col * mesh; gy0 = 0; gw0 = mesh; gh0 = h;
        } else {
          gx0 = gCol * strandLength * mesh; gy0 = gRow * strandLength * mesh;
          gw0 = Math.min(strandLength * mesh, w - gx0);
          gh0 = Math.min(strandLength * mesh, h - gy0);
        }
        applyEdgeGlow(gx0, gy0, gw0, gh0, useA, visualDepthAmt, shadowReach, tensionDepthMul, lightVec, visualLightIntensity);
      }
    }
  }

  // Final material pass: one relief treatment per strand group. This adds a
  // readable cross-section, contact shadow and restrained surface highlight.
  if (reliefAmt > 0.002 || contactShadowAmt > 0.002 || specularAmt > 0.002) {
    const rows = Math.ceil(h / mesh), cols = Math.ceil(w / mesh);
    for (let r = 0; r < rows; r += strandLength) {
      for (let c = 0; c < cols; c += strandLength) {
        const gx = c * mesh, gy = r * mesh;
        const gw = Math.min(strandLength * mesh, w - gx);
        const gh = Math.min(strandLength * mesh, h - gy);
        if (gw <= 1 || gh <= 1) continue;
        const groupParity = (Math.floor(r / strandLength) + Math.floor(c / strandLength)) % 2;
        applySurfaceReliefRect(gx, gy, gw, gh, groupParity === 0, reliefAmt, contactShadowAmt, specularAmt, surfaceBendAmt, lightVec, visualLightIntensity, shadowReach, groupParity === 0);
      }
    }
  }

  applyGrain(grainAmt);
}

// Film-grain-style noise overlay — a per-pixel random luminance texture blended
// with 'overlay', giving the surface some tactile, non-digital grit instead of
// a flat, overly clean composite. Regenerated fresh each render (no caching)
// since GRAIN is usually adjusted interactively at low-to-moderate canvas sizes.
function applyGrain(amt) {
  if (amt <= 0.003) return;
  const w = outputCanvas.width, h = outputCanvas.height;
  const off = document.createElement('canvas');
  off.width = w; off.height = h;
  const octx = off.getContext('2d');
  const imgData = octx.createImageData(w, h);
  const data = imgData.data;
  for (let i = 0; i < data.length; i += 4) {
    const n = (Math.random() * 255) | 0;
    data[i] = n; data[i + 1] = n; data[i + 2] = n; data[i + 3] = 255;
  }
  octx.putImageData(imgData, 0, 0);
  ctx.save();
  ctx.globalAlpha = Math.min(1, amt * 0.55);
  ctx.globalCompositeOperation = 'overlay';
  ctx.drawImage(off, 0, 0);
  ctx.restore();
}

// Simulates the raised/lowered relief of a woven strand catching light from one
// direction — like the reference macro photos, where ridges facing the light
// catch a bright edge and the opposite side falls into shadow, all in the SAME
// direction across the whole piece (not just "A is always lit, B always dark").
// lightVec is a unit vector pointing toward the light source; useA still adds a
// small over/under bias on top of that shared directional lighting.
function reliefProfileParams() {
  if (currentProfile === 'round') return { crown: 1.00, edge: 0.72 };
  if (currentProfile === 'ribbon') return { crown: 0.62, edge: 0.38 };
  if (currentProfile === 'beveled') return { crown: 0.82, edge: 0.88 };
  return { crown: 0.32, edge: 0.22 };
}

// Lightweight 2D relief renderer. It simulates a raised strand cross-section
// with gradients, contact shadow and a restrained specular highlight, keeping
// the Canvas-2D/mobile architecture intact while making the weave read as a
// physical surface rather than a flat photo grid.
function applySurfaceReliefRect(x, y, w, h, useA, reliefAmt, contactAmt, specAmt, bendAmt, lightVec, lightIntensity, shadowReach, strandHorizontal) {
  if (reliefAmt <= 0.002 || w <= 1 || h <= 1) return;
  const pp = reliefProfileParams();
  const crossLen = strandHorizontal ? h : w;
  const crown = Math.min(0.62, 0.10 + reliefAmt * 0.48 * pp.crown);
  const edge = Math.min(0.58, 0.06 + reliefAmt * 0.42 * pp.edge);
  const lightPower = Math.max(0, Math.min(1, lightIntensity == null ? 1 : lightIntensity));
  const shadowPower = Math.max(0, Math.min(1, shadowReach == null ? 0.75 : shadowReach));
  const reach = Math.max(1.5, crossLen * (0.08 + 0.42 * shadowPower + 0.10 * bendAmt));

  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();

  const gx0 = x + (lightVec.x < 0 ? w : 0);
  const gy0 = y + (lightVec.y < 0 ? h : 0);
  const gx1 = x + (lightVec.x < 0 ? 0 : w);
  const gy1 = y + (lightVec.y < 0 ? 0 : h);
  const shade = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
  shade.addColorStop(0, `rgba(255,250,238,${crown * (0.70 + 0.30 * lightPower)})`);
  shade.addColorStop(0.46, `rgba(255,255,255,${crown * 0.28 * lightPower})`);
  shade.addColorStop(1, `rgba(0,0,0,${edge * (0.72 + 0.28 * shadowPower)})`);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = shade;
  ctx.fillRect(x, y, w, h);

  let cross;
  cross = strandHorizontal ? ctx.createLinearGradient(0, y, 0, y + h) : ctx.createLinearGradient(x, 0, x + w, 0);
  if (currentProfile === 'round') {
    cross.addColorStop(0, `rgba(0,0,0,${edge})`);
    cross.addColorStop(0.18, `rgba(255,255,255,${crown * 0.24})`);
    cross.addColorStop(0.50, `rgba(255,255,255,${crown * 0.72})`);
    cross.addColorStop(0.82, `rgba(255,255,255,${crown * 0.16})`);
    cross.addColorStop(1, `rgba(0,0,0,${edge * 0.92})`);
  } else if (currentProfile === 'beveled') {
    cross.addColorStop(0, `rgba(0,0,0,${edge})`);
    cross.addColorStop(0.22, `rgba(255,255,255,${crown * 0.30})`);
    cross.addColorStop(0.50, `rgba(255,255,255,${crown * 0.54})`);
    cross.addColorStop(0.78, `rgba(255,255,255,${crown * 0.10})`);
    cross.addColorStop(1, `rgba(0,0,0,${edge * 0.86})`);
  } else if (currentProfile === 'ribbon') {
    cross.addColorStop(0, `rgba(0,0,0,${edge * 0.55})`);
    cross.addColorStop(0.25, `rgba(255,255,255,${crown * 0.14})`);
    cross.addColorStop(0.50, `rgba(255,255,255,${crown * 0.34})`);
    cross.addColorStop(0.75, `rgba(255,255,255,${crown * 0.08})`);
    cross.addColorStop(1, `rgba(0,0,0,${edge * 0.62})`);
  } else {
    cross.addColorStop(0, `rgba(0,0,0,${edge * 0.35})`);
    cross.addColorStop(0.50, `rgba(255,255,255,${crown * 0.14})`);
    cross.addColorStop(1, `rgba(0,0,0,${edge * 0.38})`);
  }
  ctx.globalCompositeOperation = 'soft-light';
  ctx.fillStyle = cross;
  ctx.fillRect(x, y, w, h);

  if (contactAmt > 0.002) {
    const dark = Math.min(0.72, 0.12 + contactAmt * 0.58 + shadowPower * 0.12);
    const shadowOnPositive = strandHorizontal ? lightVec.y < 0 : lightVec.x < 0;
    let sg;
    if (strandHorizontal) {
      const sy0 = shadowOnPositive ? y + h : y;
      const sy1 = shadowOnPositive ? y + h - reach : y + reach;
      sg = ctx.createLinearGradient(0, sy0, 0, sy1);
    } else {
      const sx0 = shadowOnPositive ? x + w : x;
      const sx1 = shadowOnPositive ? x + w - reach : x + reach;
      sg = ctx.createLinearGradient(sx0, 0, sx1, 0);
    }
    sg.addColorStop(0, `rgba(0,0,0,${dark})`);
    sg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = sg;
    if (strandHorizontal) {
      const yy = shadowOnPositive ? y + h - reach : y;
      ctx.fillRect(x, yy, w, reach);
    } else {
      const xx = shadowOnPositive ? x + w - reach : x;
      ctx.fillRect(xx, y, reach, h);
    }
  }

  if (specAmt > 0.002 && currentProfile !== 'flat') {
    const sp = Math.min(0.34, specAmt * (0.20 + 0.14 * lightPower) * pp.crown);
    const sg = strandHorizontal ? ctx.createLinearGradient(0, y + h * 0.24, 0, y + h * 0.56) : ctx.createLinearGradient(x + w * 0.24, 0, x + w * 0.56, 0);
    sg.addColorStop(0, 'rgba(255,255,255,0)');
    sg.addColorStop(0.55, `rgba(255,255,255,${sp})`);
    sg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = sg;
    ctx.fillRect(x, y, w, h);
  }
  ctx.restore();
}

function applySurfaceReliefPolygon(corners, useA, reliefAmt, contactAmt, specAmt, bendAmt, lightVec, lightIntensity, shadowReach) {
  if (reliefAmt <= 0.002 || !corners || corners.length < 4) return;
  const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
  const x = Math.min(...xs), y = Math.min(...ys), w = Math.max(...xs)-x, h = Math.max(...ys)-y;
  const strandHorizontal = Math.abs(corners[1][0]-corners[0][0]) >= Math.abs(corners[1][1]-corners[0][1]);
  ctx.save();
  ctx.beginPath(); ctx.moveTo(corners[0][0],corners[0][1]);
  for (let i=1;i<corners.length;i++) ctx.lineTo(corners[i][0],corners[i][1]);
  ctx.closePath(); ctx.clip();
  applySurfaceReliefRect(x,y,w,h,useA,reliefAmt,contactAmt,specAmt,bendAmt,lightVec,lightIntensity,shadowReach,strandHorizontal);
  ctx.restore();
}

function applyEdgeGlow(x, y, w, h, useA, depthAmt, shadowReach, tensionDepthMul, lightVec, lightIntensity) {
  const profileMul = currentProfile === 'round' ? 1.0 : currentProfile === 'ribbon' ? 0.82 : currentProfile === 'beveled' ? 1.12 : 0.58;
  const peakBase = Math.max(0, Math.min(0.78, 0.42 * depthAmt * (0.75 + 0.25 * tensionDepthMul) * profileMul * (0.55 + 0.45 * (lightIntensity == null ? 1 : lightIntensity)) * (useA ? 1.15 : 0.9)));
  if (peakBase <= 0.002) return;
  const reach = Math.max(1, Math.min(w, h) * (0.08 + 0.55 * Math.max(0.04, shadowReach)));

  function edgeGlow(nx, ny, gx0, gy0, gx1, gy1, rx, ry, rw, rh) {
    const lit = nx * lightVec.x + ny * lightVec.y; // -1..1, >0 = facing the light
    const alpha = peakBase * Math.abs(lit);
    if (alpha <= 0.002) return;
    const color = lit > 0 ? '255,248,232' : '0,0,0';
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(rx, ry, rw, rh);
  }

  edgeGlow(0, -1, 0, y, 0, y + reach, x, y, w, reach);
  edgeGlow(0, 1, 0, y + h, 0, y + h - reach, x, y + h - reach, w, reach);
  edgeGlow(-1, 0, x, 0, x + reach, 0, x, y, reach, h);
  edgeGlow(1, 0, x + w, 0, x + w - reach, 0, x + w - reach, y, reach, h);
}

// Same idea as applyEdgeGlow but for an arbitrary quadrilateral (the rotated
// diamond groups in DIAGONAL mode) — walks each edge and lights/shadows it
// based on how directly its own outward normal faces the light source.
function applyPolygonEdgeGlow(corners, useA, depthAmt, shadowReach, tensionDepthMul, lightVec, lightIntensity) {
  const profileMul = currentProfile === 'round' ? 1.0 : currentProfile === 'ribbon' ? 0.82 : currentProfile === 'beveled' ? 1.12 : 0.58;
  const peakBase = Math.max(0, Math.min(0.78, 0.42 * depthAmt * (0.75 + 0.25 * tensionDepthMul) * profileMul * (0.55 + 0.45 * (lightIntensity == null ? 1 : lightIntensity)) * (useA ? 1.15 : 0.9)));
  if (peakBase <= 0.002) return;
  const centroid = corners.reduce((a, c) => [a[0] + c[0] / corners.length, a[1] + c[1] / corners.length], [0, 0]);
  const edgeLen = Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]);
  const reach = Math.max(1, edgeLen * (0.08 + 0.55 * Math.max(0.04, shadowReach)));

  for (let i = 0; i < corners.length; i++) {
    const a = corners[i], b = corners[(i + 1) % corners.length];
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    let nx = mx - centroid[0], ny = my - centroid[1]; // outward normal for this edge
    const nlen = Math.hypot(nx, ny) || 1;
    nx /= nlen; ny /= nlen;

    const lit = nx * lightVec.x + ny * lightVec.y;
    const alpha = peakBase * Math.abs(lit);
    if (alpha <= 0.002) continue;
    const color = lit > 0 ? '255,248,232' : '0,0,0';

    // inward-pointing strip for the shadow/highlight to fade across
    const ix = -nx, iy = -ny;
    const a2 = [a[0] + ix * reach, a[1] + iy * reach];
    const b2 = [b[0] + ix * reach, b[1] + iy * reach];

    const g = ctx.createLinearGradient(mx, my, mx + ix * reach, my + iy * reach);
    g.addColorStop(0, `rgba(${color},${alpha})`);
    g.addColorStop(1, `rgba(${color},0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.lineTo(b2[0], b2[1]);
    ctx.lineTo(a2[0], a2[1]);
    ctx.closePath();
    ctx.fill();
  }
}

// DIAGONAL WEAVE: unlike stripe/basket (axis-aligned square cells with a diagonal
// boundary), this rotates the mesh grid itself by 45° so the bands genuinely cross
// like real diagonal basketry — each "cell" is a diamond in screen space, clipped
// and filled with the correctly-oriented (unrotated) photo content underneath.
let diagonalMaskA = null;
let diagonalMaskB = null;
let diagonalLayer = null;

function ensureDiagonalBuffers(w, h) {
  function makeCanvas(old) {
    const c = old || document.createElement('canvas');
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }
  diagonalMaskA = makeCanvas(diagonalMaskA);
  diagonalMaskB = makeCanvas(diagonalMaskB);
  diagonalLayer = makeCanvas(diagonalLayer);
  return {
    maskA: diagonalMaskA.getContext('2d'),
    maskB: diagonalMaskB.getContext('2d'),
    layer: diagonalLayer.getContext('2d')
  };
}

// Draw an already output-sized source without ever supplying an out-of-range
// source rectangle to drawImage().  This is deliberately used by DIAGONAL mode
// because iOS/Safari can black out when thousands of clipped drawImage(sourceRect)
// operations are issued near the canvas edges.
function drawMappedDiagonalSource(targetCtx, source, w, h, scale, warpX, warpY) {
  targetCtx.save();
  targetCtx.translate(w / 2 - warpX, h / 2 - warpY);
  targetCtx.scale(1 / Math.max(0.001, scale), 1 / Math.max(0.001, scale));
  targetCtx.translate(-w / 2, -h / 2);
  targetCtx.drawImage(source, 0, 0, w, h);
  targetCtx.restore();
}

function paintDiagonalMaskedSource(source, maskCtx, layerCtx, w, h, scale, warpX, warpY) {
  layerCtx.save();
  layerCtx.setTransform(1, 0, 0, 1, 0, 0);
  layerCtx.clearRect(0, 0, w, h);
  drawMappedDiagonalSource(layerCtx, source, w, h, scale, warpX, warpY);
  layerCtx.globalCompositeOperation = 'destination-in';
  layerCtx.drawImage(maskCtx.canvas, 0, 0, w, h);
  layerCtx.restore();
  ctx.drawImage(layerCtx.canvas, 0, 0, w, h);
}

// DIAGONAL WEAVE — robust mask/composite renderer.
// Instead of drawing a cropped source image for every diamond, this builds two
// lightweight polygon masks and composites each photo only once per pass. This
// keeps the actual diagonal basket geometry while avoiding Safari/iPhone canvas
// blackouts caused by large numbers of edge-clipped source rectangles.
function renderDiagonalWeave(p) {
  const { sourceA, sourceB, mesh, zoomFactor, strandLength, depthAmt, shadowReach, lightVec, lightIntensity,
    warpAmt, imperfAmt, density, tensionFactor, tensionDepthMul, reliefAmt, contactShadowAmt, specularAmt, surfaceBendAmt,
    animationProgress, weaveProgress } = p;
  const w = outputCanvas.width, h = outputCanvas.height;
  const cx = w / 2, cy = h / 2;
  const cosA = Math.SQRT1_2, sinA = Math.SQRT1_2;
  const diag = Math.sqrt(w * w + h * h);
  const range = Math.ceil(diag / 2 / Math.max(1, mesh)) + 2;
  const { maskA, maskB, layer } = ensureDiagonalBuffers(w, h);

  maskA.setTransform(1,0,0,1,0,0);
  maskB.setTransform(1,0,0,1,0,0);
  maskA.clearRect(0,0,w,h);
  maskB.clearRect(0,0,w,h);
  maskA.fillStyle = '#fff';
  maskB.fillStyle = '#fff';

  function boundsOf(corners) {
    const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]);
    const bx = Math.max(0, Math.min(w, Math.min(...xs)));
    const by = Math.max(0, Math.min(h, Math.min(...ys)));
    const bxMax = Math.max(0, Math.min(w, Math.max(...xs)));
    const byMax = Math.max(0, Math.min(h, Math.max(...ys)));
    return { bx, by, bw: bxMax - bx, bh: byMax - by };
  }

  function cellInfo(row, col) {
    const u0 = row * mesh, v0 = col * mesh;
    const gRow = Math.floor(row / strandLength);
    const gCol = Math.floor(col / strandLength);
    let baseUseA = (gRow + gCol) % 2 === 0;
    let useA = baseUseA;
    if (density > 50 && !baseUseA) {
      if (seededRandom(gRow, gCol, 5) < (density - 50) / 50) useA = true;
    } else if (density < 50 && baseUseA) {
      if (seededRandom(gRow, gCol, 5) < (50 - density) / 50) useA = false;
    }
    const cornersUV = [[u0,v0],[u0+mesh,v0],[u0+mesh,v0+mesh],[u0,v0+mesh]];
    const cornersXYBase = cornersUV.map(([u,v], i) => {
      const jx = (seededRandom(row,col,10+i)-0.5) * 2 * imperfAmt;
      const jy = (seededRandom(row,col,20+i)-0.5) * 2 * imperfAmt;
      return [u*cosA - v*sinA + cx + jx, u*sinA + v*cosA + cy + jy];
    });
    const centroid = cornersXYBase.reduce((a,c)=>[a[0]+c[0]/4,a[1]+c[1]/4],[0,0]);
    return { row, col, gRow, gCol, useA, cornersXYBase, centroid };
  }

  function reveal(row, col, passSeed) {
    if (animationProgress == null) return true;
    return shouldRevealCell(row + range, col + range, range * 2, range * 2, weaveProgress, passSeed);
  }

  function fillPolygon(maskCtx, corners) {
    const b = boundsOf(corners);
    if (b.bw <= 0 || b.bh <= 0) return false;
    maskCtx.beginPath();
    maskCtx.moveTo(corners[0][0], corners[0][1]);
    for (let i=1;i<corners.length;i++) maskCtx.lineTo(corners[i][0], corners[i][1]);
    maskCtx.closePath();
    maskCtx.fill();
    return true;
  }

  // PASS 1: under strands. The masks are disjoint by photo, so each source is
  // composited only once after all of the geometry has been accumulated.
  for (let row=-range; row<=range; row++) {
    for (let col=-range; col<=range; col++) {
      if (!reveal(row,col,4)) continue;
      const c = cellInfo(row,col);
      const target = c.useA ? maskB : maskA;
      fillPolygon(target, c.cornersXYBase);
    }
  }

  // PASS 1 compositing. Default scale=1 is an exact screen-space mapping.
  paintDiagonalMaskedSource(sourceA, maskA, layer, w, h, zoomFactor, 0, 0);
  paintDiagonalMaskedSource(sourceB, maskB, layer, w, h, zoomFactor, 0, 0);

  // Clear masks for PASS 2.
  maskA.clearRect(0,0,w,h);
  maskB.clearRect(0,0,w,h);
  const tensionScale = 1.16 + tensionFactor * 0.22;
  const edgeGroups = [];

  // PASS 2: over strands. Enlarging each diamond creates the visible fold-over
  // at crossings. The resulting masks naturally occlude the under layer.
  for (let row=-range; row<=range; row++) {
    for (let col=-range; col<=range; col++) {
      if (!reveal(row,col,5)) continue;
      const c = cellInfo(row,col);
      const cornersXY = c.cornersXYBase.map(([x,y]) => [
        c.centroid[0] + (x-c.centroid[0])*tensionScale,
        c.centroid[1] + (y-c.centroid[1])*tensionScale
      ]);
      const target = c.useA ? maskA : maskB;
      if (!fillPolygon(target, cornersXY)) continue;

      if (depthAmt > 0 && row % strandLength === 0 && col % strandLength === 0) {
        const gu0 = row * mesh, gv0 = col * mesh;
        const gSize = strandLength * mesh;
        const groupCornersUV = [[gu0,gv0],[gu0+gSize,gv0],[gu0+gSize,gv0+gSize],[gu0,gv0+gSize]];
        let groupCorners = groupCornersUV.map(([u,v]) => [u*cosA-v*sinA+cx,u*sinA+v*cosA+cy]);
        const gCentroid = groupCorners.reduce((a,cc)=>[a[0]+cc[0]/4,a[1]+cc[1]/4],[0,0]);
        groupCorners = groupCorners.map(([x,y])=>[
          gCentroid[0] + (x-gCentroid[0])*tensionScale,
          gCentroid[1] + (y-gCentroid[1])*tensionScale
        ]);
        edgeGroups.push({ corners: groupCorners, useA: c.useA });
      }
    }
  }

  paintDiagonalMaskedSource(sourceA, maskA, layer, w, h, zoomFactor, 0, 0);
  paintDiagonalMaskedSource(sourceB, maskB, layer, w, h, zoomFactor, 0, 0);

  // Keep the existing physical-depth lighting language, but do it only once per
  // strand group after the two image composites, avoiding per-cell canvas work.
  if (depthAmt > 0 || reliefAmt > 0) {
    for (const g of edgeGroups) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(g.corners[0][0],g.corners[0][1]);
      for (let i=1;i<g.corners.length;i++) ctx.lineTo(g.corners[i][0],g.corners[i][1]);
      ctx.closePath();
      ctx.clip();
      if (depthAmt > 0) applyPolygonEdgeGlow(g.corners, g.useA, depthAmt, shadowReach, tensionDepthMul, lightVec, lightIntensity);
      applySurfaceReliefPolygon(g.corners, g.useA, reliefAmt, contactShadowAmt, specularAmt, surfaceBendAmt, lightVec, lightIntensity, shadowReach);
      ctx.restore();
    }
  }
}


[meshSlider, strandLengthSlider, warpSlider, imperfectionSlider, densitySlider, tensionSlider, depthAmtSlider, shadowReachSlider, lightDirectionSlider, grainSlider, lightIntensitySlider,
 reliefSlider, contactShadowSlider, specularSlider, surfaceBendSlider,
 exposureASlider, brillianceASlider, exposureBSlider, brillianceBSlider].forEach(el => {
  el.addEventListener('input', () => {
    // After the first weave animation, parameter changes are live edits.
    // Never send the user back through the generation animation just because
    // Photo A/B exposure or brilliance (or another slider) changed.
    if (animationPlaying) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      animationPlaying = false;
      animationProgress = null;
      compositionReady = true;
      hasAnimatedOnce = true;
    }
    // Before the first PLAY WEAVE, keep the composition locked.
    if (!hasAnimatedOnce) compositionReady = false;
    updateAnimationUI();
    meshVal.textContent = meshSlider.value;
    strandLengthVal.textContent = strandLengthSlider.value;
    warpVal.textContent = warpSlider.value + '%';
    imperfectionVal.textContent = imperfectionSlider.value + '%';
    densityVal.textContent = densitySlider.value + '%';
    tensionVal.textContent = tensionSlider.value + '%';
    depthAmtVal.textContent = depthAmtSlider.value + '%';
    shadowReachVal.textContent = shadowReachSlider.value + '%';
    lightDirectionVal.textContent = lightDirectionSlider.value + '°';
    grainVal.textContent = grainSlider.value + '%';
    lightIntensityVal.textContent = lightIntensitySlider.value + '%';
    reliefVal.textContent = reliefSlider.value + '%';
    contactShadowVal.textContent = contactShadowSlider.value + '%';
    specularVal.textContent = specularSlider.value + '%';
    surfaceBendVal.textContent = surfaceBendSlider.value + '%';
    exposureAVal.textContent = exposureASlider.value;
    brillianceAVal.textContent = brillianceASlider.value;
    exposureBVal.textContent = exposureBSlider.value;
    brillianceBVal.textContent = brillianceBSlider.value;
    render();
  });
});
backlightToggle.addEventListener('change', () => { if (!hasAnimatedOnce) compositionReady = false; updateAnimationUI(); render(); });

resetBtn.addEventListener('click', () => {
  if (animationPlaying) stopAnimation();
  compositionReady = false;
  hasAnimatedOnce = false;
  meshSlider.value = 40; strandLengthSlider.value = 1; depthAmtSlider.value = 60; shadowReachSlider.value = 75; warpSlider.value = 0;
  lightDirectionSlider.value = 45; grainSlider.value = 0;
  imperfectionSlider.value = 15; densitySlider.value = 50; tensionSlider.value = 50;
  reliefSlider.value = 72; contactShadowSlider.value = 68; specularSlider.value = 24; surfaceBendSlider.value = 18;
  backlightToggle.checked = false; lightIntensitySlider.value = 50;
  zoomWithMeshToggle.checked = false;
  exposureASlider.value = 0; brillianceASlider.value = 0;
  exposureBSlider.value = 0; brillianceBSlider.value = 0;
  directionBtns.forEach(b => b.classList.remove('active'));
  document.querySelector('[data-direction="basket"]').classList.add('active');
  currentDirection = 'basket';
  currentProfile = 'round';
  profileBtns.forEach(b => b.classList.toggle('active', b.dataset.profile === 'round'));
  [meshSlider, strandLengthSlider, warpSlider, imperfectionSlider, densitySlider, tensionSlider, depthAmtSlider, shadowReachSlider, lightDirectionSlider, grainSlider, lightIntensitySlider,
   reliefSlider, contactShadowSlider, specularSlider, surfaceBendSlider,
   exposureASlider, brillianceASlider, exposureBSlider, brillianceBSlider]
    .forEach(el => el.dispatchEvent(new Event('input')));
  render();
});

function isIOS() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
}

downloadBtn.addEventListener('click', () => {
  if (!hasA || !hasB) return;
  const dataUrl = outputCanvas.toDataURL('image/png');
  if (isIOS()) {
    document.getElementById('saveOverlayImg').src = dataUrl;
    document.getElementById('saveOverlay').style.display = 'flex';
  } else {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'woven-grain.png';
    a.click();
  }
});
document.getElementById('saveOverlayClose').addEventListener('click', () => {
  document.getElementById('saveOverlay').style.display = 'none';
});

// keeps the A/B previews correctly sized after an orientation change or window
// resize, since updatePreviews() now only resizes them when the size differs
let resizeDebounce;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(render, 150);
});

updateAnimationUI();
updateAnimationUI();
render();
