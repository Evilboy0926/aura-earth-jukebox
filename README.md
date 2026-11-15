# AURA-EARTH: Spatial & Temporal Sonification Jukebox for NASA EIC

> **2026 NASA Space Apps Challenge Submission**
> - **Challenge:** *The Earth Information Jukebox*
> - **Local Event:** Legazpi City, Albay, Philippines ( & Global Award Judging )
> - **Architecture:** 100% Client-Side Vanilla HTML5 Canvas + W3C Web Audio API + W3C Web Speech API (Zero External Runtime Dependencies)

---

## 1. Executive Summary

**AURA-EARTH** is an interactive, browser-native sonification jukebox that translates visual data frames from **NASA’s Earth Information Center (EIC)** and **NASA’s Scientific Visualization Studio (SVS)** into real-time, spatialized 3D stereo soundscapes.

While NASA’s EIC captures critical planetary changes—from marine heatwaves in the Philippine Sea to global tropical precipitation, active wildfires, and ocean boundary currents—relying purely on visual media limits accessibility for the 2.2+ billion people worldwide with blindness or low vision. AURA-EARTH bridges sight and sound by scanning satellite visualization frames column by column (`180°W` to `180°E`), mapping calibrated colorbar anomalies into a harmonious **16-note C-Lydian musical scale**.

---

## 2. Core Features & Technical Architecture

### A. Real-Time Computer Vision Pixel Pipeline (`HTML5 Canvas 2D`)
- **Equirectangular Longitude Scanner:** Sweeps across an `800 x 400` viewport from `180°W` (Left Audio Channel, `-1.0` pan) to `180°E` (Right Audio Channel, `+1.0` pan).
- **16-Band Latitude Quantizer:** Slices each vertical pixel column into 16 latitude bands from `90°S` (South Pole) to `90°N` (North Pole).
- **4 Calibrated NASA SVS Scientific Profiles:**
  1. **Sea Surface Temperature (SST) Anomaly (`NASA SVS ID 5176`):** Extracts warm thermal anomalies (orange/red marine heatwaves) vs. cool baseline waters.
  2. **Global Precipitation GPM Constellation (`NASA SVS ID 4285`):** Tracks IMERG cyan/green rainbands and magenta/white tropical cyclone cores.
  3. **Active Fires VIIRS (`NASA SVS ID 5113`):** Detects high-luminance orange/amber wildfire spikes over continental landmasses.
  4. **Perpetual Ocean 2: Western Boundary Currents (`NASA SVS ID 5425`):** Maps high-velocity ocean streamlines such as the Kuroshio Current (east of Luzon/Bicol) and the Gulf Stream.
- **Multi-Frame Time-Series Sequencer & Temporal Delta ($\Delta$):** Supports uploading multiple sequential NASA SVS `.png`/`.jpg` frames (or activating a built-in 4-frame calibrated time-series) to compute frame-to-frame pixel change ($\Delta$) and modulate filter cutoff and telemetry.
- **Transparent Data Source Mode Indicator:** Clearly distinguishes between `Mode: Built-in Calibrated EIC Map`, `Mode: Calibrated 4-Frame Time-Series (Demo)`, and `Mode: Real NASA SVS EIC Frames (N loaded)`.

### B. Mathematical Web Audio API Synthesis (`Zero Pre-Recorded Audio Loops`)
- **16-Note C-Lydian Scale (`C3` 130.81 Hz to `D5` 587.33 Hz):** Prevents auditory fatigue and discordant noise by quantizing active latitude bands into consonant Lydian intervals (`C, D, E, F#, G, A, B`).
- **3-Voice Polyphonic Allocation + Planetary Drone:** Synthesizes the top 3 active latitude anomalies per column alongside a subtle `C2` (`65.41 Hz`) planetary equilibrium drone.
- **Dynamic Timbre & Low-Pass Filtering:** Transitions smoothly from pure `sine` waves (baseline `0–25%`) to warm `sine` (`26–50%`), `triangle` (`51–75%`), and harmonic `sawtooth` (`76–100%` extreme anomalies) routed through a modulated `BiquadFilterNode`.
- **Real-Time Spectrum & Oscilloscope Visualizer:** Secondary `800 x 90` canvas driven by a Web Audio `AnalyserNode` (`getByteFrequencyData` + `getByteTimeDomainData`).
- **Live Browser `.webm` Audio Recorder:** Built-in `MediaStreamAudioDestinationNode` + `MediaRecorder` exports real-time sonification sessions as downloadable `.webm` audio files.

