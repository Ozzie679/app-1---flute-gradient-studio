const DEVICES = {
  desktop: { label:'Desktop (Mac)', w:6016, h:3900 },
  ipad:    { label:'iPad',          w:2752, h:2064 },
  iphone:  { label:'iPhone',        w:1320, h:2868 }
};

const PALETTES = [
  { name:'Arctic Sky',    colors:['#0b2340','#2f7fb0','#dff3f0'], glow:'#ffffff' },
  { name:'Sunset Ember',  colors:['#3a0d1f','#c9411f','#f0dfc8'], glow:'#ffb27a' },
  { name:'Nebula Violet', colors:['#0d0a26','#5a3fc0','#e46bd6'], glow:'#c9a8ff' },
  { name:'Citrus Punch',  colors:['#1c1440','#2255aa','#f5d548'], glow:'#fff2b0' },
  { name:'Aurora Teal',   colors:['#050912','#2fd6b0','#6a3fd6'], glow:'#9dffe6' },
  { name:'Cotton Candy',  colors:['#3a2a66','#e07ad6','#dff2ff'], glow:'#ffe3f7' },
  { name:'Midnight Rose', colors:['#160b2e','#8a1d55','#ff6a4a'], glow:'#ff9d7a' },
  { name:'Golden Hour',   colors:['#132848','#e08a2f','#fff3d6'], glow:'#ffdca0' },
  { name:'Berry Coral',   colors:['#3a1030','#e0396f','#ffb37a'], glow:'#ffd6a8' },
  { name:'Mint Frost',    colors:['#0a1f2e','#3fb8a8','#eafff6'], glow:'#c8fff0' }
];
const GLOW_POS = { tl:[0.22,0.22], tr:[0.78,0.22], bl:[0.22,0.78], br:[0.78,0.78], c:[0.5,0.5] };

let state = {
  device:'desktop',
  colors:[...PALETTES[0].colors],
  angle:112,
  glowEnabled:true,
  glowColor:PALETTES[0].glow,
  glowPos:'tr',
  glowOpacity:32,
  bandCount:420,
  fluteIntensity:32,
  turbulence:0,
  paletteName:PALETTES[0].name
};

const mainCanvas = document.getElementById('main');
const mainCtx = mainCanvas.getContext('2d');
let renderPending = false;

