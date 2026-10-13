// ==UserScript==
// @name         Pocket Option OTC AI Scanner Mobile
// @namespace    po-otc-mobile-scanner
// @version      2.1.0
// @description  Draggable mobile scanner panel with diagnostics and manual candle analysis
// @match        *://pocketoption.com/*
// @match        *://*.pocketoption.com/*
// @match        *://po.trade/*
// @match        *://*.po.trade/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const ID = 'po-otc-scanner-v21';

  // Reuse an existing panel instead of silently exiting.
  function showExisting() {
    const old = document.getElementById(ID);
    if (old) {
      old.style.display = 'block';
      old.style.zIndex = '2147483647';
      return true;
    }
    return false;
  }

  function start() {
    if (!document.body) {
      setTimeout(start, 300);
      return;
    }

    if (showExisting()) return;

    const style = document.createElement('style');
    style.textContent = `
      #${ID} {
        position: fixed !important;
        top: 95px !important;
        left: 12px !important;
        width: min(320px, calc(100vw - 24px)) !important;
        max-height: 70vh !important;
        overflow: auto !important;
        z-index: 2147483647 !important;
        background: #101923 !important;
        color: #f3f7fb !important;
        border: 1px solid #2cba88 !important;
        border-radius: 13px !important;
        box-shadow: 0 8px 30px #0009 !important;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, sans-serif !important;
        display: block !important;
        pointer-events: auto !important;
        -webkit-text-size-adjust: 100%;
      }
      #${ID} * { box-sizing: border-box; }
      #${ID} .po-head {
        padding: 12px;
        background: #173b32;
        border-radius: 12px 12px 0 0;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        cursor: move;
        touch-action: none;
        user-select: none;
      }
      #${ID} .po-title { font-weight: 800; font-size: 14px; }
      #${ID} button {
        border: 0;
        border-radius: 7px;
        padding: 7px 10px;
        color: white;
        background: #287b60;
        font-weight: 700;
        cursor: pointer;
      }
      #${ID} .po-body { padding: 12px; }
      #${ID} .po-status {
        padding: 9px;
        margin-bottom: 10px;
        border-radius: 8px;
        background: #24313e;
        overflow-wrap: anywhere;
      }
      #${ID} textarea {
        display: block;
        width: 100%;
        min-height: 82px;
        padding: 9px;
        border-radius: 8px;
        border: 1px solid #536575;
        background: #0a1119;
        color: white;
        font: 12px/1.4 monospace;
        margin: 8px 0;
      }
      #${ID} .po-row { display: flex; gap: 7px; flex-wrap: wrap; }
      #${ID} .po-row button { flex: 1; }
      #${ID} .po-result {
        margin-top: 10px;
        padding: 10px;
        background: #1d2a35;
        border-radius: 8px;
        overflow-wrap: anywhere;
      }
      #${ID} .po-muted { color: #b7c5d1; font-size: 12px; }
      #po-reopen-v21 {
        position: fixed !important;
        bottom: 95px !important;
        right: 12px !important;
        z-index: 2147483647 !important;
        background: #087f5b !important;
        color: white !important;
        padding: 12px 14px !important;
        border: 0 !important;
        border-radius: 25px !important;
        font-weight: 800 !important;
        display: none;
      }
    `;
    document.documentElement.appendChild(style);

    const panel = document.createElement('section');
    panel.id = ID;
    panel.innerHTML = `
      <div class="po-head" id="po-drag-v21">
        <div class="po-title">⚡ OTC AI SCANNER</div>
        <div class="po-row" style="flex-wrap:nowrap">
          <button id="po-min-v21" type="button">—</button>
          <button id="po-close-v21" type="button">×</button>
        </div>
      </div>
      <div class="po-body" id="po-body-v21">
        <div class="po-status" id="po-status-v21">
          🟡 Scanner loaded. Live candle feed not verified.
        </div>
        <div class="po-muted">
          Paste real candle OHLC data below. Newest candle must be last.
          Format: open,high,low,close — one candle per line.
        </div>
        <textarea id="po-data-v21"
          placeholder="1.0840,1.0850,1.0830,1.0845&#10;1.0845,1.0860,1.0840,1.0855"></textarea>
        <div class="po-row">
          <button id="po-scan-v21" type="button">ANALYZE</button>
          <button id="po-clear-v21" type="button">CLEAR</button>
        </div>
        <div class="po-result" id="po-result-v21">
          <b>Waiting for candle data</b>
          <p class="po-muted">No random or simulated candles are generated.</p>
        </div>
        <p class="po-muted">
          Analysis only. CALL/PUT is not guaranteed. Confirm expiry and
          chart timeframe manually. This panel does not place trades.
        </p>
      </div>
    `;
    document.body.appendChild(panel);

    const reopen = document.createElement('button');
    reopen.id = 'po-reopen-v21';
    reopen.type = 'button';
    reopen.textContent = '⚡ Open Scanner';
    document.body.appendChild(reopen);

    const $ = (id) => document.getElementById(id);
    const status = $('po-status-v21');
    const body = $('po-body-v21');

    status.textContent =
      '🟢 PANEL LOADED — Userscript is running. Live feed: not connected by this script.';

    $('po-min-v21').addEventListener('click', (e) => {
      e.stopPropagation();
      body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    $('po-close-v21').addEventListener('click', (e) => {
      e.stopPropagation();
      panel.style.display = 'none';
      reopen.style.display = 'block';
    });

    reopen.addEventListener('click', () => {
      panel.style.display = 'block';
      reopen.style.display = 'none';
    });

    $('po-clear-v21').addEventListener('click', () => {
      $('po-data-v21').value = '';
      $('po-result-v21').textContent = 'Data cleared. Paste real candle data to analyze.';
      status.textContent = '🟡 Waiting for real candle data.';
    });

    // Drag panel by its header; keep it within the visible screen.
    const header = $('po-drag-v21');
    let dragging = false;
    let startX = 0, startY = 0, originX = 0, originY = 0;

    header.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      startX = e.clientX;
      startY = e.clientY;
      originX = rect.left;
      originY = rect.top;
      panel.style.left = originX + 'px';
      panel.style.top = originY + 'px';
      panel.style.right = 'auto';
      try { header.setPointerCapture(e.pointerId); } catch (_) {}
      e.preventDefault();
    });

    header.addEventListener('pointermove', (e) => {
      if (!dragging) return;
      const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxY = Math.max(0, window.innerHeight - 70);
      panel.style.left = Math.min(maxX, Math.max(0, originX + e.clientX - startX)) + 'px';
      panel.style.top = Math.min(maxY, Math.max(0, originY + e.clientY - startY)) + 'px';
    });

    const stopDrag = () => { dragging = false; };
    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);

    // Basic transparent OHLC analysis; it never fabricates data.
    function analyze() {
      const raw = $('po-data-v21').value.trim();
      const lines = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
      const candles = [];

      for (const line of lines) {
        const values = line.split(/[,\s;]+/).map(Number);
        if (values.length < 4 || values.slice(0, 4).some(v => !Number.isFinite(v))) {
          $('po-result-v21').textContent =
            'Invalid row: use open,high,low,close. Check every line.';
          return;
        }
        const [open, high, low, close] = values;
        if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
          $('po-result-v21').textContent =
            'Invalid OHLC row: high/low do not contain open and close.';
          return;
        }
        candles.push({ open, high, low, close });
      }

      if (candles.length < 30) {
        $('po-result-v21').textContent =
          `Only ${candles.length} valid candles. Please provide at least 30 real candles.`;
        return;
      }

      const closes = candles.map(c => c.close);
      const ema = (period) => {
        const k = 2 / (period + 1);
        let value = closes[0];
        for (let i = 1; i < closes.length; i++) {
          value = closes[i] * k + value * (1 - k);
        }
        return value;
      };

      let gains = 0, losses = 0;
      const period = 14;
      for (let i = closes.length - period; i < closes.length; i++) {
        const change = closes[i] - closes[i - 1];
        if (change > 0) gains += change;
        else losses -= change;
      }
      const avgGain = gains / period;
      const avgLoss = losses / period;
      const rsi = avgLoss === 0 ? 100 : 100 - (100 / (1 + avgGain / avgLoss));

      const last = candles[candles.length - 1];
      const previous = candles[candles.length - 2];
      const trendUp = ema(9) > ema(21) && ema(21) > ema(50);
      const trendDown = ema(9) < ema(21) && ema(21) < ema(50);
      const bullish = last.close > last.open;
      const bearish = last.close < last.open;
      const higherClose = last.close > previous.close;
      const lowerClose = last.close < previous.close;

      let signal = 'WAIT / NO CLEAR SETUP';
      let explanation = 'Indicators do not agree strongly enough.';

      if (trendUp && rsi >= 50 && rsi <= 68 && bullish && higherClose) {
        signal = 'CALL BIAS';
        explanation = 'EMA trend, RSI and latest candle direction agree.';
      } else if (trendDown && rsi <= 50 && rsi >= 32 && bearish && lowerClose) {
        signal = 'PUT BIAS';
        explanation = 'EMA trend, RSI and latest candle direction agree.';
      }

      $('po-result-v21').innerHTML = `
        <b style="font-size:18px">${signal}</b>
        <p>${explanation}</p>
        <hr style="border-color:#40515e">
        <div>EMA 9: ${ema(9).toFixed(6)}</div>
        <div>EMA 21: ${ema(21).toFixed(6)}</div>
        <div>EMA 50: ${ema(50).toFixed(6)}</div>
        <div>RSI 14: ${rsi.toFixed(1)}</div>
        <div>Last close: ${last.close}</div>
        <p class="po-muted">Rule-based indication only, not a probability or guaranteed prediction.</p>
      `;
      status.textContent = `🟢 Analyzed ${candles.length} supplied candles. Data freshness not verified.`;
    }

    $('po-scan-v21').addEventListener('click', analyze);

    // If a site re-renders its page, restore the panel if it was removed.
    const observer = new MutationObserver(() => {
      if (!document.getElementById(ID) && document.body) {
        document.body.appendChild(panel);
      }
      if (!document.getElementById('po-reopen-v21') && document.body) {
        document.body.appendChild(reopen);
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });

    console.info('[PO OTC Scanner V2.1] Panel mounted.');
  }

  try {
    start();
  } catch (error) {
    console.error('[PO OTC Scanner V2.1] Startup error:', error);
    alert('Pocket Option Scanner error: ' + error.message);
  }
})();
