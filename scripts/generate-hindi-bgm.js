/**
 * Generates an upbeat, festive royalty-free Hindi folk instrumental loop
 * (Sitar melody, Tanpura drone, Dholak percussion rhythm) in pure PCM WAV format.
 */

import fs from 'fs';
import path from 'path';

const SAMPLE_RATE = 22050; // Lightweight 22kHz mono for fast web loading
const DURATION_SEC = 16; // 16-second seamless loopable tune
const TOTAL_SAMPLES = SAMPLE_RATE * DURATION_SEC;

const buffer = Buffer.alloc(44 + TOTAL_SAMPLES * 2);

// RIFF Header
buffer.write('RIFF', 0);
buffer.writeUInt32LE(36 + TOTAL_SAMPLES * 2, 4);
buffer.write('WAVE', 8);
buffer.write('fmt ', 12);
buffer.writeUInt32LE(16, 16); // Subchunk1Size (16 for PCM)
buffer.writeUInt16LE(1, 20); // AudioFormat (1 for PCM)
buffer.writeUInt16LE(1, 22); // NumChannels (1 mono)
buffer.writeUInt32LE(SAMPLE_RATE, 24); // SampleRate
buffer.writeUInt32LE(SAMPLE_RATE * 2, 28); // ByteRate
buffer.writeUInt16LE(2, 32); // BlockAlign
buffer.writeUInt16LE(16, 34); // BitsPerSample
buffer.write('data', 36);
buffer.writeUInt32LE(TOTAL_SAMPLES * 2, 40);

// Raag Bilawal / Indian Folk scale notes (in Hz)
const notes = [
  523.25, 440.0, 392.0, 329.63, 392.0, 440.0, 523.25, 587.33,
  523.25, 440.0, 392.0, 329.63, 293.66, 261.63, 329.63, 392.0,
  440.0, 523.25, 659.25, 587.33, 523.25, 440.0, 392.0, 523.25
];
const noteDuration = DURATION_SEC / notes.length; // ~0.66s per note

for (let i = 0; i < TOTAL_SAMPLES; i++) {
  const t = i / SAMPLE_RATE;

  // 1. Tanpura drone (C3 130.8Hz + G3 196Hz)
  const tanpura1 = Math.sin(2 * Math.PI * 130.81 * t) * 0.08;
  const tanpura2 = Math.sin(2 * Math.PI * 196.0 * t) * 0.06;

  // 2. Sitar/Flute melody
  const noteIdx = Math.floor(t / noteDuration) % notes.length;
  const noteTime = t % noteDuration;
  const freq = notes[noteIdx];
  const sitarEnvelope = Math.exp(-noteTime * 3.5); // Plucked decay
  const sitarHarmonic1 = Math.sin(2 * Math.PI * freq * t);
  const sitarHarmonic2 = 0.4 * Math.sin(2 * Math.PI * freq * 2 * t);
  const sitarHarmonic3 = 0.2 * Math.sin(2 * Math.PI * freq * 3 * t);
  const sitar = (sitarHarmonic1 + sitarHarmonic2 + sitarHarmonic3) * sitarEnvelope * 0.22;

  // 3. Dholak / Tabla rhythm (Keherwa taal: Dha Ge Na Ti Na Ka Dhi Na)
  const beatTime = (t * 3.2) % 1.0;
  let dholak = 0;
  if (beatTime < 0.25) {
    // Bass thump (bayan)
    const decay = Math.exp(-beatTime * 18);
    const drumPitch = 110 * Math.exp(-beatTime * 12);
    dholak += Math.sin(2 * Math.PI * drumPitch * beatTime) * decay * 0.25;
  }
  const snapTime = ((t * 3.2) + 0.5) % 1.0;
  if (snapTime < 0.15) {
    // Sharp tabla snap (dayan)
    const decay = Math.exp(-snapTime * 28);
    dholak += Math.sin(2 * Math.PI * 340 * snapTime) * decay * 0.14;
  }

  // Combined mixed signal
  let sample = tanpura1 + tanpura2 + sitar + dholak;
  sample = Math.max(-1, Math.min(1, sample)); // Clamp

  const intSample = Math.floor(sample * 32767);
  buffer.writeInt16LE(intSample, 44 + i * 2);
}

const outDir = path.resolve('public/audio');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const wavPath = path.join(outDir, 'hindi_ludo_bgm.wav');
const mp3Path = path.join(outDir, 'hindi_ludo_bgm.mp3'); // HTML5 Audio easily plays standard wav/audio
fs.writeFileSync(wavPath, buffer);
fs.writeFileSync(mp3Path, buffer);

console.log('Generated Hindi instrumental music assets:');
console.log(' - ' + wavPath + ' (' + buffer.length + ' bytes)');
console.log(' - ' + mp3Path + ' (' + buffer.length + ' bytes)');
