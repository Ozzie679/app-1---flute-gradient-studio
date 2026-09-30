import {
  ShaderMount,
  flutedGlassFragmentShader,
  staticMeshGradientFragmentShader,
  GlassGridShapes,
  GlassDistortionShapes,
  getShaderColorFromString,
  ShaderFitOptions,
} from '../node_modules/@paper-design/shaders/dist/index.js';

const DEVICES = {
  desktop: { label:'Desktop (Mac)', w:6016, h:3384 }, // Apple Pro Display XDR (6K)
  ipad:    { label:'iPad',          w:2752, h:2064 },
  iphone:  { label:'iPhone',        w:1320, h:2868 }
};

// Each palette is 4-6 colour spots for the mesh gradient, plus a glow tint.
// The first four are presets matched to reference wallpapers: their `look`
// sets the shape, waves and glass too.
const PALETTES = [
  { name:'Lavender Moss', colors:['#aebec0','#0c1800','#a3acf2','#94925b','#e54d21','#a6bb47'], glow:'#d9ebee',
    look:{shape:62,angle:76,softness:0,haze:0.52,waveX:0.59,waveXShift:0.3,waveY:0.92,waveYShift:0.49,fluteSize:0.54,distortion:0.69,fluteBlur:0.14,shadows:0.07,highlights:0.02,glassShape:2,shift:0,vShift:1} },
  { name:'Amber Dusk', colors:['#ffffc4','#351f0d','#322803','#e0a622','#191d25','#4a61bd'], glow:'#fff2b0',
    look:{shape:11,angle:332,softness:0.17,haze:0.88,waveX:0.33,waveXShift:0.28,waveY:0.46,waveYShift:0.17,fluteSize:0.55,distortion:0.49,fluteBlur:0,shadows:0.26,highlights:0.04,glassShape:1,shift:0.34,vShift:-0.14} },
  { name:'Peach Flare', colors:['#ffc1be','#f44e30','#b683f9','#9174ff','#ffdc92','#d923a6'], glow:'#ffd6a8',
    look:{shape:22,angle:94,softness:0.28,haze:0.17,waveX:0.54,waveXShift:0.16,waveY:0.68,waveYShift:0,fluteSize:0.55,distortion:1,fluteBlur:0.07,shadows:0.21,highlights:0.06,glassShape:3,shift:0,vShift:-0.29} },
  { name:'Aurora Night', colors:['#acfad1','#0b1b3d','#a31250','#fb2b26','#c4f5b5','#6985c3'], glow:'#c8fff0',
    look:{shape:49,angle:140,softness:0.01,haze:0.49,waveX:0.68,waveXShift:0.7,waveY:0.29,waveYShift:0.02,fluteSize:0.57,distortion:0.55,fluteBlur:0.23,shadows:0,highlights:0.05,glassShape:1,shift:0,vShift:-1} },
  { name:'Violet Ember', colors:['#72241f','#d33c22','#6be2ff','#a6d6c6','#936997','#8784df'], glow:'#ffc9a8',
    look:{shape:85,angle:189,softness:0,haze:0.73,waveX:0.14,waveXShift:0.34,waveY:0.85,waveYShift:0.1,fluteSize:0.55,distortion:0.93,fluteBlur:0.33,shadows:0.24,highlights:0.03,glassShape:1,shift:0.28,vShift:-0.07} },
  { name:'Midnight Spectrum', colors:['#120c21','#004a82','#ff5329','#1da02c'], glow:'#ffc46b',
    look:{shape:51,angle:4,softness:0,haze:0.94,waveX:0.32,waveXShift:0.57,waveY:0.23,waveYShift:0.82,fluteSize:0.54,distortion:0.99,fluteBlur:0.01,shadows:0.01,highlights:0.09,glassShape:1,shift:0,vShift:-1} },
  { name:'Solar Night', colors:['#79184c','#070113','#ffff30','#150366','#000612'], glow:'#fff3a0',
    look:{shape:33,angle:197,softness:0,haze:0.82,waveX:1,waveXShift:0.8,waveY:0.05,waveYShift:0.04,fluteSize:0.54,distortion:1,fluteBlur:0.57,shadows:0.54,highlights:0.01,glassShape:4,shift:-0.29,vShift:0} },
  { name:'Arctic Sky',    colors:['#0b2340','#2f7fb0','#dff3f0','#6ab4d8'], glow:'#ffffff' },
  { name:'Sunset Ember',  colors:['#3a0d1f','#c9411f','#f0dfc8','#f08a4b'], glow:'#ffb27a' },
  { name:'Nebula Violet', colors:['#0d0a26','#5a3fc0','#e46bd6','#8f7cff'], glow:'#c9a8ff' },
  { name:'Citrus Punch',  colors:['#1c1440','#2255aa','#f5d548','#e98a2c'], glow:'#fff2b0' },
  { name:'Aurora Teal',   colors:['#050912','#2fd6b0','#6a3fd6','#1b4f6b'], glow:'#9dffe6' },
  { name:'Cotton Candy',  colors:['#3a2a66','#e07ad6','#dff2ff','#9fb4ff'], glow:'#ffe3f7' },
  { name:'Midnight Rose', colors:['#160b2e','#8a1d55','#ff6a4a','#c2386b'], glow:'#ff9d7a' },
  { name:'Golden Hour',   colors:['#132848','#e08a2f','#fff3d6','#f2b45a'], glow:'#ffdca0' },
  { name:'Berry Coral',   colors:['#3a1030','#e0396f','#ffb37a','#ff7a6b'], glow:'#ffd6a8' },
  { name:'Mint Frost',    colors:['#0a1f2e','#3fb8a8','#eafff6','#7fd8c4'], glow:'#c8fff0' }
];
const GLOW_POS = { tl:[0.22,0.22], tr:[0.78,0.22], bl:[0.22,0.78], br:[0.78,0.78], c:[0.5,0.5] };
const MIN_COLORS = 3, MAX_COLORS = 6;


