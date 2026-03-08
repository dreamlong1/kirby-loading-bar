const SCREEN_WIDTH = 640;
const SCREEN_HEIGHT = 200;
const TRACK_LEFT = 150;
const TRACK_RIGHT = 555;
const TRACK_WIDTH = TRACK_RIGHT - TRACK_LEFT;
const TRACK_HEIGHT = 26;
const TRACK_BOTTOM = 63;
const STAR_BASE_RIGHT = 85;
const STAR_SIZE = 105;
const STAR_BOTTOM = TRACK_BOTTOM + TRACK_HEIGHT / 2 - STAR_SIZE / 2;
const KIRBY_MOUTH_X = 120;
const KIRBY_MOUTH_Y = 100;
const SWALLOW_DURATION = 40;
const GULP_DURATION = 36;

function toScreenWidthPercent(value) {
  return `${(value / SCREEN_WIDTH) * 100}%`;
}

function toScreenHeightPercent(value) {
  return `${(value / SCREEN_HEIGHT) * 100}%`;
}

function drawStarOccluder(ctx, canvas, fillStyle) {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const outerRadius = Math.min(canvas.width, canvas.height) * 0.44;
  const innerRadius = outerRadius * 0.56;

  ctx.save();
  ctx.fillStyle = fillStyle;
  ctx.beginPath();

  for (let point = 0; point < 10; point += 1) {
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    const radius = point % 2 === 0 ? outerRadius : innerRadius;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;

    if (point === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  }

  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function resolveDefaultScriptUrl() {
  if (typeof document !== "undefined") {
    if (document.currentScript?.src) {
      return document.currentScript.src;
    }

    const scripts = Array.from(document.querySelectorAll('script[src]'));
    const matchedScript = scripts.find((script) => {
      try {
        return new URL(script.src, window.location.href).pathname.endsWith("/kirby-progress.js");
      } catch {
        return false;
      }
    });

    if (matchedScript?.src) {
      return matchedScript.src;
    }
  }

  if (typeof window !== "undefined") {
    return window.location.href;
  }

  return "./";
}

const DEFAULT_ASSET_BASE = new URL("./frames/", resolveDefaultScriptUrl()).href;

const ASSET_GROUPS = {
  kirby: ["kirby_00.png", "kirby_01.png", "kirby_02.png", "kirby_03.png"],
  star: [
    "star_00.png",
    "star_01.png",
    "star_02.png",
    "star_03.png",
    "star_04.png",
    "star_05.png",
    "star_06.png",
  ],
  particle: [
    "particle_00.png",
    "particle_01.png",
    "particle_02.png",
    "particle_03.png",
    "particle_04.png",
    "particle_05.png",
    "particle_06.png",
    "particle_07.png",
  ],
  effect: [
    "inhale_01.png",
    "inhale_03.png",
    "inhale_04.png",
    "inhale_06.png",
    "inhale_07.png",
    "inhale_09.png",
  ],
  satisfied: ["satisfied_00.png", "satisfied_01.png"],
};

const ASSET_NAMES = Object.values(ASSET_GROUPS).flat();
const assetCache = new Map();

const template = document.createElement("template");
template.innerHTML = `
  <style>
    @import url("https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap");

    :host {
      --kirby-max-width: 760px;
      --kirby-font-family: "Press Start 2P", cursive;
      --kirby-frame-bg: #1a1a1a;
      --kirby-screen-bg: #0a0a14;
      --kirby-screen-border: #333;
      --kirby-track-bg: #151520;
      --kirby-track-border: #2a2a3a;
      --kirby-accent: #ffcc00;
      --kirby-complete: #ff6688;
      --kirby-text-dim: #666;
      --kirby-subtle: #555;
      display: block;
      width: min(100%, var(--kirby-max-width));
      color: #ffffff;
      font-family: var(--kirby-font-family);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .shell {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    .screen-title {
      position: absolute;
      top: 10%;
      left: 0;
      width: 100%;
      text-align: center;
      margin: 0;
      font-size: 14px;
      color: var(--kirby-accent);
      text-shadow: 2px 2px 0 #000, 0 0 8px rgba(255, 204, 0, 0.5);
      letter-spacing: 2px;
      transition: color 0.3s ease, text-shadow 0.3s ease, opacity 0.3s ease;
      z-index: 30;
    }

    .screen {
      background: var(--kirby-screen-bg);
      width: 100%;
      aspect-ratio: 640 / 200;
      position: relative;
      overflow: hidden;
      border-radius: 6px;
      border: 2px solid var(--kirby-screen-border);
      box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.8);
    }

    .screen::after {
      content: "";
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        0deg,
        rgba(0, 0, 0, 0.12) 0px,
        rgba(0, 0, 0, 0.12) 1px,
        transparent 1px,
        transparent 3px
      );
      pointer-events: none;
      z-index: 20;
    }

    .loader-area {
      position: relative;
      width: 100%;
      height: 100%;
    }

    canvas {
      image-rendering: pixelated;
      display: block;
    }

    .kirby-canvas {
      position: absolute;
      left: 1.5625%;
      bottom: 10%;
      width: 19.6875%;
      height: 60%;
      z-index: 10;
      transition: transform 0.2s ease;
      transform-origin: center bottom;
    }

    .progress-track {
      position: absolute;
      left: ${toScreenWidthPercent(TRACK_LEFT)};
      right: ${toScreenWidthPercent(STAR_BASE_RIGHT)};
      bottom: ${toScreenHeightPercent(TRACK_BOTTOM)};
      height: ${toScreenHeightPercent(TRACK_HEIGHT)};
      background: #0f0f15;
      border-radius: 8px;
      border: 3px solid #000;
      box-shadow:
        0 0 0 2px var(--kirby-track-border),
        inset 0 4px 6px rgba(0, 0, 0, 0.9);
      overflow: hidden;
      z-index: 5;
      transition: opacity 0.5s ease;
    }

    .progress-fill {
      position: absolute;
      inset: 0 auto 0 0;
      width: 100%;
      background: linear-gradient(
        180deg,
        #ffea66 0%,
        #ffcc00 30%,
        #ff8800 70%,
        #cc4400 100%
      );
      border-right: 2px solid #fff;
      border-radius: 2px;
      transition: width 0.08s linear;
      box-shadow: 0 0 12px rgba(255, 204, 0, 0.8);
    }

    .progress-fill::before {
      content: "";
      position: absolute;
      inset: 0;
      background: repeating-linear-gradient(
        -45deg,
        transparent,
        transparent 8px,
        rgba(255, 255, 255, 0.25) 8px,
        rgba(255, 255, 255, 0.25) 16px
      );
      z-index: 1;
    }

    .progress-fill::after {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 40%;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.7) 0%, rgba(255, 255, 255, 0.1) 100%);
      border-radius: 2px 2px 0 0;
      z-index: 2;
    }

    .star-canvas {
      position: absolute;
      right: ${toScreenWidthPercent(STAR_BASE_RIGHT - STAR_SIZE / 2)};
      bottom: ${toScreenHeightPercent(STAR_BOTTOM)};
      width: ${toScreenWidthPercent(STAR_SIZE)};
      height: ${toScreenHeightPercent(STAR_SIZE)};
      z-index: 10;
      transition: right 0.08s linear, transform 0.05s linear, opacity 0.18s ease;
      transform-origin: center center;
    }

    .particle-canvas {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      z-index: 8;
      pointer-events: none;
    }

    @keyframes neon-pulse {
      0% { 
        transform: scale(1.1); 
        text-shadow: 2px 2px 0 #000, 0 0 10px #ff0055, 0 0 20px #ff0055; 
      }
      50% { 
        transform: scale(1.3); 
        text-shadow: 2px 2px 0 #000, 0 0 20px #ff6688, 0 0 40px #ff6688, 0 0 60px #ff0055; 
        color: #fff;
      }
      100% { 
        transform: scale(1.1); 
        text-shadow: 2px 2px 0 #000, 0 0 10px #ff0055, 0 0 20px #ff0055; 
      }
    }

    .screen-title.completed {
      color: #ff6688;
      letter-spacing: 0;
      animation: neon-pulse 1s infinite ease-in-out;
    }

    @keyframes kirby-gulp {
      0% { transform: scale(1, 1); }
      15% { transform: scale(1.25, 0.85); }
      30% { transform: scale(0.9, 1.15); }
      45% { transform: scale(1.12, 0.92); }
      60% { transform: scale(0.97, 1.05); }
      75% { transform: scale(1.04, 0.98); }
      100% { transform: scale(1, 1); }
    }

    .kirby-gulp {
      animation: kirby-gulp 0.6s ease-out;
    }
  </style>

  <div class="shell">
    <div class="screen" part="screen">
      <div class="screen-title" data-role="pct-text" part="label">LOADING 0%</div>
      <div
        class="loader-area"
        data-role="loader"
        role="progressbar"
        aria-label="Kirby loading progress"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="0"
      >
        <canvas class="kirby-canvas" data-role="kirby-canvas" width="126" height="120"></canvas>
        <div class="progress-track" data-role="progress-track" part="track">
          <div class="progress-fill" data-role="progress-fill" part="fill"></div>
        </div>
        <canvas class="star-canvas" data-role="star-canvas" width="105" height="105"></canvas>
        <canvas class="particle-canvas" data-role="particle-canvas" width="640" height="200"></canvas>
      </div>
    </div>
  </div>
`;

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function parseProgress(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeAssetBase(rawBase) {
  if (!rawBase) {
    return DEFAULT_ASSET_BASE;
  }

  const normalized = rawBase.endsWith("/") ? rawBase : `${rawBase}/`;
  return new URL(normalized, resolveDefaultScriptUrl()).href;
}

function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn("Failed to load Kirby asset:", url);
      resolve(null);
    };
    img.src = url;
  });
}

