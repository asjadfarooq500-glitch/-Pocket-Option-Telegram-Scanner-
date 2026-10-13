// ==UserScript==
// @name         Pocket Option OTC AI Scanner Mobile
// @namespace    po-otc-mobile-scanner
// @version      2.0.0
// @description  Draggable mobile candle analysis panel with manual OHLC import
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.__PO_OTC_SCANNER_V2__) return;
  window.__PO_OTC_SCANNER_V2__ = true;

  const ID = 'po-otc-v2';
  const $ = (selector, root = document) =>
    root.querySelector(selector);

  let candles = [];
  let journal = [];
  let minimized = false;

  // ---------------------------
  // MOBILE STYLES
  // ---------------------------

  const style = document.createElement('style');

  style.textContent = `
    #${ID} {
      position: fixed;
      top: 95px;
      left: auto;
      right: 8px;
      width: 265px;
      max-width: calc(100vw - 16px);
      max-height: 43vh;
      overflow-y: auto;
      overflow-x: hidden;
      z-index: 2147483647;
      color: #e5edf7;
      background: #0b1220;
      border: 1px solid #10b981;
      border-radius: 13px;
      box-shadow: 0 5px 25px #0009;
      font-family: -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      font-size: 12px;
      -webkit-text-size-adjust: 100%;
      overscroll-behavior: contain;
    }

    #${ID} * {
      box-sizing: border-box;
    }

    #${ID} .head {
      position: sticky;
      top: 0;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 5px;
      padding: 9px;
      background: #111c2c;
      border-bottom: 1px solid #334155;
      cursor: grab;
      touch-action: none;
      user-select: none;
      -webkit-user-select: none;
    }

    #${ID} .head:active {
      cursor: grabbing;
    }

    #${ID} .brand {
      font-weight: 900;
      font-size: 13px;
      line-height: 1.4;
    }

    #${ID} .green {
      color: #34d399;
    }

    #${ID} .head-buttons {
      display: flex;
      gap: 4px;
    }

    #${ID} button {
      min-height: 29px;
      padding: 6px 8px;
      color: #fff;
      background: #172235;
      border: 1px solid #334155;
      border-radius: 7px;
      font-size: 11px;
      touch-action: manipulation;
    }

    #${ID} button:active {
      opacity: 0.75;
    }

    #${ID} .body {
      display: grid;
      gap: 7px;
      padding: 8px;
    }

    #${ID} .box {
      padding: 8px;
      background: #111c2c;
      border: 1px solid #29384c;
      border-radius: 8px;
      overflow-wrap: anywhere;
    }

    #${ID} .muted {
      color: #9aabc0;
      font-size: 10px;
      line-height: 1.5;
      overflow-wrap: anywhere;
    }

    #${ID} .status-title {
      font-weight: 800;
      margin-bottom: 3px;
    }

    #${ID} .row {
      display: flex;
      align-items: flex-start;
      gap: 6px;
    }

    #${ID} .row > * {
      flex: 1;
      min-width: 0;
    }

    #${ID} label {
      display: block;
      margin-bottom: 3px;
      color: #9aabc0;
      font-size: 10px;
    }

    #${ID} input,
    #${ID} select,
    #${ID} textarea {
      display: block;
      width: 100%;
      min-width: 0;
      padding: 8px;
      color: #fff;
      background: #111c2c;
      border: 1px solid #334155;
      border-radius: 7px;
      font-family: inherit;
      font-size: 12px;
    }

    #${ID} textarea {
      min-height: 68px;
      resize: vertical;
      font-size: 10px;
    }

    #${ID} .primary {
      background: #047857;
      border-color: #10b981;
    }

    #${ID} .signal {
      margin: 3px 0;
      font-size: 23px;
      font-weight: 900;
    }

    #${ID} .CALL {
      color: #34d399;
    }

    #${ID} .PUT {
      color: #fb7185;
    }

    #${ID} .WAIT {
      color: #fbbf24;
    }

    #${ID} .metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 5px;
    }

    #${ID} .metric {
      min-width: 0;
      padding: 7px 4px;
      background: #111c2c;
      border: 1px solid #29384c;
      border-radius: 7px;
      text-align: center;
    }

    #${ID} .metric b {
      display: block;
      font-size: 12px;
      overflow-wrap: anywhere;
    }

    #${ID} .metric small {
      display: block;
      margin-top: 3px;
      color: #9aabc0;
      font-size: 9px;
    }

    #${ID} .hidden {
      display: none !important;
    }

    #${ID} .footer {
      text-align: center;
      color: #8192a8;
      font-size: 9px;
      line-height: 1.4;
    }

    #po-otc-reopen {
      position: fixed;
      right: 8px;
      bottom: 95px;
      z-index: 2147483647;
      padding: 11px 13px;
      color: #fff;
      background: #047857;
      border: 1px solid #34d399;
      border-radius: 12px;
      font: bold 12px -apple-system, Arial, sans-serif;
      box-shadow: 0 4px 15px #0008;
      touch-action: manipulation;
    }
  `;

  (document.head || document.documentElement).appendChild(style);

  // ---------------------------
  // CREATE PANEL
  // ---------------------------

  const panel = document.createElement('section');
  panel.id = ID;

  panel.innerHTML = `
    <div class="head" id="po-head">
      <div>
        <div class="brand">
          OTC <span class="green">AI SCANNER</span>
        </div>
        <div class="muted">Drag here to move</div>
      </div>

      <div class="head-buttons">
        <button type="button" id="po-min">−</button>
        <button type="button" id="po-close">×</button>
      </div>
    </div>

    <div class="body" id="po-body">

      <div class="box" id="po-status">
        <div class="status-title">DATA OFFLINE</div>
        <div class="muted">
          Automatic live candle connection has not been verified.
        </div>
      </div>

      <div class="row">
        <div>
          <label for="po-pair">Pair name</label>
          <input id="po-pair" value="OTC pair"
                 placeholder="Pair name">
        </div>

        <div>
          <label for="po-tf">Timeframe</label>
          <select id="po-tf">
            <option>3s</option>
            <option>5s</option>
            <option>15s</option>
            <option>30s</option>
            <option selected>1m</option>
            <option>2m</option>
            <option>3m</option>
            <option>4m</option>
            <option>5m</option>
            <option>10m</option>
            <option>15m</option>
          </select>
        </div>
      </div>

      <div class="box">
        <div class="muted">LATEST ANALYSIS</div>
        <div class="signal WAIT" id="po-signal">WAIT</div>
        <div class="muted" id="po-reason">
          Import genuine candle data to start analysis.
        </div>
      </div>

      <div class="metrics">
        <div class="metric">
          <b id="po-trend">—</b>
          <small>EMA Trend</small>
        </div>
        <div class="metric">
          <b id="po-rsi">—</b>
          <small>RSI 14</small>
        </div>
        <div class="metric">
          <b id="po-atr">—</b>
          <small>ATR 14</small>
        </div>
      </div>

      <div>
        <label for="po-data">Import CSV or JSON candles</label>
        <textarea id="po-data"
          placeholder="CSV:
time,open,high,low,close
2026-10-13T12:00:00Z,1.1000,1.1010,1.0990,1.1005"></textarea>
        <div class="muted">
          Paste genuine OHLC data. Never paste passwords,
          account details, cookies or session tokens.
        </div>
      </div>

      <div class="row">
        <button class="primary" id="po-import" type="button">
          Import & Analyze
        </button>
        <button id="po-clear" type="button">
          Clear
        </button>
      </div>

      <div class="row">
        <button id="po-check" type="button">
          Check Page
        </button>
        <button id="po-journal" type="button">
          Journal
        </button>
      </div>

      <div class="box hidden" id="po-journal-box">
        <b>Recent signals</b>
        <div class="muted" id="po-journal-text"></div>
      </div>

      <div class="muted" id="po-detail">
        Live market data is not connected.
      </div>

      <div class="footer">
        Manual analysis only. No automatic trading.
        No guaranteed accuracy or profits.
      </div>
    </div>
  `;

  document.documentElement.appendChild(panel);

  // Reopen button for a closed panel.

  const reopen = document.createElement('button');
  reopen.id = 'po-otc-reopen';
  reopen.type = 'button';
  reopen.textContent = 'OTC SCANNER';
  reopen.classList.add('hidden');
  document.documentElement.appendChild(reopen);

  reopen.addEventListener('click', () => {
    panel.classList.remove('hidden');
    reopen.classList.add('hidden');
  });

  // ---------------------------
  // DRAG PANEL WITH TOUCH
  // ---------------------------

  const head = $('#po-head', panel);
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  head.addEventListener('pointerdown', event => {
    if (event.target.closest('button')) return;

    dragging = true;

    const rect = panel.getBoundingClientRect();

    startX = event.clientX;
    startY = event.clientY;
    initialLeft = rect.left;
    initialTop = rect.top;

    panel.style.left = initialLeft + 'px';
    panel.style.top = initialTop + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';

    try {
      head.setPointerCapture(event.pointerId);
    } catch (_) {}

    event.preventDefault();
  });

  head.addEventListener('pointermove', event => {
    if (!dragging) return;

    const maxLeft = Math.max(0, innerWidth - panel.offsetWidth);
    const maxTop = Math.max(0, innerHeight - 45);

    const nextLeft = Math.max(
      0,
      Math.min(maxLeft, initialLeft + event.clientX - startX)
    );

    const nextTop = Math.max(
      0,
      Math.min(maxTop, initialTop + event.clientY - startY)
    );

    panel.style.left = nextLeft + 'px';
    panel.style.top = nextTop + 'px';
  });

  function stopDragging() {
    dragging = false;
  }

  head.addEventListener('pointerup', stopDragging);
  head.addEventListener('pointercancel', stopDragging);
  head.addEventListener('lostpointercapture', stopDragging);

  // ---------------------------
  // MINIMIZE AND CLOSE
  // ---------------------------

  $('#po-min', panel).addEventListener('click', () => {
    minimized = !minimized;

    $('#po-body', panel).classList.toggle('hidden', minimized);

    $('#po-min', panel).textContent = minimized ? '+' : '−';

    panel.style.maxHeight = minimized ? 'none' : '43vh';
    panel.style.overflow = minimized ? 'visible' : 'auto';
  });

  $('#po-close', panel).addEventListener('click', () => {
    panel.classList.add('hidden');
    reopen.classList.remove('hidden');
  });

  // ---------------------------
  // STATUS DISPLAY
  // ---------------------------

  function setStatus(title, message) {
    const box = $('#po-status', panel);

    box.replaceChildren();

    const heading = document.createElement('div');
    heading.className = 'status-title';
    heading.textContent = title;

    const description = document.createElement('div');
    description.className = 'muted';
    description.textContent = message;

    box.append(heading, description);
  }

  function resetSignal(message) {
    $('#po-signal', panel).textContent = 'WAIT';
    $('#po-signal', panel).className = 'signal WAIT';
    $('#po-reason', panel).textContent = message;
  }

  // ---------------------------
  // CANDLE DATA PARSER
  // ---------------------------

  function parseCandles(raw) {
    raw = raw.trim();

    if (!raw) {
      throw new Error('Pehle genuine candle data paste karein.');
    }

    let rows = null;

    try {
      const json = JSON.parse(raw);

      if (Array.isArray(json)) {
        rows = json;
      } else if (Array.isArray(json.candles)) {
        rows = json.candles;
      } else if (Array.isArray(json.data)) {
        rows = json.data;
      }
    } catch (_) {}

    if (!rows) {
      const lines = raw.split(/\r?\n/).filter(Boolean);

      if (lines.length < 2) {
        throw new Error('CSV header aur candle rows required hain.');
      }

      const separator = lines[0].includes(';') ? ';' : ',';

      const headers = lines[0]
        .replace(/^\uFEFF/, '')
        .split(separator)
        .map(v => v.trim().toLowerCase());

      const find = aliases =>
        headers.findIndex(h => aliases.includes(h));

      const ix = {
        time: find(['time', 'timestamp', 'date', 'datetime', 't']),
        open: find(['open', 'o']),
        high: find(['high', 'h']),
        low: find(['low', 'l']),
        close: find(['close', 'c'])
      };

      if ([ix.open, ix.high, ix.low, ix.close].some(v => v < 0)) {
        throw new Error(
          'CSV mein open, high, low, close columns hone chahiye.'
        );
      }

      rows = lines.slice(1).map((line, index) => {
        const p = line.split(separator).map(v => v.trim());

        return {
          time: ix.time >= 0 ? p[ix.time] : index,
          open: p[ix.open],
          high: p[ix.high],
          low: p[ix.low],
          close: p[ix.close]
        };
      });
    }

    if (rows.length < 30) {
      throw new Error(
        'Kam az kam 30 candles chahiye; 60 ya zyada behtar hain.'
      );
    }

    const result = rows.map((c, i) => ({
      time: c.time ?? c.timestamp ?? c.t ?? i,
      open: Number(c.open ?? c.o),
      high: Number(c.high ?? c.h),
      low: Number(c.low ?? c.l),
      close: Number(c.close ?? c.c)
    }));

    for (const c of result) {
      if (![c.open, c.high, c.low, c.close].every(Number.isFinite)) {
        throw new Error('Candle data mein invalid numbers hain.');
      }

      if (
        c.high < c.low ||
        c.high < Math.max(c.open, c.close) ||
        c.low > Math.min(c.open, c.close)
      ) {
        throw new Error('OHLC values invalid hain.');
      }
    }

    return result.slice(-1000);
  }

  // ---------------------------
  // TECHNICAL INDICATORS
  // ---------------------------

  function calculateEMA(values, period) {
    if (values.length < period) return null;

    let current = values.slice(0, period)
      .reduce((a, b) => a + b, 0) / period;

    const alpha = 2 / (period + 1);

    for (let i = period; i < values.length; i++) {
      current = values[i] * alpha + current * (1 - alpha);
    }

    return current;
  }

  function calculateRSI(values, period = 14) {
    if (values.length < period + 1) return null;

    let gain = 0;
    let loss = 0;

    for (let i = 1; i <= period; i++) {
      const change = values[i] - values[i - 1];

      if (change > 0) gain += change;
      else loss -= change;
    }

    gain /= period;
    loss /= period;

    for (let i = period + 1; i < values.length; i++) {
      const change = values[i] - values[i - 1];

      gain = (
        gain * (period - 1) + Math.max(0, change)
      ) / period;

      loss = (
        loss * (period - 1) + Math.max(0, -change)
      ) / period;
    }

    if (gain === 0 && loss === 0) return 50;
    if (loss === 0) return 100;
    if (gain === 0) return 0;

    return 100 - 100 / (1 + gain / loss);
  }

  function calculateATR(data, period = 14) {
    if (data.length < period + 1) return null;

    const ranges = [];

    for (let i = 1; i < data.length; i++) {
      const c = data[i];
      const previous = data[i - 1];

      ranges.push(Math.max(
        c.high - c.low,
        Math.abs(c.high - previous.close),
        Math.abs(c.low - previous.close)
      ));
    }

    const sample = ranges.slice(-period);

    return sample.reduce((a, b) => a + b, 0) / sample.length;
  }

  // ---------------------------
  // CANDLE ANALYSIS
  // ---------------------------

  function analyze(data) {
    const closes = data.map(c => c.close);
    const last = data[data.length - 1];
    const previous = data[data.length - 2];

    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    const ema50 = calculateEMA(closes, 50);
    const ema200 = calculateEMA(closes, 200);

    const rsi = calculateRSI(closes);
    const atr = calculateATR(data);

    let bullish = 0;
    let bearish = 0;

    const reasons = [];

    if (ema9 !== null && ema21 !== null) {
      if (ema9 > ema21) {
        bullish++;
        reasons.push('EMA 9 above EMA 21');
      } else if (ema9 < ema21) {
       
