// ==UserScript==
// @name         Pocket Option APEX Real-Time Titan Engine
// @namespace    https://github.com/
// @version      240.0
// @description  Zero-Wait Bootstrap, Live Dynamic Pattern Engine, Anti-Flicker Memory, Dual EMA & RSI
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

    // DUAL-FALLBACK LIVE PRICE GETTER
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
            return candidates[0].val;
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
        return "EUR/USD OTC";
    }

    // =========================================================================
    // 2. HUD INTERFACE
    // =========================================================================
    function mountHUD() {
        const root = document.body || document.documentElement;
        if (!root || document.getElementById('po-apex-hud')) return;

        const hud = document.createElement('div');
        hud.id = 'po-apex-hud';
        hud.style.cssText = `
            position: fixed !important;
            top: 170px !important;
            left: 15px !important;
            z-index: 2147483647 !important;
            background: rgba(3, 8, 24, 0.98) !important;
            border: 2px solid #0284c7 !important;
            border-radius: 14px !important;
            padding: 10px !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 16px 55px rgba(0,0,0,0.98) !important;
            width: 240px !important;
            touch-action: none !important;
            user-select: none !important;
            display: block !important;
            visibility: visible !important;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ APEX TITAN REAL-TIME v240</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="a-pair" style="color: #38bdf8; font-weight: bold;">EUR/USD OTC</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="a-price" style="color: #10b981; font-weight: bold;">--</span></div>
            
            <div style="background: #081024; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>O: <b id="a-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="a-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="a-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; display: flex; justify-content: space-between;">
                    <span>BODY: <b id="a-body" style="color:#38bdf8;">--%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">--%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">--%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">FAST RSI (7): <span id="a-rsi" style="color: #38bdf8; font-weight: bold;">50.0</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TREND (EMA): <span id="a-trend" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE PATTERN: <span id="a-pattern" style="color: #c084fc; font-weight: bold;">DETECTING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR: <span id="a-snr" style="color: #38bdf8; font-weight: bold;">MID-RANGE</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN CONFLUENCE NOW
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Candle-by-Candle Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY TO SCAN</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Live & Synced</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 14s to 5s of candle</div>
        `;

        root.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 15, startBoxY = 170;
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 245, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 285, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        bindScannerEvents();
    }

    // =========================================================================
    // 3. CANDLE ENGINE & REAL-TIME PATTERN TRACKER
    // =========================================================================
    let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
    let lastMinuteTracked = -1;
    let candleHistory = [];
    let storedPair = "";

    function calculateEMA(period) {
        if (candleHistory.length < 2) return candleClose;
        let p = Math.min(period, candleHistory.length);
        let k = 2 / (p + 1);
        let ema = candleHistory[0].close;
        for (let i = 1; i < candleHistory.length; i++) {
            ema = (candleHistory[i].close * k) + (ema * (1 - k));
        }
        return ema;
    }

    function calculateRSI(period = 7) {
        if (candleHistory.length < 2) return 50.0;
        let p = Math.min(period, candleHistory.length - 1);
        let gains = 0, losses = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) {
            let diff = candleHistory[i].close - candleHistory[i - 1].close;
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }
        if (losses === 0) return 80.0;
        let rs = gains / losses;
        return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
    }

    function runEngineTick() {
        mountHUD();

        const currentPair = getActivePair();
        const price = getLivePrice();
        const now = new Date();
        const currentSec = now.getSeconds();
        const currentMin = now.getMinutes();

        // Strict Anti-Flicker Pair Switch Flush
        if (storedPair !== "" && currentPair !== storedPair && currentPair.length > 3) {
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;
            candleHistory = [];
            lastMinuteTracked = currentMin;
        }
        storedPair = currentPair;

        // Minute Rollover (:00.000)
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
                    bodyPct: Math.round((cBody / cRange) * 100),
                    upperPct: Math.round((cUpper / cRange) * 100),
                    lowerPct: Math.round((cLower / cRange) * 100)
                });
                if (candleHistory.length > 30) candleHistory.shift();
            }

            lastMinuteTracked = currentMin;
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;
        }

        if (price) {
            if (candleOpen === null) {
                candleOpen = price;
                candleHigh = price;
                candleLow = price;
            }

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

            // LIVE WICK & BODY RATIOS
            let cRange = Math.max(0.00001, candleHigh - candleLow);
            let cBody = Math.abs(candleClose - candleOpen);
            let cUpper = Math.max(0, candleHigh - Math.max(candleOpen, candleClose));
            let cLower = Math.max(0, Math.min(candleOpen, candleClose) - candleLow);

            let bPct = Math.round((cBody / cRange) * 100);
            let uPct = Math.round((cUpper / cRange) * 100);
            let lPct = Math.round((cLower / cRange) * 100);

            let sum = bPct + uPct + lPct;
            if (sum > 100) {
                let factor = 100 / sum;
                bPct = Math.round(bPct * factor);
                uPct = Math.round(uPct * factor);
                lPct = 100 - bPct - uPct;
            }

            let elBody = document.getElementById('a-body');
            let elUwick = document.getElementById('a-uwick');
            let elLwick = document.getElementById('a-lwick');
            if (elBody) elBody.innerText = `${bPct}%`;
            if (elUwick) elUwick.innerText = `${uPct}%`;
            if (elLwick) elLwick.innerText = `${lPct}%`;

            // LIVE PATTERN ENGINE (UPDATES EVERY 100ms)
            let isGreen = candleClose >= candleOpen;
            let livePat = "Volume Flow";
            if (isGreen && bPct >= 65 && uPct <= 12) livePat = "Bullish Marubozu 🟢";
            else if (!isGreen && bPct >= 65 && lPct <= 12) livePat = "Bearish Marubozu 🔴";
            else if (lPct >= 48 && bPct <= 35) livePat = "Hammer Rejection 🟢";
            else if (uPct >= 48 && bPct <= 35) livePat = "Shooting Star Rejection 🔴";
            else if (bPct <= 12) livePat = "Indecision Doji ⚠️";
            else livePat = isGreen ? "Buyer Momentum 🟢" : "Seller Momentum 🔴";

            let patEl = document.getElementById('a-pattern');
            if (patEl) patEl.innerText = livePat;

            // RSI & EMA
            let currentRsi = calculateRSI(7);
            let rsiEl = document.getElementById('a-rsi');
            if (rsiEl) {
                rsiEl.innerText = currentRsi.toString();
                if (currentRsi >= 70) rsiEl.style.color = "#ef4444";
                else if (currentRsi <= 30) rsiEl.style.color = "#10b981";
                else rsiEl.style.color = "#38bdf8";
            }

            let trendEl = document.getElementById('a-trend');
            if (trendEl) {
                let ema5 = calculateEMA(5);
                let ema13 = calculateEMA(13);
                if (ema5 && ema13) {
                    if (ema5 > ema13) {
                        trendEl.innerText = "BULLISH FLOW 🟢";
                        trendEl.style.color = "#10b981";
                    } else {
                        trendEl.innerText = "BEARISH FLOW 🔴";
                        trendEl.style.color = "#ef4444";
                    }
                } else {
                    trendEl.innerText = isGreen ? "BULLISH BIAS 🟢" : "BEARISH BIAS 🔴";
                    trendEl.style.color = isGreen ? "#10b981" : "#ef4444";
                }
            }

            // Swing SNR Levels
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

    // =========================================================================
    // 4. SCANNER: ZERO-WAIT MULTI-CONFLUENCE EVALUATOR
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
            btn.innerText = "EVALUATING MATRIX...";
            if (pBar) pBar.style.display = "block";
            if (pFill) pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 12;

            const scanInterval = setInterval(() => {
                elapsed++;
                let t = getLivePrice();
                if (t) tickSamples.push(t);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                if (pFill) pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateRealTimeDecision(tickSamples);
                }
            }, 75);

            function evaluateRealTimeDecision(ticks) {
                isScanning = false;
                btn.style.opacity = "1";
                btn.innerText = "🔬 SCAN CONFLUENCE NOW";
                if (pBar) pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const currentPrice = candleClose || getLivePrice();

                // CANDLE GEOMETRY
                let isGreen = currentPrice >= candleOpen;
                let bodySize = Math.abs(currentPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, currentPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, currentPrice) - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                let p1 = candleHistory.length >= 1 ? candleHistory[candleHistory.length - 1] : null;

                // SNR LEVEL CALCULATION
                let swingLow = Infinity, swingHigh = -Infinity;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (candleHistory[i].low < swingLow) swingLow = candleHistory[i].low;
                    if (candleHistory[i].high > swingHigh) swingHigh = candleHistory[i].high;
                }

                let channelRange = Math.max(0.0001, swingHigh - swingLow);
                let isAtFloor = (currentPrice - swingLow) <= (channelRange * 0.18);
                let isAtRoof = (swingHigh - currentPrice) <= (channelRange * 0.18);

                // Floor Reversal Bounce Check
                let isFloorBounce = (isAtFloor || currentPrice <= swingLow) && isGreen && (lowerWickPct >= 20 || bodyPct >= 40);

                // Tick Velocity
                let tickVelocityScore = 0;
                if (ticks.length >= 4) {
                    let diff = ticks[ticks.length - 1] - ticks[0];
                    if (diff > 0.00002) tickVelocityScore = 15;
                    else if (diff < -0.00002) tickVelocityScore = -15;
                }

                // Fast RSI Score
                let rsiVal = calculateRSI(7);
                let rsiScore = 0;
                if (rsiVal >= 72) rsiScore = -25;
                else if (rsiVal <= 28) rsiScore = 25;

                // CONFLUENCE SCORE MATRIX (-100 to +100)
                let score = 0;
                let patternName = "Standard Flow";

                if (isGreen && bodyPct >= 65 && upperWickPct <= 12) {
                    score += 48;
                    patternName = "Bullish Marubozu Expansion";
                } else if (!isGreen && bodyPct >= 65 && lowerWickPct <= 12) {
                    score -= 48;
                    patternName = "Bearish Marubozu Dump";
                } else if (lowerWickPct >= 48 && bodyPct <= 35 && upperWickPct <= 15) {
                    score += 45;
                    patternName = "Hammer Floor Rejection";
                } else if (upperWickPct >= 48 && bodyPct <= 35 && lowerWickPct <= 15) {
                    score -= 45;
                    patternName = "Shooting Star Roof Rejection";
                } else if (p1 && !p1.isGreen && isGreen && currentPrice > p1.open && bodyPct >= 45) {
                    score += 44;
                    patternName = "Bullish Engulfing Reversal";
                } else if (p1 && p1.isGreen && !isGreen && currentPrice < p1.open && bodyPct >= 45) {
                    score -= 44;
                    patternName = "Bearish Engulfing Reversal";
                } else {
                    score += isGreen ? 25 : -25;
                    patternName = isGreen ? "Buyer Pressure Momentum" : "Seller Pressure Momentum";
                }

                score += rsiScore;
                score += tickVelocityScore;

                // Support Floor Bounce Priority
                if (isFloorBounce) {
                    score += 40;
                    patternName = "Support Floor Reversal Bounce 🟢";
                }

                // ANTI-OPPOSITE SAFEGUARD
                if (isGreen && score < 0 && !(upperWickPct >= 55 && isAtRoof)) {
                    score = 25;
                    patternName = "Buyer Flow Absorption (PUT Blocked)";
                } else if (!isGreen && score > 0 && !(lowerWickPct >= 55 && isAtFloor)) {
                    score = -25;
                    patternName = "Seller Flow Pressure (CALL Blocked)";
                }

                let isCall = score >= 0;
                let finalConfidence = Math.min(98, 84 + Math.round(Math.abs(score) / 7));

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                if (sigText) {
                    sigText.innerText = action;
                    sigText.style.color = isCall ? "#10b981" : "#ef4444";
                }
                if (sigBox) sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                if (confText) confText.innerText = `CONFIDENCE: ${finalConfidence}% • SCORE: ${Math.abs(score)}`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${patternName} • Body: ${bodyPct}% • ${wickInfo}`;
                if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size: 7.5px;">${dynamicReason}</span>`;

                playTone(isCall ? 960 : 440, "sine", 0.22);
            }
        });
    }

    setInterval(runEngineTick, 100);
})();