let state = {
  device:'desktop',
  colors:[...PALETTES[0].colors],
  angle:0,
  shape:42,
  waveX:0.35,
  waveY:0.35,
  waveXShift:0.25,
  waveYShift:0.6,
  softness:0.4,
  haze:0.25,
  glowEnabled:true,
  glowColor:PALETTES[0].glow,
  glowPos:'tr',
  glowOpacity:32,
  shadows:0.2,
  highlights:0.08,
  fluteSize:0.5,
  distortion:0.3,
  fluteBlur:0.08,
  glassShape:GlassDistortionShapes.prism,
  shift:0,
  vShift:0,
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

// Paints one soft radial patch of colour, blended onto the canvas.
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

// Maps the controls onto the mesh gradient shader. Shape is the seed that
// places the colour spots; the waves bend the whole layout (their phases
// aren't sliders, "New shape" re-rolls them).
function meshUniforms(cfg){
  return {
    u_colors: cfg.colors.map(c => getShaderColorFromString(c)),
    u_colorsCount: cfg.colors.length,
    u_positions: cfg.shape,
    u_waveX: cfg.waveX,
    u_waveXShift: cfg.waveXShift,
    u_waveY: cfg.waveY,
    u_waveYShift: cfg.waveYShift,
    u_mixing: cfg.softness,
    u_rotation: cfg.angle,
  };
}

// Builds the colour layer that the fluted glass then refracts: an organic
// mesh gradient (rendered by `meshMount`), plus the optional glow.
function buildColorField({ mount }, w, h, cfg){
  if(mount.gl.isContextLost()) throw new Error('WebGL context lost');
  mount.setUniforms(meshUniforms(cfg)); // renders synchronously

  let canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  let ctx = canvas.getContext('2d');
  ctx.drawImage(mount.canvasElement, 0, 0, w, h);
  const hazePx = (cfg.haze || 0) * 0.3 * Math.min(w, h);
  if(hazePx >= 0.5){
    canvas = blurWithEdges(canvas, hazePx);
    ctx = canvas.getContext('2d');
  }

  if(cfg.glowEnabled){
    const [px,py] = GLOW_POS[cfg.glowPos];
    drawBlob(ctx, w*px, h*py, Math.max(w,h)*0.62, cfg.glowColor, cfg.glowOpacity/100, 'screen');
  }
  return padSides(canvas);
}

// Gaussian blur that doesn't fade the borders: the edges are extended
// outwards first, so the blur only mixes in the image's own edge colours.
function blurWithEdges(src, px){
  const w = src.width, h = src.height, p = Math.ceil(px*2);
  const big = document.createElement('canvas'); big.width = w + 2*p; big.height = h + 2*p;
  const b = big.getContext('2d');
  b.drawImage(src, p, p);
  b.drawImage(src, 0, 0, 1, h, 0, p, p, h);
  b.drawImage(src, w-1, 0, 1, h, p+w, p, p, h);
  b.drawImage(big, 0, p, w+2*p, 1, 0, 0, w+2*p, p);
  b.drawImage(big, 0, p+h-1, w+2*p, 1, 0, p+h, w+2*p, p);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  o.filter = `blur(${px}px)`;
  o.drawImage(big, -p, -p);
  return out;
}

// Flutes near the left/right edges refract from beyond the image, which the
// glass shader renders as transparent (dark lines in the output). So the
// field gets side margins filled by stretching its edge columns; the glass
// crops back to the visible size.
const SIDE_PAD = 0.12;
function padSides(canvas){
  const { width:w, height:h } = canvas;
  const p = Math.ceil(w * SIDE_PAD);
  const out = document.createElement('canvas');
  out.width = w + 2*p; out.height = h;
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, p, 0);
  ctx.drawImage(canvas, 0, 0, 1, h, 0, 0, p, h);
  ctx.drawImage(canvas, w-1, 0, 1, h, p+w, 0, p, h);
  return out;
}

