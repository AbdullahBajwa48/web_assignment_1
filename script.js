/* =========================================================
   TYPING TEST — script.js
   All test logic: word generation, input handling, timing,
   caret movement, scrolling and result calculation.
   ========================================================= */

/* ---------- WORD BANK ---------- */
const WORD_BANK = [
  "the","be","to","of","and","a","in","that","have","it","for","not","on","with","he",
  "as","you","do","at","this","but","his","by","from","they","we","say","her","she","or",
  "an","will","my","one","all","would","there","their","what","so","up","out","if","about",
  "who","get","which","go","me","when","make","can","like","time","no","just","him","know",
  "take","people","into","year","your","good","some","could","them","see","other","than",
  "then","now","look","only","come","its","over","think","also","back","after","use","two",
  "how","our","work","first","well","way","even","new","want","because","any","these","give",
  "day","most","us","is","water","long","find","here","thing","great","man","world","life",
  "still","should","between","need","home","right","under","while","last","never","few",
  "same","form","large","program","real","both","however","however","tell","during","say",
  "small","every","found","still","between","name","should","house","might","state","again",
  "school","show","every","each","government","system","part","place","help","low","hand",
  "keep","student","turn","problem","fact","hard","point","open","seem","together","next",
  "white","children","begin","got","walk","example","ease","paper","group","always","music",
  "those","both","mark","often","letter","until","mile","river","car","feet","care","second",
  "book","carry","science","eat","room","friend","begin","idea","fish","mountain","stop",
  "once","base","hear","horse","cut","sure","watch","color","face","wood","main","enough",
  "plain","girl","usual","young","ready","above","ever","red","list","though","feel","talk",
  "bird","soon","body","dog","family","direct","pose","leave","song","measure","door","product",
  "black","short","numeral","class","wind","question","happen","complete","ship","area","half",
  "rock","order","fire","south","problem","piece","told","knew","pass","since","top","whole",
  "king","space","heard","best","hour","better","true","during","hundred","five","remember",
  "step","early","hold","west","ground","interest","reach","fast","verb","sing","listen","six",
  "table","travel","less","morning","ten","simple","several","vowel","toward","war","lay",
  "against","pattern","slow","center","love","person","money","serve","appear","road","map",
  "rain","rule","govern","pull","cold","notice","voice","unit","power","town","fine","certain",
  "fly","fall","lead","cry","dark","machine","note","wait","plan","figure","star","box"
];

const QUOTES = [
  "Simplicity is the ultimate sophistication and it takes real courage to move in that direction once you have started down the path of an idea.",
  "The only way to do great work is to love what you do, and if you have not found it yet keep looking and do not settle.",
  "In the middle of every difficulty lies opportunity waiting quietly for someone patient enough to notice it and act.",
  "Code is like humor, when you have to explain it, it is bad and everyone can tell that something went wrong along the way.",
  "The best way to predict the future is to invent it yourself rather than waiting around for someone else to build it."
];

/* ---------- DOM REFERENCES ---------- */
const wordsEl = document.getElementById("words");
const wordsWrapperEl = document.getElementById("wordsWrapper");
const typeAreaEl = document.getElementById("typeArea");
const hiddenInput = document.getElementById("hiddenInput");
const liveStatsEl = document.getElementById("liveStats");
const amountsGroup = document.getElementById("amountsGroup");
const restartBtn = document.getElementById("restartBtn");
const nextTestBtn = document.getElementById("nextTestBtn");
const resultsOverlay = document.getElementById("resultsOverlay");

const punctuationBtn = document.getElementById("punctuationBtn");
const numbersBtn = document.getElementById("numbersBtn");
const modeBtns = document.querySelectorAll(".mode-btn");

/* result fields */
const resWpm = document.getElementById("resWpm");
const resAcc = document.getElementById("resAcc");
const resRaw = document.getElementById("resRaw");
const resChars = document.getElementById("resChars");
const resTime = document.getElementById("resTime");
const resMode = document.getElementById("resMode");

/* caret element (created dynamically so it can be repositioned smoothly) */
const caretEl = document.createElement("div");
caretEl.className = "caret";
caretEl.style.position = "absolute";
caretEl.style.width = "2px";
caretEl.style.background = "var(--caret)";
caretEl.style.borderRadius = "1px";
caretEl.style.transition = "left .08s ease, top .08s ease";
caretEl.style.animation = "caret-blink 1s steps(1) infinite";
wordsWrapperEl.style.position = "relative";
wordsWrapperEl.appendChild(caretEl);

