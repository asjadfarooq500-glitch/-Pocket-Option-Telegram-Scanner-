// ==UserScript==
// @name         Pocket Option APEX Quantum Titan Engine
// @namespace    https://github.com/
// @version      190.0
// @description  Full Institutional Suite: 20+ Price Action Patterns, EMA Trends, Liquidity Sweeps, SNR & Zero-Freeze Stream
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

    // 1. IN-PAGE CANVAS BADGE SNIFFER
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

    // DUAL-FALLBACK LIVE PRICE DETECTOR
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
            if (el && el.innerText && el.innerText.trim().length > 2) {
                return el.innerText.split('\n')[0].trim();
            }
        }
        return "OTC ASSET";
    }

    // 2. HUD INTERFACE
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
                <span>⚡ APEX TITAN QUANT v190</span>
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
                    <span>BODY: <b id="a-body" style="color:#38bdf8;">--%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">--%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">--%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">TREND (EMA): <span id="a-trend" style="color: #facc15; font-weight: bold;">CALCULATING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">PATTERN: <span id="a-pattern" style="color: #c084fc; font-weight: bold;">SCANNING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR: <span id="a-snr" style="color: #38bdf8; font-weight: bold;">MID-RANGE</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN FULL TITAN MATRIX
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Titan Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
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

    // 3. CANDLE ENGINE & 25-BAR BUFFER
    let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
    let lastMinuteTracked = -1;
    let candleHistory = [];
    let storedPair = "";

    function calculateEMA(period) {
        if (candleHistory.length < period) return null;
        let k = 2 / (period + 1);
        let ema = candleHistory[0].close;
        for (let i = 1; i < candleHistory.length; i++) {
            ema = (candleHistory[i].close * k) + (ema * (1 - k));
        }
        return ema;
    }

    function runEngineTick() {
        mountHUD();

        const currentPair = getActivePair();
        const price = getLivePrice();
        const now = new Date();
        const currentSec = now.getSeconds();
        const currentMin = now.getMinutes();

        // Pair Switch Auto-Flush
        if (storedPair !== "" && currentPair !== storedPair) {
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
                if (candleHistory.length > 25) candleHistory.shift();
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

            // REAL LIVE WICK & BODY RATIOS
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

            // EMA Trend Calculation
            let ema9 = calculateEMA(9);
            let ema21 = calculateEMA(21);
            let trendEl = document.getElementById('a-trend');
            if (trendEl) {
                if (ema9 && ema21) {
                    if (ema9 > ema21 && price > ema9) {
                        trendEl.innerText = "STRONG BULLISH 🟢";
                        trendEl.style.color = "#10b981";
                    } else if (ema9 < ema21 && price < ema9) {
                        trendEl.innerText = "STRONG BEARISH 🔴";
                        trendEl.style.color = "#ef4444";
                    } else {
                        trendEl.innerText = "RANGING / CHOP";
                        trendEl.style.color = "#38bdf8";
                    }
                } else {
                    trendEl.innerText = "ACCUMULATING";
                    trendEl.style.color = "#facc15";
                }
            }

            // Swing High / Low (SNR)
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

    // 4. SCANNER: COMPLETE PRICE ACTION MATRIX
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
            const patEl = document.getElementById('a-pattern');
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
            btn.innerText = "SCANNING 20+ PATTERNS...";
            if (pBar) pBar.style.display = "block";
            if (pFill) pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 14;

            const scanInterval = setInterval(() => {
                elapsed++;
                let t = getLivePrice();
                if (t) tickSamples.push(t);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                if (pFill) pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateTitanDecision(tickSamples);
                }
            }, 90);

            function evaluateTitanDecision(ticks) {
                isScanning = false;
                btn.style.opacity = "1";
                btn.innerText = "🔬 SCAN FULL TITAN MATRIX";
                if (pBar) pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const currentPrice = candleClose || getLivePrice();

                // CURRENT RUNNING CANDLE GEOMETRY
                let isGreen = currentPrice >= candleOpen;
                let bodySize = Math.abs(currentPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, currentPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, currentPrice) - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // HISTORICAL CANDLES (P1, P2, P3)
                let p1 = candleHistory.length >= 1 ? candleHistory[candleHistory.length - 1] : null;
                let p2 = candleHistory.length >= 2 ? candleHistory[candleHistory.length - 2] : null;
                let p3 = candleHistory.length >= 3 ? candleHistory[candleHistory.length - 3] : null;

                // SNR LEVEL CALCULATION
                let swingLow = Infinity, swingHigh = -Infinity;
                let redStreak = 0, greenStreak = 0;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (candleHistory[i].low < swingLow) swingLow = candleHistory[i].low;
                    if (candleHistory[i].high > swingHigh) swingHigh = candleHistory[i].high;

                    if (!candleHistory[i].isGreen) {
                        if (greenStreak === 0) redStreak++;
                    } else {
                        if (redStreak === 0) greenStreak++;
                    }
                }
                if (!isGreen) redStreak++;
                else greenStreak++;

                let channelRange = Math.max(0.0001, swingHigh - swingLow);
                let isAtFloor = (currentPrice - swingLow) <= (channelRange * 0.18);
                let isAtRoof = (swingHigh - currentPrice) <= (channelRange * 0.18);

                // LIQUIDITY SWEEP CHECK (Wick pierced level and closed back inside)
                let isFloorSweep = (candleLow < swingLow) && (currentPrice > swingLow) && (lowerWickPct >= 40);
                let isRoofSweep = (candleHigh > swingHigh) && (currentPrice < swingHigh) && (upperWickPct >= 40);

                // MOMENTUM EXHAUSTION DECAY
                let isExhaustionDrop = p2 && p1 && !p2.isGreen && !p1.isGreen && !isGreen && (p2.body > p1.body) && (p1.body > bodySize);
                let isExhaustionPump = p2 && p1 && p2.isGreen && p1.isGreen && isGreen && (p2.body > p1.body) && (p1.body > bodySize);

                // CONFLUENCE SCORE MATRIX (-100 to +100)
                let score = 0;
                let patternName = "Standard Volume Flow";

                // -------------------------------------------------------------
                // 20+ COMPLETE CANDLESTICK PATTERNS
                // -------------------------------------------------------------

                // 1. Giant Bullish Marubozu (Power Breakout)
                if (isGreen && bodyPct >= 72 && upperWickPct <= 10) {
                    score += 48;
                    patternName = "Bullish Marubozu Breakout";
                }
                // 2. Giant Bearish Marubozu (Power Dump)
                else if (!isGreen && bodyPct >= 72 && lowerWickPct <= 10) {
                    score -= 48;
                    patternName = "Bearish Marubozu Dump";
                }
                // 3. Opening Bullish Belt Hold (Open = Low, Rallies Strong)
                else if (isGreen && lowerWickPct <= 5 && bodyPct >= 60) {
                    score += 44;
                    patternName = "Bullish Belt Hold Expansion";
                }
                // 4. Opening Bearish Belt Hold (Open = High, Dumps Strong)
                else if (!isGreen && upperWickPct <= 5 && bodyPct >= 60) {
                    score -= 44;
                    patternName = "Bearish Belt Hold Avalanche";
                }
                // 5. Bullish Engulfing
                else if (p1 && !p1.isGreen && isGreen && currentPrice > p1.open && candleOpen < p1.close && bodyPct >= 52) {
                    score += 45;
                    patternName = "Bullish Engulfing Reversal";
                }
                // 6. Bearish Engulfing
                else if (p1 && p1.isGreen && !isGreen && currentPrice < p1.open && candleOpen > p1.close && bodyPct >= 52) {
                    score -= 45;
                    patternName = "Bearish Engulfing Reversal";
                }
                // 7. Morning Star (3-Bar Institutional Reversal)
                else if (p2 && p1 && !p2.isGreen && p1.bodyPct <= 25 && isGreen && bodyPct >= 45 && currentPrice > (p2.open + p2.close) / 2) {
                    score += 50;
                    patternName = "Morning Star 3-Bar Reversal";
                }
                // 8. Evening Star (3-Bar Institutional Reversal)
                else if (p2 && p1 && p2.isGreen && p1.bodyPct <= 25 && !isGreen && bodyPct >= 45 && currentPrice < (p2.open + p2.close) / 2) {
                    score -= 50;
                    patternName = "Evening Star 3-Bar Reversal";
                }
                // 9. Confirmed Hammer Floor Rejection
                else if (lowerWickPct >= 55 && bodyPct <= 30 && upperWickPct <= 15) {
                    score += 42;
                    patternName = "Hammer Floor Rejection";
                }
                // 10. Inverted Hammer (Floor Bullish Test)
                else if (isAtFloor && upperWickPct >= 55 && bodyPct <= 30 && lowerWickPct <= 15) {
                    score += 40;
                    patternName = "Inverted Hammer Floor Bounce";
                }
                // 11. Confirmed Shooting Star Roof Rejection
                else if (upperWickPct >= 55 && bodyPct <= 30 && lowerWickPct <= 15) {
                    score -= 42;
                    patternName = "Shooting Star Roof Rejection";
                }
                // 12. Hanging Man (Roof Bearish Reversal)
                else if (isAtRoof && lowerWickPct >= 55 && bodyPct <= 30 && upperWickPct <= 15) {
                    score -= 40;
                    patternName = "Hanging Man Roof Drop";
                }
                // 13. Dragonfly Doji (Floor Liquidity Grab)
                else if (bodyPct <= 10 && lowerWickPct >= 65 && upperWickPct <= 10) {
                    score += 40;
                    patternName = "Dragonfly Doji Liquidity Grab";
                }
                // 14. Gravestone Doji (Roof Liquidity Grab)
                else if (bodyPct <= 10 && upperWickPct >= 65 && lowerWickPct <= 10) {
                    score -= 40;
                    patternName = "Gravestone Doji Liquidity Grab";
                }
                // 15. Tweezer Bottom Double Test
                else if (p1 && Math.abs(candleLow - p1.low) <= 0.00006 && lowerWickPct >= 35 && p1.lowerPct >= 35) {
                    score += 38;
                    patternName = "Tweezer Bottom Double Test";
                }
                // 16. Tweezer Top Double Test
                else if (p1 && Math.abs(candleHigh - p1.high) <= 0.00006 && upperWickPct >= 35 && p1.upperPct >= 35) {
                    score -= 38;
                    patternName = "Tweezer Top Double Test";
                }
                // 17. Three White Soldiers
                else if (p2 && p1 && p2.isGreen && p1.isGreen && isGreen && bodyPct >= 40 && p1.bodyPct >= 40) {
                    score += 44;
                    patternName = "Three White Soldiers Rally";
                }
                // 18. Three Black Crows
                else if (p2 && p1 && !p2.isGreen && !p1.isGreen && !isGreen && bodyPct >= 40 && p1.bodyPct >= 40) {
                    score -= 44;
                    patternName = "Three Black Crows Avalanche";
                }
                // 19. Piercing Line Reversal
                else if (p1 && !p1.isGreen && isGreen && candleOpen < p1.low && currentPrice >= (p1.open + p1.close) / 2) {
                    score += 39;
                    patternName = "Piercing Line Floor Reversal";
                }
                // 20. Dark Cloud Cover Reversal
                else if (p1 && p1.isGreen && !isGreen && candleOpen > p1.high && currentPrice <= (p1.open + p1.close) / 2) {
                    score -= 39;
                    patternName = "Dark Cloud Cover Roof Reversal";
                }
                // 21. Bullish Harami (Inside Bar)
                else if (p1 && !p1.isGreen && isGreen && candleHigh <= p1.high && candleLow >= p1.low && bodyPct >= 35) {
                    score += 34;
                    patternName = "Bullish Harami Inside Expansion";
                }
                // 22. Bearish Harami (Inside Bar)
                else if (p1 && p1.isGreen && !isGreen && candleHigh <= p1.high && candleLow >= p1.low && bodyPct >= 35) {
                    score -= 34;
                    patternName = "Bearish Harami Inside Dump";
                }
                // Default Flow
                else {
                    if (isGreen) score += 20;
                    else score -= 20;
                    patternName = isGreen ? "Buyer Flow Dominance" : "Seller Flow Dominance";
                }

                // -------------------------------------------------------------
                // MULTI-CONFLUENCE BOOSTERS (SMC Sweeps, Trends & Decay)
                // -------------------------------------------------------------

                // Liquidity Sweep Multipliers
                if (isFloorSweep) {
                    score += 35;
                    patternName = "SMC Floor Liquidity Sweep Bounce";
                } else if (isRoofSweep) {
                    score -= 35;
                    patternName = "SMC Roof Liquidity Sweep Rejection";
                }

                // Momentum Decay Multipliers
                if (isExhaustionDrop) {
                    score += 30; // Drop ran out of fuel -> reversal
                    patternName = "Bearish Momentum Decay Exhaustion";
                } else if (isExhaustionPump) {
                    score -= 30; // Pump ran out of fuel -> reversal
                    patternName = "Bullish Momentum Decay Exhaustion";
                }

                // Heavy Waterfall / Rally Momentum Locks
                if (redStreak >= 4 && lowerWickPct <= 35) score -= 35;
                else if (greenStreak >= 4 && upperWickPct <= 35) score += 35;

                // Support / Resistance Alignments
                if (isAtFloor) {
                    if (score > 0) score += 25;
                    else if (score < -30 && bodyPct >= 65) score -= 15;
                }
                if (isAtRoof) {
                    if (score < 0) score -= 25;
                    else if (score > 30 && bodyPct >= 65) score += 15;
                }

                // Final Score & Chop Shield
                let isCall = score > 0;
                let finalConfidence = Math.min(98, 85 + Math.round(Math.abs(score) / 10));

                if (patEl) patEl.innerText = patternName;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                // CHOP SHIELD (Skip Confused Indecisive Candles)
                if (Math.abs(score) < 32 && bodyPct < 30) {
                    if (sigText) {
                        sigText.innerText = "AVOID / CHOPPY ⚠️";
                        sigText.style.color = "#facc15";
                    }
                    if (sigBox) sigBox.style.borderColor = "#facc15";
                    if (confText) confText.innerText = `MARKET INDECISIVE (${Math.abs(score)} PTS)`;
                    if (desc) desc.innerHTML = `Wait for next clear candle cycle<br><span style="color:#94a3b8; font-size: 7.5px;">Low momentum chop • Skip this trade</span>`;
                    playTone(380, "sine", 0.15);
                    return;
                }

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
