# How the Typing Test App Works (Updated)

This document walks through **every block** of `index.html`, `style.css`, and `script.js` and explains what it does and why. It reflects the app in its current state, including the two bug fixes applied after the initial build:

1. **Scroll-reset fix** — new tests no longer render "mid-scroll" with clipped lines.
2. **Caret-blink fix** — the caret now stays solid while typing and only blinks when idle.

Read it top-to-bottom for each file, in the same order the code appears.

---

## 1. `index.html` — Structure

### `<head>`
Loads the JetBrains Mono font (a monospace typeface, so every character takes the same width — this is what stops the text from "jumping" as it turns from gray to white) and links `style.css`.

### `.topbar` (the config bar)
```html
<div class="bar-group toggles"> ... punctuation / numbers ... </div>
<div class="bar-group modes"> ... time / words / quote / zen / custom ... </div>
<div class="bar-group amounts" id="amountsGroup"></div>
<button class="settings-btn">...</button>
```
- **toggles** — two buttons (`punctuationBtn`, `numbersBtn`) that flip on/off. They don't change the test mode, only how the word list is generated.
- **modes** — five buttons with a `data-mode="..."` attribute. JS reads this attribute to know which mode was clicked; no separate `if/else` per button is needed.
- **`#amountsGroup`** — deliberately left **empty** in the HTML. It is a slot that `script.js` fills in every time the mode changes (15/30/60/120 for time, 10/25/50/100 for words, a number input for custom, nothing for quote/zen).
- **settings-btn** — currently decorative (an SVG gear icon), a hook for future settings.

### `.lang-row`
Just the "🌐 english" label from the reference image. Static, no JS attached.

### `#liveStats`
An empty `<div>`. During a test this becomes the seconds-remaining counter (time mode) or the `12/50` word counter (words/quote mode). Kept empty at rest so nothing shows before you start typing.

### `.type-area > .words-wrapper > .words`
```html
<main class="type-area" id="typeArea">
  <div class="words-wrapper" id="wordsWrapper">
    <div class="words" id="words" tabindex="0"></div>
  </div>
</main>
```
- **`#words`** — gets completely rebuilt by JS: one `<div class="word">` per word, each containing one `<span class="char">` per letter.
- **`#wordsWrapper`** — a fixed-height, `overflow:hidden` box. It's the "window" you see three lines through. JS scrolls *this* element's `scrollTop` as you move to a new line — this is the element at the center of the scroll-reset fix below.
- **`#typeArea`** — the outer hit-box; clicking anywhere in it refocuses the hidden input.

### `#hiddenInput`
The real, native `<input>` that receives the browser's keyboard events (crucial for mobile). It's visually hidden so you never see a text box — you only see the custom-styled word list reacting to it. All typing logic reads from this input's `keydown` events, not its `.value`.

### `.restart-row`
A single circular-arrow button (`#restartBtn`). Click → `resetTest()` in JS.

### `.results-overlay > .results-card`
Hidden by default (`display:none`, toggled by a `.show` class). Contains placeholder numbers with IDs (`resWpm`, `resAcc`, `resRaw`, `resChars`, `resTime`, `resMode`) that JS fills in once a test ends, plus a "next test" button that also calls `resetTest()`.

---

## 2. `style.css` — Appearance & Motion

### `:root` variables
```css
--bg, --bg-alt, --sub, --sub-alt, --text, --main, --error, --error-extra, --caret
```
Every color in the app is defined once here. `--sub` (gray) = untyped text, `--text` (near-white) = correctly typed text, `--error` (red) = wrong letters, `--main` (yellow) = the accent color for active buttons and stats.

### `.topbar`, `.bar-group`, `.toggle-btn` / `.mode-btn` / `.amount-btn`
Flexbox row of pill-shaped groups. The important rule is:
```css
.toggle-btn.active, .mode-btn.active, .amount-btn.active { color: var(--main); }
```
JS only ever toggles this `.active` class — the CSS decides what "active" looks like, JS just decides *which* button has it.

### `.words`
```css
.words{ display:flex; flex-wrap:wrap; gap:0 0.55em; }
```
`flex-wrap` makes long text wrap onto new lines automatically, while `.word { white-space:nowrap }` keeps each word an unbreakable unit so it never splits mid-letter across two lines.

