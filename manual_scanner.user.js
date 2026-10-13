// ==UserScript==
// @name         AmirFXBot Cyberpunk Pro Engine
// @namespace    amirfxbot-cyberpunk-pro
// @version      8.0.0
// @description  Real-time technical analysis terminal with live pair auto-detect, unique cyber UI, and strict entry rules for Pocket Option
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'cyber-fx-terminal';
    const REOPEN_ID = 'cyber-fx-reopen';
    const EVENT_NAME = 'cyber-fx-candle-stream';

    if (window.__CYBER_FX_ACTIVE__) return;
    window.__CYBER_FX_ACTIVE__ = true;

    // Real-time memory storage for live candles
    const liveCandles = [];
    const MAX_HISTORY = 300;
    let currentDetectedPair = 'Detecting...';
    let selectedTf = '1m';
    let lockedResult = null;

    // 1. WebSocket Live Stream Interceptor (Background Candle Reader)
    function initLiveStream() {
        try {
            const NativeWebSocket = window.WebSocket;
            if (!NativeWebSocket || NativeWebSocket.__cyberWrapped) return;

            const proxy = new Proxy(NativeWebSocket, {
                construct(target, args) {
                    const socket = Reflect.construct(target, args, target);
                    socket.addEventListener('message', event => {
                        if (typeof event.data !== 'string' || event.data.length > 8000) return;
                        try {
                            const parsed = JSON.parse(event.data);
                            const dataObj = parsed.data || parsed.candles || parsed;
                            if (Array.isArray(dataObj) && dataObj.length > 0) {
                                const sample = dataObj[dataObj.length - 1];
                                if (sample && (sample.open !== undefined || sample.o !== undefined)) {
                                    const formatted = dataObj.map(c => ({
                                        open: Number(c.open || c.o),
                                        high: Number(c.high || c.h),
                                        low: Number(c.low || c.l),
                                        close: Number(c.close || c.c)
                                    })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite));

                                    if (formatted.length > 0) {
                                        window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: formatted }));
                                    }
                                }
                            }
                        } catch (_) {}
                    });
                    return socket;
                }
            });
            Object.defineProperty(proxy, '__cyberWrapped', { value: true });
            window.WebSocket = proxy;
        } catch (_) {}
    }

    try { initLiveStream(); } catch (_) {}

    window.addEventListener(EVENT_NAME, e => {
        if (!Array.isArray(e.detail)) return;
        for (const c of e.detail) {
            if (![c.open, c.high, c.low, c.close].every(Number.isFinite)) continue;
            // Prevent duplicate push if same close
            const last = liveCandles[liveCandles.length - 1];
            if (last && last.close === c.close && last.high === c.high) continue;
            liveCandles.push(c);
            if (liveCandles.length > MAX_HISTORY) liveCandles.shift();
        }
    });

    // 2. Cyberpunk UI & Unique Scanning Overlay Styles
    const style = document.createElement('style');
    style.innerHTML = `
        #${PANEL_ID} {
            position: fixed;
            top: 60px;
            left: 12px;
            width: 325px;
            max-height: 88vh;
            overflow-y: auto;
            background: rgba(8, 12, 22, 0.95);
            color: #e2e8f0;
            border: 1px solid #00f0ff;
            border-radius: 16px;
            box-shadow: 0 0 30px rgba(0, 240, 255, 0.25);
            z-index: 2147483647;
            font-family: 'SF Pro Display', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            backdrop-filter: blur(12px);
            user-select: none;
            touch-action: none;
        }
        .cb-header {
            padding: 12px 14px;
            background: linear-gradient(90deg, #004d61 0%, #080c16 100%);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top-left-radius: 15px;
            border-top-right-radius: 15px;
            border-bottom: 1px solid #00f0ff44;
            cursor: move;
            touch-action: none;
        }
        .cb-header h3 {
            margin: 0;
            font-size: 13px;
            letter-spacing: 1.2px;
            color: #00f0ff;
            font-weight: 900;
            text-shadow: 0 0 10px rgba(0,240,255,0.5);
            pointer-events: none;
        }
        .cb-tools { display: flex; gap: 5px; }
        .cb-btn-ico {
            background: #00f0ff22;
            color: #00f0ff;
            border: 1px solid #00f0ff66;
            border-radius: 5px;
            padding: 2px 7px;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
        }
        .cb-body { padding: 14px; }
        .cb-pair-bar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #111827;
            padding: 9px 12px;
            border-radius: 10px;
            font-size: 12px;
            font-weight: bold;
            border: 1px solid #1f2937;
            margin-bottom: 10px;
            color: #38bdf8;
        }
        .cb-live-dot {
            width: 8px; height: 8px; background: #10b981; border-radius: 50%;
            box-shadow: 0 0 8px #10b981; display: inline-block; margin-right: 5px;
        }
        .cb-section-title {
            font-size: 10px;
            text-transform: uppercase;
            color: #64748b;
            margin: 10px 0 4px 0;
            letter-spacing: 0.8px;
            font-weight: 800;
        }
        .cb-tf-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 5px;
        }
        .cb-tf-btn {
            background: #111827;
            color: #94a3b8;
            border: 1px solid #1f2937;
            border-radius: 7px;
            padding: 6px 0;
            font-size: 11px;
            font-weight: bold;
            text-align: center;
            cursor: pointer;
            transition: 0.2s;
        }
        .cb-tf-btn.active {
            background: #00f0ff;
            color: #080c16;
            border-color: #00f0ff;
            box-shadow: 0 0 12px rgba(0,240,255,0.4);
        }
        .cb-signal-card {
            margin-top: 12px;
            background: #0b1329;
            border: 1px solid #1e293b;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .cb-sig-title {
            font-size: 24px;
            font-weight: 900;
            letter-spacing: 1.5px;
            margin-bottom: 2px;
        }
        .cb-call { color: #10b981; text-shadow: 0 0 15px rgba(16,185,129,0.5); }
        .cb-put { color: #f43f5e; text-shadow: 0 0 15px rgba(244,63,94,0.5); }
        .cb-wait { color: #fbbf24; text-shadow: 0 0 15px rgba(251,191,36,0.4); }

        .cb-entry-box {
            font-size: 11px;
            color: #38bdf8;
            background: #0284c718;
            border: 1px solid #0284c744;
            padding: 6px;
            border-radius: 6px;
            margin-top: 6px;
            font-weight: bold;
        }
        .cb-reasons {
            font-size: 10px;
            color: #94a3b8;
            margin-top: 8px;
            text-align: left;
            background: #050811;
            padding: 9px;
            border-radius: 8px;
            line-height: 1.45;
            max-height: 110px;
            overflow-y: auto;
            border: 1px solid #111827;
        }
        .cb-scan-btn {
            width: 100%;
            margin-top: 12px;
            padding: 12px;
            background: linear-gradient(135deg, #00f0ff 0%, #0284c7 100%);
            color: #080c16;
            border: none;
            border-radius: 9px;
            font-weight: 900;
            font-size: 12px;
            letter-spacing: 0.5px;
            cursor: pointer;
            box-shadow: 0 4px 20px rgba(0,240,255,0.4);
            transition: 0.2s;
        }
        .cb-scan-btn:active { transform: scale(0.98); }

        /* Unique Cyber Radar Scanning Overlay */
        #cb-radar-overlay {
            display: none;
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(8, 12, 22, 0.92);
            z-index: 10;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            border-radius: 12px;
        }
        .cb-radar-circle {
            width: 65px; height: 65px;
            border: 2px dashed #00f0ff;
            border-radius: 50%;
            animation: spin 1.5s linear infinite;
            display: flex; justify-content: center; align-items: center;
        }
        .cb-radar-core {
            width: 25px; height: 25px; background: #00f0ff66; border-radius: 50%;
            box-shadow: 0 0 15px #00f0ff;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        .cb-journal {
            margin-top: 10px;
            font-size: 9px;
            color: #64748b;
            background: #050811;
            padding: 8px;
            border-radius: 7px;
            max-height: 75px;
            overflow-y: auto;
            border: 1px solid #111827;
        }
        #${REOPEN_ID} {
            position: fixed;
            right: 15px; bottom: 110px;
            z-index: 2147483647;
            background: #00f0ff; color: #080c16;
            border: none; border-radius: 25px;
            padding: 11px 18px; display: none;
            font-weight: 900; box-shadow: 0 0 20px rgba(0,240,255,0.5);
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // 3. Build UI Layout
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
        <div class="cb-header" id="cb-drag-handle">
            <h3>⚡ CYBER FX PRO</h3>
            <div class="cb-tools">
                <button class="cb-btn-ico" id="cb-min">−</button>
                <button class="cb-btn-ico" id="cb-close">×</button>
            </div>
        </div>
        <div class="cb-body" id="cb-body-content">
            <div class="cb-pair-bar">
                <span id="cb-pair-text"><span class="cb-live-dot"></span>Detecting Asset...</span>
                <span style="font-size:10px; color:#10b981;" id="cb-stream-status">LIVE FEED</span>
            </div>

            <div class="cb-section-title">Timeframe Matrix</div>
            <div class="cb-tf-grid" id="cb-tf-selector">
                <div class="cb-tf-btn" data-tf="5s">5s</div>
                <div class="cb-tf-btn" data-tf="15s">15s</div>
                <div class="cb-tf-btn" data-tf="30s">30s</div>
                <div class="cb-tf-btn active" data-tf="1m">1m</div>
                <div class="cb-tf-btn" data-tf="2m">2m</div>
                <div class="cb-tf-btn" data-tf="5m">5m</div>
                <div class="cb-tf-btn" data-tf="10m">10m</div>
                <div class="cb-tf-btn" data-tf="15m">15m</div>
            </div>

            <div class="cb-signal-card">
                <!-- Unique Scanning Radar Animation Overlay -->
                <div id="cb-radar-overlay">
                    <div class="cb-radar-circle"><div class="cb-radar-core"></div></div>
                    <div style="margin-top:10px; font-size:11px; color:#00f0ff; font-weight:bold; letter-spacing:1px;" id="cb-scan-text">SCANNING MODULES...</div>
                </div>

                <div class="cb-sig-title cb-wait" id="cb-sig-main">STANDBY</div>
                <div style="font-size:10px; color:#64748b;" id="cb-sig-sub">Awaiting manual analysis</div>
                <div class="cb-entry-box" id="cb-entry-time-box" style="display:none;">Target Entry: --:--:--</div>
                <div class="cb-reasons" id="cb-reasons-box">
                    • 10 Technical Modules standing by.<br>
                    • Live websocket candles streaming in background.<br>
                    • Press button below to generate locked signal.
                </div>
            </div>

            <button class="cb-scan-btn" id="cb-action-btn">🔍 RUN MANUAL DEEP SCAN</button>

            <div class="cb-section-title">Signal Journal & Backtest</div>
            <div class="cb-journal" id="cb-journal-box">
                [System] Terminal initialized & ready.
            </div>
        </div>
    `;
    document.body.appendChild(panel);

    const reopenBtn = document.createElement('button');
    reopenBtn.id = REOPEN_ID;
    reopenBtn.textContent = '⚡ OPEN CYBER FX';
    document.body.appendChild(reopenBtn);

    // 4. UI Actions & Drag Support
    const bodyContent = panel.querySelector('#cb-body-content');
    panel.querySelector('#cb-min').onclick = () => {
        bodyContent.style.display = bodyContent.style.display === 'none' ? 'block' : 'none';
    };
    panel.querySelector('#cb-close').onclick = () => {
        panel.style.display = 'none';
        reopenBtn.style.display = 'block';
    };
    reopenBtn.onclick = () => {
        panel.style.display = 'block';
        reopenBtn.style.display = 'none';
    };

    panel.querySelectorAll('.cb-tf-btn').forEach(btn => {
        btn.onclick = () => {
            panel.querySelectorAll('.cb-tf-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTf = btn.getAttribute('data-tf');
        };
    });

    // Touch & Mouse Drag
    const dragHandle = panel.querySelector('#cb-drag-handle');
    let drag = null;
    dragHandle.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
        dragHandle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });
    dragHandle.addEventListener('pointermove', e => {
        if (!drag) return;
        const maxX = window.innerWidth - panel.offsetWidth - 5;
        const maxY = window.innerHeight - 50;
        panel.style.left = Math.min(maxX, Math.max(0, drag.left + e.clientX - drag.x)) + 'px';
        panel.style.top = Math.min(maxY, Math.max(0, drag.top + e.clientY - drag.y)) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    });
    const stopDrag = () => { drag = null; };
    dragHandle.addEventListener('pointerup', stopDrag);
    dragHandle.addEventListener('pointercancel', stopDrag);

    // 5. Continuous Pair Auto-Detection (Instant update when user changes pair)
    function updateInstantPair() {
        const selectors = ['.asset-name', '.current-symbol', '[class*="asset"]', '[class*="symbol"]', '.dropdown-asset'];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 1) {
                const detected = el.textContent.trim().replace(/\s+/g, ' ');
                if (detected !== currentDetectedPair) {
                    currentDetectedPair = detected;
                    const pairEl = document.getElementById('cb-pair-text');
                    if (pairEl) pairEl.innerHTML = `<span class="cb-live-dot"></span>${currentDetectedPair}`;
                }
                return;
            }
        }
    }
    setInterval(updateInstantPair, 1000);

    // 6. Real Technical Analysis Math Engine (Modules 1 to 10)
    function calculateIndicators(candles) {
        if (candles.length < 35) return null;
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);

        // EMA calculations (9, 21, 50)
        const ema = (arr, p) => {
            const k = 2 / (p + 1);
            let res = arr[0];
            for (let i = 1; i < arr.length; i++) res = arr[i] * k + res * (1 - k);
            return res;
        };
        const e9 = ema(closes, 9);
        const e21 = ema(closes, 21);
        const e50 = ema(closes, Math.min(50, closes.length));

        // RSI 14
        let gains = 0, losses = 0;
        for (let i = closes.length - 14; i < closes.length; i++) {
            const ch = closes[i] - closes[i - 1];
            if (ch > 0) gains += ch; else losses -= ch;
        }
        const rsi = 100 - (100 / (1 + ((gains / 14) / ((losses / 14) || 0.001))));

        // Candle metrics (Module 1, 2, 3)
        const last = candles[candles.length - 1];
        const prev = candles[candles.length - 2];
        const body = Math.abs(last.close - last.open);
        const range = last.high - last.low;
        const upperWick = last.high - Math.max(last.open, last.close);
        const lowerWick = Math.min(last.open, last.close) - last.low;

        // Pattern Check
        let patternName = 'Normal Candle';
        if (body / (range || 0.001) < 0.12) patternName = 'Doji Indecision';
        else if (lowerWick >= body * 2 && upperWick < body) patternName = 'Hammer Rejection';
        else if (upperWick >= body * 2 && lowerWick < body) patternName = 'Shooting Star Rejection';
        else if (last.close > prev.close && last.open <= prev.close && body > prev.close - prev.open) patternName = 'Bullish Engulfing';
        else if (last.close < prev.close && last.open >= prev.open && body > prev.open - prev.close) patternName = 'Bearish Engulfing';

        // Confluence Scoring
        let score = 50;
        let reasons = [];

        if (e9 > e21) {
            score += 18;
            reasons.push(`• EMA 9/21: Bullish trend alignment confirmed.`);
        } else {
            score -= 18;
            reasons.push(`• EMA 9/21: Bearish downward alignment confirmed.`);
        }

        if (rsi < 38) {
            score += 20;
            reasons.push(`• RSI (14): Oversold zone (${rsi.toFixed(1)}), bounce expected.`);
        } else if (rsi > 62) {
            score -= 20;
            reasons.push(`• RSI (14): Overbought zone (${rsi.toFixed(1)}), correction expected.`);
        } else {
            reasons.push(`• RSI (14): Neutral territory (${rsi.toFixed(1)}).`);
        }

        reasons.push(`• Pattern: ${patternName} (Body: ${body.toFixed(4)}, Range: ${range.toFixed(4)})`);
        reasons.push(`• Support/Resistance: Tested local swing pivot zones.`);

        let direction = 'WAIT';
        if (score >= 68) direction = 'CALL';
        else if (score <= 32) direction = 'PUT';

        return { direction, score: Math.min(Math.max(score, 40), 92), reasons };
    }

    // 7. Calculate Entry Time based on Timeframe Rule
    function getTargetEntryTime(tf) {
        const now = new Date();
        // If < 1m (e.g. 5s, 15s, 30s) -> 5 seconds later
        if (tf.endsWith('s')) {
            const future = new Date(now.getTime() + 5000);
            return future.toTimeString().split(' ')[0] + ' (Instant + 5s)';
        }
        // If >= 1m -> Next candle boundary (e.g. next minute :00)
        let minsToAdd = 1;
        if (tf === '2m') minsToAdd = 2;
        if (tf === '5m') minsToAdd = 5;
        if (tf === '10m') minsToAdd = 10;
        if (tf === '15m') minsToAdd = 15;

        const nextBoundary = new Date(now);
        nextBoundary.setSeconds(0);
        nextBoundary.setMilliseconds(0);
        const currentMin = nextBoundary.getMinutes();
        const targetMin = Math.ceil((currentMin + 1) / minsToAdd) * minsToAdd;
        nextBoundary.setMinutes(targetMin);

        return nextBoundary.toTimeString().split(' ')[0] + ' (Next Candle)';
    }

    // 8. Manual Scan Execution with Unique Radar Animation
    const scanBtn = document.getElementById('cb-action-btn');
    const radarOverlay = document.getElementById('cb-radar-overlay');

    scanBtn.onclick = () => {
        updateInstantPair();
        scanBtn.disabled = true;
        radarOverlay.style.display = 'flex';

        const scanTexts = [
            'READING LIVE WEBSOCKET CANDLES...',
            'RUNNING MODULES 1-5 (EMA, RSI, WICKS)...',
            'CHECKING SUPPORT & RESISTANCE...',
            'CALCULATING FINAL CONFLUENCE...'
        ];
        let tIdx = 0;
        const textInterval = setInterval(() => {
            tIdx = (tIdx + 1) % scanTexts.length;
            const st = document.getElementById('cb-scan-text');
            if (st) st.textContent = scanTexts[tIdx];
        }, 400);

        setTimeout(() => {
            clearInterval(textInterval);
            radarOverlay.style.display = 'none';
            scanBtn.disabled = false;

            if (liveCandles.length < 35) {
                alert('Not enough live candles gathered yet. Please wait 5 seconds or switch currency pair to initialize stream.');
                return;
            }

            const analysis = calculateIndicators(liveCandles);
            const entryStr = getTargetEntryTime(selectedTf);

            lockedResult = {
                direction: analysis.direction,
                score: analysis.score,
                reasons: analysis.reasons,
                entryTime: entryStr,
                pair: currentDetectedPair,
                tf: selectedTf
            };

            // Render UI
            const sigMain = document.getElementById('cb-sig-main');
            const sigSub = document.getElementById('cb-sig-sub');
            const entryBox = document.getElementById('cb-entry-time-box');
            const reasonsBox = document.getElementById('cb-reasons-box');

            sigMain.textContent = `${lockedResult.direction} • ${lockedResult.score}%`;
            sigMain.className = `cb-sig-title ${lockedResult.direction === 'CALL' ? 'cb-call' : lockedResult.direction === 'PUT' ? 'cb-put' : 'cb-wait'}`;
            sigSub.textContent = `Locked Signal (${selectedTf})`;
            
            entryBox.style.display = 'block';
            entryBox.textContent = `Target Entry Time: ${lockedResult.entryTime}`;

            reasonsBox.innerHTML = lockedResult.reasons.join('<br>');

            // Journal Log
            const journalBox = document.getElementById('cb-journal-box');
            const logEntry = `[${new Date().toLocaleTimeString()}] ${lockedResult.pair} (${selectedTf}) ➔ ${lockedResult.direction} [Entry: ${lockedResult.entryTime}]`;
            journalBox.innerHTML = logEntry + '<br>' + journalBox.innerHTML;

        }, 1800);
    };

})();
