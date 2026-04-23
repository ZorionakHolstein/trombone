const VF = Vex.Flow;
const CONCERT_TRANSPOSE = 0;

const noteToSemitone = {
  "C":0, "D":2, "E":4, "F":5, "G":7, "A":9, "B":11
};

const scaleIntervalMap = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  natural_minor: [0, 2, 3, 5, 7, 8, 10, 12],
  harmonic_minor: [0, 2, 3, 5, 7, 8, 11, 12],
  melodic_minor: [0, 2, 3, 5, 7, 9, 11, 12]
};

const letters = ["C","D","E","F","G","A","B"];

const trombonePositions = {
  "E2":"7", "F2":"6", "F#2":"5", "Gb2":"5", "G2":"4", "Ab2":"3", "G#2":"3", "A2":"2", "Bb2":"1", "A#2":"1",
  "B2":"7", "Cb3":"7", "C3":"6", "B#2":"6", "Db3":"5", "C#3":"5", "D3":"4", "Eb3":"3", "D#3":"3", "E3":"2", "Fb3":"2", "F3":"1", "E#3":"1",
  "F#3":"5", "Gb3":"5", "G3":"4", "Ab3":"3", "G#3":"3", "A3":"2", "Bb3":"1", "A#3":"1",
  "B3":"4", "Cb4":"4", "C4":"3", "B#3":"3", "Db4":"2", "C#4":"2", "D4":"1",
  "Eb4":"3", "D#4":"3", "E4":"2", "Fb4":"2", "F4":"1",
  "F#4":"3", "Gb4":"3", "G4":"2", "Ab4":"1", "G#4":"1",
  "A4":"2", "Bb4":"1", "A#4":"1",
  "B4":"2", "Cb5":"2", "C5":"1",
  "Db5":"2", "C#5":"2", "D5":"1",
  "Eb5":"3", "D#5":"3", "E5":"2", "F5":"1"
};

const staffEl             = document.getElementById("staff");
const underRowEl          = document.getElementById("underRow");
const notationInnerEl     = document.getElementById("notationInner");

const scaleKeyEl          = document.getElementById("scaleKey");
const startOctaveEl       = document.getElementById("startOctave");
const octaveModeEl        = document.getElementById("octaveMode");
const directionModeEl     = document.getElementById("directionMode");
const holdTimeEl          = document.getElementById("holdTime");
const showFingeringsEl    = document.getElementById("showFingerings");
const highlightAccidentalsEl = document.getElementById("highlightAccidentals");
const accidentalModeEl       = document.getElementById("accidentalMode");

const startBtn     = document.getElementById("startBtn");
const resetBtn     = document.getElementById("resetBtn");
const nextBtn      = document.getElementById("nextBtn");
const playPitchBtn = document.getElementById("playPitchBtn");

const targetNoteLabel      = document.getElementById("targetNoteLabel");
const detectedConcertLabel = document.getElementById("detectedConcertLabel");
const detectedWrittenLabel = document.getElementById("detectedWrittenLabel");
const matchStatus          = document.getElementById("matchStatus");
const progressText         = document.getElementById("progressText");
const fingeringBox         = document.getElementById("fingeringBox");
const fingeringText        = document.getElementById("fingeringText");
const holdBar              = document.getElementById("holdBar");

let audioContext = null;
let analyser     = null;
let mediaStream  = null;
let dataArray    = null;
let rafId        = null;

let currentScale      = [];
let currentScaleNames = [];
let currentIndex      = 0;
let matchStartTime    = null;
let micStarted        = false;

function freqToMidi(freq){
  return Math.round(69 + 12 * Math.log2(freq / 440));
}

function midiToPreferredName(midi){
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const names = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"];
  return names[pc] + octave;
}

