// ==UserScript==
// @name         Pocket Option Auto Scanner V4
// @namespace    po-auto-scanner-v4
// @version      4.0.0
// @description  Read-only candle detection diagnostics and technical analysis
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @run-at       document-start
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
     * PAGE DATA OBSERVER
     * Looks for conventional OHLC objects in WebSocket messages.
     * It does not submit orders or inspect account credentials.
     */
    function installReadOnlyObserver() {
        try {
            const NativeWebSocket = window.WebSocket;
            if (!NativeWebSocket || NativeWebSocket.__poV4Wrapped) return;

            function extractCandles(value, output, depth) {
                if (depth > 8 || value == null) return;

                if (Array.isArray(value)) {
                    for (const item of value) {
                        extractCandles(item, output, depth + 1);
                    }
                    return;
                }

                if (typeof value !== 'object') return;

                const keys = Object.keys(value);
                const lower = {};
                for (const key of keys) {
                    lower[key.toLowerCase()] = value[key];
                }

                const get = (...names) => {
                    for (const name of names) {
                        if (lower[name] !== undefined) return lower[name];
                    }
                    return undefined;
                };

                const o = get('open', 'o');
                const h = get('high', 'h');
                const l = get('low', 'l');
                const c = get('close', 'c');

                if ([o, h, l, c].every(v =>
                    v !== undefined && v !== null &&
                    v !== '' && Number.isFinite(Number(v))
                )) {
                    const candle = {
                        open: Number(o),
                        high: Number(h),
                        low: Number(l),
                        close: Number(c)
                    };

                    if (
                        candle.high >= candle.low &&
                        candle.high >= Math.max(candle.open, candle.close) &&
                        candle.low <= Math.min(candle.open, candle.close)
                    ) {
                        output.push(candle);
                    }
                }

                for (const key of keys) {
                    if (value[key] && typeof value[key] === 'object') {
                        extractCandles(value[key], output, depth + 1);
                    }
                }
            }

            const proxy = new Proxy(NativeWebSocket, {
                construct(target, args) {
                    const socket = Reflect.construct(target, args, target);

                    socket.addEventListener('message', event => {
                        if (typeof event.data !== 'string') return;

                        // Only parse JSON. Never forward raw messages.
                        try {
                            const parsed = JSON.parse(event.data);
                            const found = [];
                            extractCandles(parsed, found, 0);

                            if (found.length) {
                                window.dispatchEvent(new CustomEvent(
                                    EVENT_NAME,
                                    { detail: found.slice(-100) }
                                ));
                            }
                        } catch (_) {
                            // Unsupported or non-JSON message.
                        }
                    });

                    return socket;
                }
            });

            Object.defineProperty(proxy, '__poV4Wrapped', {
                value: true
            });

            window.WebSocket = proxy;
        } catch (_) {
            // The browser may prevent page-level instrumentation.
        }
    }

    /*
     * Try to install the observer in the page context.
     * If the browser blocks inline injection, diagnostics will report no data.
     */
    function injectObserver() {
        const script = document.createElement('script');

        script.textContent = '(' + installReadOnlyObserver.toString() + ')();';

        (document.documentElement || document.head).appendChild(script);
        script.remove();
    }

    try {
        injectObserver();
    } catch (_) {}

    /*
     * SCANNER UI AND ANALYSIS
     */
    const candles = [];
    const MAX_CANDLES = 500;
    let lastCandleKey = '';
    let lastDataAt = 0;
    let panel = null;
    let selectedPair = 'Detecting pair…';

    function addCandles(incoming) {
        if (!Array.isArray(incoming)) return;

        for (const c of incoming) {
            if (
                !c ||
                ![c.open, c.high, c.low, c.close].every(Number.isFinite) ||
                c.high < c.low ||
                c.high < Math.max(c.open, c.close) ||
                c.low > Math.min(c.open, c.close)
            ) continue;

            const key = [
                c.open, c.high, c.low, c.close
            ].join('|');

            if (key === lastCandleKey) continue;

            lastCandleKey = key;
            candles.push({
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close
            });

            if (candles.length > MAX_CANDLES) candles.shift();
            lastDataAt = Date.now();
        }

        updatePanel();
    }

    window.addEventListener(EVENT_NAME, event => {
        addCandles(event.detail);
    });

    function detectPair() {
        const text = document.body?.innerText || '';

        const patterns = [
            /\b[A-Z]{3}\s*\/\s*[A-Z]{3}\s*OTC\b/i,
            /\b[A-Z]{3}\s*\/\s*[A-Z]{3}\b/i
        ];

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match) return match[0].replace(/\s+/g, ' ').trim();
        }

        return 'Pair not detected';
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

        let gains = 0;
        let losses = 0;

        for (let i = values.length - period; i < values.length; i++) {
            const change = values[i] - values[i - 1];

            if (change > 0) gains += change;
            else losses -= change;
        }

        const avgGain = gains / period;
        const avgLoss = losses / period;

        if (avgGain === 0 && avgLoss === 0) return 50;
        if (avgLoss === 0) return 100;

        return 100 - 100 / (1 + avgGain / avgLoss);
    }

    function analyse() {
        if (candles.length < 50) {
            return {
                signal: 'DATA INSUFFICIENT',
                reason: 'At least 50 detected candles are required.'
            };
        }

        const closes = candles.map(c => c.close);

        const e9 = ema(closes, 9);
        const e21 = ema(closes, 21);
        const e50 = ema(closes, 50);
        const rsi = calculateRSI(closes);

        if ([e9, e21, e50, rsi].some(v => v === null)) {
            return {
                signal: 'DATA INSUFFICIENT',
                reason: 'Indicators could not be calculated.'
            };
        }

        const last = candles[candles.length - 1];
        const previous = candles[candles.length - 2];

        const bullishTrend = e9 > e21 && e21 > e50;
        const bearishTrend = e9 < e21 && e21 < e50;

        const bullishCandle =
            last.close > last.open &&
            last.close > previous.close;

        const bearishCandle =
            last.close < last.open &&
            last.close < previous.close;

        if (bullishTrend && rsi >= 50 && rsi <= 68 && bullishCandle) {
            return {
                signal: 'CALL BIAS',
                reason: 'EMA trend, RSI and candle direction agree.',
                e9, e21, e50, rsi
            };
        }

        if (bearishTrend && rsi >= 32 && rsi <= 50 && bearishCandle) {
            return {
                signal: 'PUT BIAS',
                reason: 'EMA trend, RSI and candle direction agree.',
                e9, e21, e50, rsi
            };
        }

        return {
            signal: 'WAIT',
            reason: 'No sufficiently aligned setup.',
            e9, e21, e50, rsi
        };
    }

    function createPanel() {
        if (!document.body || document.getElementById(PANEL_ID)) return;

        panel = document.createElement('div');
        panel.id = PANEL_ID;

        Object.assign(panel.style, {
            position: 'fixed',
            top: '95px',
            left: '10px',
            width: 'min(310px, calc(100vw - 20px))',
            maxHeight: '68vh',
            overflowY: 'auto',
            zIndex: '2147483647',
            background: '#101923',
            color: '#fff',
            border: '2px solid #10b981',
            borderRadius: '12px',
            boxShadow: '0 6px 25px #0009',
            font: '14px/1.45 -apple-system,Arial,sans-serif',
            display: 'block'
        });

        panel.innerHTML = `
          <div id="po-v4-header" style="
            padding:11px;background:#064e3b;display:flex;
            justify-content:space-between;align-items:center;
            touch-action:none;user-select:none">
            <b>⚡ OTC AUTO SCANNER V4</b>
            <span>
              <button id="po-v4-min">−</button>
              <button id="po-v4-close">×</button>
            </span>
          </div>
          <div id="po-v4-body" style="padding:12px">
            <div id="po-v4-status" style="
              background:#253545;padding:9px;border-radius:7px">
              Checking data connection…
            </div>
            <div id="po-v4-pair" style="margin-top:9px">
              Selected pair: Detecting…
            </div>
            <div id="po-v4-count" style="margin-top:5px">
              Candles received: 0
            </div>
            <div id="po-v4-signal" style="
              margin-top:12px;padding:12px;background:#1e293b;
              border-radius:8px">
              Waiting for real candle data.
            </div>
            <div id="po-v4-indicators" style="
              margin-top:8px;font-size:12px;color:#cbd5e1"></div>
            <div style="margin-top:10px;font-size:11px;color:#cbd5e1">
              Read-only analysis. No automatic orders. Signals are not
              guaranteed. The detected feed format may be unsupported.
            </div>
          </div>
        `;

        panel.querySelectorAll('button').forEach(button => {
            Object.assign(button.style, {
                background: '#087f5b',
                color: '#fff',
                border: '0',
                borderRadius: '5px',
                padding: '6px 9px',
                fontWeight: 'bold'
            });
        });

        document.body.appendChild(panel);

        let reopen = document.getElementById(REOPEN_ID);

        if (!reopen) {
            reopen = document.createElement('button');
            reopen.id = REOPEN_ID;
            reopen.textContent = '⚡ OPEN SCANNER';

            Object.assign(reopen.style, {
                position: 'fixed',
                right: '10px',
                bottom: '90px',
                zIndex: '2147483647',
                background: '#087f5b',
                color: '#fff',
                border: '0',
                borderRadius: '25px',
                padding: '12px',
                display: 'none'
            });

            document.body.appendChild(reopen);
        }

        const body = panel.querySelector('#po-v4-body');

        panel.querySelector('#po-v4-min').onclick = () => {
            body.style.display = body.style.display === 'none'
                ? 'block' : 'none';
        };

        panel.querySelector('#po-v4-close').onclick = () => {
            panel.style.display = 'none';
            reopen.style.display = 'block';
        };

        reopen.onclick = () => {
            panel.style.display = 'block';
            reopen.style.display = 'none';
        };

        // Drag panel using its header.
        const header = panel.querySelector('#po-v4-header');
        let drag = null;

        header.addEventListener('pointerdown', event => {
            if (event.target.closest('button')) return;

            const rect = panel.getBoundingClientRect();

            drag = {
                x: event.clientX,
                y: event.clientY,
                left: rect.left,
                top: rect.top
            };

            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            try {
                header.setPointerCapture(event.pointerId);
            } catch (_) {}

            event.preventDefault();
        });

        header.addEventListener('pointermove', event => {
            if (!drag) return;

            const maxX = Math.max(0, innerWidth - panel.offsetWidth);
            const maxY = Math.max(0, innerHeight - 50);

            panel.style.left = Math.min(maxX, Math.max(0,
                drag.left + event.clientX - drag.x)) + 'px';

            panel.style.top = Math.min(maxY, Math.max(0,
                drag.top + event.clientY - drag.y)) + 'px';
        });

        const stop = () => { drag = null; };

        header.addEventListener('pointerup', stop);
        header.addEventListener('pointercancel', stop);

        updatePanel();
    }

    function updatePanel() {
        if (!panel || !document.getElementById(PANEL_ID)) return;

        selectedPair = detectPair();

        const age = lastDataAt ? Date.now() - lastDataAt : Infinity;
        const fresh = age < 15000;

        panel.querySelector('#po-v4-pair').textContent =
            'Selected pair: ' + selectedPair;

        panel.querySelector('#po-v4-count').textContent =
            'Candles received: ' + candles.length;

        const status = panel.querySelector('#po-v4-status');

        if (!lastDataAt) {
            status.textContent =
                '🔴 DATA OFFLINE — no supported candle messages detected.';
        } else if (!fresh) {
            status.textContent =
                '🟠 DATA STALE — no new candle data recently.';
        } else {
            status.textContent =
                '🟢 CANDLE MESSAGES DETECTED — feed format not independently verified.';
        }

        const output = panel.querySelector('#po-v4-signal');

        if (!fresh || candles.length < 50) {
            output.textContent =
                'No actionable signal. Waiting for fresh real candle data.';
            panel.querySelector('#po-v4-indicators').textContent = '';
            return;
        }

        const result = analyse();

        output.textContent = result.signal + '\n' + result.reason;
        output.style.whiteSpace = 'pre-line';

        panel.querySelector('#po-v4-indicators').textContent =
            result.rsi === undefined
                ? ''
                : 'EMA 9: ' + result.e9.toFixed(6) +
                  ' | EMA 21: ' + result.e21.toFixed(6) +
                  ' | EMA 50: ' + result.e50.toFixed(6) +
                  ' | RSI: ' + result.rsi.toFixed(1);
    }

    function boot() {
        if (!document.body) {
            setTimeout(boot, 250);
            return;
        }

        createPanel();

        // Pair label may change after the user selects another instrument.
        const observer = new MutationObserver(() => {
            if (!document.getElementById(PANEL_ID)) {
                createPanel();
            }
            updatePanel();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true
        });

        // Refresh diagnostics even if the page does not mutate.
        setInterval(updatePanel, 3000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