/* the caret should stay solid (no blinking) while the user is actively
   typing, and only start blinking again once they pause — this timer
   tracks that "idle" state. */
let caretIdleTimer = null;
const CARET_IDLE_DELAY = 500; // ms of inactivity before the caret resumes blinking

function markCaretActive() {
  caretEl.style.animation = "none"; // stop blinking
  caretEl.style.opacity = "1";      // keep it fully visible while typing
  clearTimeout(caretIdleTimer);
  caretIdleTimer = setTimeout(() => {
    caretEl.style.animation = "caret-blink 1s steps(1) infinite";
  }, CARET_IDLE_DELAY);
}

/* ---------- STATE ---------- */
const AMOUNTS = {
  time: [15, 30, 60, 120],
  words: [10, 25, 50, 100]
};

const state = {
  mode: "time",          // time | words | quote | zen | custom
  amount: 15,             // seconds for time mode, word count for words/custom mode
  punctuation: false,
  numbers: false,
  words: [],              // target word strings
  wordElements: [],        // {el, charsEls[]}
  typed: [],               // typed string per word index
  currentIndex: 0,
  started: false,
  finished: false,
  startTime: null,
  timeLeft: 15,
  timerInterval: null,
  stats: { correct: 0, incorrect: 0, extra: 0, missed: 0 }
};

/* =========================================================
   TEXT GENERATION
   ========================================================= */

function pickRandomWord(prevWord) {
  let word;
  do {
    word = WORD_BANK[Math.floor(Math.random() * WORD_BANK.length)];
  } while (word === prevWord && WORD_BANK.length > 1);
  return word;
}

/* Apply punctuation / number variations to a plain word list */
function applyExtras(rawWords) {
  const result = [];
  let capitalizeNext = true;

  for (let i = 0; i < rawWords.length; i++) {
    let word = rawWords[i];

    if (state.numbers && Math.random() < 0.11) {
      word = String(Math.floor(Math.random() * 9000) + 10);
    }

    if (state.punctuation) {
      if (capitalizeNext && /^[a-z]/.test(word)) {
        word = word[0].toUpperCase() + word.slice(1);
      }
      capitalizeNext = false;

      const r = Math.random();
      if (r < 0.05) { word += ","; }
      else if (r < 0.08) { word += "."; capitalizeNext = true; }
      else if (r < 0.09) { word += "!"; capitalizeNext = true; }
      else if (r < 0.10) { word += "?"; capitalizeNext = true; }
    }
    result.push(word);
  }
  return result;
}

/* Generate `count` random words honouring current toggles */
function generateText(count) {
  const raw = [];
  let prev = null;
  for (let i = 0; i < count; i++) {
    const w = pickRandomWord(prev);
    raw.push(w);
    prev = w;
  }
  return applyExtras(raw);
}

/* =========================================================
   RENDERING
   ========================================================= */

function buildWordElement(word) {
  const wordDiv = document.createElement("div");
  wordDiv.className = "word";
  const chars = [];
  for (const ch of word) {
    const span = document.createElement("span");
    span.className = "char";
    span.textContent = ch;
    wordDiv.appendChild(span);
    chars.push(span);
  }
  return { el: wordDiv, chars };
}

function renderAllWords() {
  wordsEl.innerHTML = "";
  state.wordElements = state.words.map((w) => {
    const built = buildWordElement(w);
    wordsEl.appendChild(built.el);
    return built;
  });
  state.wordElements[0].el.classList.add("current-word");
}

function appendMoreWords(count) {
  const extra = generateText(count);
  extra.forEach((w) => {
    state.words.push(w);
    const built = buildWordElement(w);
    wordsEl.appendChild(built.el);
    state.wordElements.push(built);
  });
}

/* =========================================================
   MODE / AMOUNT CONTROLS
   ========================================================= */