function loadAssets(baseUrl) {
  if (!assetCache.has(baseUrl)) {
    const task = Promise.all(
      ASSET_NAMES.map(async (name) => [name, await loadImage(new URL(name, baseUrl).href)])
    ).then((entries) => Object.fromEntries(entries));
    assetCache.set(baseUrl, task);
  }

  return assetCache.get(baseUrl);
}

class KirbyProgress extends HTMLElement {
  static get observedAttributes() {
    return ["value", "asset-base", "autoplay"];
  }

  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.appendChild(template.content.cloneNode(true));

    this._elements = {
      loader: this.shadowRoot.querySelector('[data-role="loader"]'),
      pctText: this.shadowRoot.querySelector('[data-role="pct-text"]'),
      kirbyCanvas: this.shadowRoot.querySelector('[data-role="kirby-canvas"]'),
      progressTrack: this.shadowRoot.querySelector('[data-role="progress-track"]'),
      progressFill: this.shadowRoot.querySelector('[data-role="progress-fill"]'),
      starCanvas: this.shadowRoot.querySelector('[data-role="star-canvas"]'),
      particleCanvas: this.shadowRoot.querySelector('[data-role="particle-canvas"]'),
    };

    this._contexts = {
      kirby: this._elements.kirbyCanvas.getContext("2d"),
      star: this._elements.starCanvas.getContext("2d"),
      particle: this._elements.particleCanvas.getContext("2d"),
    };