// ShaderMount sizes its canvas from a ResizeObserver, which fires
// asynchronously; reading pixels before then gives blank output. Polls until
// the canvas reaches the target size (timers, not requestAnimationFrame, so
// it also works while the window is hidden), giving up after timeoutMs.
function waitForCanvasResize(canvas, expectedWidth, expectedHeight, timeoutMs = 3000){
  const start = performance.now();
  return new Promise((resolve) => {
    (function check(){
      if (canvas.width === expectedWidth && canvas.height === expectedHeight) return resolve();
      if (performance.now() - start > timeoutMs) {
        console.warn(`[shader] canvas never reached ${expectedWidth}x${expectedHeight}, stuck at ${canvas.width}x${canvas.height}. Reading pixels anyway.`);
        return resolve();
      }
      setTimeout(check, 8);
    })();
  });
}

// Flute size 0..1 sets how many flutes fit across the screen's shorter side,
// from 80 (fine) to 12 (wide), on a log scale; 0.5 is ~30, like the
// reference wallpapers. The shader counts flutes across the image width, so
// landscape screens get proportionally more.
const FLUTES_FINE = 80, FLUTES_WIDE = 12;
function fluteCount(fluteSize, aspect){
  const acrossShort = FLUTES_FINE * Math.pow(FLUTES_WIDE / FLUTES_FINE, fluteSize);
  return acrossShort * Math.max(1, aspect);
}

// Patches to the stock fluted-glass shader:
// - It sizes highlight lines (~2px) and flute blur (1px sample step) in screen
//   pixels, so the small preview had strong flutes and full-size exports faint
//   ones. Both now scale by u_designScale = flute width / DESIGN_FLUTE_PX, so
//   a wallpaper looks the same at every size.
// - u_vShift adds vertical refraction: each flute shows the image shifted up
//   or down, which is what makes top-to-bottom gradients look stepped.
// - Refracted samples are clamped inside the image, and its edge fade is off:
//   past the edge it drew them transparent, and with vertical refraction the
//   fade itself left dark spikes along the top and bottom edges.
const DESIGN_FLUTE_PX = 11.5;
const GLASS_PATCHES = [
  ['uniform float u_blur;', 'uniform float u_blur;\nuniform float u_designScale;\nuniform float u_vShift;'],
  ['  fractOrigUV.x += distortion;', '  fractOrigUV.x += distortion;\n  fractOrigUV.y += distortion * u_vShift;'],
  ['  float frame = getUvFrame(uv, edgeDistortion);', '  uv = clamp(uv, vec2(.0005), vec2(.9995));\n  float frame = 1.;'],
  ['float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x));', 'float highlightsWidth = 2. * max(.001, fwidth(UvToFract.x)) * u_designScale;'],
  ['getBlur(u_image, uv, 1. / u_resolution / u_pixelRatio,', 'getBlur(u_image, uv, u_designScale / u_resolution / u_pixelRatio,'],
];
const glassFragmentShader = GLASS_PATCHES.reduce((src, [from, to]) => {
  if(!src.includes(from)) throw new Error(`Fluted glass shader changed; patch needs updating: ${from}`);
  return src.replace(from, to);
}, flutedGlassFragmentShader);

// `w`/`h` are the visible output's size; `imageScale` is how much wider the
// padded field is, since the shader counts flutes across the whole image.
function shaderUniforms(cfg, w, h, imageScale = 1){
  const flutes = fluteCount(cfg.fluteSize, w / h);
  return {
    u_designScale: (w / flutes) / DESIGN_FLUTE_PX,
    u_vShift: cfg.vShift,
    u_shadows: cfg.shadows,
    u_highlights: cfg.highlights,
    u_size: clamp((200 - flutes * imageScale) / 195, 0, 1),
    u_distortion: cfg.distortion,
    u_blur: cfg.fluteBlur,
    u_distortionShape: cfg.glassShape,
    u_shift: cfg.shift,
  };
}

// ShaderMount only accepts a loaded <img> for u_image, so a mount is created
// with this 1x1 placeholder and the real color field is uploaded afterwards.
const PLACEHOLDER_IMAGE_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';

const SIZING_UNIFORMS = {
  u_fit: ShaderFitOptions.cover,
  u_scale: 1,
  u_rotation: 0,
  u_originX: 0.5,
  u_originY: 0.5,
  u_offsetX: 0,
  u_offsetY: 0,
  u_worldWidth: 0,
  u_worldHeight: 0,
};