function renderAmountButtons() {
  amountsGroup.innerHTML = "";

  if (state.mode === "time" || state.mode === "words") {
    const list = AMOUNTS[state.mode];
    list.forEach((val) => {
      const btn = document.createElement("button");
      btn.className = "amount-btn" + (val === state.amount ? " active" : "");
      btn.textContent = val;
      btn.addEventListener("click", () => {
        state.amount = val;
        resetTest();
      });
      amountsGroup.appendChild(btn);
    });
  } else if (state.mode === "custom") {
    const input = document.createElement("input");
    input.type = "number";
    input.min = "5";
    input.max = "300";
    input.value = state.amount;
    input.className = "amount-btn";
    input.style.width = "60px";
    input.style.background = "transparent";
    input.style.border = "none";
    input.style.color = "var(--main)";
    input.style.fontFamily = "inherit";
    input.addEventListener("change", () => {
      const v = parseInt(input.value, 10);
      state.amount = Number.isFinite(v) && v > 0 ? v : 25;
      resetTest();
    });
    amountsGroup.appendChild(input);
  }
  /* quote / zen modes: no amount selector needed */
}

function setMode(mode) {
  state.mode = mode;
  modeBtns.forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));

  if (mode === "time") state.amount = AMOUNTS.time[0];
  else if (mode === "words") state.amount = AMOUNTS.words[0];
  else if (mode === "custom") state.amount = 25;

  renderAmountButtons();
  resetTest();
}

modeBtns.forEach((btn) => {
  btn.addEventListener("click", () => setMode(btn.dataset.mode));
});

punctuationBtn.addEventListener("click", () => {
  state.punctuation = !state.punctuation;
  punctuationBtn.classList.toggle("active", state.punctuation);
  resetTest();
});

numbersBtn.addEventListener("click", () => {
  state.numbers = !state.numbers;
  numbersBtn.classList.toggle("active", state.numbers);
  resetTest();
});

/* =========================================================
   TEST LIFECYCLE
   ========================================================= */

function buildInitialWords() {
  if (state.mode === "quote") {
    const quote = QUOTES[Math.floor(Math.random() * QUOTES.length)];
    state.words = quote.split(" ");
  } else if (state.mode === "words" || state.mode === "custom") {
    state.words = generateText(state.amount);
  } else if (state.mode === "zen") {
    state.words = generateText(30); // zen shows a soft backdrop of words; freeform stats still tracked
  } else {
    // time mode: generate a generous initial batch, more appended as needed
    state.words = generateText(60);
  }
}

function resetTest() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  state.started = false;
  state.finished = false;
  state.startTime = null;
  state.currentIndex = 0;
  state.typed = [];
  state.stats = { correct: 0, incorrect: 0, extra: 0, missed: 0 };
  state.timeLeft = state.mode === "time" ? state.amount : 0;

  resultsOverlay.classList.remove("show");
  typeAreaEl.classList.remove("blurred");

  // the previous test may have scrolled the word box down as the user
  // progressed through lines — snap it back to the top before drawing
  // the new text, otherwise the new words render mid-scroll and get
  // clipped by the fixed-height overflow:hidden wrapper.
  wordsWrapperEl.scrollTop = 0;

  buildInitialWords();
  renderAllWords();
  wordsWrapperEl.scrollTop = 0;
  updateCaret();

  // fresh test, nothing typed yet — caret should idle-blink right away
  clearTimeout(caretIdleTimer);
  caretEl.style.animation = "caret-blink 1s steps(1) infinite";
  updateLiveStats();

  hiddenInput.value = "";
  focusInput();
}

function focusInput() {
  hiddenInput.focus({ preventScroll: true });
}

function startTestIfNeeded() {
  if (state.started || state.finished) return;
  state.started = true;
  state.startTime = Date.now();

  if (state.mode === "time") {
    state.timerInterval = setInterval(() => {
      state.timeLeft -= 1;
      updateLiveStats();
      if (state.timeLeft <= 0) {
        endTest();
      }
    }, 1000);
  }
}

function updateLiveStats() {
  if (state.mode === "time") {
    liveStatsEl.textContent = state.started ? String(Math.max(0, state.timeLeft)) : String(state.amount);
  } else if (state.mode === "words" || state.mode === "custom") {
    liveStatsEl.textContent = `${state.currentIndex}/${state.words.length}`;
  } else if (state.mode === "quote") {
    liveStatsEl.textContent = `${state.currentIndex}/${state.words.length}`;
  } else {
    liveStatsEl.textContent = state.started ? "zen" : "";
  }
}

