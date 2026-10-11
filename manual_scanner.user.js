Act as an elite full-stack JavaScript engineer specializing in reverse engineering, WebSockets, and financial chart analysis. Write a complete, standalone, production-grade Userscript (`.user.js`) specifically engineered for Pocket Option (`pocketoption.com` and `po.market`) running on iOS Safari (via the Userscripts extension)[span_0](start_span)[span_0](end_span).

The script must replicate the high-tech FXVISION dark-neon interface[span_1](start_span)[span_1](end_span) and provide real-time indicator evaluation and historical backtesting.

---

### 1. UI & STYLING SPECIFICATIONS (FXVISION THEME)
1. **Glassmorphic Neon Container:**
   - Fixed floating card at the top-right (`top: 50px; right: 10px; width: 235px;`).
   - Deep dark background (`#080d1a` to `#04070f`), cyan glowing border (`1px solid #00e5ff33`), and soft box-shadow[span_2](start_span)[span_2](end_span).
   - Touch drag handlers (`touchstart`, `touchmove`, `touchend`) optimized for iOS touchscreens so the user can freely reposition the widget across the screen.
2. **Top Header & Asset Card:**
   - "FXVISION" cyan neon text with active green status beacon and minimize/close icon[span_3](start_span)[span_3](end_span).
   - Dynamic pair container displaying the currently selected broker asset (e.g., "EUR/USD (OTC)")[span_4](start_span)[span_4](end_span).
3. **Circular Signal Gauge:**
   - Responsive SVG circle with animated `stroke-dashoffset`[span_5](start_span)[span_5](end_span).
   - Dynamic states:
     - Neutral: Cyan glow, "STANDBY", 0.0%[span_6](start_span)[span_6](end_span).
     - UP / CALL: Vivid green (`#00e676`), displays confluence score (e.g., 88.5%).
     - DOWN / PUT: Vivid red (`#ff1744`), displays confluence score (e.g., 91.2%).
4. **Action Button & 30-Candle Analytics Card:**
   - Neon "TURN ON / TURN OFF" toggle switch[span_7](start_span)[span_7](end_span).
   - Grid panel displaying rolling performance over the last 30 candles:
     - 30C Wins count
     - 30C Losses count
     - Win-Rate % (highlighted in cyan/green)

---

### 2. DATA ACQUISITION & WEBSOCKET ENGINE
1. **WebSocket Interception:**
   - Monkey-patch the native `window.WebSocket` constructor to sniff outgoing and incoming broker traffic without breaking broker functionality.
   - Capture incoming candle frames, tick updates, and asset changes.
2. **DOM Fallback Scanner:**
   - Set up a fallback `MutationObserver` and 1-second interval scanner monitoring `.current-symbol`, `.btn-asset__name`, or active pair elements to detect active asset switches instantly.
   - When the user changes pairs on Pocket Option, reset and reload the 30-candle calculation immediately for the selected pair.

---

### 3. TECHNICAL ANALYSIS & CONFLUENCE ALGORITHM
Do NOT use random numbers. Implement lightweight technical analysis calculated on candle close arrays:
1. **RSI (Relative Strength Index - 14 Periods):** Calculate price momentum and overbought/oversold levels.
2. **Exponential Moving Average (EMA 9 & EMA 21):** Track trend direction and moving average crossovers.
3. **Accuracy / Confluence Scoring:**
   - Base score: 70%.
   - Add +10% if EMA 9 is decisively above/below EMA 21.
   - Add +10% if RSI confirms direction (RSI < 35 for oversold bounce / RSI > 65 for overbought rejection).
   - Cap maximum displayed accuracy between 75% and 95%.

---

### 4. ROLLING 30-CANDLES BACKTEST ENGINE
1. Store the rolling history of the last 30 completed candles (Open, High, Low, Close).
2. For each candle from index 1 to 29:
   - Evaluate the trend/indicator condition of candle `i - 1`.
   - Compare with candle `i` outcome:
     - Win: Signal UP and `Close > Open` OR Signal DOWN and `Close < Open`.
     - Loss: Market closed opposite to the signal direction.
3. Dynamically update the UI:
   $$\text{Win Rate} = \left(\frac{\text{Wins}}{\text{Wins} + \text{Losses}}\right) \times 100$$

---

### 5. USERSCRIPT HEADERS & DEPLOYMENT
Include a clean Userscript header:
```javascript
// ==UserScript==
// @name         Pocket Option FX-Vision Elite Signal Bot
// @namespace    [https://pocketoption.com/](https://pocketoption.com/)
// @version      2.0
// @description  Automated asset-sync, circular confluence gauge, and 30-candle win/loss backtester
// @match        https://*[.pocketoption.com/](https://.pocketoption.com/)*
// @match        https://*.po.market/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
