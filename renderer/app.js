import {
  ShaderMount,
  flutedGlassFragmentShader,
  GlassGridShapes,
  GlassDistortionShapes,
  getShaderColorFromString,
  ShaderFitOptions,
} from '../node_modules/@paper-design/shaders/dist/index.js';

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
  shadows:0.2,
  highlights:0.08,
  fluteSize:0.55,
  distortion:0,
  fluteBlur:0.08,
  paletteName:PALETTES[0].name
};

const mainCanvas = document.getElementById('main');
const mainCtx = mainCanvas.getContext('2d');

// At most one preview render runs at a time. Rendering is async, so a fast
// slider drag calls scheduleRender() many times mid-render; letting those
// run concurrently caused flicker. Inputs that arrive during a render just
// set renderQueued, and one follow-up pass picks up the latest `state`.
let isRendering = false;
let renderQueued = false;

function clamp(v, min, max){ return Math.min(max, Math.max(min, v)); }

function hexToRgba(hex, a){
  const h = hex.replace('#','');
  const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
  return `rgba(${r},${g},${b},${a})`;
}

function gradientCoords(w,h,angleDeg){
  const a = angleDeg * Math.PI/180;
  const cx = w/2, cy = h/2;
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

// Builds the flat color layer that the fluted-glass shader then distorts: a
// linear base gradient, two automatic accent blobs in the gradient's
// transition zone (so the middle isn't a straight blend), plus the user's
// glow highlight.
function buildColorField(w, h, cfg){
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');

  const {x0,y0,x1,y1} = gradientCoords(w,h,cfg.angle);
  const grad = ctx.createLinearGradient(x0,y0,x1,y1);
  cfg.colors.forEach((c,i)=> grad.addColorStop(i/(cfg.colors.length-1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0,0,w,h);

  const angleRad = cfg.angle * Math.PI/180;
  const dirX = Math.cos(angleRad), dirY = Math.sin(angleRad);
  const perpX = -dirY, perpY = dirX;

  const gx0 = w*(0.5 + perpX*0.26), gy0 = h*(0.5 + perpY*0.26);
  drawBlob(ctx, gx0, gy0, Math.max(w,h)*0.55, cfg.colors[1], 0.55, 'soft-light');

  const gx1 = w*(0.5 - perpX*0.24), gy1 = h*(0.5 - perpY*0.24);
  drawBlob(ctx, gx1, gy1, Math.max(w,h)*0.48, cfg.colors[0], 0.35, 'overlay');

  if(cfg.glowEnabled){
    const [px,py] = GLOW_POS[cfg.glowPos];
    drawBlob(ctx, w*px, h*py, Math.max(w,h)*0.62, cfg.glowColor, cfg.glowOpacity/100, 'screen');
  }

  return canvas;
}

// ShaderMount sizes its internal canvas via ResizeObserver, which fires
// asynchronously. Without this wait, pixel readback happens before the
// canvas has grown past its browser-default 300x150 size, producing
// blank exports. This polls via its own ResizeObserver and resolves as
// soon as the canvas matches the target size, with a timeout as a
// safety net so a stuck render can't hang forever.
function waitForCanvasResize(canvas, expectedWidth, expectedHeight, timeoutMs = 3000){
  return new Promise((resolve) => {
    if (canvas.width === expectedWidth && canvas.height === expectedHeight) {
      resolve();
      return;
    }
    let settled = false;
    const observer = new ResizeObserver(() => {
      if (settled) return;
      if (canvas.width === expectedWidth && canvas.height === expectedHeight) {
        settled = true;
        observer.disconnect();
        clearTimeout(timeoutId);
        resolve();
      }
    });
    observer.observe(canvas);
    const timeoutId = setTimeout(() => {
      if (settled) return;
      settled = true;
      observer.disconnect();
      console.warn(`[shader] canvas never reached ${expectedWidth}x${expectedHeight} within ${timeoutMs}ms, stuck at ${canvas.width}x${canvas.height}. Reading pixels anyway.`);
      resolve();
    }, timeoutMs);
  });
}

function shaderUniforms(cfg){
  return {
    u_shadows: cfg.shadows,
    u_highlights: cfg.highlights,
    u_size: cfg.fluteSize,
    u_distortion: cfg.distortion,
    u_blur: cfg.fluteBlur,
  };
}

// ShaderMount only accepts a loaded <img> for u_image, so a mount is created
// with this 1x1 placeholder and the real color field is uploaded afterwards.
const PLACEHOLDER_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

// Creates a FlutedGlass ShaderMount in a hidden w x h container.
async function createShaderMount(w, h){
  const img = new Image();
  img.src = PLACEHOLDER_IMAGE_SRC;
  await img.decode();

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-99999px';
  container.style.top = '0';
  container.style.width = `${w}px`;
  container.style.height = `${h}px`;
  document.body.appendChild(container);

  try {
    const mount = new ShaderMount(
      container,
      flutedGlassFragmentShader,
      {
        u_image: img,
        u_colorBack: getShaderColorFromString('#00000000'),
        u_colorShadow: getShaderColorFromString('#000000'),
        u_colorHighlight: getShaderColorFromString('#ffffff'),
        ...shaderUniforms(state),
        u_shape: GlassGridShapes.lines,
        u_angle: 0,
        u_distortionShape: GlassDistortionShapes.prism,
        u_shift: 0,
        u_stretch: 0,
        u_edges: 0,
        u_marginLeft: 0, u_marginRight: 0, u_marginTop: 0, u_marginBottom: 0,
        u_grainMixer: 0,
        u_grainOverlay: 0,
        u_fit: ShaderFitOptions.cover,
        u_scale: 1,
        u_rotation: 0,
        u_originX: 0.5,
        u_originY: 0.5,
        u_offsetX: 0,
        u_offsetY: 0,
        u_worldWidth: 0,
        u_worldHeight: 0,
      },
      { preserveDrawingBuffer: true },
      0, 0, 1, w*h
    );
    await waitForCanvasResize(mount.canvasElement, w, h);
    return { mount, container };
  } catch (err) {
    container.remove();
    throw err;
  }
}

function disposeShaderMount({ mount, container }){
  mount.dispose();
  container.remove();
}

// Draws a color field through the shader and returns a copy of the result.
// Instead of PNG-encoding the field into an <img> (the only input
// ShaderMount's API takes), the canvas is uploaded straight into the mount's
// existing u_image texture. This reaches into ShaderMount internals (gl,
// textures, textureUnitMap, uniformLocations) from @paper-design/shaders
// 0.0.77; re-check this if that package is upgraded.
function drawWithShader({ mount }, field, cfg){
  const { gl } = mount;
  if(gl.isContextLost()) throw new Error('WebGL context lost');
  gl.useProgram(mount.program);
  gl.activeTexture(gl.TEXTURE0 + mount.textureUnitMap.get('u_image'));
  gl.bindTexture(gl.TEXTURE_2D, mount.textures.get('u_image'));
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, field);
  gl.uniform1f(mount.uniformLocations.u_imageAspectRatio, field.width / field.height);
  mount.setUniforms(shaderUniforms(cfg)); // also renders synchronously

  const out = document.createElement('canvas');
  out.width = field.width; out.height = field.height;
  out.getContext('2d').drawImage(mount.canvasElement, 0, 0);
  return out;
}

// Long-lived mounts for the sizes rendered over and over (preview per
// device, gallery thumbnails), keyed by "WxH". Stored as promises so two
// callers asking for the same new size share one mount. Once a mount
// exists, drawWithShader() is fully synchronous, so callers can never
// interleave on the same mount.
const shaderMounts = new Map();

async function getShaderMount(w, h){
  const key = `${w}x${h}`;
  let entry = shaderMounts.get(key);
  if(entry){
    const existing = await entry.catch(()=>null);
    if(existing && !existing.mount.gl.isContextLost()) return existing;
    if(existing) disposeShaderMount(existing);
    shaderMounts.delete(key);
  }
  entry = createShaderMount(w, h);
  shaderMounts.set(key, entry);
  return entry;
}

// Renders a config to a brand new w x h canvas, reusing a cached mount.
async function renderToCanvas(w, h, cfg){
  const mount = await getShaderMount(w, h);
  return drawWithShader(mount, buildColorField(w, h, cfg), cfg);
}

// Full-resolution exports are rare and large (up to ~23 MP), so they get a
// throwaway mount rather than holding that much GPU memory for the session.
async function renderOnce(w, h, cfg){
  const mount = await createShaderMount(w, h);
  try {
    return drawWithShader(mount, buildColorField(w, h, cfg), cfg);
  } finally {
    disposeShaderMount(mount);
  }
}

// Pure calculation only -- does NOT touch the DOM. Assigning to
// canvas.width/height clears the bitmap even when the value is unchanged,
// so we need the target size *before* deciding whether a resize is needed
// (otherwise the preview flashes black).
function computeDeviceCanvasSize(device, maxDim){
  const d = DEVICES[device];
  const scale = Math.min(maxDim/d.w, maxDim/d.h);
  return { w: Math.round(d.w*scale), h: Math.round(d.h*scale) };
}

async function renderMain(){
  const { w, h } = computeDeviceCanvasSize(state.device, 900);

  // All the expensive work happens offscreen. mainCanvas is not touched
  // during this await, so the previous frame stays visible while it runs.
  const finalCanvas = await renderToCanvas(w, h, state);

  // Only resize mainCanvas if the device actually changed size. On a
  // slider drag it never does, so this branch is skipped entirely and the
  // canvas is never cleared -- the old frame survives right up until the
  // drawImage below replaces it.
  if (mainCanvas.width !== w || mainCanvas.height !== h) {
    mainCanvas.width = w;
    mainCanvas.height = h;
  }

  // Resize (if any) and draw happen in this same synchronous block, with
  // no `await` between them. The browser can only repaint between JS
  // tasks/microtasks, not in the middle of one, so even on a real device
  // switch there's no frame where the canvas is visibly blank -- this is
  // the standard offscreen-render-then-blit ("double buffering") pattern.
  mainCtx.clearRect(0,0,w,h);
  mainCtx.drawImage(finalCanvas, 0, 0, w, h);

  document.getElementById('resLabel').textContent =
    `${DEVICES[state.device].w} × ${DEVICES[state.device].h}`;
  document.getElementById('paletteName').textContent = state.paletteName;
}

async function scheduleRender(){
  if(isRendering){
    renderQueued = true;
    return;
  }
  isRendering = true;
  try {
    do {
      renderQueued = false;
      try {
        await renderMain();
      } catch (err) {
        // Keep the previous frame and carry on; a failed render must not
        // leave isRendering stuck, or the preview would freeze for good.
        console.error('Preview render failed:', err);
      }
    } while(renderQueued);
  } finally {
    isRendering = false;
  }
  saveCurrentSettings();
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
  if(typeof saved.shadows === 'number') state.shadows = clamp(saved.shadows, 0, 0.6);
  if(typeof saved.highlights === 'number') state.highlights = clamp(saved.highlights, 0, 0.35);
  if(typeof saved.fluteSize === 'number') state.fluteSize = clamp(saved.fluteSize, 0.4, 0.8);
  if(typeof saved.distortion === 'number') state.distortion = clamp(saved.distortion, 0, 0.5);
  if(typeof saved.fluteBlur === 'number') state.fluteBlur = clamp(saved.fluteBlur, 0, 0.6);
  if(saved.paletteName) state.paletteName = saved.paletteName;
}

// Debounced: electron-store writes to disk synchronously, and renders are
// now fast enough that saving after every one would mean dozens of disk
// writes per second during a slider drag.
let saveSettingsTimer;
function saveCurrentSettings(){
  if(!window.electronAPI?.saveSettings) return;
  clearTimeout(saveSettingsTimer);
  saveSettingsTimer = setTimeout(()=> window.electronAPI.saveSettings(state), 400);
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
  $('shadows').value = state.shadows;
  $('shadowsVal').textContent = state.shadows.toFixed(2);
  $('highlights').value = state.highlights;
  $('highlightsVal').textContent = state.highlights.toFixed(2);
  $('fluteSize').value = state.fluteSize;
  $('fluteSizeVal').textContent = state.fluteSize.toFixed(2);
  $('distortion').value = state.distortion;
  $('distortionVal').textContent = state.distortion.toFixed(2);
  $('fluteBlur').value = state.fluteBlur;
  $('fluteBlurVal').textContent = state.fluteBlur.toFixed(2);
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
$('shadows').addEventListener('input', e=>{ state.shadows=+e.target.value; $('shadowsVal').textContent=state.shadows.toFixed(2); scheduleRender(); });
$('highlights').addEventListener('input', e=>{ state.highlights=+e.target.value; $('highlightsVal').textContent=state.highlights.toFixed(2); scheduleRender(); });
$('fluteSize').addEventListener('input', e=>{ state.fluteSize=+e.target.value; $('fluteSizeVal').textContent=state.fluteSize.toFixed(2); scheduleRender(); });
$('distortion').addEventListener('input', e=>{ state.distortion=+e.target.value; $('distortionVal').textContent=state.distortion.toFixed(2); scheduleRender(); });
$('fluteBlur').addEventListener('input', e=>{ state.fluteBlur=+e.target.value; $('fluteBlurVal').textContent=state.fluteBlur.toFixed(2); scheduleRender(); });

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
function randomInRange(min, max, decimals=2){
  const v = min + Math.random()*(max-min);
  return parseFloat(v.toFixed(decimals));
}
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
    shadows: randomInRange(0, 0.4),
    highlights: randomInRange(0, 0.2),
    fluteSize: randomInRange(0.4, 0.8),
    distortion: randomInRange(0, 0.04),
    fluteBlur: randomInRange(0, 0.25, 2),
    paletteName: p.name
  };
}

$('shuffleBtn').addEventListener('click', ()=>{
  state = {...state, ...randomCfg()};
  syncControlsFromState();
  scheduleRender();
});

// ---- gallery ----
// Bumped on every rebuild so a slower, older build stops adding thumbnails
// once a newer one has started (e.g. Refresh clicked twice quickly).
let galleryBuildId = 0;

async function buildGallery(){
  const buildId = ++galleryBuildId;
  const gal = $('gallery');
  gal.innerHTML='';
  for(let i=0;i<6;i++){
    const cfg = randomCfg();
    let thumbCanvas;
    try {
      thumbCanvas = await renderToCanvas(240, 150, cfg);
    } catch (err) {
      console.error('Gallery thumbnail failed:', err);
      continue;
    }
    if(buildId !== galleryBuildId) return;

    const wrap = document.createElement('div');
    wrap.className='thumb';
    wrap.appendChild(thumbCanvas);

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
let noteTimer;
function showNote(text, clearAfterMs){
  clearTimeout(noteTimer);
  $('loadingNote').textContent = text;
  if(clearAfterMs) noteTimer = setTimeout(()=>{ $('loadingNote').textContent=''; }, clearAfterMs);
}

function canvasToPngBlob(canvas){
  return new Promise((resolve, reject)=>{
    canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error('Could not encode PNG')), 'image/png');
  });
}

async function saveWallpaper(cfg){
  showNote('Rendering full resolution…');
  // Give the note a moment to paint before the heavy render blocks the page.
  await new Promise(r=>setTimeout(r, 30));
  try {
    const d = DEVICES[cfg.device];
    const blob = await canvasToPngBlob(await renderOnce(d.w, d.h, cfg));
    const suggestedName = `flute-gradient-${cfg.paletteName.toLowerCase().replace(/\s+/g,'-')}-${cfg.device}.png`;

    if(window.electronAPI){
      const result = await window.electronAPI.saveWallpaper(await blob.arrayBuffer(), suggestedName);
      if(result.success) showNote(`Saved: ${result.filePath}`, 3000);
      else if(result.error) showNote(`Couldn't save: ${result.error}`, 6000);
      else showNote('');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = suggestedName;
      a.click();
      showNote('Downloaded', 3000);
    }
  } catch (err) {
    console.error('Save failed:', err);
    showNote(`Couldn't render wallpaper: ${err.message}`, 6000);
  }
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
  await renderMain();
  await buildGallery();
}
init();