### `.char` color states
```css
.word .char{ color:var(--sub); transition: color .08s ease; }
.word .char.correct{ color:var(--text); }
.word .char.incorrect{ color:var(--error); text-decoration: underline; }
.word .char.extra{ color:var(--error-extra); }
```
The entire "typing feedback" visual system:
- No class → gray (not typed yet).
- `.correct` → brighter/white.
- `.incorrect` → red + underline.
- `.extra` → a darker red, used only for characters typed beyond a word's real length.
`transition: color .08s ease` makes the color change fade smoothly instead of flashing.

### `.caret` (created dynamically by JS; blink keyframes defined here)
```css
@keyframes caret-blink{
  0%, 50%{ opacity:1; }
  51%, 100%{ opacity:0; }
}
```
A 2px vertical bar. Its `left`/`top` position is recalculated and moved in pixels by JS on every keystroke; the inline `transition: left .08s, top .08s` (set in JS) is what makes it *glide* to the next letter instead of teleporting. **Whether the blink animation is actually running is now controlled entirely by JS** — see `markCaretActive()` below — the CSS only defines what the blink *looks like*, not when it happens.

### `.type-area.blurred .words`
```css
.type-area.blurred .words{ filter: blur(4px); }
```
When the hidden input loses focus mid-test, the word list blurs — a visual cue that keystrokes aren't being captured right now.

### `.results-overlay` / `.results-card`
A fixed, full-screen, semi-transparent backdrop with the card centered via flexbox. `.show` (added by JS) turns `display:none` into `display:flex`. `@keyframes pop-in` gives the card a small fade/scale-in.

### `@media (max-width: 720px)`
Shrinks font sizes, hides button text labels (keeping only icons) and tightens gaps — the mobile responsiveness layer.

---

## 3. `script.js` — Behavior & Logic

### Word bank & quotes
```js
const WORD_BANK = [ "the","be","to", ... ];
const QUOTES = [ "Simplicity is the ultimate...", ... ];
```
A large plain array of common English words (source of all "time"/"words"/"custom"/"zen" text) and a small array of full sentences (source of "quote" mode text).

### DOM references block
Every element the script needs to read or update is grabbed **once**, at the top, into a `const` — all the "wiring" lives in one place.

### The caret element + blink control *(updated)*
```js
const caretEl = document.createElement("div");
...
caretEl.style.animation = "caret-blink 1s steps(1) infinite";
wordsWrapperEl.appendChild(caretEl);

let caretIdleTimer = null;
const CARET_IDLE_DELAY = 500;

function markCaretActive() {
  caretEl.style.animation = "none";
  caretEl.style.opacity = "1";
  clearTimeout(caretIdleTimer);
  caretIdleTimer = setTimeout(() => {
    caretEl.style.animation = "caret-blink 1s steps(1) infinite";
  }, CARET_IDLE_DELAY);
}
```
The caret `<div>` is created in JS (not HTML) because its position has to be recalculated constantly. **This is the block behind the caret-blink fix.**
- By default the caret has the blink animation running.
- `markCaretActive()` is called on every recognized keystroke (see the `keydown` listener further down). It immediately **stops** the animation and forces `opacity: 1`, so the caret stays solid while you're actively typing.
- It also (re)starts a 500ms timer via `setTimeout`. If another keystroke comes in before the timer fires, `clearTimeout` cancels it and a new one starts — so the caret only resumes blinking once you've been idle for a full half-second.
- Net effect: **type continuously → solid caret. Pause → caret starts blinking after ~0.5s.**

### `state` object
```js
const state = { mode, amount, punctuation, numbers, words, wordElements,
                 typed, currentIndex, started, finished, startTime,
                 timeLeft, timerInterval, stats };
```
The single source of truth for the whole app — everything the UI shows is a reflection of what's in `state`.

### Text generation
```js
function pickRandomWord(prevWord) { ... }
function applyExtras(rawWords) { ... }
function generateText(count) { ... }
```
- `pickRandomWord` grabs a random word from `WORD_BANK`, re-rolling once if it repeats the previous word.
- `applyExtras` is a second pass: if **numbers** is on, ~11% of words become random numbers; if **punctuation** is on, it capitalizes "sentence" starts and randomly appends `,` `.` `!` `?`.
- `generateText(count)` combines both: build `count` random words, then run them through `applyExtras`.

