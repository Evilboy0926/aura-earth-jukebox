/**
 * AURA-EARTH: Spatial & Temporal Sonification Jukebox for NASA EIC
 * 2026 NASA Space Apps Challenge — "The Earth Information Jukebox"
 *
 * Pure Vanilla ES6+ Computer Vision & Web Audio API Synthesis Engine
 * Zero external runtime dependencies.
 */

// 16-Note C-Lydian Scale (South Pole Band 0 -> North Pole Band 15)
// C, D, E, F#, G, A, B across octaves 3 to 5 (scientifically pleasant, non-fatiguing harmony)
const LYDIAN_FREQS = [
  130.81, 146.83, 164.81, 185.00, 196.00, 220.00, 246.94, // Octave 3: C3 - B3
  261.63, 293.66, 329.63, 369.99, 392.00, 440.00, 493.88, // Octave 4: C4 - B4
  523.25, 587.33                                          // Octave 5: C5 - D5
];

const LYDIAN_NAMES = [
  'C3', 'D3', 'E3', 'F#3', 'G3', 'A3', 'B3',
  'C4', 'D4', 'E4', 'F#4', 'G4', 'A4', 'B4',
  'C5', 'D5'
];

// Official NASA SVS EIC Dataset Citations & Acoustic Profiles
const DATASET_INFO = {
  sst: {
    name: 'Sea Surface Temperature (SST) Anomaly',
    svsId: '5176',
    url: 'https://svs.gsfc.nasa.gov/5176',
    desc: 'Maps thermal colorbar anomalies (deep blue cool baseline -> cyan/yellow moderate -> orange/red extreme marine heatwaves) to C-Lydian harmonic overtones.'
  },
  precip: {
    name: 'Global Precipitation GPM Constellation',
    svsId: '4285',
    url: 'https://svs.gsfc.nasa.gov/4285',
    desc: 'Maps IMERG precipitation rate (teal drizzle -> bright green rainbands -> magenta/white intense tropical cyclone cores) to rhythmic polyphonic voices.'
  },
  fires: {
    name: 'Active Fires VIIRS Thermal Hotspots',
    svsId: '5113',
    url: 'https://svs.gsfc.nasa.gov/5113',
    desc: 'Detects high-luminance orange, amber, and white-hot VIIRS radiative power spikes over continental landmasses, triggering sharp harmonic sawtooth accents.'
  },
  currents: {
    name: 'Perpetual Ocean 2: Western Boundary Currents',
    svsId: '5425',
    url: 'https://svs.gsfc.nasa.gov/5425',
    desc: 'Tracks high-velocity ocean streamlines (Kuroshio Current along the Philippines/Bicol & Gulf Stream) using cyan-to-white luminance velocity vectors.'
  }
};

// Simplified Continent Polygons in Normalized Coordinates [lon (-180..180), lat (-90..90)]
const CONTINENT_POLYGONS = [
  // North America
  [[-165, 65], [-130, 70], [-80, 68], [-55, 50], [-80, 25], [-98, 18], [-82, 8], [-105, 20], [-124, 40], [-165, 60]],
  // South America
  [[-80, 10], [-60, 10], [-35, -6], [-48, -28], [-68, -54], [-75, -45], [-71, -18], [-81, -4]],
  // Eurasia
  [[-10, 36], [10, 60], [45, 70], [110, 72], [170, 65], [140, 38], [120, 22], [104, 2], [96, 16], [78, 8], [68, 24], [48, 12], [35, 32], [26, 38], [-9, 38]],
  // Africa
  [[-17, 15], [-6, 35], [11, 37], [33, 31], [51, 12], [40, -11], [35, -25], [18, -35], [12, -17], [9, 4], [-8, 5]],
  // Maritime Southeast Asia & Philippines Archipelago (Luzon / Bicol / Visayas / Mindanao)
  [[120, 18.5], [122.5, 16], [124.2, 13.2], [126.2, 8], [124, 6], [121, 9], [119.8, 14]],
  [[100, 5], [118, 6], [116, -3], [105, -6]],
  [[130, -1], [148, -6], [146, -9], [132, -4]],
  // Australia
  [[114, -22], [130, -12], [142, -11], [153, -26], [147, -38], [130, -33], [115, -34]],
  // Antarctica
  [[-180, -72], [-90, -68], [0, -71], [90, -69], [180, -72], [180, -89], [-180, -89]]
];

// DOM Elements
const canvas = document.getElementById('eicCanvas');
const ctx = canvas.getContext('2d', { willReadFrequently: true });
const spectrumCanvas = document.getElementById('spectrumCanvas');
const sCtx = spectrumCanvas.getContext('2d');

const playBtn = document.getElementById('playBtn');
const resetBtn = document.getElementById('resetBtn');
const recordBtn = document.getElementById('recordBtn');
const narrateBtn = document.getElementById('narrateBtn');
const simMultiFrameBtn = document.getElementById('simMultiFrameBtn');
const clearFramesBtn = document.getElementById('clearFramesBtn');

const datasetSelect = document.getElementById('datasetSelect');
const datasetCitation = document.getElementById('datasetCitation');
const fileInput = document.getElementById('fileInput');
const regionSelect = document.getElementById('regionSelect');
const speedSlider = document.getElementById('speedSlider');
const volSlider = document.getElementById('volSlider');
const speedVal = document.getElementById('speedVal');
const volVal = document.getElementById('volVal');

const engineStatus = document.getElementById('engineStatus');
const dataSourceBadge = document.getElementById('dataSourceBadge');
const regionHudLabel = document.getElementById('regionHudLabel');
const voiceStatus = document.getElementById('voiceStatus');
const srAnnouncer = document.getElementById('srAnnouncer');

const downloadContainer = document.getElementById('downloadContainer');
const downloadLink = document.getElementById('downloadLink');

// Telemetry Readout DOM
const telFrame = document.getElementById('telFrame');
const telPan = document.getElementById('telPan');
const telIntensity = document.getElementById('telIntensity');
const telDelta = document.getElementById('telDelta');
const telPitch = document.getElementById('telPitch');

