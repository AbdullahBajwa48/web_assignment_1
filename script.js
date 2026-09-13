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
