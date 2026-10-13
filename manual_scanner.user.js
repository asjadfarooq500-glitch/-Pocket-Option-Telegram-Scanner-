// ==UserScript==
// @name         Pocket Option OTC AI Scanner
// @namespace    pocket-option-otc-ai-scanner
// @version      1.1.0
// @description  Mobile OTC candle analysis panel. No fake candles or automatic trading.
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(() => {
  'use strict';

  if (window.__PO_OTC_AI_SCANNER__) return;
  window.__PO_OTC_AI_SCANNER__ = true;

  const $ = (s, r = document) => r.querySelector(s);
  const state = {
    candles: [],
    pair: 'OTC pair',
    timeframe: '1m',
    journal: []
  };

  const css = `
  #poai {
    position:fixed;right:8px;bottom:20px;width:min(355px,calc(100vw - 16px));
    max-height:78vh;overflow:auto;z-index:2147483647;
    background:#0b1220;color:#e5edf7;border:1px solid #10b981;
    border-radius:15px;box-shadow:0 10px 35px #0009;
    font:13px -apple-system,BlinkMacSystemFont,Arial,sans-serif;
  }
  #poai *{box-sizing:border-box}
  #poai .head{position:sticky;top:0;background:#111c2c;padding:12px;
    display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155}
  #poai .title{font-weight:900;font-size:15px}
  #poai .green{color:#34d399}
  #poai .body{padding:11px;display:grid;gap:9px}
  #poai .row{display:flex;gap:7px}
  #poai .row>*{flex:1;min-width:0}
  #poai label{display:block;color:#9aabc0;font-size:11px;margin-bottom:4px}
  #poai input,#poai select,#poai textarea{width:100%;background:#111c2c;color:#fff;
    border:1px solid #334155;border-radius:8px;padding:9px;font:inherit}
  #poai textarea{min-height:100px;resize:vertical;font-size:11px}
  #poai button{background:#172235;color:#fff;border:1px solid #334155;
    border-radius:8px;padding:9px;font:inherit}
  #poai .primary{background:#047857;border-color:#10b981}
  #poai .box{background:#111c2c;border:1px solid #29384c;border-radius:9px;padding:10px}
  #poai .muted{color:#9aabc0;font-size:11px;line-height:1.5}
  #poai .signal{font-size:25px;font-weight:900;margin:4px 0}
  #poai .CALL{color:#34d399}#poai .PUT{color:#fb7185}#poai .WAIT{color:#fbbf24}
  #poai .metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
  #poai .metric{background:#111c2c;padding:8px;border-radius:8px;border:1px solid #29384c}
  #poai .metric b{display:block;font-size:14px}
  #poai .metric small{font-size:10px;color:#9aabc0}
  #poai .hidden{display:none!important}
  #poai .footer{text-align:center;font-size:10px;color:#8192a8}
  `;

  const style = document.createElement('style');
  style.textContent = css;
  document.documentElement.appendChild(style);

  const panel = document.createElement('section');
  panel.id = 'poai';
  panel.innerHTML = `
    <div class="head">
      <div>
        <div class="title">OTC <span class="green">AI SCANNER</span></div>
        <div class="muted">Candle analysis · Manual mode</div>
      </div>
      <button id="poai-min">−</button>
    </div>

    <div class="body" id="poai-body">
      <div class="box" id="poai-status">
        <b>DATA OFFLINE</b>
        <div class="muted">Waiting for genuine OHLC candle data.</div>
      </div>

      <div class="row">
        <div>
          <label>Pair name</label>
          <input id="poai-pair" value="OTC pair">
        </div>
        <div>
          <label>Timeframe</label>
          <select id="poai-tf">
            <option>3s</option><option>5s</option>
            <option>15s</option><option>30s</option>
            <option selected>1m</option><option>2m</option>
            <option>3m</option><option>4m</option>
            <option>5m</option><option>10m</option><option>15m</option>
          </select>
        </div>
      </div>

      <div class="box">
        <div class="muted">LATEST ANALYSIS</div>
        <div class="signal WAIT" id="poai-signal">WAIT</div>
        <div class="muted" id="poai-reason">
          Import at least 60 genuine candles for analysis.
        </div>
      </div>

      <div class="metrics">
        <div class="metric"><b id="poai-trend">—</b><small>EMA trend</small></div>
        <div class="metric"><b id="poai-rsi">—</b><small>RSI 14</small></div>
        <div class="metric"><b id="poai-atr">—</b><small>ATR 14</small></div>
      </div>

      <div>
        <label>Import genuine candle data (CSV or JSON)</label>
        <textarea id="poai-data" placeholder="CSV example:
time,open,high,low,close
2026-10-13T12:00:00Z,1.1000,1.1010,1.0990,1.1005
..."></textarea>
        <div class="muted">
          Use actual exported OHLC candles. Do not paste passwords,
          account details, cookies or session tokens.
        </div>
      </div>

      <div class="row">
        <button class="primary" id="poai-import">Import & Analyze</button>
        <button id="poai-clear">Clear</button>
      </div>

      <div class="row">
        <button id="poai-check">Check page</button>
        <button id="poai-journal">Signal journal</button>
      </div>

      <div class="box hidden" id="poai-logbox">
        <b>Recent signals</b>
        <div class="muted" id="poai-log"></div>
      </div>

      <div class="muted" id="poai-detail">
        Live chart access has not been verified.
      </div>

      <div class="footer">
        Educational analysis only · No automatic orders · No guaranteed profits
      </div>
    </div>
  `;

  document.documentElement.appendChild(panel);

  function setStatus(title, message) {
    $('#poai-status').innerHTML =
      '<b></b><div class="muted"></div>';
    $('#poai-status b').textContent = title;
    $('#poai-status .muted').textContent = message;
  }

  function parseCandles(raw) {
    let arr = null;

    try {
      const obj = JSON.parse(raw);
      if (Array.isArray(obj)) arr = obj;
      else if (obj && Array.isArray(obj.candles)) arr = obj.candles;
    } catch (_) {}

    if (!arr) {
      const lines = raw.trim().split(/\r?\n/).filter(Boolean);

      if (lines.length < 2) {
        throw new Error('CSV header aur candle rows paste karein.');
      }

      const sep = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(sep)
        .map(x => x.trim().toLowerCase());

      const find = names => headers.findIndex(h => names.includes(h));

      const ix = {
        time: find(['time','timestamp','date','datetime','t']),
        open: find(['open','o']),
        high: find(['high','h']),
        low: find(['low','l']),
        close: find(['close','c'])
      };

      if ([ix.open, ix.high, ix.low, ix.close].some(i => i < 0)) {
        throw new Error('CSV mein open, high, low aur close columns zaroori hain.');
      }

      arr = lines.slice(1).map((line, i) => {
        const p = line.split(sep).map(x => x.trim());
        return {
          time: ix.time >= 0 ? p[ix.time] : i,
          open: p[ix.open],
          high: p[ix.high],
          low: p[ix.low],
          close: p[ix.close]
        };
      });
    }

    if (arr.length < 30) {
      throw new Error('Kam az kam 30 candles chahiye; behtar analysis ke liye 60+ use karein.');
    }

    const candles = arr.map((c, i) => ({
      time: c.time ?? c.timestamp ?? i,
      open: Number(c.open ?? c.o),
      high: Number(c.high ?? c.h),
      low: Number(c.low ?? c.l),
      close: Number(c.close ?? c.c)
    }));

    for (const c of candles) {
      if (![c.open,c.high,c.low,c.close].every(Number.isFinite)) {
        throw new Error('Candle data mein invalid number mila.');
      }

      if (
        c.high < c.low ||
        c.high < Math.max(c.open,c.close) ||
        c.low > Math.min(c.open,c.close)
      ) {
        throw new Error('OHLC candle values invalid hain.');
      }
    }

    return candles.slice(-1000);
  }

  function ema(values, period) {
    if (values.length < period) return null;

    const k = 2 / (period + 1);
    let value = values.slice(0, period)
      .reduce((a,b) => a+b, 0) / period;

    for (let i = period; i < values.length; i++) {
      value = values[i] * k + value * (1-k);
    }

    return value;
  }

  function rsi(values, period = 14) {
    if (values.length < period + 1) return null;

    let gains = 0;
    let losses = 0;

    for (let i = 1; i <= period; i++) {
      const d = values[i] - values[i-1];
      if (d > 0) gains += d;
      else losses -= d;
    }

    gains /= period;
    losses /= period;

    for (let i = period+1; i < values.length; i++) {
      const d = values[i] - values[i-1];
      gains = (gains*(period-1) + Math.max(d,0)) / period;
      losses = (losses*(period-1) + Math.max(-d,0)) / period;
    }

    if (losses === 0) return 100;
    return 100 - 100/(1 + gains/losses);
  }

  function atr(candles, period = 14) {
    if (candles.length < period+1) return null;

    const tr = [];

    for (let i = 1; i < candles.length; i++) {
      const c = candles[i];
      const prev = candles[i-1];

      tr.push(Math.max(
        c.high-c.low,
        Math.abs(c.high-prev.close),
        Math.abs(c.low-prev.close)
      ));
    }

    const recent = tr.slice(-period);
    return recent.reduce((a,b) => a+b,0)/recent.length;
  }

  function analyze(candles) {
    const closes = candles.map(c => c.close);
    const last = candles[candles.length-1];
    const prev = candles[candles.length-2];

    const e9 = ema(closes,9);
    const e21 = ema(closes,21);
    const e50 = ema(closes,50);
    const e200 = ema(closes,200);
    const rv = rsi(closes);
    const av = atr(candles);

    let bull = 0;
    let bear = 0;
    const reasons = [];

    if (e9 !== null && e21 !== null) {
      if (e9 > e21) {
        bull++;
        reasons.push('EMA 9 > EMA 21');
      } else if (e9 < e21) {
        bear++;
        reasons.push('EMA 9 < EMA 21');
      }
    }

    if (e21 !== null && e50 !== null) {
      if (e21 > e50) bull++;
      else if (e21 < e50) bear++;
    }

    if (e50 !== null) {
      if (last.close > e50) bull++;
      else if (last.close < e50) bear++;
    }

    if (e200 !== null) {
      if (last.close > e200) bull++;
      else if (last.close < e200) bear++;
    }

    if (rv !== null) {
      if (rv >= 52 && rv < 70) {
        bull++;
        reasons.push('RSI bullish momentum');
      } else if (rv <= 48 && rv > 30) {
        bear++;
        reasons.push('RSI bearish momentum');
      } else if (rv >= 70 || rv <= 30) {
        reasons.push('RSI extreme; reversal risk');
      }
    }

    const body = Math.abs(last.close-last.open);
    const range = Math.max(last.high-last.low, Number.EPSILON);
    const upper = last.high-Math.max(last.open,last.close);
    const lower = Math.min(last.open,last.close)-last.low;

    if (last.close > last.open) {
      bull++;
      if (
        prev.close < prev.open &&
        last.open <= prev.close &&
        last.close >= prev.open
      ) {
        bull++;
        reasons.push('Bullish engulfing candidate');
      }
    }

    if (last.close < last.open) {
      bear++;
      if (
        prev.close > prev.open &&
        last.open >= prev.close &&
        last.close <= prev.open
      ) {
        bear++;
        reasons.push('Bearish engulfing candidate');
      }
    }

    if (lower > body*2 && upper < Math.max(body,range*0.15)) {
      bull++;
      reasons.push('Hammer-like candle; context matters');
    }

    if (upper > body*2 && lower < Math.max(body,range*0.15)) {
      bear++;
      reasons.push('Shooting-star-like candle; context matters');
    }

    const recent = candles.slice(-20);
    const high = Math.max(...recent.map(c => c.high));
    const low = Math.min(...recent.map(c => c.low));

    if (last.close >= high-range*0.05) {
      reasons.push('Near recent resistance');
    }

    if (last.close <= low+range*0.05) {
      reasons.push('Near recent support');
    }

    let signal = 'WAIT';

    const total = bull+bear;
    const agreement = Math.abs(bull-bear);

    if (
      candles.length >= 60 &&
      agreement >= 3 &&
      total >= 5 &&
      Math.max(bull,bear)/total >= 0.68
    ) {
      signal = bull > bear ? 'CALL' : 'PUT';
    } else {
      reasons.push('Mixed or weak confirmation');
    }

    return {
      signal, bull, bear, reasons,
      trend: e9 === null || e21 === null
        ? 'Need data'
        : e9 > e21 ? 'Bullish' : e9 < e21 ? 'Bearish' : 'Flat',
      rsi: rv,
      atr: av,
      last
    };
  }

  function render() {
    if (state.candles.length < 30) return;

    const a = analyze(state.candles);

    $('#poai-signal').textContent = a.signal;
    $('#poai-signal').className = 'signal ' + a.signal;
    $('#poai-reason').textContent =
      `${a.bull} bullish / ${a.bear} bearish. ` +
      a.reasons.slice(0,5).join(' · ');

    $('#poai-trend').textContent = a.trend;
    $('#poai-rsi').textContent =
      a.rsi === null ? '—' : a.rsi.toFixed(1);
    $('#poai-atr').textContent =
      a.atr === null ? '—' : a.atr.toPrecision(4);

    $('#poai-detail').textContent =
      `Latest close: ${a.last.close} · Candle time: ${a.last.time}. ` +
      `Historical import only; this is not a live signal feed.`;

    setStatus(
      'OHLC DATA IMPORTED',
      `${state.candles.length} structurally valid candles. ` +
      'The script cannot independently verify the data source.'
    );

    if (a.signal !== 'WAIT') {
      state.journal.unshift({
        time: new Date().toLocaleString(),
        signal: a.signal,
        pair: state.pair,
        timeframe: state.timeframe,
        close: a.last.close
      });

      state.journal = state.journal.slice(0,50);
    }
  }

  $('#poai-import').addEventListener('click', () => {
    try {
      state.candles = parseCandles($('#poai-data').value);
      state.pair = $('#poai-pair').value.trim() || 'OTC pair';
      state.timeframe = $('#poai-tf').value;
      render();
    } catch (e) {
      state.candles = [];
      setStatus('DATA ERROR', e.message || 'Could not read candle data.');
      $('#poai-signal').textContent = 'WAIT';
      $('#poai-signal').className = 'signal WAIT';
    }
  });

  $('#poai-clear').addEventListener('click', () => {
    state.candles = [];
    $('#poai-data').value = '';
    $('#poai-signal').textContent = 'WAIT';
    $('#poai-signal').className = 'signal WAIT';
    $('#poai-reason').textContent = 'Import genuine OHLC candles to analyze.';
    $('#poai-trend').textContent = '—';
    $('#poai-rsi').textContent = '—';
    $('#poai-atr').textContent = '—';
    $('#poai-detail').textContent = 'No candle source verified.';
    setStatus('DATA OFFLINE', 'No candle data loaded.');
  });

  $('#poai-check').addEventListener('click', () => {
    const tables = [...document.querySelectorAll('table')];
    const found = tables.some(t => {
      const text = (t.innerText || '').toLowerCase();
      return /\bopen\b/.test(text) &&
             /\bhigh\b/.test(text) &&
             /\blow\b/.test(text) &&
             /\bclose\b/.test(text);
    });

    if (found) {
      setStatus(
        'OHLC LABELS FOUND',
        'Visible table labels detected. Candle values are not automatically imported.'
      );
    } else {
      setStatus(
        'DATA OFFLINE',
        'No visible OHLC table found. The script does not extract candles from chart pixels.'
      );
    }
  });

  $('#poai-journal').addEventListener('click', () => {
    const box = $('#poai-logbox');
    box.classList.toggle('hidden');

    $('#poai-log').textContent = state.journal.length
      ? state.journal.slice(0,20).map(x =>
          `${x.time} · ${x.signal} · ${x.pair} ${x.timeframe} · close ${x.close}`
        ).join('\n')
      : 'No qualifying signals logged yet.';
  });

  $('#poai-min').addEventListener('click', () => {
    $('#poai-body').classList.toggle('hidden');
    $('#poai-min').textContent =
      $('#poai-body').classList.contains('hidden') ? '+' : '−';
  });

  setStatus(
    'DATA OFFLINE',
    'Scanner loaded. Automatic live OTC candle access has not been verified.'
  );
})();