// Offscreen Buffer for Clean Pixel Extraction (Without Scanline HUD Artifacts)
const offscreen = document.createElement('canvas');
offscreen.width = canvas.width;
offscreen.height = canvas.height;
const offCtx = offscreen.getContext('2d', { willReadFrequently: true });

// Previous Frame Offscreen Buffer for Temporal Delta (Δ) Calculation
const prevOffscreen = document.createElement('canvas');
prevOffscreen.width = canvas.width;
prevOffscreen.height = canvas.height;
const prevOffCtx = prevOffscreen.getContext('2d', { willReadFrequently: true });

// Application State
let audioCtx = null;
let masterGain = null;
let analyser = null;
let mediaStreamDest = null;
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;

let droneOsc = null;
let droneGain = null;

let isPlaying = false;
let scanX = 0;
let sweepSpeed = 1.0;
let masterVolume = 0.75;
let regionMode = 'global'; // 'global' (0..800) or 'wpac' (655..734 -> 115°E..150°E)

// Western Pacific / Philippine Sea & Bicol Sector Bounds on 800x400 Equirectangular Grid
const WPAC_BOUNDS = {
  startX: 655, // ~115°E
  endX: 734,   // ~150°E
  boxX1: 667,  // 120°E
  boxX2: 711,  // 140°E
  boxY1: 155,  // 20°N
  boxY2: 189   // 5°N
};

// Multi-Frame State
let frames = []; // Array of Canvas/Image sources
let currentFrameIdx = 0;
let prevFrameIdx = 0;
let dataSourceMode = 'calibrated-single'; // 'calibrated-single' | 'calibrated-series' | 'real-nasa'

// Last Extracted Column Telemetry for Narration & Spectrum Display
let lastTelemetry = {
  lonLabel: '180.0°W',
  pan: -1.0,
  peakIntensity: 0,
  deltaPct: 0,
  topBandIdx: 0,
  topNote: 'C3',
  topFreq: 130.81,
  activeBands: []
};

/**
 * Announce message to Screen Readers via ARIA live region
 */
function announceSR(message) {
  if (!srAnnouncer) return;
  srAnnouncer.textContent = '';
  setTimeout(() => {
    srAnnouncer.textContent = message;
  }, 30);
}

/**
 * Initialize Web Audio API Context, Master Gain, AnalyserNode, Recording Stream & C2 Planetary Drone
 */
function initAudioEngine() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();

    masterGain = audioCtx.createGain();
    masterGain.gain.value = masterVolume;

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.78;

    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    // MediaStreamDestination for Live Browser Audio Export (.webm)
    if (typeof audioCtx.createMediaStreamDestination === 'function') {
      mediaStreamDest = audioCtx.createMediaStreamDestination();
      masterGain.connect(mediaStreamDest);
    }

    // Subtle C2 (65.41 Hz) Planetary Equilibrium Drone
    droneOsc = audioCtx.createOscillator();
    droneGain = audioCtx.createGain();
    droneOsc.type = 'sine';
    droneOsc.frequency.value = 65.41; // Deep C2
    droneGain.gain.value = 0.0;
    droneOsc.connect(droneGain);
    droneGain.connect(masterGain);
    droneOsc.start();
  }

  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  engineStatus.textContent = 'Audio Engine: Active (Web Audio DSP)';
  engineStatus.classList.add('engine-active');
}

/**
 * Convert Longitude/Latitude (-180..180, -90..90) to Canvas (x, y)
 */