function hexToRgba(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

// cxOverride/cyOverride let us compute the gradient axis against a taller
// off-screen buffer (see buildColorField) while still treating w/h as the
// logical, visible canvas size for the angle math.
function gradientCoords(w,h,angleDeg,cxOverride,cyOverride){
  const a = angleDeg * Math.PI/180;
  const cx = cxOverride!==undefined ? cxOverride : w/2;
  const cy = cyOverride!==undefined ? cyOverride : h/2;
  const len = Math.sqrt(w*w+h*h)/2;
  return { x0:cx-Math.cos(a)*len, y0:cy-Math.sin(a)*len, x1:cx+Math.cos(a)*len, y1:cy+Math.sin(a)*len };
}

// Paints one soft radial patch of color, blended onto whatever's already on
// the canvas. This is the building block for both the automatic accent
// blobs and the user-controlled glow highlight.
function drawBlob(ctx, gx, gy, radius, color, opacity, blend){
  ctx.save();
  ctx.globalCompositeOperation = blend;
  const rg = ctx.createRadialGradient(gx,gy,0, gx,gy,radius);
  rg.addColorStop(0, hexToRgba(color, opacity));
  rg.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = rg;
  ctx.fillRect(0,0,ctx.canvas.width, ctx.canvas.height);
  ctx.restore();
}

// A stable (non-random) seed derived from the palette/colors/glow position,
// so the same settings always produce the same wave shape (no flicker while
// dragging unrelated sliders like angle or band count), but different
// palettes get visibly different wave curves.
function seedFromCfg(cfg){
  const s = `${cfg.paletteName}|${cfg.colors.join(',')}|${cfg.glowPos}`;
  let h = 0;
  for(let i=0;i<s.length;i++){ h = (h*31 + s.charCodeAt(i))|0; }
  return Math.abs(h)%1000;
}

// Deterministic pseudo-random value per flute band index, used for subtle
// natural brightness jitter between adjacent ridges (real fluted glass is
// never perfectly uniform).
function bandJitter(i){
  const x = Math.sin(i*12.9898)*43758.5453;
  return x - Math.floor(x);
}

// Builds the color layer BEFORE any warp is applied: a linear base gradient
// plus two automatic accent blobs positioned in the gradient's transition
// zone (not just re-coloring the start/end extremes), plus the user's glow
// highlight. Everything here gets warped together afterwards, which is what
// gives the glow and color regions their organic, non-linear edges instead
// of a straight axis.
//
// The whole thing is built on a canvas taller than the final image (extra
// "margin" above and below) so that when warpAndComposite() later shifts
// columns up/down, it always has real pixels to sample from and never
// exposes a transparent gap at the top/bottom edge.
function buildColorField(w, h, cfg){
  const margin = Math.ceil(h*0.18);
  const tallH = h + margin*2;
  const buf = document.createElement('canvas');
  buf.width = w; buf.height = tallH;
  const bctx = buf.getContext('2d');

  const {x0,y0,x1,y1} = gradientCoords(w,h,cfg.angle, w/2, margin+h/2);
  const grad = bctx.createLinearGradient(x0,y0,x1,y1);
  cfg.colors.forEach((c,i)=> grad.addColorStop(i/(cfg.colors.length-1), c));
  bctx.fillStyle = grad;
  bctx.fillRect(0,0,w,tallH);

  const angleRad = cfg.angle * Math.PI/180;
  const dirX = Math.cos(angleRad), dirY = Math.sin(angleRad);
  // Perpendicular to the gradient axis: this is where the linear gradient is
  // already passing through its mid-tone, so blobs placed here blend INTO
  // the transition instead of just intensifying the already-start/end areas.
  const perpX = -dirY, perpY = dirX;

  const gx0 = w*(0.5 + perpX*0.26), gy0 = margin + h*(0.5 + perpY*0.26);
  drawBlob(bctx, gx0, gy0, Math.max(w,h)*0.55, cfg.colors[1], 0.55, 'soft-light');

  const gx1 = w*(0.5 - perpX*0.24), gy1 = margin + h*(0.5 - perpY*0.24);
  drawBlob(bctx, gx1, gy1, Math.max(w,h)*0.48, cfg.colors[0], 0.35, 'overlay');

  if(cfg.glowEnabled){
    const [px,py] = GLOW_POS[cfg.glowPos];
    drawBlob(bctx, w*px, margin+h*py, Math.max(w,h)*0.62, cfg.glowColor, cfg.glowOpacity/100, 'screen');
  }

  return { canvas: buf, margin };
}

// Takes the pre-warp color field and stamps it onto the visible canvas one
// narrow vertical slice at a time, each slice sampled from a slightly
// different vertical offset in the tall buffer. The offset follows a sum of
// two sine waves (irregular, not a single uniform ripple), so straight
// color boundaries become the varied curves/parabolas seen in the reference
// wallpapers instead of one bent line.
//
// The slice width is locked to the flute band width (cfg.bandCount) on
// purpose: if the warp and the flutes used different periods, they'd beat
// against each other and create a moire-like visual noise. Sharing one grid
// keeps the color bend and the flute ridges moving together.
function warpAndComposite(ctx, w, h, field, cfg){
  const { canvas: buf, margin } = field;
  const turbulence = cfg.turbulence/100;
  const baseAmp = h*0.012; // small baseline curve even at 0% wave distortion
  const amp = Math.min(baseAmp + turbulence*h*0.16, margin*0.92);

  const seed = seedFromCfg(cfg);
  const f1 = 1.4 + (seed%7)*0.15;
  const f2 = 2.6 + (seed%5)*0.2;
  const p1 = seed*1.7;
  const p2 = seed*0.9 + 1.3;

  const step = w/cfg.bandCount;
  ctx.clearRect(0,0,w,h);
  for(let x=0; x<w; x+=step){
    const bw = Math.min(step+1, w-x+1);
    const t = (x+step/2)/w;
    const wave = Math.sin(t*Math.PI*2*f1 + p1)*0.6 + Math.sin(t*Math.PI*2*f2 + p2)*0.4;
    const offsetY = wave*amp;
    const srcY = margin + offsetY;
    ctx.drawImage(buf, x, srcY, bw, h, x, 0, bw, h);
  }
}

// Reads back a single scaled-down horizontal strip of whatever's currently
// on the canvas (the warped color field, at this point) so drawFlutes() can
// make each ridge's brightness react to the color underneath it, brighter
// where the underlying gradient is already light, more restrained where
// it's dark. This is what makes the flutes read as glass catching light
// rather than a flat repeating stripe pattern.
function sampleLuminanceRow(ctx, w, h, samples){
  const tmp = document.createElement('canvas');
  tmp.width = samples; tmp.height = 1;
  const tctx = tmp.getContext('2d');
  tctx.drawImage(ctx.canvas, 0, Math.floor(h*0.5), w, 1, 0,0, samples,1);
  const data = tctx.getImageData(0,0,samples,1).data;
  const lums = new Array(samples);
  for(let i=0;i<samples;i++){
    const r=data[i*4], g=data[i*4+1], b=data[i*4+2];
    lums[i] = (0.299*r+0.587*g+0.114*b)/255;
  }
  return lums;
}

function drawFlutes(ctx,w,h,bandCount,intensityPct,turbulencePct,lums){
  const intensity = intensityPct/100;
  const turbulence = turbulencePct/100;
  const bw = w/bandCount;
  const segs = turbulence>0 ? Math.max(2, Math.round(10*turbulence)) : 1;
  const segH = h/segs;
  const samples = lums ? lums.length : 0;

  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  for(let i=0;i<bandCount;i++){
    const bx = i*bw;

    const jitter = 0.85 + bandJitter(i)*0.3; // 0.85-1.15, natural ridge-to-ridge variation
    let lumFactor = 1;
    if(samples){
      const t = (bx+bw/2)/w;
      const si = Math.min(samples-1, Math.max(0, Math.floor(t*samples)));
      lumFactor = 0.75 + lums[si]*0.6; // brighter underlying color -> brighter highlight
    }
    const bandIntensity = Math.max(0, Math.min(1.3, intensity*jitter*lumFactor));

    for(let s=0;s<segs;s++){
      const sy = s*segH;
      const wobble = turbulence>0 ? Math.sin(i*0.14 + s*0.6) * turbulence * bw * 2.2 : 0;
      const g = ctx.createLinearGradient(bx+wobble,0,bx+bw+wobble,0);
      // Asymmetric shadow/highlight/shadow curve (peak slightly off-center)
      // reads as a glass ridge catching light from one side, rather than a
      // flat symmetric stripe.
      g.addColorStop(0.00, `rgba(0,0,0,${0.50*bandIntensity})`);
      g.addColorStop(0.35, `rgba(0,0,0,${0.15*bandIntensity})`);
      g.addColorStop(0.55, `rgba(255,255,255,${1.00*bandIntensity})`);
      g.addColorStop(0.72, `rgba(255,255,255,${0.25*bandIntensity})`);
      g.addColorStop(1.00, `rgba(0,0,0,${0.45*bandIntensity})`);
      ctx.fillStyle = g;
      ctx.fillRect(bx+wobble-1, sy, bw+2, segH+1);
    }
  }
  ctx.restore();
}

function render(ctx, w, h, cfg){
  ctx.clearRect(0,0,w,h);

  const field = buildColorField(w, h, cfg);
  warpAndComposite(ctx, w, h, field, cfg);

  const sampleCount = Math.min(300, Math.max(60, Math.round(cfg.bandCount/2)));
  const lums = sampleLuminanceRow(ctx, w, h, sampleCount);

  drawFlutes(ctx, w, h, cfg.bandCount, cfg.fluteIntensity, cfg.turbulence, lums);
}

function fitCanvasToDevice(canvas, device, maxDim){
  const d = DEVICES[device];
  const scale = Math.min(maxDim/d.w, maxDim/d.h);
  canvas.width = Math.round(d.w*scale);
  canvas.height = Math.round(d.h*scale);
}

function renderMain(){
  fitCanvasToDevice(mainCanvas, state.device, 900);
  render(mainCtx, mainCanvas.width, mainCanvas.height, state);
  document.getElementById('resLabel').textContent =
    `${DEVICES[state.device].w} × ${DEVICES[state.device].h}`;
  document.getElementById('paletteName').textContent = state.paletteName;
}

function scheduleRender(){
  if(!renderPending){
    renderPending = true;
    requestAnimationFrame(()=>{
      renderPending=false;
      renderMain();
      saveCurrentSettings();
    });
  }
}

function applySavedSettings(saved){
  if(!saved || typeof saved !== 'object') return;
  if(saved.device && DEVICES[saved.device]) state.device = saved.device;
  if(Array.isArray(saved.colors) && saved.colors.length === 3) state.colors = [...saved.colors];
  if(typeof saved.angle === 'number') state.angle = saved.angle;
  if(typeof saved.glowEnabled === 'boolean') state.glowEnabled = saved.glowEnabled;
  if(saved.glowColor) state.glowColor = saved.glowColor;
  if(saved.glowPos && GLOW_POS[saved.glowPos]) state.glowPos = saved.glowPos;
  if(typeof saved.glowOpacity === 'number') state.glowOpacity = saved.glowOpacity;
  if(typeof saved.bandCount === 'number') state.bandCount = saved.bandCount;
  if(typeof saved.fluteIntensity === 'number') state.fluteIntensity = saved.fluteIntensity;
  if(typeof saved.turbulence === 'number') state.turbulence = saved.turbulence;
  if(saved.paletteName) state.paletteName = saved.paletteName;
}

function saveCurrentSettings(){
  if(window.electronAPI?.saveSettings){
    window.electronAPI.saveSettings(state);
  }
}

// ---- controls wiring ----
const $ = id => document.getElementById(id);

function syncControlsFromState(){
  $('colorA').value = state.colors[0];
  $('colorB').value = state.colors[1];
  $('colorC').value = state.colors[2];
  $('angle').value = state.angle;
  $('angleVal').textContent = state.angle+'°';
  $('glowEnabled').checked = state.glowEnabled;
  $('glowColor').value = state.glowColor;
  $('glowPos').value = state.glowPos;
  $('glowOpacity').value = state.glowOpacity;
  $('glowOpacityVal').textContent = state.glowOpacity+'%';
  $('bandCount').value = state.bandCount;
  $('bandVal').textContent = state.bandCount;
  $('fluteIntensity').value = state.fluteIntensity;
  $('fluteVal').textContent = state.fluteIntensity+'%';
  $('turbulence').value = state.turbulence;
  $('waveVal').textContent = state.turbulence+'%';
  $('glowControls').style.display = state.glowEnabled ? 'block' : 'none';
  document.querySelectorAll('#deviceSeg button').forEach(b=>{
    b.classList.toggle('active', b.dataset.device===state.device);
  });
}

['colorA','colorB','colorC'].forEach((id,i)=>{
  $(id).addEventListener('input', e=>{
    state.colors[i] = e.target.value;
    state.paletteName = 'Custom';
    $('paletteName').textContent = 'Custom';
    scheduleRender();
  });
});
$('angle').addEventListener('input', e=>{ state.angle=+e.target.value; $('angleVal').textContent=state.angle+'°'; scheduleRender(); });
$('glowEnabled').addEventListener('change', e=>{ state.glowEnabled=e.target.checked; $('glowControls').style.display=state.glowEnabled?'block':'none'; scheduleRender(); });
$('glowColor').addEventListener('input', e=>{ state.glowColor=e.target.value; scheduleRender(); });
$('glowPos').addEventListener('change', e=>{ state.glowPos=e.target.value; scheduleRender(); });
$('glowOpacity').addEventListener('input', e=>{ state.glowOpacity=+e.target.value; $('glowOpacityVal').textContent=state.glowOpacity+'%'; scheduleRender(); });
$('bandCount').addEventListener('input', e=>{ state.bandCount=+e.target.value; $('bandVal').textContent=state.bandCount; scheduleRender(); });
$('fluteIntensity').addEventListener('input', e=>{ state.fluteIntensity=+e.target.value; $('fluteVal').textContent=state.fluteIntensity+'%'; scheduleRender(); });
$('turbulence').addEventListener('input', e=>{ state.turbulence=+e.target.value; $('waveVal').textContent=state.turbulence+'%'; scheduleRender(); });

document.querySelectorAll('#deviceSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{ state.device=b.dataset.device; syncControlsFromState(); scheduleRender(); });
});