/* Finalize scoring for one word once it's left behind (space pressed or test end) */
function finalizeWord(index) {
  const target = state.words[index] ?? "";
  const typed = state.typed[index] ?? "";
  const max = Math.max(target.length, typed.length);
  for (let i = 0; i < max; i++) {
    if (i < typed.length && i < target.length) {
      if (typed[i] === target[i]) state.stats.correct++;
      else state.stats.incorrect++;
    } else if (i < typed.length) {
      state.stats.extra++;
    } else {
      state.stats.missed++;
    }
  }
}

function endTest() {
  if (state.finished) return;
  state.finished = true;
  clearInterval(state.timerInterval);

  // finalize the word currently being typed (partial credit) if it has content
  if (state.typed[state.currentIndex] !== undefined) {
    finalizeWord(state.currentIndex);
  }

  showResults();
}

function showResults() {
  const elapsedMs = state.startTime ? Date.now() - state.startTime : 0;
  const elapsedSeconds = Math.max(elapsedMs / 1000, 0.5);
  const minutes = elapsedSeconds / 60;

  const { correct, incorrect, extra, missed } = state.stats;
  const totalTyped = correct + incorrect + extra;

  const wpm = Math.round((correct / 5) / minutes) || 0;
  const raw = Math.round((totalTyped / 5) / minutes) || 0;
  const acc = totalTyped > 0 ? Math.round((correct / totalTyped) * 1000) / 10 : 0;

  resWpm.textContent = wpm;
  resRaw.textContent = raw;
  resAcc.textContent = `${acc}%`;
  resChars.textContent = `${correct}/${incorrect}/${extra}/${missed}`;
  resTime.textContent = `${Math.round(elapsedSeconds)}s`;

  let modeLabel = state.mode;
  if (state.mode === "time" || state.mode === "words") modeLabel = `${state.mode} ${state.amount}`;
  resMode.textContent = modeLabel;

  resultsOverlay.classList.add("show");
}

/* =========================================================
   CARET + SCROLL
   ========================================================= */

function updateCaret() {
  const current = state.wordElements[state.currentIndex];
  if (!current) return;
  const typedLen = (state.typed[state.currentIndex] || "").length;

  let rect;
  if (typedLen < current.chars.length) {
    rect = current.chars[typedLen].getBoundingClientRect();
  } else if (current.chars.length > 0) {
    const last = current.chars[current.chars.length - 1].getBoundingClientRect();
    rect = { left: last.right, top: last.top, height: last.height };
  } else {
    rect = current.el.getBoundingClientRect();
  }

  const wrapperRect = wordsWrapperEl.getBoundingClientRect();
  caretEl.style.left = (rect.left - wrapperRect.left + wordsWrapperEl.scrollLeft) + "px";
  caretEl.style.top = (rect.top - wrapperRect.top + wordsWrapperEl.scrollTop) + "px";
  caretEl.style.height = rect.height + "px";

  scrollToCurrentLine();
}

function scrollToCurrentLine() {
  const current = state.wordElements[state.currentIndex];
  if (!current) return;
  const wrapperRect = wordsWrapperEl.getBoundingClientRect();
  const wordRect = current.el.getBoundingClientRect();
  const relativeTop = wordRect.top - wrapperRect.top + wordsWrapperEl.scrollTop;
  const lineHeight = wordRect.height;

  // keep the active line within the first visible line-and-a-half of the viewport
  const maxVisible = lineHeight * 1.4;
  if (relativeTop > maxVisible) {
    wordsWrapperEl.scrollTop = relativeTop - lineHeight * 0.4;
  } else if (relativeTop < 0) {
    wordsWrapperEl.scrollTop = Math.max(0, relativeTop);
  }
}

/* =========================================================
   RENDER CURRENT WORD (per keystroke)
   ========================================================= */