function lonLatToXY(lon, lat, w, h) {
  const x = ((lon + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return [x, y];
}

/**
 * Render Continents & Coordinate Graticules onto a target 2D Context
 */
function drawWorldBase(targetCtx, w, h, profile) {
  // Deep background gradient
  const bgGrad = targetCtx.createLinearGradient(0, 0, 0, h);
  if (profile === 'fires') {
    bgGrad.addColorStop(0, '#04070f');
    bgGrad.addColorStop(0.5, '#070c18');
    bgGrad.addColorStop(1, '#04070f');
  } else if (profile === 'currents') {
    bgGrad.addColorStop(0, '#03091c');
    bgGrad.addColorStop(0.5, '#061533');
    bgGrad.addColorStop(1, '#03091c');
  } else {
    bgGrad.addColorStop(0, '#061026');
    bgGrad.addColorStop(0.5, '#0a1938');
    bgGrad.addColorStop(1, '#061026');
  }
  targetCtx.fillStyle = bgGrad;
  targetCtx.fillRect(0, 0, w, h);

  // Draw Continent Outlines & Fill
  targetCtx.save();
  targetCtx.fillStyle = profile === 'fires' ? '#111a24' : '#0b1322';
  targetCtx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
  targetCtx.lineWidth = 1.2;

  CONTINENT_POLYGONS.forEach((poly) => {
    targetCtx.beginPath();
    poly.forEach(([lon, lat], idx) => {
      const [x, y] = lonLatToXY(lon, lat, w, h);
      if (idx === 0) targetCtx.moveTo(x, y);
      else targetCtx.lineTo(x, y);
    });
    targetCtx.closePath();
    targetCtx.fill();
    targetCtx.stroke();
  });
  targetCtx.restore();
}

/**
 * Generate a Calibrated EIC Map Canvas for the selected NASA SVS Dataset & Phase
 * @param {string} profile - 'sst' | 'precip' | 'fires' | 'currents'
 * @param {number} phase - 0..3 temporal evolution step
 */
function createCalibratedMapCanvas(profile, phase = 0) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const g = c.getContext('2d');
  const w = c.width;
  const h = c.height;

  drawWorldBase(g, w, h, profile);

  const shiftX = phase * 8; // Subtle temporal propagation across multi-frame sequences
  const ampScale = 1 + phase * 0.1;

  if (profile === 'sst') {
    // NASA SVS 5176: Sea Surface Temperature Anomaly
    // 1. Equatorial Pacific ENSO Thermal Plume
    const ensoGrad = g.createRadialGradient(320 - shiftX, h * 0.52, 12, 320 - shiftX, h * 0.52, 185);
    ensoGrad.addColorStop(0, `rgba(255, 55, 20, ${Math.min(1, 0.92 * ampScale)})`);
    ensoGrad.addColorStop(0.45, 'rgba(251, 146, 60, 0.72)');
    ensoGrad.addColorStop(0.75, 'rgba(250, 204, 21, 0.35)');
    ensoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = ensoGrad;
    g.fillRect(0, 0, w, h);

    // 2. Western Pacific Warm Pool & Philippine Sea / Bicol Anomaly (120°E - 140°E)
    const wpacGrad = g.createRadialGradient(692 - shiftX * 0.6, 172, 8, 692 - shiftX * 0.6, 172, 85);
    wpacGrad.addColorStop(0, 'rgba(255, 65, 30, 0.96)');
    wpacGrad.addColorStop(0.45, 'rgba(251, 146, 60, 0.80)');
    wpacGrad.addColorStop(0.8, 'rgba(56, 189, 248, 0.25)');
    wpacGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = wpacGrad;
    g.fillRect(0, 0, w, h);

    // 3. North Atlantic / Gulf Stream Warm Anomaly
    const natlGrad = g.createRadialGradient(255 + shiftX * 0.4, 122, 10, 255 + shiftX * 0.4, 122, 95);
    natlGrad.addColorStop(0, 'rgba(249, 115, 22, 0.88)');
    natlGrad.addColorStop(0.55, 'rgba(250, 204, 21, 0.48)');
    natlGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = natlGrad;
    g.fillRect(0, 0, w, h);

    // 4. Southern Ocean Cool Baseline Wake
    const coolGrad = g.createRadialGradient(520, 315, 15, 520, 315, 130);
    coolGrad.addColorStop(0, 'rgba(56, 189, 248, 0.65)');
    coolGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = coolGrad;
    g.fillRect(0, 0, w, h);

  } else if (profile === 'precip') {
    // NASA SVS 4285: Global Precipitation GPM Constellation
    // 1. ITCZ Equatorial Rainband
    for (let x = 30; x < w - 30; x += 18) {
      const waveY = h * 0.48 + Math.sin((x + shiftX * 2) * 0.025) * 26;
      const pGrad = g.createRadialGradient(x, waveY, 3, x, waveY, 38);
      pGrad.addColorStop(0, 'rgba(52, 211, 153, 0.82)');
      pGrad.addColorStop(0.55, 'rgba(14, 165, 233, 0.42)');
      pGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = pGrad;
      g.fillRect(x - 42, waveY - 42, 84, 84);
    }

    // 2. Western Pacific / Philippine Sea Typhoon System approaching Bicol (125°E - 135°E, 12°N - 16°N)
    const tyX = 696 - phase * 6;
    const tyY = 170 - phase * 3;
    const tyGrad = g.createRadialGradient(tyX, tyY, 4, tyX, tyY, 64);
    tyGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    tyGrad.addColorStop(0.28, 'rgba(232, 121, 249, 0.92)');
    tyGrad.addColorStop(0.6, 'rgba(52, 211, 153, 0.72)');
    tyGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    g.fillStyle = tyGrad;
    g.fillRect(tyX - 75, tyY - 75, 150, 150);

    // 3. Mid-Latitude Frontal Storm Tracks (North Pacific & North Atlantic)
    [[165 + shiftX, 115], [275 + shiftX, 108], [610 + shiftX, 285]].forEach(([sx, sy]) => {
      const stGrad = g.createRadialGradient(sx, sy, 5, sx, sy, 68);
      stGrad.addColorStop(0, 'rgba(167, 243, 208, 0.88)');
      stGrad.addColorStop(0.5, 'rgba(56, 189, 248, 0.55)');
      stGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = stGrad;
      g.fillRect(sx - 75, sy - 75, 150, 150);
    });

  } else if (profile === 'fires') {
    // NASA SVS 5113: Active Fires VIIRS Thermal Hotspots
    const fireClusters = [
      // Amazon Basin
      { cx: 265, cy: 222, count: 26, spread: 34 },
      // Sub-Saharan & Central Africa Savanna Belt
      { cx: 445, cy: 192, count: 38, spread: 42 },
      { cx: 462, cy: 235, count: 28, spread: 32 },
      // Southeast Asia & Luzon / Western Pacific Rim
      { cx: 645, cy: 168, count: 22, spread: 26 },
      { cx: 672, cy: 174, count: 16, spread: 16 },
      // Northern Australia
      { cx: 702, cy: 248, count: 24, spread: 30 },
      // Western North America
      { cx: 138, cy: 112, count: 20, spread: 24 }
    ];

    fireClusters.forEach((cluster, cIdx) => {
      for (let i = 0; i < cluster.count; i++) {
        // Deterministic pseudo-random offset so calibration frames are reproducible
        const angle = (i * 2.39996) + phase * 0.45 + cIdx;
        const dist = ((i * 7 + phase * 3) % cluster.spread);
        const fx = cluster.cx + Math.cos(angle) * dist;
        const fy = cluster.cy + Math.sin(angle) * (dist * 0.7);
        const radius = 10 + ((i + phase) % 9);

        const fGrad = g.createRadialGradient(fx, fy, 1, fx, fy, radius);
        fGrad.addColorStop(0, 'rgba(255, 250, 210, 0.98)');
        fGrad.addColorStop(0.35, 'rgba(251, 146, 60, 0.90)');
        fGrad.addColorStop(0.7, 'rgba(220, 38, 38, 0.55)');
        fGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = fGrad;
        g.fillRect(fx - radius, fy - radius, radius * 2, radius * 2);
      }
    });

  } else if (profile === 'currents') {
    // NASA SVS 5425: Perpetual Ocean 2: Western Boundary Currents
    // Streamlines for Kuroshio Current (Philippines/Bicol -> Taiwan -> Japan), Gulf Stream, Agulhas
    const streams = [
      // Kuroshio Current (Originating off eastern Bicol / Catanduanes / Philippine Sea)
      { x0: 676, y0: 176, x1: 735, y1: 118, strength: 1.0 },
      // North Equatorial Current feeding Philippine Sea
      { x0: 765, y0: 180, x1: 676, y1: 174, strength: 0.85 },
      // Gulf Stream (Western North Atlantic)
      { x0: 222, y0: 145, x1: 315, y1: 98, strength: 0.95 },
      // Agulhas Current (South Africa)
      { x0: 475, y0: 268, x1: 435, y1: 286, strength: 0.88 },
      // East Australian Current
      { x0: 742, y0: 245, x1: 738, y1: 288, strength: 0.82 },
      // Antarctic Circumpolar Current
      { x0: 80, y0: 325, x1: 720, y1: 325, strength: 0.65 }
    ];

    streams.forEach((st) => {
      const steps = 28;
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        const sx = st.x0 + (st.x1 - st.x0) * t;
        const sy = st.y0 + (st.y1 - st.y0) * t + Math.sin(t * Math.PI * 3 + phase * 1.1) * 9;
        const rad = 22 * st.strength;
        const cGrad = g.createRadialGradient(sx, sy, 2, sx, sy, rad);
        cGrad.addColorStop(0, 'rgba(240, 253, 250, 0.95)');
        cGrad.addColorStop(0.4, 'rgba(56, 189, 248, 0.78)');
        cGrad.addColorStop(0.8, 'rgba(14, 116, 144, 0.32)');
        cGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        g.fillStyle = cGrad;
        g.fillRect(sx - rad, sy - rad, rad * 2, rad * 2);
      }
    });
  }

  return c;
}