function buildPaletteRow(){
  const row = $('paletteRow');
  row.innerHTML='';
  PALETTES.forEach((p)=>{
    const el = document.createElement('div');
    el.className='swatch';
    el.title = p.name;
    el.style.background = `linear-gradient(135deg, ${p.colors[0]}, ${p.colors[1]}, ${p.colors[2]})`;
    el.addEventListener('click', ()=>{
      state.colors=[...p.colors];
      state.glowColor=p.glow;
      state.paletteName=p.name;
      syncControlsFromState();
      scheduleRender();
    });
    row.appendChild(el);
  });
}

function randomFrom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function randomCfg(){
  const p = randomFrom(PALETTES);
  const posKeys = Object.keys(GLOW_POS);
  return {
    device: state.device,
    colors:[...p.colors],
    angle: Math.round(70 + Math.random()*70),
    glowEnabled: Math.random()>0.15,
    glowColor: p.glow,
    glowPos: randomFrom(posKeys),
    glowOpacity: Math.round(20+Math.random()*35),
    bandCount: Math.round(250+Math.random()*350),
    fluteIntensity: Math.round(20+Math.random()*35),
    turbulence: Math.random()>0.6 ? Math.round(Math.random()*55) : 0,
    paletteName: p.name
  };
}

$('shuffleBtn').addEventListener('click', ()=>{
  state = {...state, ...randomCfg()};
  syncControlsFromState();
  scheduleRender();
});