// Creates a ShaderMount for `fragmentShader` in a hidden w x h container.
async function createMount(w, h, fragmentShader, uniforms){
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
      fragmentShader,
      { ...SIZING_UNIFORMS, ...uniforms },
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

// The fluted glass that refracts the colour layer.
async function createGlassMount(w, h){
  const img = new Image();
  img.src = PLACEHOLDER_IMAGE_SRC;
  await img.decode();
  return createMount(w, h, glassFragmentShader, {
        u_image: img,
        u_colorBack: getShaderColorFromString('#00000000'),
        u_colorShadow: getShaderColorFromString('#000000'),
        u_colorHighlight: getShaderColorFromString('#ffffff'),
        ...shaderUniforms(state, w, h),
        u_shape: GlassGridShapes.lines,
        u_angle: 0,
        u_stretch: 0,
        u_edges: 0,
        // Just outside the canvas: at 0 the shader draws a thin frame line.
        u_marginLeft: -0.02, u_marginRight: -0.02, u_marginTop: -0.02, u_marginBottom: -0.02,
        u_grainMixer: 0,
        u_grainOverlay: 0,
  });
}

// The organic colour layer. Its box is the whole canvas, so a given shape
// keeps the same layout on every device (stretched to the screen's shape).
function createMeshMount(w, h){
  return createMount(w, h, staticMeshGradientFragmentShader, {
    ...meshUniforms(state),
    u_grainMixer: 0,
    u_grainOverlay: 0,
    u_fit: ShaderFitOptions.none,
  });
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
  // The mount is the visible size; "cover" fit crops the padded field's margins.
  const { width:w, height:h } = mount.canvasElement;
  mount.setUniforms(shaderUniforms(cfg, w, h, field.width / w)); // also renders synchronously

  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  out.getContext('2d').drawImage(mount.canvasElement, 0, 0);
  return out;
}

// Long-lived mounts for the sizes rendered over and over (preview per
// device, gallery thumbnails), keyed by "WxH". Stored as promises so two
// callers asking for the same new size share one mount. Once a mount
// exists, drawWithShader() is fully synchronous, so callers can never
// interleave on the same mount.
// One mount per role ('preview', 'thumb'). The preview size follows the
// window, so a new size replaces the old mount instead of piling up WebGL
// contexts (browsers cap how many can be alive at once).
const shaderMounts = new Map();

async function getShaderMount(role, w, h, create){
  const entry = shaderMounts.get(role);
  if(entry){
    const existing = await entry.promise.catch(()=>null);
    if(existing && entry.w === w && entry.h === h && !existing.mount.gl.isContextLost()) return existing;
    if(shaderMounts.get(role) !== entry) return getShaderMount(role, w, h, create); // replaced while we waited
    if(existing) disposeShaderMount(existing);
    shaderMounts.delete(role);
  }
  const promise = create(w, h);
  shaderMounts.set(role, { w, h, promise });
  return promise;
}

// Renders a config to a brand new w x h canvas, reusing the role's mount.
async function renderToCanvas(role, w, h, cfg){
  const mesh = await getShaderMount(`${role}-mesh`, w, h, createMeshMount);
  const glass = await getShaderMount(role, w, h, createGlassMount);
  return drawWithShader(glass, buildColorField(mesh, w, h, cfg), cfg);
}

// Full-resolution exports are rare and large (up to ~23 MP), so they get a
// throwaway mount rather than holding that much GPU memory for the session.
async function renderOnce(w, h, cfg){
  let field;
  const mesh = await createMeshMount(w, h);
  try {
    field = buildColorField(mesh, w, h, cfg);
  } finally {
    disposeShaderMount(mesh);
  }
  const glass = await createGlassMount(w, h);
  try {
    return drawWithShader(glass, field, cfg);
  } finally {
    disposeShaderMount(glass);
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

// ---- layout: where the wallpaper sits in the window ----
// Mac fills the window edge to edge (cropping slightly, like macOS "Fill
// Screen"). iPad/iPhone sit in a device-shaped frame centred in the space
// the floating controls leave free, over a blurred copy of the wallpaper.
const frameEl = document.getElementById('frame');
const backdropCanvas = document.getElementById('backdrop');
let immersive = false;

function freeArea(){
  const W = innerWidth, H = innerHeight;
  // Full-screen view: leave room at the bottom for the pop-up control bar.
  if(immersive) return { x:32, y:32, w:W-64, h:H-32-96 };
  const panel = document.querySelector('.panel').getBoundingClientRect();
  const left = panel.right + 24;
  const top = 72, bottom = 108;
  return { x:left, y:top, w:Math.max(120, W-left-24), h:Math.max(120, H-top-bottom) };
}

function frameRect(){
  if(state.device === 'desktop') return { x:0, y:0, w:innerWidth, h:innerHeight, radius:0 };
  const d = DEVICES[state.device];
  const a = freeArea();
  const s = Math.min(a.w/d.w, a.h/d.h);
  const w = Math.round(d.w*s), h = Math.round(d.h*s);
  // Rounded corners roughly matching the real devices' screens.
  const radius = Math.round(w * (state.device === 'iphone' ? 0.14 : 0.045));
  return { x:Math.round(a.x + (a.w-w)/2), y:Math.round(a.y + (a.h-h)/2), w, h, radius };
}

function layoutFrame(){
  const r = frameRect();
  Object.assign(frameEl.style, { left:`${r.x}px`, top:`${r.y}px`, width:`${r.w}px`, height:`${r.h}px`, borderRadius:`${r.radius}px` });
  frameEl.style.setProperty('--frame-w', `${r.w}px`);
  frameEl.classList.toggle('device', state.device !== 'desktop');
  frameEl.classList.toggle('ipad', state.device === 'ipad');
}

// Preview pixel size: enough to cover the frame at the screen's pixel
// density, capped, and rounded to 100 px steps so small window resizes
// don't force a new shader mount every time.
function previewSize(){
  const r = frameRect();
  const d = DEVICES[state.device];
  const cssScale = Math.max(r.w/d.w, r.h/d.h);
  const longest = Math.max(d.w, d.h) * cssScale * Math.min(devicePixelRatio || 1, 2);
  const maxDim = Math.min(2400, Math.max(600, Math.ceil(longest/100)*100));
  return computeDeviceCanvasSize(state.device, maxDim);
}

async function renderMain(){
  const { w, h } = previewSize();

  // All the expensive work happens offscreen. mainCanvas is not touched
  // during this await, so the previous frame stays visible while it runs.
  const finalCanvas = await renderToCanvas('preview', w, h, state);

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
  // A tiny copy, stretched and blurred by CSS, fills the space around the
  // iPad/iPhone frame so there are no black bars.
  backdropCanvas.getContext('2d').drawImage(finalCanvas, 0, 0, backdropCanvas.width, backdropCanvas.height);

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
  const hex = /^#[0-9a-f]{6}$/i;
  if(Array.isArray(saved.colors) && saved.colors.length >= MIN_COLORS && saved.colors.every(c => hex.test(c))){
    state.colors = saved.colors.slice(0, MAX_COLORS);
  }
  // Settings saved before the organic style have no shape; their old
  // linear-gradient angle means something else, so it isn't carried over.
  if(typeof saved.shape === 'number'){
    state.shape = clamp(saved.shape, 0, 100);
    if(typeof saved.angle === 'number') state.angle = clamp(saved.angle, 0, 360);
  }
  for(const k of ['waveX','waveY','waveXShift','waveYShift']){
    if(typeof saved[k] === 'number') state[k] = clamp(saved[k], 0, 1);
  }
  if(typeof saved.softness === 'number') state.softness = clamp(saved.softness, 0, 1);
  if(typeof saved.haze === 'number') state.haze = clamp(saved.haze, 0, 1);
  if(Object.values(GlassDistortionShapes).includes(saved.glassShape)) state.glassShape = saved.glassShape;
  if(typeof saved.shift === 'number') state.shift = clamp(saved.shift, -1, 1);
  if(typeof saved.vShift === 'number') state.vShift = clamp(saved.vShift, -1, 1);
  if(typeof saved.glowEnabled === 'boolean') state.glowEnabled = saved.glowEnabled;
  if(saved.glowColor) state.glowColor = saved.glowColor;
  if(saved.glowPos && GLOW_POS[saved.glowPos]) state.glowPos = saved.glowPos;
  if(typeof saved.glowOpacity === 'number') state.glowOpacity = saved.glowOpacity;
  if(typeof saved.shadows === 'number') state.shadows = clamp(saved.shadows, 0, 1);
  if(typeof saved.highlights === 'number') state.highlights = clamp(saved.highlights, 0, 0.35);
  if(typeof saved.fluteSize === 'number'){
    // Before the organic style, fluteSize was the shader's raw u_size.
    const v = typeof saved.shape === 'number' ? saved.fluteSize
      : Math.log((200 - 195*saved.fluteSize) / FLUTES_FINE) / Math.log(FLUTES_WIDE / FLUTES_FINE);
    state.fluteSize = clamp(v, 0, 1);
  }
  if(typeof saved.distortion === 'number') state.distortion = clamp(saved.distortion, 0, 1);
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

function buildColorPickers(){
  const row = $('colorsRow');
  row.querySelectorAll('input[type=color]').forEach(el => el.remove());
  state.colors.forEach((c, i)=>{
    const input = document.createElement('input');
    input.type = 'color';
    input.value = c;
    input.setAttribute('aria-label', `Colour ${i+1}`);
    input.addEventListener('input', e=>{
      state.colors[i] = e.target.value;
      state.paletteName = 'Custom';
      syncActivePalette();
      scheduleRender();
    });
    row.insertBefore(input, $('removeColor'));
  });
  $('removeColor').disabled = state.colors.length <= MIN_COLORS;
  $('addColor').disabled = state.colors.length >= MAX_COLORS;
}

function syncControlsFromState(){
  buildColorPickers();
  $('shape').value = state.shape;
  $('shapeVal').textContent = Math.round(state.shape);
  $('waveX').value = state.waveX;
  $('waveXVal').textContent = state.waveX.toFixed(2);
  $('waveY').value = state.waveY;
  $('waveYVal').textContent = state.waveY.toFixed(2);
  $('softness').value = state.softness;
  $('softnessVal').textContent = state.softness.toFixed(2);
  $('glassShape').value = String(state.glassShape);
  $('vShift').value = state.vShift;
  $('vShiftVal').textContent = state.vShift.toFixed(2);
  $('haze').value = state.haze;
  $('hazeVal').textContent = state.haze.toFixed(2);
  $('angle').value = state.angle;
  $('angleVal').textContent = Math.round(state.angle)+'°';
  $('glowEnabled').checked = state.glowEnabled;
  $('glowColor').value = state.glowColor;
  $('glowPos').style.setProperty('--glow-color', state.glowColor);
  document.querySelectorAll('#glowPos button').forEach(b=>{
    const on = b.dataset.pos === state.glowPos;
    b.classList.toggle('active', on);
    b.setAttribute('aria-checked', on);
    b.setAttribute('role', 'radio');
  });
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
  document.body.dataset.device = state.device;
  syncActivePalette();
}

function syncActivePalette(){
  $('paletteName').textContent = state.paletteName;
  document.querySelectorAll('#paletteRow .swatch').forEach(s=>{
    s.classList.toggle('active', s.dataset.name===state.paletteName);
  });
}

$('addColor').addEventListener('click', ()=>{
  if(state.colors.length >= MAX_COLORS) return;
  // New spot: a blend of two existing colours, so it fits the palette.
  const mixHex = (a, b)=> '#' + [1,3,5].map(i => Math.round((parseInt(a.substr(i,2),16) + parseInt(b.substr(i,2),16))/2).toString(16).padStart(2,'0')).join('');
  state.colors.push(mixHex(state.colors[0], state.colors[state.colors.length-1]));
  state.paletteName = 'Custom';
  syncControlsFromState();
  scheduleRender();
});
$('removeColor').addEventListener('click', ()=>{
  if(state.colors.length <= MIN_COLORS) return;
  state.colors.pop();
  state.paletteName = 'Custom';
  syncControlsFromState();
  scheduleRender();
});
$('shape').addEventListener('input', e=>{ state.shape=+e.target.value; $('shapeVal').textContent=state.shape; scheduleRender(); });
$('newShape').addEventListener('click', ()=>{
  state.shape = Math.round(Math.random()*100);
  state.waveXShift = Math.random();
  state.waveYShift = Math.random();
  syncControlsFromState();
  scheduleRender();
});
$('waveX').addEventListener('input', e=>{ state.waveX=+e.target.value; $('waveXVal').textContent=state.waveX.toFixed(2); scheduleRender(); });
$('waveY').addEventListener('input', e=>{ state.waveY=+e.target.value; $('waveYVal').textContent=state.waveY.toFixed(2); scheduleRender(); });
$('softness').addEventListener('input', e=>{ state.softness=+e.target.value; $('softnessVal').textContent=state.softness.toFixed(2); scheduleRender(); });
$('vShift').addEventListener('input', e=>{ state.vShift=+e.target.value; $('vShiftVal').textContent=state.vShift.toFixed(2); scheduleRender(); });
$('glassShape').addEventListener('change', e=>{ state.glassShape=+e.target.value; scheduleRender(); });
$('haze').addEventListener('input', e=>{ state.haze=+e.target.value; $('hazeVal').textContent=state.haze.toFixed(2); scheduleRender(); });
$('angle').addEventListener('input', e=>{ state.angle=+e.target.value; $('angleVal').textContent=state.angle+'°'; scheduleRender(); });
$('glowEnabled').addEventListener('change', e=>{ state.glowEnabled=e.target.checked; $('glowControls').style.display=state.glowEnabled?'block':'none'; scheduleRender(); });
$('glowColor').addEventListener('input', e=>{ state.glowColor=e.target.value; $('glowPos').style.setProperty('--glow-color', state.glowColor); scheduleRender(); });
document.querySelectorAll('#glowPos button').forEach(b=>{
  b.addEventListener('click', ()=>{ state.glowPos=b.dataset.pos; syncControlsFromState(); scheduleRender(); });
});
$('glowOpacity').addEventListener('input', e=>{ state.glowOpacity=+e.target.value; $('glowOpacityVal').textContent=state.glowOpacity+'%'; scheduleRender(); });
$('shadows').addEventListener('input', e=>{ state.shadows=+e.target.value; $('shadowsVal').textContent=state.shadows.toFixed(2); scheduleRender(); });
$('highlights').addEventListener('input', e=>{ state.highlights=+e.target.value; $('highlightsVal').textContent=state.highlights.toFixed(2); scheduleRender(); });
$('fluteSize').addEventListener('input', e=>{ state.fluteSize=+e.target.value; $('fluteSizeVal').textContent=state.fluteSize.toFixed(2); scheduleRender(); });
$('distortion').addEventListener('input', e=>{ state.distortion=+e.target.value; $('distortionVal').textContent=state.distortion.toFixed(2); scheduleRender(); });
$('fluteBlur').addEventListener('input', e=>{ state.fluteBlur=+e.target.value; $('fluteBlurVal').textContent=state.fluteBlur.toFixed(2); scheduleRender(); });

document.querySelectorAll('#deviceSeg button').forEach(b=>{
  b.addEventListener('click', ()=>{
    if(state.device === b.dataset.device) return;
    state.device=b.dataset.device;
    syncControlsFromState();
    layoutFrame();
    scheduleRender();
    buildGallery({ reshuffle:false });
  });
});

function buildPaletteRow(){
  const row = $('paletteRow');
  row.innerHTML='';
  PALETTES.forEach((p)=>{
    const el = document.createElement('button');
    el.className='swatch';
    el.title = p.name;
    el.dataset.name = p.name;
    el.setAttribute('aria-label', `${p.name} palette`);
    el.style.background = `linear-gradient(135deg, ${p.colors.join(', ')})`;
    el.addEventListener('click', ()=>{
      // Presets (palettes with a `look`) set the whole wallpaper, not just colours.
      if(p.look) state = { ...state, shift:0, vShift:0, ...p.look, glowEnabled:false };
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
// Everything a wallpaper looks like, independent of which device it's for.
function randomCfg(){
  const p = randomFrom(PALETTES);
  const posKeys = Object.keys(GLOW_POS);
  return {
    colors:[...p.colors],
    angle: Math.round(Math.random()*360),
    shape: Math.round(Math.random()*100),
    waveX: randomInRange(0, 0.6),
    waveY: randomInRange(0, 0.6),
    waveXShift: randomInRange(0, 1),
    waveYShift: randomInRange(0, 1),
    softness: randomInRange(0, 0.7),
    haze: randomInRange(0.1, 0.5),
    glowEnabled: Math.random() < 0.3,
    glowColor: p.glow,
    glowPos: randomFrom(posKeys),
    glowOpacity: Math.round(20+Math.random()*35),
    shadows: randomInRange(0.05, 0.3),
    highlights: randomInRange(0.02, 0.15),
    fluteSize: randomInRange(0.4, 0.65),
    distortion: randomInRange(0.15, 0.45),
    fluteBlur: randomInRange(0, 0.2, 2),
    glassShape: randomFrom([GlassDistortionShapes.prism, GlassDistortionShapes.prism, GlassDistortionShapes.lens, GlassDistortionShapes.contour]),
    shift: 0,
    vShift: Math.random() < 0.5 ? 0 : randomInRange(-0.4, 0.4),
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
// Kept between rebuilds so switching device re-renders the same six
// variations in the new shape instead of shuffling them.
let galleryCfgs = [];

async function buildGallery({ reshuffle = true } = {}){
  const buildId = ++galleryBuildId;
  if(reshuffle || galleryCfgs.length === 0){
    galleryCfgs = Array.from({ length:6 }, randomCfg);
  }
  // ~2x the size they're shown at, for sharp thumbnails.
  const { w, h } = computeDeviceCanvasSize(state.device, 140);

  // Render all six first and swap them in together, so the row doesn't
  // collapse and re-grow while it rebuilds.
  const thumbs = [];
  for(const cfg of galleryCfgs){
    try {
      thumbs.push({ cfg, canvas: await renderToCanvas('thumb', w, h, cfg) });
    } catch (err) {
      console.error('Gallery thumbnail failed:', err);
    }
    if(buildId !== galleryBuildId) return;
  }

  $('gallery').replaceChildren(...thumbs.map(({ cfg, canvas })=>{
    const wrap = document.createElement('div');
    wrap.className='thumb';
    wrap.title = cfg.paletteName;
    wrap.appendChild(canvas);

    const dl = document.createElement('div');
    dl.className='dl';
    dl.title = 'Save this variation';
    dl.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14"/></svg>';
    dl.addEventListener('click', (ev)=>{ ev.stopPropagation(); saveWallpaper({ ...cfg, device: state.device }); });
    wrap.appendChild(dl);

    wrap.addEventListener('click', ()=> applyVariation(galleryCfgs.indexOf(cfg)));
    return wrap;
  }));
}
$('refreshGallery').addEventListener('click', ()=> buildGallery());

// Index of the gallery variation last applied, for the full-screen view's
// previous/next buttons.
let variationIndex = -1;
function applyVariation(i){
  if(!galleryCfgs.length) return;
  variationIndex = (i + galleryCfgs.length) % galleryCfgs.length;
  const cfg = galleryCfgs[variationIndex];
  state = { ...state, ...cfg, colors:[...cfg.colors] };
  syncControlsFromState();
  scheduleRender();
}

// ---- save / export ----
// Renders the config at full device resolution, then hands the PNG bytes
// to Electron's native Save dialog (via preload.js). Falls back to a plain
// browser download if electronAPI isn't present (e.g. testing index.html
// directly in a browser tab).
let noteTimer;
function showNote(text, clearAfterMs, tone = ''){
  clearTimeout(noteTimer);
  const note = $('loadingNote');
  note.textContent = text;
  note.className = `glass toast ${text ? 'visible' : ''} ${tone}`;
  note.title = text;
  if(clearAfterMs) noteTimer = setTimeout(()=>{ note.className = `glass toast ${tone}`; }, clearAfterMs);
}

function canvasToPngBlob(canvas){
  return new Promise((resolve, reject)=>{
    canvas.toBlob(blob=> blob ? resolve(blob) : reject(new Error('Could not encode PNG')), 'image/png');
  });
}

async function saveWallpaper(cfg){
  const btn = $('downloadBtn');
  if(btn.disabled) return;
  btn.disabled = true;
  btn.textContent = 'Rendering…';
  showNote(`Rendering ${DEVICES[cfg.device].w} × ${DEVICES[cfg.device].h}…`);
  // Give the note a moment to paint before the heavy render blocks the page.
  await new Promise(r=>setTimeout(r, 30));
  try {
    const d = DEVICES[cfg.device];
    const blob = await canvasToPngBlob(await renderOnce(d.w, d.h, cfg));
    const suggestedName = `flute-gradient-${cfg.paletteName.toLowerCase().replace(/\s+/g,'-')}-${cfg.device}.png`;

    if(window.electronAPI){
      btn.textContent = 'Save PNG';
      const result = await window.electronAPI.saveWallpaper(await blob.arrayBuffer(), suggestedName);
      if(result.success) showNote(`✓ Saved ${result.filePath.split(/[\\/]/).pop()}`, 4000, 'ok');
      else if(result.error) showNote(`Couldn't save: ${result.error}`, 8000, 'err');
      else showNote('');
    } else {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = suggestedName;
      a.click();
      showNote('✓ Downloaded', 4000, 'ok');
    }
  } catch (err) {
    console.error('Save failed:', err);
    showNote(`Couldn't render wallpaper: ${err.message}`, 8000, 'err');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save PNG';
  }
}
// Snapshot state so moving a slider mid-save can't change the export.
$('downloadBtn').addEventListener('click', ()=> saveWallpaper({ ...state, colors:[...state.colors] }));

// ---- updates ----
// 'ready' (Windows/Linux): already downloaded, restart installs it.
// 'available' (macOS): opens the .dmg download to install by hand.
function showUpdate(status){
  if(!status) return;
  const btn = $('updateBtn');
  if(status.state === 'ready'){
    $('updateText').textContent = `Version ${status.version} is ready`;
    btn.textContent = 'Restart to update';
    btn.onclick = ()=> window.electronAPI.installUpdate();
  } else if(status.state === 'available'){
    $('updateText').textContent = `Version ${status.version} is available`;
    btn.textContent = 'Download';
    btn.onclick = ()=> window.electronAPI.downloadUpdate();
  } else {
    return;
  }
  $('updateBanner').hidden = false;
}

if(window.electronAPI?.onUpdateStatus){
  window.electronAPI.onUpdateStatus(showUpdate);
  window.electronAPI.getUpdateStatus().then(showUpdate);
}

// ---- full-screen view ----
// Hides every panel and makes the window truly full screen. A small bar
// fades in when the mouse moves and out again after a short pause.
let wakeTimer;
function wakeControls(){
  if(!immersive) return;
  document.body.classList.add('controls-awake');
  clearTimeout(wakeTimer);
  wakeTimer = setTimeout(()=>{
    // Stay awake while the pointer is over the bar itself.
    if(!$('immersiveBar').matches(':hover')) document.body.classList.remove('controls-awake');
  }, 2000);
}

function setImmersive(on){
  if(immersive === on) return;
  immersive = on;
  document.body.classList.toggle('immersive', on);
  window.electronAPI?.setFullScreen?.(on);
  layoutFrame();
  scheduleRender();
  if(on) wakeControls();
  else { clearTimeout(wakeTimer); document.body.classList.remove('controls-awake'); }
}

$('fullscreenBtn').addEventListener('click', ()=> setImmersive(true));
$('exitFullscreen').addEventListener('click', ()=> setImmersive(false));
document.addEventListener('keydown', e=>{ if(e.key === 'Escape' && immersive) setImmersive(false); });
document.addEventListener('mousemove', wakeControls);
// Leaving full screen from the OS (macOS green button, Windows F11 etc.).
window.electronAPI?.onFullScreenChange?.(isFull=>{ if(!isFull) setImmersive(false); });

$('immersiveShuffle').addEventListener('click', ()=> $('shuffleBtn').click());
$('immersiveSave').addEventListener('click', ()=> $('downloadBtn').click());
$('prevVariation').addEventListener('click', ()=> applyVariation(variationIndex - 1));
$('nextVariation').addEventListener('click', ()=> applyVariation(variationIndex + 1));

$('lockToggle').addEventListener('change', e=> document.body.classList.toggle('show-lock', e.target.checked));
$('ambientToggle').addEventListener('change', e=> document.body.classList.toggle('no-backdrop', !e.target.checked));
document.body.classList.add('show-lock');

function updateLockClock(){
  const now = new Date();
  $('lockTime').textContent = now.toLocaleTimeString([], { hour:'numeric', minute:'2-digit' }).replace(/\s?[AP]M$/i, '');
  $('lockDate').textContent = now.toLocaleDateString([], { weekday:'long', day:'numeric', month:'long' });
}
updateLockClock();
setInterval(updateLockClock, 30000);

let resizeTimer;
addEventListener('resize', ()=>{
  layoutFrame();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(scheduleRender, 150);
});

// ---- init ----
async function init(){
  if(window.electronAPI?.platform) document.body.classList.add(`platform-${window.electronAPI.platform}`);
  if(window.electronAPI?.getSettings){
    const saved = await window.electronAPI.getSettings();
    applySavedSettings(saved);
  }
  buildPaletteRow();
  syncControlsFromState();
  // Place the frame without animating it in from nowhere.
  frameEl.style.transition = 'none';
  layoutFrame();
  frameEl.getBoundingClientRect();
  frameEl.style.transition = '';
  await renderMain();
  await buildGallery();
}
init();