/**
 * Load Single Built-in Calibrated EIC Map
 */
function loadSingleCalibratedMap() {
  const profile = datasetSelect.value;
  frames = [createCalibratedMapCanvas(profile, 0)];
  currentFrameIdx = 0;
  prevFrameIdx = 0;
  dataSourceMode = 'calibrated-single';

  updateDataSourceBadge();
  updateCitationBox();
  syncActiveFrameToOffscreen();
  renderViewport();
}

/**
 * Load 4-Frame Calibrated Time-Series Sequence to Demonstrate Temporal Delta (Δ)
 */
function loadCalibratedTimeSeries() {
  const profile = datasetSelect.value;
  frames = [
    createCalibratedMapCanvas(profile, 0),
    createCalibratedMapCanvas(profile, 1),
    createCalibratedMapCanvas(profile, 2),
    createCalibratedMapCanvas(profile, 3)
  ];
  currentFrameIdx = 0;
  prevFrameIdx = 0;
  dataSourceMode = 'calibrated-series';

  updateDataSourceBadge();
  syncActiveFrameToOffscreen();
  renderViewport();
  announceSR(`Loaded 4-frame calibrated time-series sequence for ${DATASET_INFO[profile].name}.`);
}

/**
 * Update Header Data Source Pill Honesty Indicator
 */
function updateDataSourceBadge() {
  if (dataSourceMode === 'real-nasa') {
    dataSourceBadge.textContent = `Mode: Real NASA SVS EIC Frames (${frames.length} loaded)`;
    dataSourceBadge.className = 'status-pill mode-real';
  } else if (dataSourceMode === 'calibrated-series') {
    dataSourceBadge.textContent = `Mode: Calibrated 4-Frame Time-Series (Demo)`;
    dataSourceBadge.className = 'status-pill mode-calibrated';
  } else {
    dataSourceBadge.textContent = 'Mode: Built-in Calibrated EIC Map';
    dataSourceBadge.className = 'status-pill mode-calibrated';
  }
}

/**
 * Update Dataset Scientific Citation Box
 */
function updateCitationBox() {
  const info = DATASET_INFO[datasetSelect.value];
  if (!info || !datasetCitation) return;
  datasetCitation.innerHTML = `
    <strong>NASA SVS ID ${info.svsId}:</strong> ${info.desc}
    <a href="${info.url}" target="_blank" rel="noopener">View Official NASA SVS ${info.svsId} Source &#8599;</a>
  `;
}

/**
 * Copy Current & Previous Frame into Offscreen Buffers for Fast Column Pixel Analysis
 */
function syncActiveFrameToOffscreen() {
  if (frames.length === 0) return;
  offCtx.clearRect(0, 0, offscreen.width, offscreen.height);
  offCtx.drawImage(frames[currentFrameIdx], 0, 0, offscreen.width, offscreen.height);

  prevOffCtx.clearRect(0, 0, prevOffscreen.width, prevOffscreen.height);
  prevOffCtx.drawImage(frames[prevFrameIdx], 0, 0, prevOffscreen.width, prevOffscreen.height);
}

/**
 * Draw Primary Interactive Viewport Canvas (Map + Graticules + Western Pacific Box + Scanline)
 */