// ---- gallery ----
function buildGallery(){
  const gal = $('gallery');
  gal.innerHTML='';
  for(let i=0;i<6;i++){
    const cfg = randomCfg();
    const wrap = document.createElement('div');
    wrap.className='thumb';
    const c = document.createElement('canvas');
    c.width=240; c.height=150;
    const ctx = c.getContext('2d');
    render(ctx,240,150,cfg);
    wrap.appendChild(c);

    const dl = document.createElement('div');
    dl.className='dl';
    dl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';
    dl.addEventListener('click', (ev)=>{ ev.stopPropagation(); saveWallpaper(cfg); });
    wrap.appendChild(dl);

    wrap.addEventListener('click', ()=>{
      state = {...state, ...cfg};
      syncControlsFromState();
      scheduleRender();
    });
    gal.appendChild(wrap);
  }
}
$('refreshGallery').addEventListener('click', buildGallery);

// ---- save / export ----
// Renders the config at full device resolution, then hands the PNG bytes
// to Electron's native Save dialog (via preload.js). Falls back to a plain
// browser download if electronAPI isn't present (e.g. testing index.html
// directly in a browser tab).
function saveWallpaper(cfg){
  const note = $('loadingNote');
  note.textContent = 'Rendering full resolution…';
  setTimeout(async ()=>{
    const d = DEVICES[cfg.device];
    const off = document.createElement('canvas');
    off.width = d.w; off.height = d.h;
    const octx = off.getContext('2d');
    render(octx, d.w, d.h, cfg);

    const suggestedName = `flute-gradient-${cfg.paletteName.toLowerCase().replace(/\s+/g,'-')}-${cfg.device}.png`;

    off.toBlob(async blob=>{
      if(window.electronAPI){
        const arrBuf = await blob.arrayBuffer();
        const result = await window.electronAPI.saveWallpaper(arrBuf, suggestedName);
        note.textContent = result.success ? `Saved: ${result.filePath}` : '';
      } else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = suggestedName;
        a.click();
        note.textContent = 'Downloaded';
      }
      setTimeout(()=>{ note.textContent=''; }, 3000);
    }, 'image/png');
  }, 30);
}
$('downloadBtn').addEventListener('click', ()=> saveWallpaper(state));

// ---- init ----
async function init(){
  if(window.electronAPI?.getSettings){
    const saved = await window.electronAPI.getSettings();
    applySavedSettings(saved);
  }
  buildPaletteRow();
  syncControlsFromState();
  renderMain();
  buildGallery();
}
init();
