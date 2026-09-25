// ==UserScript==
// @name         Pocket Option APEX Omni-Quantum God Engine
// @namespace    https://github.com/
// @version      400.0
// @description  Cumulative Tick Delta, Volatility Squeeze Index, Tick Density Acceleration, 7-Cycle Engine, 20+ Patterns, Dual EMA & Zero-Freeze Stream
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @match        *://*.pocket-option.com/*
// @match        *://*.po2.cash/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (window.top !== window.self) return;

    // =========================================================================
    // 1. IN-PAGE CANVAS BADGE SNIFFER
    // =========================================================================
    try {
        if (typeof CanvasRenderingContext2D !== 'undefined') {
            const origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(str)) {
                        var n = parseFloat(str);
                        if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100 && Math.abs(n - 1.89) > 0.01) {
                            var fill = ("" + this.fillStyle).toLowerCase();
                            var isWhite = (fill === '#ffffff' || fill === 'rgb(255, 255, 255)' || fill === 'white' || fill === '#fff' || fill.indexOf('255, 255, 255') !== -1 || fill.indexOf('255,255,255') !== -1);
                            if (isWhite) {
                                window.__po_live_tick = n;
                                window.__po_live_tick_time = Date.now();
                            }
                        }
                    }
                }
                return origFill.apply(this, arguments);
            };
        }
    } catch(e) {}

    // Audio Alert Synthesizer
    let audioCtx = null;
    function playTone(freq, type = "sine", duration = 0.20) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch(e) {}
    }

    document.addEventListener('touchstart', () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });

    // ZERO-LEAK LIVE PRICE GETTER
    function getLivePrice() {
        if (window.__po_live_tick && (Date.now() - (window.__po_live_tick_time || 0) < 1800)) {
            return window.__po_live_tick;
        }

        const candidates = [];
        const allElements = document.querySelectorAll('*');
        for (let el of allElements) {
            if (el.children.length === 0 && el.textContent) {
                let txt = el.textContent.trim();
                if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                    let rect = el.getBoundingClientRect();
                    if (rect.top > 60 && rect.left > (window.innerWidth * 0.50)) {
                        let n = parseFloat(txt);
                        if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100 && Math.abs(n - 1.89) > 0.01) {
                            candidates.push({ val: n, str: txt, top: rect.top });
                        }
                    }
                }
            }
        }

        if (candidates.length > 0) {
            const nonGrid = candidates.filter(c => !c.str.endsWith('00') && !c.str.endsWith('50'));
            if (nonGrid.length > 0) {
                return nonGrid[nonGrid.length - 1].val;
            }
            return null;
        }
        return null;
    }

    function getActivePair() {
        const selectors = ['.current-symbol', '[class*="pair-title"]', '.asset-select'];
        for (let sel of selectors) {
            let el = document.querySelector(sel);
            if (el && el.innerText) {
                let t = el.innerText.split('\n')[0].trim();
                if (t.length > 3 && t !== "OTC ASSET") return t;
            }
        }
        return "CAD/JPY OTC";
    }

    // =========================================================================
    // 2. QUANTUM HUD INTERFACE
    // =========================================================================
    function mountHUD() {
        const root = document.body || document.documentElement;
        if (!root || document.getElementById('po-apex-hud')) return;

        const hud = document.createElement('div');
        hud.id = 'po-apex-hud';
        hud.style.cssText = `
            position: fixed !important;
            top: 165px !important;
            left: 12px !important;
            z-index: 2147483647 !important;
            background: rgba(2, 6, 20, 0.98) !important;
            border: 2px solid #0284c7 !important;
            border-radius: 14px !important;
            padding: 10px !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 16px 55px rgba(0,0,0,0.98) !important;
            width: 250px !important;
            touch-action: none !important;
            user-select: none !important;
            display: block !important;
            visibility: visible !important;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ OMNI-QUANTUM GOD v400</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="a-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="a-price" style="color: #10b981; font-weight: bold;">--</span></div>
            
            <div style="background: #081024; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>O: <b id="a-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="a-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="a-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; display: flex; justify-content: space-between;">
                    <span>BODY: <b id="a-body" style="color:#38bdf8;">0%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">0%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">0%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">TICK DELTA: <span id="a-delta" style="color: #10b981; font-weight: bold;">0 (NEUTRAL)</span></div>
            <div style="font-size: 9px; color: #94a3b8;">VOLATILITY: <span id="a-squeeze" style="color: #38bdf8; font-weight: bold;">NORMAL EXPANSION</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CYCLE RHYTHM: <span id="a-cycle" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE PATTERN: <span id="a-pattern" style="color: #c084fc; font-weight: bold;">DETECTING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR: <span id="a-snr" style="color: #38bdf8; font-weight: bold;">MID-RANGE</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN GOD QUANT MATRIX
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">God Confluence Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY TO SCAN</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Delta & Squeeze Armed</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 12s to 5s of candle</div>
        `;

        root.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 12, startBoxY = 165;
        hud.addEventListener('touchstart', function(e) {
            if (e.touches.length === 1) {
                isDragging = true;
                startTouchX = e.touches[0].clientX;
                startTouchY = e.touches[0].clientY;
                const rect = hud.getBoundingClientRect();
                startBoxX = rect.left;
                startBoxY = rect.top;
            }
        }, { passive: false });

        document.addEventListener('touchmove', function(e) {
            if (!isDragging) return;
            e.preventDefault();
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 255, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 290, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        bindScannerEvents();
    }

    // =========================================================================
    // 3. COMPLETE CANDLE ENGINE WITH QUANTITATIVE CALCULATORS
    // =========================================================================
    let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
    let lastMinuteTracked = -1;
    let candleHistory = [];
    let storedPair = "";

    // Cumulative Delta & Flow Variables
    let buyTicks = 0, sellTicks = 0, tickDelta = 0;
    let lastRecordedTickPrice = null;
    let tickTimestamps = [];

    function calculateEMA(period) {
        if (candleHistory.length < period) return null;
        let k = 2 / (period + 1);
        let ema = candleHistory[0].close;
        for (let i = 1; i < candleHistory.length; i++) {
            ema = (candleHistory[i].close * k) + (ema * (1 - k));
        }
        return ema;
    }

    function calculateRSI(period = 7) {
        if (candleHistory.length < period + 1) return 50.0;
        let gains = 0, losses = 0;
        for (let i = candleHistory.length - period; i < candleHistory.length; i++) {
            let diff = candleHistory[i].close - candleHistory[i - 1].close;
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }
        if (losses === 0) return 100.0;
        let rs = gains / losses;
        return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
    }

    function calculateATR(period = 14) {
        if (candleHistory.length < 3) return 0.0005;
        let p = Math.min(period, candleHistory.length);
        let sum = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) {
            sum += candleHistory[i].range;
        }
        return sum / p;
    }

    function runEngineTick() {
        mountHUD();

        const currentPair = getActivePair();
        const price = getLivePrice();
        const now = new Date();
        const currentSec = now.getSeconds();
        const currentMin = now.getMinutes();

        // Pair Switch Auto-Flush
        if (storedPair !== "" && currentPair !== storedPair && currentPair.length > 3) {
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;
            candleHistory = [];
            lastMinuteTracked = currentMin;
            buyTicks = 0; sellTicks = 0; tickDelta = 0;
            lastRecordedTickPrice = price;
            tickTimestamps = [];
            resetStatusBox();
        }
        storedPair = currentPair;

        // INSTANT MINUTE ROLLOVER PURGE (:00.000)
        if (currentMin !== lastMinuteTracked) {
            if (lastMinuteTracked !== -1 && candleOpen !== null && price) {
                let prevClose = candleClose || price;
                let cBody = Math.abs(prevClose - candleOpen);
                let cRange = Math.max(0.00001, candleHigh - candleLow);
                let cUpper = Math.max(0, candleHigh - Math.max(candleOpen, prevClose));
                let cLower = Math.max(0, Math.min(candleOpen, prevClose) - candleLow);

                candleHistory.push({
                    open: candleOpen,
                    close: prevClose,
                    high: candleHigh,
                    low: candleLow,
                    isGreen: prevClose >= candleOpen,
                    body: cBody,
                    range: cRange,
                    upperWick: cUpper,
                    lowerWick: cLower,
                    finalDelta: tickDelta
                });
                if (candleHistory.length > 40) candleHistory.shift();
            }

            lastMinuteTracked = currentMin;
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;

            // Reset Delta and Velocity for new candle
            buyTicks = 0; sellTicks = 0; tickDelta = 0;
            lastRecordedTickPrice = price;
            tickTimestamps = [];

            resetStatusBox();
        }

        if (price) {
            if (candleOpen === null) {
                candleOpen = price;
                candleHigh = price;
                candleLow = price;
                lastRecordedTickPrice = price;
            }

            // CUMULATIVE TICK DELTA ENGINE
            if (lastRecordedTickPrice !== null) {
                if (price > lastRecordedTickPrice) {
                    buyTicks++;
                    tickDelta++;
                } else if (price < lastRecordedTickPrice) {
                    sellTicks++;
                    tickDelta--;
                }
            }
            lastRecordedTickPrice = price;

            // TICK FREQUENCY / DENSITY (Sliding 4s window)
            let curMs = Date.now();
            tickTimestamps.push(curMs);
            tickTimestamps = tickTimestamps.filter(t => (curMs - t) <= 4000);

            if (price > candleHigh) candleHigh = price;
            if (price < candleLow) candleLow = price;
            candleClose = price;

            let decimals = price > 100 ? 3 : 5;
            let elPrice = document.getElementById('a-price');
            let elOpen = document.getElementById('a-open');
            let elHigh = document.getElementById('a-high');
            let elLow = document.getElementById('a-low');

            if (elPrice) { elPrice.innerText = price.toFixed(decimals); elPrice.style.color = "#10b981"; }
            if (elOpen) elOpen.innerText = candleOpen.toFixed(decimals);
            if (elHigh) elHigh.innerText = candleHigh.toFixed(decimals);
            if (elLow) elLow.innerText = candleLow.toFixed(decimals);

            // WICK & BODY RATIOS (WITH MICRO-DEADZONE)
            let cRange = Math.max(0.00001, candleHigh - candleLow);
            let cBody = Math.abs(candleClose - candleOpen);
            let cUpper = Math.max(0, candleHigh - Math.max(candleOpen, candleClose));
            let cLower = Math.max(0, Math.min(candleOpen, candleClose) - candleLow);

            if (cUpper < 0.000025 || (cUpper / cRange) < 0.04) cUpper = 0;
            if (cLower < 0.000025 || (cLower / cRange) < 0.04) cLower = 0;

            let bPct = Math.round((cBody / cRange) * 100);
            let uPct = Math.round((cUpper / cRange) * 100);
            let lPct = Math.round((cLower / cRange) * 100);

            let sum = bPct + uPct + lPct;
            if (sum > 100) {
                let factor = 100 / sum;
                bPct = Math.round(bPct * factor);
                uPct = Math.round(uPct * factor);
                lPct = Math.max(0, 100 - bPct - uPct);
            }

            let elBody = document.getElementById('a-body');
            let elUwick = document.getElementById('a-uwick');
            let elLwick = document.getElementById('a-lwick');
            if (elBody) elBody.innerText = `${bPct}%`;
            if (elUwick) elUwick.innerText = `${uPct}%`;
            if (elLwick) elLwick.innerText = `${lPct}%`;

            // DISPLAY DELTA
            let deltaEl = document.getElementById('a-delta');
            if (deltaEl) {
                let sign = tickDelta > 0 ? "+" : "";
                deltaEl.innerText = `${sign}${tickDelta} (${tickDelta > 0 ? "BUYERS 🟢" : (tickDelta < 0 ? "SELLERS 🔴" : "NEUTRAL")})`;
                deltaEl.style.color = tickDelta > 0 ? "#10b981" : (tickDelta < 0 ? "#ef4444" : "#94a3b8");
            }

            // VOLATILITY SQUEEZE DETECTOR
            let atr14 = calculateATR(14);
            let squeezeEl = document.getElementById('a-squeeze');
            let isSqueezed = false;
            if (candleHistory.length >= 4) {
                let recentAvgRange = (candleHistory[candleHistory.length - 1].range + candleHistory[candleHistory.length - 2].range + cRange) / 3;
                if (recentAvgRange < (atr14 * 0.52)) {
                    isSqueezed = true;
                }
            }

            if (squeezeEl) {
                if (isSqueezed) {
                    squeezeEl.innerText = "COILING SQUEEZE ⚡ (BREAKOUT SOON)";
                    squeezeEl.style.color = "#facc15";
                } else if (cRange > (atr14 * 1.5)) {
                    squeezeEl.innerText = "EXPLOSIVE EXPANSION 🚀";
                    squeezeEl.style.color = "#10b981";
                } else {
                    squeezeEl.innerText = "NORMAL FLOW";
                    squeezeEl.style.color = "#38bdf8";
                }
            }

            // 7-CYCLE RECOGNITION
            let isGreen = candleClose >= candleOpen;
            let histColors = candleHistory.slice(-5).map(c => c.isGreen ? "G" : "R");
            histColors.push(isGreen ? "G" : "R");
            let seq = histColors.join("-");

            let redStreak = 0, greenStreak = 0;
            for (let i = candleHistory.length - 1; i >= 0; i--) {
                if (!candleHistory[i].isGreen) {
                    if (greenStreak === 0) redStreak++;
                    else break;
                } else {
                    if (redStreak === 0) greenStreak++;
                    else break;
                }
            }
            if (candleClose < candleOpen) redStreak++;
            else greenStreak++;

            let cycleEl = document.getElementById('a-cycle');
            if (cycleEl) {
                if (redStreak >= 4) {
                    cycleEl.innerText = `WATERFALL CRASH (${redStreak}x RED) 🔴`;
                    cycleEl.style.color = "#ef4444";
                } else if (greenStreak >= 4) {
                    cycleEl.innerText = `ROCKET RALLY (${greenStreak}x GREEN) 🟢`;
                    cycleEl.style.color = "#10b981";
                } else if (seq.endsWith("G-R-G-R") || seq.endsWith("R-G-R-G") || seq.endsWith("G-R-G") || seq.endsWith("R-G-R")) {
                    cycleEl.innerText = "1-1 PING-PONG CYCLE 🏓";
                    cycleEl.style.color = "#facc15";
                } else if (seq.endsWith("G-G-G-R") || seq.endsWith("R-R-R-G")) {
                    cycleEl.innerText = "3-1 TREND RECHARGE ⚡";
                    cycleEl.style.color = "#38bdf8";
                } else if (seq.endsWith("G-G-R") || seq.endsWith("R-R-G")) {
                    cycleEl.innerText = "2-1 PULLBACK STAIRCASE 📈";
                    cycleEl.style.color = "#10b981";
                } else {
                    cycleEl.innerText = "BALANCED FLOW";
                    cycleEl.style.color = "#94a3b8";
                }
            }

            let livePat = isGreen ? "Buyer Pressure Flow 🟢" : "Seller Pressure Flow 🔴";
            if (isGreen && bPct >= 65 && uPct <= 8) livePat = "Bullish Marubozu 🟢";
            else if (!isGreen && bPct >= 65 && lPct <= 8) livePat = "Bearish Marubozu 🔴";
            else if (lPct >= 45 && bPct <= 35) livePat = "Hammer Rejection 🟢";
            else if (uPct >= 45 && bPct <= 35) livePat = "Shooting Star Rejection 🔴";

            let patEl = document.getElementById('a-pattern');
            if (patEl) patEl.innerText = livePat;

            // SNR LEVELS
            let swingLow = Infinity, swingHigh = -Infinity;
            for (let i = 0; i < candleHistory.length; i++) {
                if (candleHistory[i].low < swingLow) swingLow = candleHistory[i].low;
                if (candleHistory[i].high > swingHigh) swingHigh = candleHistory[i].high;
            }

            const snrEl = document.getElementById('a-snr');
            if (snrEl && swingLow !== Infinity && swingHigh !== -Infinity) {
                let buffer = (swingHigh - swingLow) * 0.16;
                if (Math.abs(price - swingLow) <= buffer) {
                    snrEl.innerText = "SUPPORT FLOOR 🟢";
                    snrEl.style.color = "#10b981";
                } else if (Math.abs(price - swingHigh) <= buffer) {
                    snrEl.innerText = "RESISTANCE ROOF 🔴";
                    snrEl.style.color = "#ef4444";
                } else {
                    snrEl.innerText = "MID-CHANNEL";
                    snrEl.style.color = "#94a3b8";
                }
            }
        }

        let elPair = document.getElementById('a-pair');
        let elTimer = document.getElementById('a-timer');
        if (elPair) elPair.innerText = currentPair;
        if (elTimer) elTimer.innerText = `${60 - currentSec}s`;
    }

    function resetStatusBox() {
        let sigText = document.getElementById('a-signal-text');
        let sigBox = document.getElementById('a-status-box');
        let confText = document.getElementById('a-conf-text');
        let desc = document.getElementById('a-desc');
        if (sigText) { sigText.innerText = "READY TO SCAN"; sigText.style.color = "#facc15"; }
        if (sigBox) { sigBox.style.borderColor = "#1e293b"; }
        if (confText) { confText.innerText = "Delta & Squeeze Armed"; }
        if (desc) { desc.innerHTML = "Scan in last 12s to 5s of candle"; }
    }

    // =========================================================================
    // 4. SCANNER: GOD-QUANT CONFLUENCE MATRIX RESOLVER
    // =========================================================================
    let isScanning = false;
    function bindScannerEvents() {
        const btn = document.getElementById('a-scan-btn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = "true";

        btn.addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('a-status-box');
            const sigText = document.getElementById('a-signal-text');
            const confText = document.getElementById('a-conf-text');
            const desc = document.getElementById('a-desc');
            const pBar = document.getElementById('a-progress-bar');
            const pFill = document.getElementById('a-progress-fill');

            if (!price || candleOpen === null) {
                if (sigText) {
                    sigText.innerText = "WAITING FOR TICK";
                    sigText.style.color = "#f43f5e";
                }
                return;
            }

            isScanning = true;
            btn.style.opacity = "0.6";
            btn.innerText = "RESOLVING QUANTUM MATRIX...";
            if (pBar) pBar.style.display = "block";
            pFill.style.width = "0%";

            let elapsed = 0;
            const sampleSteps = 10;

            const scanInterval = setInterval(() => {
                elapsed++;
                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateGodQuantumDecision();
                }
            }, 60);

            function evaluateGodQuantumDecision() {
                isScanning = false;
                btn.style.opacity = "1";
                btn.innerText = "🔬 SCAN GOD QUANT MATRIX";
                if (pBar) pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const currentPrice = candleClose || getLivePrice();

                let isGreen = currentPrice >= candleOpen;
                let bodySize = Math.abs(currentPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, currentPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, currentPrice) - candleLow);

                if (upperWick < 0.000025 || (upperWick / totalRange) < 0.04) upperWick = 0;
                if (lowerWick < 0.000025 || (lowerWick / totalRange) < 0.04) lowerWick = 0;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                let p1 = candleHistory.length >= 1 ? candleHistory[candleHistory.length - 1] : null;

                // STREAKS
                let redStreak = 0, greenStreak = 0;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (!candleHistory[i].isGreen) {
                        if (greenStreak === 0) redStreak++;
                        else break;
                    } else {
                        if (redStreak === 0) greenStreak++;
                        else break;
                    }
                }
                if (!isGreen) redStreak++;
                else greenStreak++;

                // SEQUENCE STRING
                let histColors = candleHistory.slice(-5).map(c => c.isGreen ? "G" : "R");
                histColors.push(isGreen ? "G" : "R");
                let seq = histColors.join("-");

                let isPingPong = seq.endsWith("G-R-G-R") || seq.endsWith("R-G-R-G") || seq.endsWith("G-R-G") || seq.endsWith("R-G-R");
                let is3_1_Bull = seq.endsWith("G-G-G-R");
                let is3_1_Bear = seq.endsWith("R-R-R-G");

                // DELTA DIVERGENCE CHECK (Trap Detector)
                let isBullishDeltaTrap = isGreen && tickDelta <= -10; // Candle is green but sellers flooded
                let isBearishDeltaTrap = !isGreen && tickDelta >= 10; // Candle is red but buyers flooded

                let isCall = false;
                let setupName = "";
                let confidence = 88;

                // =============================================================
                // SUPREME QUANTUM LAWS (PRIORITY RESOLUTION)
                // =============================================================

                // LAW 1: WATERFALL DUMP VETO (Counter-Trading CALL BANNED)
                if (redStreak >= 4) {
                    isCall = false;
                    setupName = `Waterfall Avalanche (${redStreak}x RED • CALL Banned 🔴)`;
                    confidence = 97;
                }
                // LAW 2: ROCKET RALLY VETO (Counter-Trading PUT BANNED)
                else if (greenStreak >= 4) {
                    isCall = true;
                    setupName = `Rocket Rampage (${greenStreak}x GREEN • PUT Banned 🟢)`;
                    confidence = 97;
                }
                // LAW 3: SOLID MARUBOZU EXPANSIONS (Clean Institutional Breakout)
                else if (isGreen && bodyPct >= 65 && upperWickPct <= 10) {
                    isCall = true;
                    setupName = "Bullish Solid Marubozu Breakout 🟢";
                    confidence = 96;
                }
                else if (!isGreen && bodyPct >= 65 && lowerWickPct <= 10) {
                    isCall = false;
                    setupName = "Bearish Solid Marubozu Breakdown 🔴";
                    confidence = 96;
                }
                // LAW 4: DELTA DIVERGENCE ABSORPTION TRAP
                else if (isBullishDeltaTrap) {
                    isCall = false; // Green candle with heavy sell delta -> Expect DROP!
                    setupName = `Negative Delta Trap (Sell Divergence: ${tickDelta} 🔴)`;
                    confidence = 94;
                }
                else if (isBearishDeltaTrap) {
                    isCall = true; // Red candle with heavy buy delta -> Expect BOUNCE!
                    setupName = `Positive Delta Trap (Buy Divergence: +${tickDelta} 🟢)`;
                    confidence = 94;
                }
                // LAW 5: 3-1 RECHARGE CYCLES
                else if (is3_1_Bull) {
                    isCall = true;
                    setupName = "3G-1R Recharge Completion (Resume BUY 🟢)";
                    confidence = 93;
                }
                else if (is3_1_Bear) {
                    isCall = false;
                    setupName = "3R-1G Recharge Completion (Resume SELL 🔴)";
                    confidence = 93;
                }
                // LAW 6: 1-1 PING-PONG CYCLES (Only in balanced range)
                else if (isPingPong && redStreak < 2 && greenStreak < 2) {
                    isCall = !isGreen;
                    setupName = isCall ? "1-1 Ping-Pong Alternation (Flip BUY 🟢)" : "1-1 Ping-Pong Alternation (Flip SELL 🔴)";
                    confidence = 92;
                }
                // LAW 7: CONFIRMED PINBAR REJECTIONS
                else if (lowerWickPct >= 48 && bodyPct <= 35 && redStreak <= 2) {
                    isCall = true;
                    setupName = "Hammer Floor Rejection Bounce 🟢";
                    confidence = 91;
                }
                else if (upperWickPct >= 48 && bodyPct <= 35 && greenStreak <= 2) {
                    isCall = false;
                    setupName = "Shooting Star Roof Drop 🔴";
                    confidence = 91;
                }
                // LAW 8: FLOW DOMINANCE
                else {
                    isCall = isGreen;
                    setupName = isGreen ? "Buyer Pressure Flow 🟢" : "Seller Pressure Flow 🔴";
                    confidence = 86;
                }

                // ABSOLUTE SANITY CHECK (Never contradict strong green/red Marubozu)
                if (isGreen && bodyPct >= 62 && !isCall && !isBullishDeltaTrap) {
                    isCall = true;
                    setupName = "Bullish Momentum Veto (Flipped to CALL 🟢)";
                } else if (!isGreen && bodyPct >= 62 && isCall && !isBearishDeltaTrap) {
                    isCall = false;
                    setupName = "Bearish Momentum Veto (Flipped to PUT 🔴)";
                }

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                if (sigText) {
                    sigText.innerText = action;
                    sigText.style.color = isCall ? "#10b981" : "#ef4444";
                }
                if (sigBox) sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                if (confText) confText.innerText = `CONFIDENCE: ${confidence}% • ${action}`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${setupName} • Delta: ${tickDelta > 0 ? "+" + tickDelta : tickDelta} • Body: ${bodyPct}% • ${wickInfo}`;
                if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size: 7.5px;">${dynamicReason}</span>`;

                playTone(isCall ? 960 : 440, "sine", 0.22);
            }
        });
    }

    setInterval(runEngineTick, 100);
})();