function renderViewport(activeBands = []) {
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(offscreen, 0, 0);

  // Subtle Latitude/Longitude Coordinate Graticules
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  for (let x = w / 6; x < w; x += w / 6) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = h / 6; y < h; y += h / 6) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }
  // Equator Line (0° Latitude)
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.stroke();
  ctx.restore();

  // Western Pacific / Philippine Sea & Bicol Highlight Box (120°E–140°E, 5°N–20°N)
  ctx.save();
  const isWpacActive = regionMode === 'wpac';
  ctx.strokeStyle = isWpacActive ? '#f59e0b' : 'rgba(245, 158, 11, 0.55)';
  ctx.lineWidth = isWpacActive ? 2.2 : 1.2;
  ctx.setLineDash(isWpacActive ? [] : [4, 3]);
  const bw = WPAC_BOUNDS.boxX2 - WPAC_BOUNDS.boxX1;
  const bh = WPAC_BOUNDS.boxY2 - WPAC_BOUNDS.boxY1;
  ctx.strokeRect(WPAC_BOUNDS.boxX1, WPAC_BOUNDS.boxY1, bw, bh);

  // Label for Philippine Sea / Bicol Box
  ctx.fillStyle = isWpacActive ? '#fde68a' : 'rgba(253, 230, 138, 0.78)';
  ctx.font = '600 10px Segoe UI, sans-serif';
  ctx.fillText('PH Sea / Bicol (120°E–140°E)', WPAC_BOUNDS.boxX1 - 38, WPAC_BOUNDS.boxY1 - 5);
  ctx.restore();

  // Dim outside sector when Western Pacific Regional Focus is active
  if (regionMode === 'wpac') {
    ctx.save();
    ctx.fillStyle = 'rgba(2, 6, 23, 0.58)';
    ctx.fillRect(0, 0, WPAC_BOUNDS.startX, h);
    ctx.fillRect(WPAC_BOUNDS.endX, 0, w - WPAC_BOUNDS.endX, h);
    ctx.restore();
  }

  // Draw Active Scanline (Vertical Longitude Cursor)
  const sx = Math.floor(scanX);
  ctx.save();
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 2.5;
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.moveTo(sx, 0);
  ctx.lineTo(sx, h);
  ctx.stroke();

  // Highlight Triggered Latitude Bands along Scanline
  const bandHeight = h / 16;
  activeBands.forEach((b) => {
    const yTop = h - (b.band + 1) * bandHeight;
    ctx.fillStyle = b.intensity > 0.7 ? '#f87171' : '#f59e0b';
    ctx.fillRect(sx - 5, yTop + 2, 10, bandHeight - 4);
  });
  ctx.restore();
}

/**
 * Evaluate Pixel Anomaly (0.0 to 1.0) using Scientific Dataset Colorbar Profile
 */
function computePixelAnomaly(r, g, b, profile) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  if (profile === 'sst') {
    // SVS 5176: Warm thermal anomalies (red/orange/yellow) vs deep ocean background
    const warmScore = Math.max(0, (rn - bn * 0.65) * 1.25 + gn * 0.25);
    const coolScore = Math.max(0, (bn - rn) * 0.55);
    return Math.min(1, Math.max(warmScore, coolScore * 0.6));
  }
  if (profile === 'precip') {
    // SVS 4285: Green/Cyan rainbands and Magenta/White intense storm cores
    const stormCore = (rn > 0.7 && bn > 0.7) ? (rn + bn) * 0.52 : 0;
    const rainBand = Math.max(0, gn * 0.9 + bn * 0.45 - rn * 0.25);
    return Math.min(1, Math.max(stormCore, rainBand));
  }
  if (profile === 'fires') {
    // SVS 5113: High-contrast orange/red/yellow thermal hotspots
    if (rn < 0.38) return 0;
    return Math.min(1, Math.max(0, (rn - bn * 0.85) * 1.35));
  }
  if (profile === 'currents') {
    // SVS 5425: Cyan-to-white luminance velocity streamlines
    const lum = rn * 0.28 + gn * 0.48 + bn * 0.24;
    return Math.min(1, Math.max(0, (lum - 0.14) * 1.3));
  }
  return (rn + gn + bn) / 3;
}

/**
 * Analyze Current Column at `x`, Trigger Spatial Web Audio Synthesis, and Update Telemetry
 */