    Object.values(this._contexts).forEach((context) => {
      context.imageSmoothingEnabled = false;
    });

    this._images = null;
    this._assetsReady = false;
    this._assetLoadToken = 0;
    this._frameHandle = 0;
    this._syncingValueAttribute = false;
    this._autoplayRequested = false;
    this._lastProgressEventValue = -1;

    this._pValue = 0;
    this._isAnimating = false;
    this._kirbyFrame = 0;
    this._satisfiedFrame = 0;
    this._starFrame = 0;
    this._frameCount = 0;
    this._completionState = "loading";
    this._swallowTick = 0;
    this._particles = [];

    this._renderFrame = this._renderFrame.bind(this);
  }

  connectedCallback() {
    this._prepareAssets();
  }

  disconnectedCallback() {
    if (this._frameHandle) {
      cancelAnimationFrame(this._frameHandle);
      this._frameHandle = 0;
    }
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) {
      return;
    }

    if (name === "asset-base") {
      if (this.isConnected) {
        this._prepareAssets();
      }
      return;
    }

    if (name === "autoplay") {
      if (newValue !== null) {
        this.start();
      } else {
        this.stop();
      }
      return;
    }

    if (name === "value" && !this._syncingValueAttribute) {
      this._applyExternalValue(parseProgress(newValue, 0));
    }
  }

  get value() {
    return this._pValue;
  }

  set value(nextValue) {
    this.setValue(nextValue);
  }

  get assetBase() {
    return normalizeAssetBase(this.getAttribute("asset-base"));
  }

  start() {
    if (!this._assetsReady) {
      this._autoplayRequested = true;
      return;
    }

    if (this._completionState !== "loading" || this._pValue >= 100) {
      this.reset({ emitReset: false });
    }

    this._isAnimating = true;
  }

  stop() {
    this._isAnimating = false;
    this._autoplayRequested = false;
  }

  reset(options = {}) {
    const { emitReset = true } = options;
    this._hardResetToLoading({ syncAttribute: true, emitProgress: true });

    if (emitReset) {
      this.dispatchEvent(new CustomEvent("reset", { bubbles: true, detail: { value: this._pValue } }));
    }
  }

  setValue(nextValue) {
    const clampedValue = clamp(parseProgress(nextValue, this._pValue), 0, 100);
    this._applyExternalValue(clampedValue);
  }

  async _prepareAssets() {
    const token = ++this._assetLoadToken;
    this._assetsReady = false;
    this._images = await loadAssets(this.assetBase);

    if (!this.isConnected || token !== this._assetLoadToken) {
      return;
    }

    this._assetsReady = true;
    this._hardResetToLoading({ syncAttribute: false, emitProgress: false });

    const initialValue = clamp(parseProgress(this.getAttribute("value"), 0), 0, 100);
    if (initialValue > 0) {
      this._updateProgress(initialValue, { syncAttribute: false, emitProgress: false });
    }

    this._startLoop();

    if (this.hasAttribute("autoplay") || this._autoplayRequested) {
      this._autoplayRequested = false;
      this.start();
    }
  }

  _startLoop() {
    if (this._frameHandle || !this.isConnected) {
      return;
    }

    this._frameHandle = requestAnimationFrame(this._renderFrame);
  }

  _renderFrame() {
    this._frameHandle = 0;
    if (!this.isConnected || !this._assetsReady) {
      return;
    }

    this._frameCount += 1;
    this._drawKirby();
    this._drawStar();

    if (this._completionState === "swallowing") {
      this._renderSwallowingStar();
    } else if (this._completionState === "gulping") {
      this._renderGulping();
    }

    if (this._isAnimating) {
      const nextValue = clamp(this._pValue + Math.random() * 0.4 + 0.15, 0, 100);
      if (nextValue >= 100) {
        this._isAnimating = false;
      }

      this._updateProgress(nextValue, { syncAttribute: false, emitProgress: true });
      if (this._frameCount % 4 === 0 && nextValue < 100) {
        this._spawnParticle();
      }
    }

    this._updateAndDrawParticles();
    this._frameHandle = requestAnimationFrame(this._renderFrame);
  }

  _drawKirby() {
    const ctx = this._contexts.kirby;
    const canvas = this._elements.kirbyCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (this._completionState === "gulping" || this._completionState === "done") {
      if (this._frameCount % 15 === 0) {
        this._satisfiedFrame = (this._satisfiedFrame + 1) % ASSET_GROUPS.satisfied.length;
      }

      const image = this._images[ASSET_GROUPS.satisfied[this._satisfiedFrame]];
      if (!image) {
        return;
      }

      const scaleFactor = 2.5;
      const drawWidth = Math.floor(image.width * scaleFactor);
      const drawHeight = Math.floor(image.height * scaleFactor);
      const drawX = Math.floor((canvas.width - drawWidth) / 2);
      const drawY = canvas.height - drawHeight - 2;
      ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
      return;
    }

    if (this._frameCount % 10 === 0) {
      this._kirbyFrame = (this._kirbyFrame + 1) % ASSET_GROUPS.kirby.length;
    }

    const image = this._images[ASSET_GROUPS.kirby[this._kirbyFrame]];
    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }

  _drawStar() {
    if (this._completionState !== "loading" && this._completionState !== "swallowing") {
      return;
    }

    if (this._frameCount % 8 === 0) {
      this._starFrame = (this._starFrame + 1) % ASSET_GROUPS.star.length;
    }

    const ctx = this._contexts.star;
    const canvas = this._elements.starCanvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawStarOccluder(
      ctx,
      canvas,
      getComputedStyle(this).getPropertyValue("--kirby-screen-bg").trim() || "#0a0a14"
    );

    const image = this._images[ASSET_GROUPS.star[this._starFrame]];
    if (image) {
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    }
  }

  _renderSwallowingStar() {
    this._swallowTick += 1;
    const progress = this._swallowTick / SWALLOW_DURATION;

    if (progress >= 1) {
      this._completionState = "gulping";
      this._swallowTick = 0;
      this._elements.starCanvas.style.display = "none";
      this._elements.kirbyCanvas.classList.add("kirby-gulp");
      this._elements.kirbyCanvas.addEventListener(
        "animationend",
        () => this._elements.kirbyCanvas.classList.remove("kirby-gulp"),
        { once: true }
      );
      this._spawnBurstParticles();
      return;
    }

    const easeIn = progress * progress * progress;
    const scale = 1 - easeIn * 0.95;
    this._elements.starCanvas.style.transform = `scale(${scale}) rotate(${progress * 720}deg)`;
    this._elements.starCanvas.style.opacity = String(1 - easeIn);

    if (this._frameCount % 3 === 0) {
      const starRect = this._elements.starCanvas.getBoundingClientRect();
      const particleRect = this._elements.particleCanvas.getBoundingClientRect();
      const scaleX = particleRect.width ? SCREEN_WIDTH / particleRect.width : 1;
      const scaleY = particleRect.height ? SCREEN_HEIGHT / particleRect.height : 1;
      const relX = (starRect.left - particleRect.left + starRect.width / 2) * scaleX;
      const relY = (starRect.top - particleRect.top + starRect.height / 2) * scaleY;
      this._spawnEffectCloud(relX, relY);
    }
  }

  _renderGulping() {
    this._swallowTick += 1;
    if (this._swallowTick >= GULP_DURATION) {
      this._completionState = "done";
    }
  }

  _spawnParticle() {
    const starX = TRACK_RIGHT - (TRACK_WIDTH * this._pValue) / 100;
    this._particles.push({
      x: starX + Math.random() * 30 - 15,
      y: 60 + Math.random() * 50,
      vx: -(Math.random() * 6 + 3),
      vy: (Math.random() - 0.5) * 2,
      life: 1,
      decay: 0.02 + Math.random() * 0.02,
      frameIdx: Math.floor(Math.random() * ASSET_GROUPS.particle.length),
      size: 0.4 + Math.random() * 0.5,
      type: "particle",
    });
  }

  _spawnEffectCloud(x, y) {
    this._particles.push({
      x,
      y,
      vx: -(Math.random() * 4 + 2),
      vy: (Math.random() - 0.5) * 1.5,
      life: 1,
      decay: 0.015 + Math.random() * 0.015,
      frameIdx: Math.floor(Math.random() * ASSET_GROUPS.effect.length),
      size: 0.6 + Math.random() * 0.8,
      type: "effect",
    });
  }

  _spawnBurstParticles() {
    for (let index = 0; index < 16; index += 1) {
      const angle = (index / 16) * Math.PI * 2;
      const speed = 2 + Math.random() * 4;
      this._particles.push({
        x: KIRBY_MOUTH_X,
        y: KIRBY_MOUTH_Y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        decay: 0.02 + Math.random() * 0.01,
        frameIdx: Math.floor(Math.random() * ASSET_GROUPS.particle.length),
        size: 0.3 + Math.random() * 0.5,
        type: "particle",
      });
    }

    for (let index = 0; index < 6; index += 1) {
      this._particles.push({
        x: KIRBY_MOUTH_X + Math.random() * 60 - 30,
        y: KIRBY_MOUTH_Y + Math.random() * 40 - 20,
        vx: (Math.random() - 0.5) * 3,
        vy: (Math.random() - 0.5) * 3,
        life: 1,
        decay: 0.012 + Math.random() * 0.01,
        frameIdx: Math.floor(Math.random() * ASSET_GROUPS.effect.length),
        size: 1 + Math.random(),
        type: "effect",
      });
    }
  }

  _updateAndDrawParticles() {
    const ctx = this._contexts.particle;
    ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    for (let index = this._particles.length - 1; index >= 0; index -= 1) {
      const particle = this._particles[index];
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.life -= particle.decay;

      if (
        particle.life <= 0 ||
        particle.x < -20 ||
        particle.x > SCREEN_WIDTH + 20 ||
        particle.y < -20 ||
        particle.y > SCREEN_HEIGHT + 20
      ) {
        this._particles.splice(index, 1);
        continue;
      }

      const frameGroup = particle.type === "effect" ? ASSET_GROUPS.effect : ASSET_GROUPS.particle;
      const image = this._images[frameGroup[particle.frameIdx % frameGroup.length]];
      if (!image) {
        continue;
      }

      ctx.globalAlpha = Math.max(0, particle.life);
      const drawWidth = image.width * particle.size * 2;
      const drawHeight = image.height * particle.size * 2;
      ctx.drawImage(image, particle.x - drawWidth / 2, particle.y - drawHeight / 2, drawWidth, drawHeight);
    }

    ctx.globalAlpha = 1;
  }

  _hardResetToLoading(options = {}) {
    const { syncAttribute = true, emitProgress = true } = options;

    this._isAnimating = false;
    this._autoplayRequested = false;
    this._pValue = 0;
    this._frameCount = 0;
    this._kirbyFrame = 0;
    this._satisfiedFrame = 0;
    this._starFrame = 0;
    this._completionState = "loading";
    this._swallowTick = 0;
    this._particles.length = 0;
    this._lastProgressEventValue = -1;

    this._elements.starCanvas.style.display = "block";
    this._elements.starCanvas.style.transform = "";
    this._elements.starCanvas.style.opacity = "1";
    this._elements.progressTrack.style.opacity = "1";
    this._elements.kirbyCanvas.classList.remove("kirby-gulp");
    this._contexts.particle.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

    this._updateProgress(0, { syncAttribute, emitProgress });
  }

  _applyExternalValue(nextValue) {
    if (!this._assetsReady) {
      this._syncValueAttribute(nextValue);
      return;
    }

    if (this._completionState !== "loading" && nextValue < 100) {
      this._hardResetToLoading({ syncAttribute: false, emitProgress: false });
    } else {
      this.stop();
    }

    this._updateProgress(nextValue, { syncAttribute: true, emitProgress: true });
  }

  _updateProgress(nextValue, options = {}) {
    const { syncAttribute = false, emitProgress = true } = options;
    const clampedValue = clamp(nextValue, 0, 100);
    this._pValue = clampedValue;

    this._elements.progressFill.style.width = `${100 - clampedValue}%`;

    const starRight = STAR_BASE_RIGHT - STAR_SIZE / 2 + (TRACK_WIDTH * clampedValue) / 100;
    this._elements.starCanvas.style.right = `${(starRight / SCREEN_WIDTH) * 100}%`;

    if (clampedValue >= 100 && this._completionState === "loading") {
      this._completionState = "swallowing";
      this._swallowTick = 0;
      this._elements.pctText.textContent = "COMPLETED!";
      this._elements.pctText.classList.add("completed");
      this._elements.progressTrack.style.opacity = "0";
      this.dispatchEvent(new CustomEvent("complete", { bubbles: true, detail: { value: clampedValue } }));
    } else if (clampedValue < 100) {
      if (this._elements.pctText.classList.contains("completed")) {
        this._elements.pctText.classList.remove("completed");
      }
      this._elements.pctText.textContent = `LOADING ${Math.floor(clampedValue)}%`;
      this._elements.pctText.style.color = "var(--kirby-accent)";
      this._elements.pctText.style.textShadow = "2px 2px 0 #000, 0 0 8px rgba(255, 204, 0, 0.5)";
    }

    this._elements.loader.setAttribute("aria-valuenow", String(Math.round(clampedValue)));
    this._elements.loader.setAttribute(
      "aria-valuetext",
      clampedValue >= 100 && this._completionState !== "loading"
        ? "Completed"
        : `Loading ${Math.floor(clampedValue)} percent`
    );

    if (syncAttribute) {
      this._syncValueAttribute(clampedValue);
    }

    if (emitProgress) {
      this._emitProgress(clampedValue);
    }
  }

  _emitProgress(nextValue) {
    const roundedValue = Math.floor(nextValue);
    if (roundedValue === this._lastProgressEventValue) {
      return;
    }

    this._lastProgressEventValue = roundedValue;
    this.dispatchEvent(
      new CustomEvent("progress", {
        bubbles: true,
        detail: { value: nextValue, state: this._completionState },
      })
    );
  }

  _syncValueAttribute(nextValue) {
    const serializedValue = String(Math.round(nextValue));
    if (this.getAttribute("value") === serializedValue) {
      return;
    }

    this._syncingValueAttribute = true;
    this.setAttribute("value", serializedValue);
    this._syncingValueAttribute = false;
  }
}

if (!customElements.get("kirby-progress")) {
  customElements.define("kirby-progress", KirbyProgress);
}

if (typeof window !== "undefined") {
  window.KirbyProgress = KirbyProgress;
}
