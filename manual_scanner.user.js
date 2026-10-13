// ==UserScript==
// @name         Pocket Option Auto Scanner V4 Fixed
// @namespace    po-auto-scanner-v4-fixed
// @version      4.1.0
// @description  Optimized read-only candle diagnostics and technical analysis for Safari & Desktop
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'po-auto-scanner-v4';
    const REOPEN_ID = 'po-auto-scanner-v4-reopen';
    const EVENT_NAME = 'po-v4-normalized-candle';

    if (window.__PO_AUTO_SCANNER_V4__) return;
    window.__PO_AUTO_SCANNER_V4__ = true;

    /*
     * LIGHTWEIGHT WEBSOCKET MONITOR (Safari Safe)
     */
    function initSocketObserver() {
        try {
            const NativeWebSocket = window.WebSocket;
            if (!NativeWebSocket || NativeWebSocket.__poV4Wrapped) return;

            const proxy = new Proxy(NativeWebSocket, {
                construct(target, args) {
                    const socket = Reflect.construct(target, args, target);

                    socket.addEventListener('message', event => {
                        if (typeof event.data !== 'string' || event.data.length > 5000) return;

                        try {
                            const parsed = JSON.parse(event.data);
                            // Quick light check for OHLC arrays to avoid heavy recursion lag
                            if (parsed && typeof parsed === 'object') {
                                const dataObj = parsed.data || parsed.candles || parsed;
                                if (Array.isArray(dataObj) && dataObj.length > 0) {
                                    const sample = dataObj[dataObj.length - 1];
                                    if (sample && (sample.open !== undefined || sample.o !== undefined)) {
                                        const candlesList = dataObj.map(c => ({
                                            open: Number(c.open || c.o),
                                            high: Number(c.high || c.h),
                                            low: Number(c.low || c.l),
                                            close: Number(c.close || c.c)
                                        })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite));

                                        if (candlesList.length > 0) {
                                            window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: candlesList.slice(-20) }));
                                        }
                                    }
                                }
                            }
                        } catch (_) {}
                    });

                    return socket;
                }
            });

            Object.defineProperty(proxy, '__poV4Wrapped', { value: true });
            window.WebSocket = proxy;
        } catch (_) {}
    }

    try {
        initSocketObserver();
    } catch (_) {}

    /*
     * SCANNER UI & ANALYSIS ENGINE
     */
    const candles = [];
    const MAX_CANDLES = 200;
    let lastCandleKey = '';
    let lastDataAt = 0;
    let panel = null;

    function addCandles(incoming) {
        if (!Array.isArray(incoming)) return;

        for (const c of incoming) {
            if (!c || ![c.open, c.high, c.low, c.close].every(Number.isFinite)) continue;
            const key = `${c.open}|${c.high}|${c.low}|${c.close}`;
            if (key === lastCandleKey) continue;

            lastCandleKey = key;
            candles.push({ open: c.open, high: c.high, low: c.low, close: c.close });

            if (candles.length > MAX_CANDLES) candles.shift();
            lastDataAt = Date.now();
        }
        updatePanel();
    }

    window.addEventListener(EVENT_NAME, event => addCandles(event.detail));

    function detectPair() {
        // Safe lightweight pair detector without full body innerText scan
        const titleEl = document.querySelector('.asset-name, .current-symbol, [class*="asset"], [class*="symbol"]');
        if (titleEl && titleEl.textContent) {
            return titleEl.textContent.trim();
        }
        return 'Active Asset';
    }

    function ema(values, period) {
        if (values.length < period) return null;
        const k = 2 / (period + 1);
        let result = values[0];
        for (let i = 1; i < values.length; i++) {
            result = values[i] * k + result * (1 - k);
        }
        return result;
    }

    function calculateRSI(values, period = 14) {
        if (values.length < period + 1) return null;
        let gains = 0, losses = 0;
        for (let i = values.length - period; i < values.length; i++) {
            const change = values[i] - values[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        const avgGain = gains / period;
        const avgLoss = losses / period;
        if (avgGain === 0 && avgLoss === 0) return 50;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + (avgGain / avgLoss)));
    }

    function analyse() {
        if (candles.length < 30) {
            return { signal: 'DATA INSUFFICIENT', reason: 'At least 30 candles required.' };
        }

        const closes = candles.map(c => c.close);
        const e9 = ema(closes, 9);
        const e21 = ema(closes, 21);
        const rsi = calculateRSI(closes);

        if ([e9, e21, rsi].some(v => v === null)) {
            return { signal: 'DATA INSUFFICIENT', reason: 'Calculating indicators...' };
        }

        const last = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        if (e9 > e21 && rsi >= 50 && last.close > previous.close) {
            return { signal: 'CALL BIAS', reason: 'EMA & RSI alignment bullish.', e9, e21, rsi };
        }
        if (e9 < e21 && rsi <= 50 && last.close < previous.close) {
            return { signal: 'PUT BIAS', reason: 'EMA & RSI alignment bearish.', e9, e21, rsi };
        }

        return { signal: 'WAIT', reason: 'No clear trend setup.', e9, e21, rsi };
    }

    function createPanel() {
        if (!document.body || document.getElementById(PANEL_ID)) return;

        panel = document.createElement('div');
        panel.id = PANEL_ID;

        Object.assign(panel.style, {
            position: 'fixed',
            top: '110px',
            left: '15px',
            width: '280px',
            maxHeight: '70vh',
            overflowY: 'auto',
            zIndex: '2147483647',
            background: '#101923',
            color: '#fff',
            border: '2px solid #10b981',
            borderRadius: '12px',
            boxShadow: '0 6px 25px rgba(0,0,0,0.6)',
            font: '13px/1.4 -apple-system, sans-serif'
        });

        panel.innerHTML = `
          <div id="po-v4-header" style="padding:10px;background:#064e3b;display:flex;justify-content:space-between;align-items:center;cursor:move;touch-action:none;">
            <b>⚡ SCANNER V4 (FIXED)</b>
            <span>
              <button id="po-v4-min">−</button>
              <button id="po-v4-close">×</button>
            </span>
          </div>
          <div id="po-v4-body" style="padding:12px">
            <div id="po-v4-status" style="background:#253545;padding:8px;border-radius:6px;font-size:11px;">Connecting feed...</div>
            <div id="po-v4-pair" style="margin-top:8px;font-weight:bold;">Asset: Detecting...</div>
            <div id="po-v4-count" style="margin-top:4px;">Candles: 0</div>
            <div id="po-v4-signal" style="margin-top:10px;padding:10px;background:#1e293b;border-radius:6px;">Waiting for candles...</div>
            <div id="po-v4-indicators" style="margin-top:6px;font-size:11px;color:#cbd5e1;"></div>
          </div>
        `;

        document.body.appendChild(panel);

        let reopen = document.getElementById(REOPEN_ID);
        if (!reopen) {
            reopen = document.createElement('button');
            reopen.id = REOPEN_ID;
            reopen.textContent = '⚡ OPEN SCANNER';
            Object.assign(reopen.style, {
                position: 'fixed',
                right: '15px',
                bottom: '100px',