function sonifyColumn(x, triggerAudio = true) {
  const w = offscreen.width;
  const h = offscreen.height;
  const colX = Math.max(0, Math.min(w - 1, Math.floor(x)));
  const profile = datasetSelect.value;

  const colData = offCtx.getImageData(colX, 0, 1, h).data;
  const prevColData = prevOffCtx.getImageData(colX, 0, 1, h).data;

  const numBands = 16;
  const bandHeight = Math.floor(h / numBands);
  const bandResults = [];
  let totalDelta = 0;

  for (let b = 0; b < numBands; b++) {
    // Band 0 = South Pole (bottom), Band 15 = North Pole (top)
    const yStart = h - (b + 1) * bandHeight;
    let sumAnomaly = 0;
    let bandDelta = 0;

    for (let y = yStart; y < yStart + bandHeight; y++) {
      const idx = y * 4;
      const curAnom = computePixelAnomaly(colData[idx], colData[idx + 1], colData[idx + 2], profile);
      const prvAnom = computePixelAnomaly(prevColData[idx], prevColData[idx + 1], prevColData[idx + 2], profile);
      sumAnomaly += curAnom;
      bandDelta += Math.abs(curAnom - prvAnom);
    }

    const avgIntensity = sumAnomaly / bandHeight;
    const avgBandDelta = bandDelta / bandHeight;
    totalDelta += avgBandDelta;

    bandResults.push({
      band: b,
      intensity: avgIntensity,
      delta: avgBandDelta,
      freq: LYDIAN_FREQS[b],
      note: LYDIAN_NAMES[b]
    });
  }

  // Sort to select Top 3 Most Intense Latitude Bands (Polyphonic Voice Allocation)
  const sorted = [...bandResults].sort((a, b) => b.intensity - a.intensity);
  const activeBands = sorted.slice(0, 3).filter((item) => item.intensity > 0.16);

  // Compute Geographic Longitude (-180°W to +180°E) and Stereo Pan (-1.0 Left to +1.0 Right)
  const lonDeg = (colX / w) * 360 - 180;
  const lonDir = lonDeg < 0 ? 'W' : 'E';
  const lonFormatted = `${Math.abs(lonDeg).toFixed(1)}°${lonDir}`;

  let pan = (colX / w) * 2 - 1;
  if (regionMode === 'wpac') {
    // Expand stereo stage across Western Pacific sector so user hears full Left-to-Right separation
    const normWpac = (colX - WPAC_BOUNDS.startX) / (WPAC_BOUNDS.endX - WPAC_BOUNDS.startX);
    pan = Math.max(-1, Math.min(1, normWpac * 2 - 1));
  }

  const peak = sorted[0] || { intensity: 0, band: 0, freq: LYDIAN_FREQS[0], note: 'C3' };
  const meanDeltaPct = frames.length > 1 ? Math.min(100, (totalDelta / numBands) * 260) : 0;

  // Trigger Polyphonic Web Audio Synthesis
  if (triggerAudio && audioCtx && activeBands.length > 0) {
    const now = audioCtx.currentTime;
    const panner = audioCtx.createStereoPanner();
    panner.pan.setValueAtTime(pan, now);

    // Dynamic Low-Pass Filter modulated by Peak Anomaly & Temporal Delta
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    const cutoff = 520 + peak.intensity * 2600 + (meanDeltaPct * 15);
    filter.frequency.setValueAtTime(Math.min(6000, cutoff), now);

    filter.connect(panner);
    panner.connect(masterGain);

    activeBands.forEach((voice, vIdx) => {
      const osc = audioCtx.createOscillator();
      const vGain = audioCtx.createGain();

      // Acoustic Timbre Mapping (Matches Audio Legend Tiers 1-4)
      if (voice.intensity > 0.72) {
        osc.type = 'sawtooth';
      } else if (voice.intensity > 0.48) {
        osc.type = 'triangle';
      } else {
        osc.type = 'sine';
      }

      osc.frequency.setValueAtTime(voice.freq, now);

      const amp = Math.min(0.24, (voice.intensity * 0.2) / (vIdx + 1));
      const noteDur = Math.max(0.08, 0.14 / sweepSpeed);

      vGain.gain.setValueAtTime(0.0001, now);
      vGain.gain.linearRampToValueAtTime(amp, now + 0.015);
      vGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDur);

      osc.connect(vGain);
      vGain.connect(filter);

      osc.start(now);
      osc.stop(now + noteDur + 0.02);
    });
  }

  // Update Telemetry Cards
  const modeTag = dataSourceMode === 'real-nasa' ? 'NASA EIC' : 'Calibrated';
  telFrame.textContent = `${currentFrameIdx + 1} / ${frames.length} (${modeTag})`;

  const panSide = pan < -0.05 ? 'L' : pan > 0.05 ? 'R' : 'C';
  telPan.textContent = `${lonFormatted} (${pan >= 0 ? '+' : ''}${pan.toFixed(2)} ${panSide})`;

  const pct = Math.round(peak.intensity * 100);
  const tierName = pct > 75 ? 'Extreme' : pct > 50 ? 'Elevated' : pct > 25 ? 'Moderate' : 'Baseline';
  telIntensity.textContent = `${pct}% (${tierName})`;

  telDelta.textContent = frames.length > 1
    ? `${meanDeltaPct.toFixed(1)}% (Multi-Frame)`
    : '0.0% (Single Frame)';

  telPitch.textContent = activeBands.length > 0
    ? `${peak.note} (${peak.freq.toFixed(1)} Hz)`
    : 'Rest (Baseline)';

  voiceStatus.textContent = `Active Voices: ${activeBands.length} / 3 Polyphonic + C2 Planetary Drone`;

  lastTelemetry = {
    lonLabel: lonFormatted,
    pan,
    peakIntensity: pct,
    tierName,
    deltaPct: meanDeltaPct,
    topBandIdx: peak.band,
    topNote: peak.note,
    topFreq: peak.freq,
    activeBands
  };

  renderViewport(activeBands);
}

/**
 * Play Calibrated Audio Legend Reference Tone (Keys 1 - 4)
 */
function playReferenceTone(level) {
  initAudioEngine();
  const now = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const filter = audioCtx.createBiquadFilter();
  filter.type = 'lowpass';

  const configs = {
    1: { freq: 130.81, note: 'C3', type: 'sine', cutoff: 700, label: 'Level 1 Baseline (0 to 25 percent): Pure C3 Sine Wave at 130.8 Hertz' },
    2: { freq: 196.00, note: 'G3', type: 'sine', cutoff: 1200, label: 'Level 2 Moderate (26 to 50 percent): Warm G3 Sine Wave at 196.0 Hertz' },
    3: { freq: 329.63, note: 'E4', type: 'triangle', cutoff: 2400, label: 'Level 3 Elevated (51 to 75 percent): E4 Triangle Wave at 329.6 Hertz' },
    4: { freq: 493.88, note: 'B4', type: 'sawtooth', cutoff: 4200, label: 'Level 4 Extreme Anomaly (76 to 100 percent): B4 Harmonic Sawtooth at 493.9 Hertz' }
  };

  const cfg = configs[level] || configs[1];
  osc.type = cfg.type;
  osc.frequency.setValueAtTime(cfg.freq, now);
  filter.frequency.setValueAtTime(cfg.cutoff, now);

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.28, now + 0.03);
  gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.65);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(masterGain);

  osc.start(now);
  osc.stop(now + 0.68);

  telPitch.textContent = `Legend [${level}]: ${cfg.note} (${cfg.freq} Hz)`;
  announceSR(cfg.label);
}

/**
 * Real-Time Secondary Canvas: Web Audio API AnalyserNode Spectrum & Waveform Visualizer
 */
function renderSpectrumLoop() {
  const sw = spectrumCanvas.width;
  const sh = spectrumCanvas.height;
  sCtx.fillStyle = '#030712';
  sCtx.fillRect(0, 0, sw, sh);

  // Subtle Grid Line
  sCtx.strokeStyle = 'rgba(30, 41, 59, 0.75)';
  sCtx.beginPath();
  sCtx.moveTo(0, sh / 2);
  sCtx.lineTo(sw, sh / 2);
  sCtx.stroke();

  if (analyser && audioCtx && audioCtx.state === 'running') {
    const bufferLength = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufferLength);
    const timeData = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(freqData);
    analyser.getByteTimeDomainData(timeData);

    // Draw Frequency Bars
    const barCount = 64;
    const barWidth = sw / barCount;
    for (let i = 0; i < barCount; i++) {
      const val = freqData[i] / 255;
      const barHeight = val * (sh - 10);
      sCtx.fillStyle = val > 0.65 ? '#f59e0b' : '#38bdf8';
      sCtx.fillRect(i * barWidth + 1, sh - barHeight, barWidth - 3, barHeight);
    }

    // Draw Oscilloscope Time-Domain Waveform Overlay
    sCtx.strokeStyle = '#f8fafc';
    sCtx.lineWidth = 1.6;
    sCtx.beginPath();
    const sliceWidth = sw / bufferLength;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * sh) / 2;
      if (i === 0) sCtx.moveTo(x, y);
      else sCtx.lineTo(x, y);
      x += sliceWidth;
    }
    sCtx.stroke();
  } else {
    // Standby Baseline Line
    sCtx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    sCtx.font = '12px Segoe UI, sans-serif';
    sCtx.fillText('Press Play [Space] or Audio Legend Keys [1–4] to activate real-time Web Audio DSP spectrum', 16, sh / 2 + 4);
  }

  requestAnimationFrame(renderSpectrumLoop);
}