### Rendering
```js
function buildWordElement(word) { ... }
function renderAllWords() { ... }
function appendMoreWords(count) { ... }
```
- `buildWordElement` turns one word string into a `<div class="word">` of `<span class="char">` letters, returning both the wrapper and the individual spans.
- `renderAllWords()` wipes `#words` and rebuilds it completely from `state.words` — used when a test starts/restarts.
- `appendMoreWords(count)` generates more words and **appends** them without touching what's already rendered — used mid-test in time/zen mode so text never runs out while the clock is still going.

### Mode & amount controls
```js
function renderAmountButtons() { ... }
function setMode(mode) { ... }
modeBtns.forEach(...); punctuationBtn.addEventListener(...); numbersBtn.addEventListener(...);
```
- `renderAmountButtons()` fills the empty `#amountsGroup` slot based on `state.mode`: 4 preset buttons (time/words), a number `<input>` (custom), or nothing (quote/zen).
- `setMode()` switches `state.mode`, picks a default amount, re-draws the amount buttons, and calls `resetTest()`.
- The punctuation/numbers buttons flip their boolean and also call `resetTest()`, since currently displayed text was generated under the old setting.

### Test lifecycle *(updated)*
```js
function buildInitialWords() { ... }
function resetTest() { ... }
function focusInput() { ... }
function startTestIfNeeded() { ... }
function updateLiveStats() { ... }
```
- `buildInitialWords()` decides how much/what kind of text to generate: a full quote, an exact word count, or a 60-word head-start for time/zen mode (topped up later by `appendMoreWords`).
- **`resetTest()` — this is where the scroll-reset fix lives:**
  ```js
  wordsWrapperEl.scrollTop = 0;      // reset BEFORE building new text
  buildInitialWords();
  renderAllWords();
  wordsWrapperEl.scrollTop = 0;      // reset AGAIN after rendering, before positioning caret
  updateCaret();

  clearTimeout(caretIdleTimer);
  caretEl.style.animation = "caret-blink 1s steps(1) infinite";
  ```
  Previously, finishing a test left `#wordsWrapper` scrolled down (from following your typing through earlier lines). If a new test's words were rendered without resetting that scroll position, the box would show a *partial* line clipped at the top and another clipped at the bottom, since `#wordsWrapper` clips anything outside its fixed height (`overflow:hidden`). Setting `scrollTop = 0` — once before generating new text and once more right after rendering it, before the caret is positioned — guarantees every new test always starts cleanly from line one. The caret's blink animation is also explicitly restored here (in case the idle timer from the *previous* test was still pending), so a fresh test always starts with a normal blinking caret, not a stuck solid one.
- `focusInput()` calls `.focus()` on the hidden input.
- `startTestIfNeeded()` is only called from the first keystroke handlers. It flips `state.started`, stamps `state.startTime = Date.now()` (the basis for all WPM math), and — only in time mode — starts a `setInterval` that ticks `state.timeLeft` down every second and calls `endTest()` at zero.
- `updateLiveStats()` re-renders the counter above the words: seconds left (time mode), `typed/total` (words/quote), or "zen" — always read fresh from `state`.