function renderCurrentWord() {
  const current = state.wordElements[state.currentIndex];
  if (!current) return;
  const target = state.words[state.currentIndex];
  const typed = state.typed[state.currentIndex] || "";

  // update / create char spans for target length + any extra typed chars
  const maxLen = Math.max(target.length, typed.length);

  for (let i = 0; i < maxLen; i++) {
    let span = current.chars[i];
    if (!span) {
      // extra character typed beyond the target word — create a new span
      span = document.createElement("span");
      span.className = "char extra";
      span.textContent = typed[i];
      current.el.appendChild(span);
      current.chars[i] = span;
      continue;
    }
    if (i >= target.length) continue; // handled above on creation

    if (i < typed.length) {
      span.classList.toggle("correct", typed[i] === target[i]);
      span.classList.toggle("incorrect", typed[i] !== target[i]);
    } else {
      span.classList.remove("correct", "incorrect");
    }
  }

  // remove any leftover extra spans if user backspaced them away
  while (current.chars.length > Math.max(target.length, typed.length)) {
    const removed = current.chars.pop();
    removed.remove();
  }

  updateCaret();
}

/* =========================================================
   INPUT HANDLING
   ========================================================= */

function moveToNextWord() {
  finalizeWord(state.currentIndex);

  state.wordElements[state.currentIndex].el.classList.remove("current-word");
  state.currentIndex++;

  const isWordLimited = state.mode === "words" || state.mode === "custom" || state.mode === "quote";
  if (isWordLimited && state.currentIndex >= state.words.length) {
    updateLiveStats();
    endTest();
    return;
  }

  // keep a healthy buffer of upcoming words for time-based & zen modes
  if ((state.mode === "time" || state.mode === "zen") && state.currentIndex > state.words.length - 15) {
    appendMoreWords(40);
  }

  state.wordElements[state.currentIndex].el.classList.add("current-word");
  updateLiveStats();
  updateCaret();
}

function handleCharacterInput(char) {
  if (state.finished) return;
  startTestIfNeeded();

  const idx = state.currentIndex;
  state.typed[idx] = (state.typed[idx] || "") + char;
  renderCurrentWord();
  updateLiveStats();

  // zen mode: end test manually only (no auto end), other modes just keep going
}

function handleSpace() {
  if (state.finished) return;
  startTestIfNeeded();

  const idx = state.currentIndex;
  if (!state.typed[idx]) return; // ignore space with nothing typed
  moveToNextWord();
}

function handleBackspace(ctrlKey) {
  if (state.finished) return;
  const idx = state.currentIndex;
  const typed = state.typed[idx] || "";

  if (typed.length > 0) {
    state.typed[idx] = ctrlKey ? "" : typed.slice(0, -1);
    renderCurrentWord();
    return;
  }

  // move back into the previous word if it wasn't perfectly correct (monkeytype-style correction)
  if (idx > 0) {
    const prevTyped = state.typed[idx - 1] || "";
    const prevTarget = state.words[idx - 1] || "";
    if (prevTyped !== prevTarget) {
      state.wordElements[idx].el.classList.remove("current-word");
      state.currentIndex--;
      state.wordElements[state.currentIndex].el.classList.add("current-word");
      renderCurrentWord();
      updateLiveStats();
    }
  }
}

hiddenInput.addEventListener("keydown", (e) => {
  if (state.finished) return;

  if (e.key === " ") {
    e.preventDefault();
    markCaretActive();
    handleSpace();
  } else if (e.key === "Backspace") {
    e.preventDefault();
    markCaretActive();
    handleBackspace(e.ctrlKey || e.metaKey);
  } else if (e.key === "Enter") {
    if (state.mode === "zen") {
      e.preventDefault();
      endTest();
    }
  } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault();
    markCaretActive();
    handleCharacterInput(e.key);
  }
});

// keep hidden input focused whenever the user clicks the typing area
typeAreaEl.addEventListener("click", focusInput);
document.addEventListener("click", (e) => {
  if (!resultsOverlay.classList.contains("show") && !e.target.closest(".topbar")) {
    focusInput();
  }
});

typeAreaEl.addEventListener("focusin", () => typeAreaEl.classList.remove("blurred"));
hiddenInput.addEventListener("blur", () => {
  if (!state.finished) typeAreaEl.classList.add("blurred");
});

/* prevent page from scrolling on space bar globally */
window.addEventListener("keydown", (e) => {
  if (e.key === " " && document.activeElement === hiddenInput) {
    e.preventDefault();
  }
});

/* =========================================================
   RESTART / NEXT TEST
   ========================================================= */

restartBtn.addEventListener("click", resetTest);
nextTestBtn.addEventListener("click", resetTest);

window.addEventListener("resize", updateCaret);

/* =========================================================
   INIT
   ========================================================= */

renderAmountButtons();
resetTest();