function parseTonic(tonic){
  const match = tonic.match(/^([A-G])([b#]?)$/);
  if(!match) return { letter: "C", accidental: "" };
  return { letter: match[1], accidental: match[2] || "" };
}

function letterIndex(letter){
  return letters.indexOf(letter);
}

function accidentalOffset(accidental){
  if(accidental === "#") return 1;
  if(accidental === "b") return -1;
  return 0;
}

function mod12(n){
  return ((n % 12) + 12) % 12;
}

function accidentalStringFromDiff(diff){
  if(diff === 1) return "#";
  if(diff === -1) return "b";
  if(diff === 2) return "##";
  if(diff === -2) return "bb";
  return "";
}

function buildScaleSpelling(tonic, scaleType = "major"){
  const tonicInfo = parseTonic(tonic);
  const startLetterIdx = letterIndex(tonicInfo.letter);
  const tonicPc = mod12(noteToSemitone[tonicInfo.letter] + accidentalOffset(tonicInfo.accidental));
  const intervals = scaleIntervalMap[scaleType] || scaleIntervalMap.major;

  const result = [];

  for(let i = 0; i < 8; i++){
    const degreeLetter = letters[(startLetterIdx + i) % 7];
    const targetPc = mod12(tonicPc + intervals[i]);
    const naturalPc = noteToSemitone[degreeLetter];
    let diff = targetPc - naturalPc;
    if(diff > 6) diff -= 12;
    if(diff < -6) diff += 12;

    result.push(degreeLetter + accidentalStringFromDiff(diff));
  }

  return result;
}

function parseScaleSelection(value){
  const [tonic = "C", scaleType = "major"] = (value || "C|major").split("|");
  return { tonic, scaleType };
}

function getKeySignatureName(tonic, scaleType){
  if(scaleType === "major") return tonic;
  return tonic + "m";
}

function spelledNoteToMidi(spelled, octave){
  const match = spelled.match(/^([A-G])(bb|##|b|#)?$/);
  if(!match) return 60;

  const letter = match[1];
  const accidental = match[2] || "";
  let pc = noteToSemitone[letter];

  if(accidental === "#") pc += 1;
  if(accidental === "b") pc -= 1;
  if(accidental === "##") pc += 2;
  if(accidental === "bb") pc -= 2;

  return (octave + 1) * 12 + pc;
}

function buildAscendingSpelledSequence(keyName, scaleType, octaves){
  const oneOct = buildScaleSpelling(keyName, scaleType);
  if(octaves === 1) return oneOct;
  if(octaves === 2) return oneOct.concat(oneOct.slice(1));
  return oneOct;
}

function assignAscendingOctaves(spelledSequence, startingOctave){
  const result = [];
  let currentOctave = parseInt(startingOctave, 10);
  let previousLetterIdx = null;

  for(const spelled of spelledSequence){
    const currentLetterIdx = letterIndex(spelled[0]);

    if(previousLetterIdx !== null && currentLetterIdx <= previousLetterIdx){
      currentOctave++;
    }

    result.push({
      name: spelled,
      octave: currentOctave
    });

    previousLetterIdx = currentLetterIdx;
  }

  return result;
}

function buildScaleData(keyName, scaleType, startingOctave, octaves = 1, direction = "updown"){
  const ascendingSpelled = buildAscendingSpelledSequence(keyName, scaleType, octaves);
  const ascendingWithOctaves = assignAscendingOctaves(ascendingSpelled, startingOctave);

  const upNames = ascendingWithOctaves.map(n => n.name + n.octave);
  const upMidis = ascendingWithOctaves.map(n => spelledNoteToMidi(n.name, n.octave));

  if(direction === "up"){
    return {
      names: upNames,
      midis: upMidis
    };
  }

  let downNames = upNames.slice(0, -1).reverse();
  let downMidis = upMidis.slice(0, -1).reverse();

  if(scaleType === "melodic_minor"){
    const descendingSpelled = buildAscendingSpelledSequence(keyName, "natural_minor", octaves);
    const descendingWithOctaves = assignAscendingOctaves(descendingSpelled, startingOctave);
    const descendingNames = descendingWithOctaves.map(n => n.name + n.octave);
    const descendingMidis = descendingWithOctaves.map(n => spelledNoteToMidi(n.name, n.octave));
    downNames = descendingNames.slice(0, -1).reverse();
    downMidis = descendingMidis.slice(0, -1).reverse();
  }

  return {
    names: upNames.concat(downNames),
    midis: upMidis.concat(downMidis)
  };
}

function splitSpelledName(fullName){
  const match = fullName.match(/^([A-G](?:bb|##|b|#)?)(-?\d)$/);
  if(!match) return { pitch: "C", octave: "3" };
  return { pitch: match[1], octave: match[2] };
}

function vexKeyFromSpelled(fullName, includeAccidental = true){
  const parts = splitSpelledName(fullName);
  const letter = parts.pitch[0].toLowerCase();
  const accidental = includeAccidental ? parts.pitch.slice(1) : "";
  const octave = parts.octave;
  return `${letter}${accidental}/${octave}`;
}

function isAccidentalName(fullName){
  const parts = splitSpelledName(fullName);
  return parts.pitch.includes("#") || parts.pitch.includes("b");
}

function normalizePositionName(fullName){
  return fullName.replace("##", "#").replace("bb", "b");
}

function getPosition(fullName){
  return trombonePositions[fullName] ||
         trombonePositions[normalizePositionName(fullName)] ||
         "—";
}

function getPitchAccidental(fullName){
  const parts = splitSpelledName(fullName);
  return parts.pitch.slice(1);
}

function buildKeySignatureAccidentalMap(keySignatureName){
  const tonic = keySignatureName.endsWith("m") ? keySignatureName.slice(0, -1) : keySignatureName;
  const scaleType = keySignatureName.endsWith("m") ? "natural_minor" : "major";
  const spelling = buildScaleSpelling(tonic, scaleType);
  const map = {};

  spelling.slice(0, 7).forEach(note => {
    map[note[0]] = note.slice(1);
  });

  return map;
}

function getDisplayAccidentalForKeySignature(fullName, keySignatureName){
  const pitchLetter = fullName[0];
  const actualAccidental = getPitchAccidental(fullName);
  const signatureMap = buildKeySignatureAccidentalMap(keySignatureName);
  const keySigAccidental = signatureMap[pitchLetter] || "";

  if(actualAccidental === keySigAccidental) return "";
  if(actualAccidental === "") return "n";
  return actualAccidental;
}

function ensureAudioContext(){
  if(!audioContext){
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  if(audioContext.state === "suspended"){
    return audioContext.resume();
  }
  return Promise.resolve();
}

async function playStartingPitch(durationMs = 900) {
	if (!currentScale.length) return;
	await ensureAudioContext();

	const targetName = currentScaleNames[0];
	const parts = splitSpelledName(targetName);
	const midi = spelledNoteToMidi(parts.pitch, parseInt(parts.octave, 10));
	const freq = 440 * Math.pow(2, (midi - 69) / 12);
	const now = audioContext.currentTime;
	const durationSec = durationMs / 1000;

	// main oscillator
	const oscillator = audioContext.createOscillator();
	// harmonics
	const real = new Float32Array([
		0, 1.0,
		0.9, 0.7,
		0.5, 0.35,
		0.25, 0.15
	]);
	const imag = new Float32Array(real.length);
	const wave = audioContext.createPeriodicWave(real, imag);
	
	oscillator.setPeriodicWave(wave);
	oscillator.frequency.setValueAtTime(freq, now);

	// gain 
	const gain = audioContext.createGain();
	gain.gain.setValueAtTime(0.0001, now);
	gain.gain.exponentialRampToValueAtTime(0.25, now + 0.08);
	gain.gain.exponentialRampToValueAtTime(0.18, now + 0.25);
	gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

	// low pass filter
	const filter = audioContext.createBiquadFilter();
	filter.type = "lowpass";
	filter.frequency.setValueAtTime(800, now);
	filter.frequency.exponentialRampToValueAtTime(2200, now + 0.1);
	filter.frequency.exponentialRampToValueAtTime(1200, now + durationSec);

	// vibratoOoOoOoOoOoOoOoOoOoOo!
	const lfo = audioContext.createOscillator();
	const lfoGain = audioContext.createGain();

	lfo.frequency.setValueAtTime(5.5, now); // this is the speed.
	lfoGain.gain.setValueAtTime(3, now); // this is the depth in hertz

	lfo.connect(lfoGain);
	lfoGain.connect(oscillator.frequency);

	// another oscillator
	const oscillator2 = audioContext.createOscillator();
	oscillator2.type = "sawtooth";
	oscillator2.frequency.setValueAtTime(freq, now);
	// ... and that oscillator's gain
	const gain2 = audioContext.createGain();
	gain2.gain.setValueAtTime(0.05, now);
	gain2.gain.exponentialRampToValueAtTime(0.05, now + 0.08);
	gain2.gain.exponentialRampToValueAtTime(0.03, now + 0.25);
	gain2.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

	// another low pass filter
	const filter2 = audioContext.createBiquadFilter();
	filter2.type = "lowpass";
	filter2.frequency.setValueAtTime(800, now);
	filter2.frequency.exponentialRampToValueAtTime(2200, now + 0.1);
	filter2.frequency.exponentialRampToValueAtTime(1200, now + durationSec);

	// connection graph for osc1.
	oscillator.connect(filter);
	filter.connect(gain);
	gain.connect(audioContext.destination);
	// connection graph for osc2
	oscillator2.connect(filter2);
	filter2.connect(gain2);
	gain2.connect(audioContext.destination);

	oscillator.start(now);
	oscillator.stop(now + durationSec + 0.05);
	oscillator2.start(now);
	oscillator2.stop(now + durationSec + 0.05);
	lfo.start(now);
	lfo.stop(now + durationSec + 0.05);
}
	
function updateLabels(){
  if(!currentScale.length){
    targetNoteLabel.textContent = "—";
    progressText.textContent = "0 / 0";
    fingeringText.textContent = "—";
    return;
  }

  const targetName = currentScaleNames[currentIndex];
  targetNoteLabel.textContent = targetName;
  progressText.textContent = `${currentIndex + 1} / ${currentScale.length}`;

  if(showFingeringsEl.checked){
    fingeringBox.style.display = "block";
    fingeringText.textContent = getPosition(targetName);
  } else {
    fingeringBox.style.display = "none";
  }
}

function renderUnderRow(width){
  underRowEl.innerHTML = "";
  underRowEl.style.gridTemplateColumns = `repeat(${currentScaleNames.length}, 1fr)`;
  notationInnerEl.style.width = `${width}px`;

  currentScaleNames.forEach((name, i) => {
    const cell = document.createElement("div");
    cell.className = "underCell";
    if(i === currentIndex) cell.classList.add("current");
    else if(highlightAccidentalsEl.checked && isAccidentalName(name)) cell.classList.add("accidental");

    const noteDiv = document.createElement("div");
    noteDiv.className = "underNote";
    noteDiv.textContent = name;

    const fingeringDiv = document.createElement("div");
    fingeringDiv.className = "underFinger";
    fingeringDiv.textContent = showFingeringsEl.checked ? getPosition(name) : "";

    cell.appendChild(noteDiv);
    cell.appendChild(fingeringDiv);
    underRowEl.appendChild(cell);
  });
}

function renderStaff(){
  staffEl.innerHTML = "";

  const width = Math.max(1080, /* 220 + */ (currentScale.length * 64));
  const height = 220;
  const useKeySignature = accidentalModeEl.value === "keysig";
  const { tonic: selectedTonic, scaleType: selectedScaleType } = parseScaleSelection(scaleKeyEl.value);
  const keySignatureName = getKeySignatureName(selectedTonic, selectedScaleType);

  const renderer = new VF.Renderer(staffEl, VF.Renderer.Backends.SVG);
  renderer.resize(width, height);
  const context = renderer.getContext();

  const stave = new VF.Stave(20, 40, width - 40);
  stave.addClef("bass");
  if(useKeySignature){
    stave.addKeySignature(keySignatureName);
  }
  stave.addTimeSignature("4/4");
  stave.setContext(context).draw();

  const notes = currentScaleNames.map((name, i) => {
    const parts = splitSpelledName(name);
    const accidental = parts.pitch.slice(1);
    const displayAccidental = useKeySignature
      ? getDisplayAccidentalForKeySignature(name, keySignatureName)
      : accidental;

    const staveNote = new VF.StaveNote({
      clef: "bass",
      keys: [vexKeyFromSpelled(name, false)],
      duration: "q"
    });

    if(displayAccidental){
      staveNote.addModifier(new VF.Accidental(displayAccidental), 0);
    }

    if(i === currentIndex){
      staveNote.setStyle({
        fillStyle: "#2563eb",
        strokeStyle: "#2563eb"
      });
    } else if(highlightAccidentalsEl.checked && accidental){
      staveNote.setStyle({
        fillStyle: "#f59e0b",
        strokeStyle: "#f59e0b"
      });
    }

    return staveNote;
  });

  const voice = new VF.Voice({ numBeats: notes.length, beatValue: 4 });
  voice.setStrict(false);
  voice.addTickables(notes);

  new VF.Formatter().joinVoices([voice]).format([voice], width - 90);
  voice.draw(context, stave);

  renderUnderRow(width);
}

function rebuildScale(playReference = false){
  const selection = parseScaleSelection(scaleKeyEl.value);
  const data = buildScaleData(
    selection.tonic,
    selection.scaleType,
    startOctaveEl.value,
    parseInt(octaveModeEl.value, 10),
    directionModeEl.value
  );

  currentScale = data.midis;
  currentScaleNames = data.names;
  currentIndex = 0;
  matchStartTime = null;
  holdBar.style.width = "0%";
  updateLabels();
  renderStaff();
  matchStatus.textContent = "Waiting";
  matchStatus.className = "big";

  if(playReference){
    playStartingPitch().catch(err => console.error("Reference pitch failed:", err));
  }
}

function nextNote(){
  if(currentIndex < currentScale.length - 1){
    currentIndex++;
    matchStartTime = null;
    holdBar.style.width = "0%";
    updateLabels();
    renderStaff();
  } else {
    matchStatus.textContent = "Scale complete";
    matchStatus.className = "big good";
    holdBar.style.width = "100%";
  }
}

function autoCorrelate(buffer, sampleRate){
  let SIZE = buffer.length;
  let rms = 0;
  for(let i = 0; i < SIZE; i++){
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if(rms < 0.01) return -1;

  let r1 = 0, r2 = SIZE - 1, thresh = 0.2;
  for(let i = 0; i < SIZE / 2; i++){
    if(Math.abs(buffer[i]) < thresh){
      r1 = i;
      break;
    }
  }
  for(let i = 1; i < SIZE / 2; i++){
    if(Math.abs(buffer[SIZE - i]) < thresh){
      r2 = SIZE - i;
      break;
    }
  }

  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;

  const c = new Array(SIZE).fill(0);
  for(let i = 0; i < SIZE; i++){
    for(let j = 0; j < SIZE - i; j++){
      c[i] += buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while(c[d] > c[d + 1]) d++;

  let maxval = -1;
  let maxpos = -1;
  for(let i = d; i < SIZE; i++){
    if(c[i] > maxval){
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;
  const x1 = c[T0 - 1] || c[T0];
  const x2 = c[T0];
  const x3 = c[T0 + 1] || c[T0];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if(a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
}

function concertMidiToStaffName(concertMidi){
  return midiToPreferredName(concertMidi + CONCERT_TRANSPOSE);
}

function setWaitingDisplay(){
  detectedConcertLabel.textContent = "—";
  detectedWrittenLabel.textContent = "—";
  matchStatus.textContent = "Waiting";
  matchStatus.className = "big";
  holdBar.style.width = "0%";
  matchStartTime = null;
}

function updateMatchStatus(text, cls){
  matchStatus.textContent = text;
  matchStatus.className = `big ${cls || ""}`.trim();
}

function processPitch(){
  if(!analyser || !dataArray) return;

  analyser.getFloatTimeDomainData(dataArray);
  const freq = autoCorrelate(dataArray, audioContext.sampleRate);

  if(freq === -1 || !isFinite(freq)){
    setWaitingDisplay();
    rafId = requestAnimationFrame(processPitch);
    return;
  }

  const detectedConcertMidi = freqToMidi(freq);
  const detectedStaffMidi = detectedConcertMidi + CONCERT_TRANSPOSE;

  const concertName = midiToPreferredName(detectedConcertMidi);
  const staffName = concertMidiToStaffName(detectedConcertMidi);

  detectedConcertLabel.textContent = concertName;
  detectedWrittenLabel.textContent = staffName;

  const targetMidi = currentScale[currentIndex];
  const holdRequired = parseInt(holdTimeEl.value, 10) || 600;

  if(detectedStaffMidi === targetMidi){
    updateMatchStatus("Correct", "good");

    if(matchStartTime === null){
      matchStartTime = performance.now();
    }

    const elapsed = performance.now() - matchStartTime;
    const pct = Math.min(100, (elapsed / holdRequired) * 100);
    holdBar.style.width = pct + "%";

    if(elapsed >= holdRequired){
      nextNote();
    }
  } else {
    const diff = detectedStaffMidi - targetMidi;
    if(diff < 0){
      updateMatchStatus("Too low", "bad");
    } else {
      updateMatchStatus("Too high", "bad");
    }
    matchStartTime = null;
    holdBar.style.width = "0%";
  }

  rafId = requestAnimationFrame(processPitch);
}

async function startMic(){
  try{
    if(micStarted) return;

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;

    source.connect(analyser);
    dataArray = new Float32Array(analyser.fftSize);

    micStarted = true;
    startBtn.textContent = "Mic Running";
    startBtn.disabled = true;

    await playStartingPitch();
    processPitch();
  } catch(err){
    alert("Microphone access failed. Please allow the mic and try again.\n\n" + err.message);
  }
}

function stopMic(){
  if(rafId) cancelAnimationFrame(rafId);
  if(mediaStream){
    mediaStream.getTracks().forEach(t => t.stop());
  }
  if(audioContext){
    audioContext.close();
  }
  micStarted = false;
  rafId = null;
  audioContext = null;
  analyser = null;
  mediaStream = null;
  dataArray = null;
  startBtn.textContent = "Start Mic";
  startBtn.disabled = false;
}

startBtn.addEventListener("click", startMic);
resetBtn.addEventListener("click", () => rebuildScale(true));
nextBtn.addEventListener("click", nextNote);
playPitchBtn.addEventListener("click", () => {
  playStartingPitch().catch(err => console.error("Reference pitch failed:", err));
});

scaleKeyEl.addEventListener("change", rebuildScale);
startOctaveEl.addEventListener("change", rebuildScale);
octaveModeEl.addEventListener("change", rebuildScale);
directionModeEl.addEventListener("change", rebuildScale);
showFingeringsEl.addEventListener("change", () => {
  updateLabels();
  renderStaff();
});
highlightAccidentalsEl.addEventListener("change", renderStaff);
accidentalModeEl.addEventListener("change", renderStaff);

window.addEventListener("beforeunload", stopMic);

rebuildScale();
