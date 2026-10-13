// ==UserScript==
// @name         Pocket Option Auto Scanner Mobile Fixed
// @namespace    po-auto-scanner-mobile-fixed
// @version      4.2.0
// @description  Mobile Safari persistent-inject read-only scanner for Pocket Option
// @match        https://*.pocketoption.com/*
// @match        https://pocketoption.com/*
// @match        https://*.po.trade/*
// @match        https://po.trade/*
// @match        https://*.pocket-option.com/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'po-auto-scanner-v4';
    const REOPEN_ID = 'po-auto-scanner-v4-reopen';
    const EVENT_NAME = 'po-v4-normalized-candle';

    if (window.__PO_AUTO_SCANNER_MOBILE__) return;
    window.__PO_AUTO_SCANNER_MOBILE__ = true;

    // 1. Lightweight WebSocket Hook for Safari
    try {
        const NativeWebSocket = window.WebSocket;
        if (NativeWebSocket && !NativeWebSocket.__poWrapped) {
            const proxy = new Proxy(NativeWebSocket, {
                construct(target, args) {
                    const socket = Reflect.construct(target, args, target);
                    socket.addEventListener('message', event => {
                        if (typeof event.data !== 'string' || event.data.length > 4000) return;
                        try {
                            const parsed = JSON.parse(event.data);
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
                                        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: candlesList.slice(-15) }));
                                    }
                                }
                            }
                        } catch (_) {}
                    });
                    return socket;
                }
            });
            Object.defineProperty(proxy, '__poWrapped', { value: true });
            window.WebSocket = proxy;
        }
    } catch (_) {}

    // Scanner state
    const candles = [];
    const MAX_CANDLES = 150;
    let lastCandleKey = '';
    let lastDataAt = 0;

    window.addEventListener(EVENT_NAME, event => {
        if (!Array.isArray(event.detail)) return;
        for (const c of event.detail) {
            if (!c || ![c.open, c.high, c.low, c.close].every(Number.isFinite)) continue;
            const key = `${c.open}|${c.high}|${c.low}|${c.close}`;
            if (key === lastCandleKey) continue;
            lastCandleKey = key;
            candles.push(c);
            if (candles.length > MAX_CANDLES) candles.shift();
            lastDataAt = Date.now();
        }
    });

    function ema(values, period) {
        if (values.length < period) return null;
        const k = 2 / (period + 1);
        let res = values[0];
        for (let i = 1; i < values.length; i++) {
            res = values[i] * k + res * (1 - k);
        }
        return res;
    }

    function calculateRSI(values, period = 14) {
        if (values.length < period + 1) return null;
        let gains = 0, losses = 0;
        for (let i = values.length - period; i < values.length; i++) {
            const ch = values[i] - values[i - 1];
            if (ch > 0) gains += ch;
            else losses -= ch;
        }
        const avgG = gains / period;
        const avgL = losses / period;
        if (avgG === 0 && avgL === 0) return 50;
        if (avgL === 0) return 100;
        return 100 - (100 / (1 + (avgG / avgL)));
    }

    function analyse() {
        if (candles.length < 25) return { signal: 'GATHERING DATA', reason: 'Waiting for more candles...' };
        const closes = candles.map(c => c.close);
        const e9 = ema(closes, 9);
        const e21 = ema(closes, 21);
        const rsi = calculateRSI(closes);

        if (e9 === null || e21 === null || rsi === null) return { signal: 'CALCULATING', reason: 'Processing indicators...' };

        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];

        if (e9 > e21 && rsi >= 48 && last.close > prev.close) {
            return { signal: 'CALL BIAS (UP)', reason: 'Bullish trend alignment detected.', e9, e21, rsi };
        }
        if (e9 < e21 && rsi <= 52 && last.close < prev.close) {
            return { signal: 'PUT BIAS (DOWN)', reason: 'Bearish trend alignment detected.', e9, e21, rsi };
        }
        return { signal: 'WAIT', reason: 'Market consolidation range.', e9, e21, rsi };
    }

    // 2. Persistent Self-Healing UI Creator
    function ensurePanelExists() {
        if (!document.body) return;

        let panel = document.getElementById(PANEL_ID);
        if (panel) {
            updatePanelContent(panel);
            return;
        }

        panel = document.createElement('div');
        panel.id = PANEL_ID;
        Object.assign(panel.style, {
            position: 'fixed',
            top: '80px',
            left: '10px',
            width: '270px',
            maxHeight: '65vh',
            overflowY: 'auto',
            zIndex: '2147483647',
            background: '#0d131d',
            color: '#ffffff',
            border: '2px solid #00ffaa',
            borderRadius: '14px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.8)',
            font: '12px/1.4 -apple-system, sans-serif',
            padding: '0'
        });

        panel.innerHTML = `
            <div id="po-v4-header" style="padding:10px 12px;background:#064e3b;display:flex;justify-content:space-between;align-items:center;border-top-left-radius:12px;border-top-right-radius:12px;cursor:pointer;">
                <b style="color:#00ffaa;font-size:13px;">⚡ MOBILE SCANNER V4</b>
                <div>
                    <button id="po-v4-min" style="background:#043929;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-weight:bold;margin-right:4px;">−</button>
                    <button id="po-v4-close" style="background:#043929;color:#fff;border:none;border-radius:4px;padding:3px 7px;font-weight:bold;">×</button>
                </div>
            </div>
            <div id="po-v4-body" style="padding:12px;">
                <div id="po-v4-status" style="background:#1b2838;padding:8px;border-radius:6px;font-size:11px;color:#00ffaa;">Initializing...</div>
                <div id="po-v4-count" style="margin-top:6px;font-size:11px;">Candles tracked: 0</div>
                <div id="po-v4-signal" style="margin-top:8px;padding:10px;background:#151f30;border-radius:6px;font-weight:bold;">Waiting for WebSocket feed...</div>
                <div id="po-v4-indicators" style="margin-top:6px;font-size:10px;color:#94a3b8;"></div>
            </div>
        `;

        document.body.appendChild(panel);

        // Reopen button creation if missing
        let reopen = document.getElementById(REOPEN_ID);
        if (!reopen) {
            reopen = document.createElement('button');
            reopen.id = REOPEN_ID;
            reopen.textContent = '⚡ OPEN SCANNER';
            Object.assign(reopen.style, {
                position: 'fixed',
                right: '10px',
                bottom: '120px',
                zIndex: '2147483647',
                background: '#064e3b',
                color: '#00ffaa',
                border: '1px solid #00ffaa',
                borderRadius: '20px',
                padding: '10px 14px',
                display: 'none',
                fontWeight: 'bold',
                boxShadow: '0 4px 15px rgba(0,0,0,0.5)'
            });
            document.body.appendChild(reopen);
            reopen.onclick = () => {
                panel.style.display = 'block';
                reopen.style.display = 'none';
            };
        }

        const bodyEl = panel.querySelector('#po-v4-body');
        panel.querySelector('#po-v4-min').onclick = () => {
            bodyEl.style.display = bodyEl.style.display === 'none' ? 'block' : 'none';
        };
        panel.querySelector('#po-v4-close').onclick = () => {
            panel.style.display = 'none';
            reopen.style.display = 'block';
        };

        // Touch & Mouse Drag Support for Mobile Screens
        const header = panel.querySelector('#po-v4-header');
        let drag = null;
        header.addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            const rect = panel.getBoundingClientRect();
            drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
            header.setPointerCapture(e.pointerId);
            e.preventDefault();
        });
        header.addEventListener('pointermove', e => {
            if (!drag) return;
            panel.style.left = Math.max(0, drag.left + e.clientX - drag.x) + 'px';
            panel.style.top = Math.max(0, drag.top + e.clientY - drag.y) + 'px';
        });
        const stopDrag = () => { drag = null; };
        header.addEventListener('pointerup', stopDrag);
        header.addEventListener('pointercancel', stopDrag);
    }

    function updatePanelContent(panel) {
        panel.querySelector('#po-v4-count').textContent = 'Candles tracked: ' + candles.length;
        const statusEl = panel.querySelector('#po-v4-status');
        const signalEl = panel.querySelector('#po-v4-signal');
        const indEl = panel.querySelector('#po-v4-indicators');

        const age = lastDataAt ? Date.now() - lastDataAt : Infinity;
        if (!lastDataAt) {
            statusEl.textContent = '🔴 Connecting live data stream...';
        } else if (age > 15000) {
            statusEl.textContent = '🟠 Stream idle. Tap/switch chart.';
        } else {
            statusEl.textContent = '🟢 Live feed active';
        }

        const res = analyse();
        signalEl.textContent = `${res.signal}\n${res.reason}`;
        signalEl.style.whiteSpace = 'pre-line';

        if (res.rsi !== undefined) {
            indEl.textContent = `EMA9: ${res.e9.toFixed(3)} | EMA21: ${res.e21.toFixed(3)} | RSI: ${res.rsi.toFixed(1)}`;
        }
    }

    // 3. Continuous Self-Healing Loop (Ensures it never disappears on Mobile SPA)
    setInterval(ensurePanelExists, 1500);

})();