/**
 * Main Longitudinal Jukebox Sweep Loop
 */
let lastStepTime = 0;
function jukeboxLoop(timestamp) {
  if (!isPlaying) return;

  const stepIntervalMs = 42 / sweepSpeed;
  if (timestamp - lastStepTime >= stepIntervalMs) {
    sonifyColumn(scanX, true);

    const startBound = regionMode === 'wpac' ? WPAC_BOUNDS.startX : 0;
    const endBound = regionMode === 'wpac' ? WPAC_BOUNDS.endX : canvas.width;
    const stepPx = regionMode === 'wpac' ? 1.2 : 2.5;

    scanX += stepPx;

    if (scanX >= endBound) {
      scanX = startBound;
      // Advance Frame in Multi-Frame Time-Series Sequence
      if (frames.length > 1) {
        prevFrameIdx = currentFrameIdx;
        currentFrameIdx = (currentFrameIdx + 1) % frames.length;
        syncActiveFrameToOffscreen();
      }
    }
    lastStepTime = timestamp;
  }

  requestAnimationFrame(jukeboxLoop);
}

/**
 * Toggle Jukebox Play / Pause
 */
function togglePlay() {
  initAudioEngine();
  isPlaying = !isPlaying;

  if (isPlaying) {
    playBtn.innerHTML = '&#10074;&#10074; Pause [Space]';
    playBtn.classList.add('playing');
    playBtn.setAttribute('aria-pressed', 'true');
    if (droneGain && audioCtx) {
      droneGain.gain.setTargetAtTime(0.035, audioCtx.currentTime, 0.15);
    }
    lastStepTime = performance.now();
    requestAnimationFrame(jukeboxLoop);
    announceSR('Sonification playback started.');
  } else {
    playBtn.innerHTML = '&#9654; Play [Space]';
    playBtn.classList.remove('playing');
    playBtn.setAttribute('aria-pressed', 'false');
    if (droneGain && audioCtx) {
      droneGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.1);
    }
    announceSR('Sonification playback paused.');
  }
}

/**
 * Reset Scanline to Beginning of Active Sector
 */
function resetScanline() {
  scanX = regionMode === 'wpac' ? WPAC_BOUNDS.startX : 0;
  currentFrameIdx = 0;
  prevFrameIdx = 0;
  syncActiveFrameToOffscreen();
  sonifyColumn(scanX, false);
  announceSR(`Scanline reset to ${lastTelemetry.lonLabel}.`);
}

/**
 * Toggle Regional Sweep Focus (Global vs Western Pacific / Philippine Sea & Bicol)
 */
function setRegionMode(mode) {
  regionMode = mode;
  regionSelect.value = mode;
  if (mode === 'wpac') {
    scanX = WPAC_BOUNDS.startX;
    regionHudLabel.textContent = 'Western Pacific / Philippine Sea & Bicol Focus (115°E to 150°E • Expanded Stereo)';
    announceSR('Switched to Western Pacific, Philippine Sea, and Bicol Region sector focus.');
  } else {
    scanX = 0;
    regionHudLabel.textContent = 'Global Equirectangular Projection (90°N to 90°S • 16 C-Lydian Latitude Bands)';
    announceSR('Switched to Global Full Sweep from 180 degrees West to 180 degrees East.');
  }
  sonifyColumn(scanX, false);
}

/**
 * Toggle Live Browser Audio Recording (.webm Export via MediaRecorder)
 */