### C. Blind & Low-Vision Accessibility Architecture
- **4-Level Calibrated Audio Legend (`Keys 1–4`):** Allows listeners to audition `[1] Baseline (C3 Sine)`, `[2] Moderate (G3 Sine)`, `[3] Elevated (E4 Triangle)`, and `[4] Extreme (B4 Sawtooth)` before playing the map.
- **Spoken Telemetry Narration (`Key N`):** Uses the W3C Web Speech API (`window.speechSynthesis`) to speak the active NASA dataset, data mode, longitude, stereo pan position, anomaly percentage, and musical note on demand.
- **Western Pacific / Philippine Sea & Bicol Focus (`Key W`):** Focuses the longitudinal sweep on `115°E–150°E` (highlighting `120°E–140°E, 5°N–20°N`) with expanded stereo panning so coastal communities in Legazpi City, Bicol, and the Philippines can hear local ocean warming and approaching tropical systems.

---

## 3. Keyboard Shortcuts & Accessibility Controls

| Key / Control | Action | Accessibility Purpose |
| :--- | :--- | :--- |
| **`Space`** | Play / Pause Jukebox Sweep | Start or pause real-time longitudinal sonification |
| **`ArrowLeft` / `ArrowRight`** | Scrub Longitude West / East | Manually step across longitudes and hear instant slice audio |
| **`1`, `2`, `3`, `4`** | Play Audio Legend Reference Tones | Learn the 4 calibrated acoustic intensity tiers by ear |
| **`N`** | Speak Telemetry & Audio Description | Trigger W3C Web Speech API spoken readout of current slice |
| **`W`** | Toggle Western Pacific / Bicol Focus | Switch between Global Sweep and Philippine Sea / Bicol sector |
| **`R`** | Reset Scanline | Return scanline to the start of the active sector |

---

## 4. Quick Start & Loading Official NASA SVS EIC Frames

### Running Locally (Zero Build Step)
1. Clone or download this repository.
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari) or serve locally:
   ```bash
   npx serve .
   ```
3. Open `slides.html` to view the 7-slide presentation deck (press `Ctrl+P` / `Cmd+P` -> **Save as PDF** with **Background graphics** enabled).

### Loading Real NASA SVS EIC Frames in 60 Seconds
1. Visit any of the official NASA Scientific Visualization Studio pages below and download 1 to 5 high-resolution `.png` or `.jpg` visualization frames:
   - **SST Anomaly (SVS 5176):** https://svs.gsfc.nasa.gov/5176
   - **Global Precipitation GPM (SVS 4285):** https://svs.gsfc.nasa.gov/4285
   - **Active Fires VIIRS (SVS 5113):** https://svs.gsfc.nasa.gov/5113
   - **Perpetual Ocean 2 Currents (SVS 5425):** https://svs.gsfc.nasa.gov/5425
2. In **AURA-EARTH**, select the matching **Scientific Color-Mapping Profile** in Panel 1.
3. Click **Upload Real NASA SVS EIC Frame(s)** and select your downloaded image file(s).
4. Notice the top status badge automatically updates to **`Mode: Real NASA SVS EIC Frames (N loaded)`** and press **`Space`** to listen!

---

## 5. Official NASA Data & Open Standards References

- **NASA Earth Information Center (EIC) Gallery:** https://svs.gsfc.nasa.gov/gallery/earth-information-center/
- **NASA SVS Daily Visualizations Gallery:** https://svs.gsfc.nasa.gov/gallery/daily-visualizations/
- **NASA SVS ID 5176 — Sea Surface Temperature (SST) Anomaly:** https://svs.gsfc.nasa.gov/5176
- **NASA SVS ID 4285 — Near Real-Time Global Precipitation (GPM):** https://svs.gsfc.nasa.gov/4285
- **NASA SVS ID 5113 — Active Fires As Observed by VIIRS:** https://svs.gsfc.nasa.gov/5113
- **NASA SVS ID 5425 — Perpetual Ocean 2: Western Boundary Currents:** https://svs.gsfc.nasa.gov/5425
- **W3C Web Audio API Specification:** https://www.w3.org/TR/webaudio/
- **WHATWG HTML5 Canvas 2D Context Standard:** https://html.spec.whatwg.org/multipage/canvas.html
- **W3C Web Speech API Specification:** https://wicg.github.io/speech-api/

---

## 6. Super Intelligence (SI) / AI Disclosure & Brand Compliance

- **AI / Super Intelligence Disclosure:** Generative AI (Google Gemini / Antigravity) was used during the hackathon window to assist with brainstorming the spatial audio mapping architecture, scaffolding HTML5/CSS3/JS code, and structuring documentation. All scientific visual data frames come from NASA's Scientific Visualization Studio (SVS) / calibrated procedural canvas, and all audio is synthesized mathematically in real time via W3C Web Audio API oscillators (zero AI-generated audio, video, or image assets are used).
- **NASA Brand Compliance:** In strict accordance with NASA Space Apps Challenge rules, zero NASA logos, insignias, flags, or branding appear anywhere in the application UI, source code, slide deck, or demonstration video.