### Scoring a finished word
```js
function finalizeWord(index) { ... }
```
Called once per word, the moment you leave it (space pressed, or test ends). Walks character-by-character and buckets each into `state.stats`: `correct`, `incorrect`, `extra` (typed beyond the word's length), or `missed` (left before typing that far). This is the same breakdown shown in the results card and is what all WPM/accuracy math is built from.

### Ending the test & showing results
```js
function endTest() { ... }
function showResults() { ... }
```
- `endTest()` stops the interval, gives the in-progress word a final `finalizeWord()` pass, and calls `showResults()`.
- `showResults()`:
  ```js
  const minutes = elapsedSeconds / 60;
  const wpm = Math.round((correct / 5) / minutes);
  const raw = Math.round((totalTyped / 5) / minutes);
  const acc = Math.round((correct / totalTyped) * 1000) / 10;
  ```
  - **Elapsed time** = `Date.now() - state.startTime` — the actual time spent typing, not the configured test length.
  - **WPM** — standard "5 characters = 1 word," counting only correct characters.
  - **Raw WPM** — every character typed, mistakes included.
  - **Accuracy** — correct ÷ (correct + incorrect + extra), as a percentage.
  Writes all values into the result card's DOM elements and adds `.show` to reveal the overlay.

### Caret positioning & auto-scroll
```js
function updateCaret() { ... }
function scrollToCurrentLine() { ... }
```
- `updateCaret()` finds the exact letter-`<span>` you're about to type (or the space right after the last letter) via `getBoundingClientRect()`, then sets the caret's `left`/`top` in pixels. The CSS `transition` on those properties produces a smooth glide rather than a jump on every key.
- `scrollToCurrentLine()` runs at the end of every `updateCaret()`. It checks whether the current word has drifted past roughly one-and-a-half lines down inside the fixed-height `#wordsWrapper`, and nudges `scrollTop` forward by one line if so — the "auto-scroll to the next line" behavior.

### Re-rendering the word you're actively typing
```js
function renderCurrentWord() { ... }
```
Runs on every keystroke. For each character position up to the longer of "the real word" or "what's been typed":
- If typed further than the word's real length, **creates a new `<span class="extra">`** on the fly.
- If a position has been typed, toggles `.correct`/`.incorrect` by comparing letters.
- If not yet typed, clears any leftover class (relevant after backspace).
- Removes any extra spans backspaced away, then calls `updateCaret()`.

### Moving between words
```js
function moveToNextWord() { ... }
```
Called when space is pressed on a non-empty word. Scores the word being left (`finalizeWord`), un-highlights it, advances `state.currentIndex`, then:
- In **words/custom/quote** mode: if that was the last word, ends the test.
- In **time/zen** mode: if within 15 words of the end of what's rendered, calls `appendMoreWords(40)` so the test never runs out of text early.
- Otherwise highlights the new current word and repositions everything.

### Input handlers *(updated — now also drive the caret blink)*
```js
function handleCharacterInput(char) { ... }
function handleSpace() { ... }
function handleBackspace(ctrlKey) { ... }
```
- `handleCharacterInput` appends the typed letter to `state.typed[currentIndex]`, re-renders that word, and kicks off the timer if this is the very first keystroke.
- `handleSpace` does nothing if the current word is empty (can't skip words for free); otherwise calls `moveToNextWord()`.
- `handleBackspace` deletes the last character of the current word (or, with Ctrl/Cmd, clears it entirely). Only steps back into the previous word if it's already empty **and** the previous word wasn't typed perfectly.

### Wiring it all to the keyboard *(updated)*
```js
hiddenInput.addEventListener("keydown", (e) => {
  if (e.key === " ") { e.preventDefault(); markCaretActive(); handleSpace(); }
  else if (e.key === "Backspace") { e.preventDefault(); markCaretActive(); handleBackspace(...); }
  else if (e.key === "Enter") { ... }
  else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
    e.preventDefault(); markCaretActive(); handleCharacterInput(e.key);
  }
});
```
One listener routes every key. **`markCaretActive()` is called at the very start of each branch** (space, backspace, character) — this is the second half of the caret-blink fix: it guarantees that *every* keystroke that actually does something to the test also resets the "stop blinking" timer, so the caret stays solid for as long as you keep typing, no matter which key you're pressing. Using `keydown` (rather than the input's `.value`) means nothing ever lands in the real `<input>`'s text buffer, so there's no native autocomplete/spellcheck interference. A separate global `window` listener also blocks the page itself from scrolling on space bar.

### Focus management
```js
typeAreaEl.addEventListener("click", focusInput);
document.addEventListener("click", (e) => { ... });
typeAreaEl.addEventListener("focusin", ...);
hiddenInput.addEventListener("blur", ...);
```
Clicking in or near the typing area (but not the top config bar) refocuses the hidden input. Losing focus mid-test blurs the words; regaining focus removes the blur.

### Restart / next test
```js
restartBtn.addEventListener("click", resetTest);
nextTestBtn.addEventListener("click", resetTest);
window.addEventListener("resize", updateCaret);
```
Both buttons funnel into the same `resetTest()` used by mode changes — there's only one "start fresh" code path, which is also why both bug fixes (scroll reset + caret blink reset) automatically apply everywhere a new test can begin, not just after finishing one.

### Boot sequence
```js
renderAmountButtons();
resetTest();
```
Runs once when `script.js` first loads: draws the initial amount buttons for the default "time" mode, then runs `resetTest()` to generate the first batch of words and get the app into its ready-to-type state.