function toggleAudioRecording() {
  initAudioEngine();
  if (!mediaStreamDest || typeof MediaRecorder === 'undefined') {
    announceSR('Audio recording is not supported in this browser environment.');
    return;
  }

  if (!isRecording) {
    recordedChunks = [];
    try {
      mediaRecorder = new MediaRecorder(mediaStreamDest.stream);
    } catch (e) {
      mediaRecorder = new MediaRecorder(mediaStreamDest.stream);
    }

    mediaRecorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size > 0) {
        recordedChunks.push(ev.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(recordedChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(blob);
      downloadLink.href = url;
      downloadLink.download = `AURA-EARTH-${datasetSelect.value}-sonification.webm`;
      downloadContainer.hidden = false;
      announceSR('Audio recording complete. Download link is now available.');
    };

    mediaRecorder.start();
    isRecording = true;
    downloadContainer.hidden = true;
    recordBtn.innerHTML = '&#9632; Stop Rec';
    recordBtn.classList.add('recording');
    recordBtn.setAttribute('aria-pressed', 'true');
    announceSR('Started recording live sonification audio.');

    if (!isPlaying) {
      togglePlay();
    }
  } else {
    mediaRecorder.stop();
    isRecording = false;
    recordBtn.innerHTML = '&#9679; Rec Audio';
    recordBtn.classList.remove('recording');
    recordBtn.setAttribute('aria-pressed', 'false');
  }
}

/**
 * Speak Full Accessible Audio Description & Live Telemetry via W3C Web Speech API
 */
function speakAudioDescription() {
  if (!('speechSynthesis' in window)) {
    announceSR('Web Speech synthesis is not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();

  const info = DATASET_INFO[datasetSelect.value];
  const sourceDesc = dataSourceMode === 'real-nasa'
    ? `real uploaded NASA SVS EIC frames, frame ${currentFrameIdx + 1} of ${frames.length}`
    : dataSourceMode === 'calibrated-series'
      ? `calibrated 4-frame time-series sequence, frame ${currentFrameIdx + 1} of 4`
      : 'built-in calibrated EIC reference map';

  const sectorDesc = regionMode === 'wpac'
    ? 'focused on the Western Pacific, Philippine Sea, and Bicol sector'
    : 'scanning the global equirectangular projection';

  const panDesc = lastTelemetry.pan < -0.15
    ? 'panned to the left stereo channel'
    : lastTelemetry.pan > 0.15
      ? 'panned to the right stereo channel'
      : 'centered in the stereo field';

  const text = `AURA-EARTH Telemetry Report. Active profile: ${info.name}, NASA SVS I D ${info.svsId}, using ${sourceDesc}, ${sectorDesc}. Scanline is at longitude ${lastTelemetry.lonLabel}, ${panDesc}. Peak column anomaly is ${lastTelemetry.peakIntensity} percent (${lastTelemetry.tierName} tier), triggering C-Lydian note ${lastTelemetry.topNote} at ${Math.round(lastTelemetry.topFreq)} Hertz.`;

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  window.speechSynthesis.speak(utterance);
  announceSR(text);
}

// ============================================================================
// Event Listeners & Keyboard Accessibility Bindings
// ============================================================================

playBtn.addEventListener('click', togglePlay);
resetBtn.addEventListener('click', resetScanline);
recordBtn.addEventListener('click', toggleAudioRecording);
narrateBtn.addEventListener('click', speakAudioDescription);

simMultiFrameBtn.addEventListener('click', loadCalibratedTimeSeries);
clearFramesBtn.addEventListener('click', () => {
  fileInput.value = '';
  loadSingleCalibratedMap();
  announceSR('Reset to single built-in calibrated EIC map.');
});

datasetSelect.addEventListener('change', () => {
  updateCitationBox();
  if (dataSourceMode === 'calibrated-series') {
    loadCalibratedTimeSeries();
  } else if (dataSourceMode === 'calibrated-single') {
    loadSingleCalibratedMap();
  } else {
    // Re-evaluate uploaded NASA frames with the newly selected colorbar profile
    sonifyColumn(scanX, false);
  }
  announceSR(`Selected scientific profile: ${DATASET_INFO[datasetSelect.value].name}.`);
});

regionSelect.addEventListener('change', () => {
  setRegionMode(regionSelect.value);
});

speedSlider.addEventListener('input', (e) => {
  sweepSpeed = parseFloat(e.target.value);
  speedVal.textContent = `${sweepSpeed.toFixed(1)}x`;
});

volSlider.addEventListener('input', (e) => {
  masterVolume = parseInt(e.target.value, 10) / 100;
  volVal.textContent = `${e.target.value}%`;
  if (masterGain && audioCtx) {
    masterGain.gain.setTargetAtTime(masterVolume, audioCtx.currentTime, 0.04);
  }
});

// Multi-Frame NASA SVS Image Uploader
fileInput.addEventListener('change', (e) => {
  const files = Array.from(e.target.files || []);
  if (files.length === 0) return;

  // Sort alphabetically by filename so sequential SVS frame numbers stay in temporal order
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));

  const loadedImages = [];
  let loadedCount = 0;

  files.forEach((file, index) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        loadedImages[index] = img;
        loadedCount++;
        if (loadedCount === files.length) {
          frames = loadedImages;
          currentFrameIdx = 0;
          prevFrameIdx = 0;
          dataSourceMode = 'real-nasa';
          updateDataSourceBadge();
          syncActiveFrameToOffscreen();
          sonifyColumn(scanX, false);
          announceSR(`Successfully loaded ${frames.length} real NASA EIC image frame${frames.length > 1 ? 's' : ''}.`);
        }
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
  });
});

// Audio Legend Reference Tone Buttons
document.querySelectorAll('.tone-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const level = parseInt(btn.getAttribute('data-level'), 10);
    playReferenceTone(level);
  });
});

// Interactive Click / Pointer Scrubbing on Primary Viewport Canvas
canvas.addEventListener('pointerdown', (e) => {
  initAudioEngine();
  const rect = canvas.getBoundingClientRect();
  const relX = ((e.clientX - rect.left) / rect.width) * canvas.width;
  scanX = Math.max(0, Math.min(canvas.width - 1, relX));
  sonifyColumn(scanX, true);
});

// Global Keyboard Accessibility Shortcuts
window.addEventListener('keydown', (e) => {
  // Ignore shortcuts if user is typing in an input field
  const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    if (e.code !== 'Space') return;
  }

  if (e.code === 'Space') {
    e.preventDefault();
    togglePlay();
  } else if (e.key === 'r' || e.key === 'R') {
    e.preventDefault();
    resetScanline();
  } else if (e.key === 'w' || e.key === 'W') {
    e.preventDefault();
    setRegionMode(regionMode === 'wpac' ? 'global' : 'wpac');
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    initAudioEngine();
    const maxBound = regionMode === 'wpac' ? WPAC_BOUNDS.endX : canvas.width;
    const minBound = regionMode === 'wpac' ? WPAC_BOUNDS.startX : 0;
    scanX = (scanX + 8 >= maxBound) ? minBound : scanX + 8;
    sonifyColumn(scanX, true);
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault();
    initAudioEngine();
    const maxBound = regionMode === 'wpac' ? WPAC_BOUNDS.endX : canvas.width;
    const minBound = regionMode === 'wpac' ? WPAC_BOUNDS.startX : 0;
    scanX = (scanX - 8 < minBound) ? maxBound - 4 : scanX - 8;
    sonifyColumn(scanX, true);
  } else if (['1', '2', '3', '4'].includes(e.key)) {
    e.preventDefault();
    playReferenceTone(parseInt(e.key, 10));
  } else if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    speakAudioDescription();
  }
});

// Initialize Default Calibrated Map & Spectrum Visualizer on Startup
loadSingleCalibratedMap();
sonifyColumn(scanX, false);
requestAnimationFrame(renderSpectrumLoop);
