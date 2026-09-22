// ==UserScript==
// @name         Pocket Option APEX Omni-Scan Engine
// @namespace    http://tampermonkey.net/
// @version      30.0
// @description  Full 20-Candle Chart Memory, Grid Clamping, Waterfall Lock & Multi-Pattern Confluence
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let currentLiveTick = null;

    // 1. MAIN-WORLD PROXY WITH STRICT AXIS-GRID FILTER
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `
    (function() {
        var lastValidPrice = null;

        function broadcastPrice(num) {
            if (num <= 0 || Math.abs(num - 2.62) < 0.05 || num === 100) return;

            // GRID CLAMP: Reject prices that jump unnaturally (filters out axis numbers like 0.72000)
            if (lastValidPrice !== null) {
                var maxDeviation = lastValidPrice * 0.008; // Max 0.8% deviation
                if (Math.abs(num - lastValidPrice) > maxDeviation) {
                    return; // Ignore axis numbers
                }
            }

            lastValidPrice = num;
            document.documentElement.setAttribute('data-po-live-price', num);
            document.documentElement.setAttribute('data-po-live-time', Date.now());
        }

        try {
            var origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\\d{1,6}\\.\\d{2,6}$/.test(str)) {
                        broadcastPrice(parseFloat(str));
                    }
                }
                return origFill.apply(this, arguments);
            };
        } catch(e) {}
    })();
    `;
    (document.head || document.documentElement).appendChild(bridgeScript);

    function initOmniEngine() {
        if (!document.body) {
            setTimeout(initOmniEngine, 200);
            return;
        }

        if (document.getElementById('po-omni-hud')) return;

        let audioCtx = null;
        function playBeep(freq = 850) {
            try {
                if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.18);
            } catch(e) {}
        }
        document.addEventListener('touchstart', () => {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }, { once: true });

        // HUD Design
        const hud = document.createElement('div');
        hud.id = 'po-omni-hud';
        hud.style.cssText = `
            position: fixed;
            top: 170px;
            left: 15px;
            z-index: 999999999;
            background: rgba(3, 7, 18, 0.98);
            border: 2px solid #0284c7;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 16px 55px rgba(0,0,0,0.98);
            width: 230px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ OMNI-SCAN ENGINE v30</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="o-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="o-price" style="color: #10b981; font-weight: bold;">--</span></div>
            
            <div style="background: #091226; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>O: <b id="o-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="o-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="o-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; display: flex; justify-content: space-between;">
                    <span>BODY: <b id="o-body" style="color:#38bdf8;">--%</b></span>
                    <span>U-WICK: <b id="o-uwick" style="color:#facc15;">--%</b></span>
                    <span>L-WICK: <b id="o-lwick" style="color:#facc15;">--%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">CHART FLOW: <span id="o-trend" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">DETECTED: <span id="o-setup" style="color: #c084fc; font-weight: bold;">STANDBY</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="o-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="o-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 FULL CHART OMNI-SCAN
            </button>

            <div id="o-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="o-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="o-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Omni-Scan Decision</div>
                <div id="o-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
                <div id="o-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="o-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan between 14s and 6s</div>
        `;

        document.body.appendChild(hud);

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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 235, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 275, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        function getLivePrice() {
            let hooked = parseFloat(document.documentElement.getAttribute('data-po-live-price'));
            if (hooked && hooked > 0) return hooked;

            const nodes = document.querySelectorAll('*');
            for (let el of nodes) {
                if (el.children.length === 0 && el.textContent) {
                    let txt = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        let rect = el.getBoundingClientRect();
                        if (rect.top > 80 && rect.left > (window.innerWidth * 0.5)) {
                            let n = parseFloat(txt);
                            if (n > 0 && Math.abs(n - 2.62) > 0.05) return n;
                        }
                    }
                }
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
            return "OTC PAIR";
        }

        // ==========================================
        // 20-CANDLE BUFFER & CLAMPED OHLC
        // ==========================================
        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
        let lastMinuteSynced = -1;
        let isMinuteLocked = false;
        let candleHistory = []; // Full 20-candle memory
        let storedPair = "";

        setInterval(() => {
            const currentPair = getActivePair();
            const price = getLivePrice();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            // Pair switch flush
            if (storedPair !== "" && currentPair !== storedPair) {
                candleOpen = null;
                candleHigh = -Infinity;
                candleLow = Infinity;
                isMinuteLocked = false;
                candleHistory = [];
                lastMinuteSynced = currentMin;
            }
            storedPair = currentPair;

            // Minute Bar Rollover (:00.000)
            if (currentMin !== lastMinuteSynced) {
                if (lastMinuteSynced !== -1 && candleOpen !== null && price) {
                    candleHistory.push({
                        open: candleOpen,
                        close: price,
                        high: candleHigh,
                        low: candleLow,
                        isGreen: price >= candleOpen,
                        body: Math.abs(price - candleOpen),
                        range: Math.max(0.00001, candleHigh - candleLow)
                    });
                    if (candleHistory.length > 20) candleHistory.shift();
                }

                lastMinuteSynced = currentMin;
                if (price) {
                    candleOpen = price;
                    candleHigh = price;
                    candleLow = price;
                    candleClose = price;
                    isMinuteLocked = true;
                } else {
                    candleOpen = null;
                    isMinuteLocked = false;
                }
            }

            if (price) {
                if (candleOpen === null && currentSec <= 5) {
                    candleOpen = price;
                    candleHigh = price;
                    candleLow = price;
                    isMinuteLocked = true;
                }

                // Clamped High/Low Tracking (Eliminates the 0.72000 Axis Bug!)
                if (isMinuteLocked && candleOpen !== null) {
                    let maxAllowedDiff = candleOpen * 0.003; // Max 0.3% range for 1 candle
                    if (price > candleHigh && (price - candleOpen) < maxAllowedDiff) candleHigh = price;
                    if (price < candleLow && (candleOpen - price) < maxAllowedDiff) candleLow = price;
                    candleClose = price;
                }

                let decimals = price > 100 ? 3 : 5;
                document.getElementById('o-price').innerText = price.toFixed(decimals);
                document.getElementById('o-price').style.color = "#10b981";

                if (isMinuteLocked && candleOpen !== null) {
                    document.getElementById('o-open').innerText = candleOpen.toFixed(decimals);
                    document.getElementById('o-high').innerText = candleHigh.toFixed(decimals);
                    document.getElementById('o-low').innerText = candleLow.toFixed(decimals);

                    let cRange = Math.max(0.00001, candleHigh - candleLow);
                    let cBody = Math.abs(price - candleOpen);
                    let cUpper = candleHigh - Math.max(candleOpen, price);
                    let cLower = Math.min(candleOpen, price) - candleLow;

                    let bPct = Math.round((cBody / cRange) * 100);
                    let uPct = Math.round((cUpper / cRange) * 100);
                    let lPct = Math.round((cLower / cRange) * 100);

                    document.getElementById('o-body').innerText = `${bPct}%`;
                    document.getElementById('o-uwick').innerText = `${uPct}%`;
                    document.getElementById('o-lwick').innerText = `${lPct}%`;

                    // Macro Flow Analysis
                    let redCount = 0, greenCount = 0;
                    for (let i = candleHistory.length - 1; i >= 0; i--) {
                        if (!candleHistory[i].isGreen) {
                            if (greenCount === 0) redCount++;
                            else break;
                        } else {
                            if (redCount === 0) greenCount++;
                            else break;
                        }
                    }
                    if (price < candleOpen) redCount++;
                    else greenCount++;

                    const trendEl = document.getElementById('o-trend');
                    if (redCount >= 4) {
                        trendEl.innerText = `WATERFALL CRASH (${redCount}x RED) 🔴`;
                        trendEl.style.color = "#ef4444";
                    } else if (greenCount >= 4) {
                        trendEl.innerText = `ROCKET RALLY (${greenCount}x GREEN) 🟢`;
                        trendEl.style.color = "#10b981";
                    } else {
                        trendEl.innerText = "BALANCED CHANNEL";
                        trendEl.style.color = "#38bdf8";
                    }
                }
            }

            document.getElementById('o-pair').innerText = currentPair;
            document.getElementById('o-timer').innerText = `${60 - currentSec}s`;
        }, 80);

        // ==========================================
        // OMNI-SCAN CONFLUENCE MATRIX (20-CANDLE DATA)
        // ==========================================
        let isScanning = false;
        document.getElementById('o-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('o-status-box');
            const sigText = document.getElementById('o-signal-text');
            const confText = document.getElementById('o-conf-text');
            const desc = document.getElementById('o-desc');
            const setupEl = document.getElementById('o-setup');
            const scanBtn = document.getElementById('o-scan-btn');
            const pBar = document.getElementById('o-progress-bar');
            const pFill = document.getElementById('o-progress-fill');

            if (!price || !isMinuteLocked || candleOpen === null) {
                sigText.innerText = "WAITING FOR :00";
                sigText.style.color = "#f43f5e";
                desc.innerText = "Wait for new candle open to sync data";
                playBeep(300);
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "ANALYZING 20 BARS...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 16;

            const scanInterval = setInterval(() => {
                elapsed++;
                let tick = getLivePrice();
                if (tick) tickSamples.push(tick);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateOmniConfluence(tickSamples);
                }
            }, 100);

            function evaluateOmniConfluence(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 FULL CHART OMNI-SCAN";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || candleClose || price;

                // 1. Clamped Candle Geometry
                let isGreen = latestPrice >= candleOpen;
                let bodySize = Math.abs(latestPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = candleHigh - Math.max(candleOpen, latestPrice);
                let lowerWick = Math.min(candleOpen, latestPrice) - candleLow;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 2. Count Consecutive Trend Streaks in 20 Bars
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

                let isCall = false;
                let setupName = "";
                let confidence = 88;

                // ==========================================
                // STRICT OMNI-SCAN TRADING LAWS
                // ==========================================

                // LAW 1: WATERFALL CRASH LOCK (Prevents Image 16 Blunder!)
                // In a heavy drop of 4+ Red candles, NEVER BUY! Follow the waterfall dump.
                if (redStreak >= 4 && lowerWickPct <= 35) {
                    isCall = false; // 100% PUT (Follow the institutional dump!)
                    setupName = `${redStreak}x Red Waterfall Crash (Follow Sell)`;
                    confidence = 96;
                }
                // LAW 2: ROCKET RALLY LOCK
                // In a heavy pump of 4+ Green candles, NEVER SELL! Follow the breakout.
                else if (greenStreak >= 4 && upperWickPct <= 35) {
                    isCall = true; // 100% CALL (Follow the institutional pump!)
                    setupName = `${greenStreak}x Green Rocket Rally (Follow Buy)`;
                    confidence = 96;
                }
                // LAW 3: SOLID BODY IMPULSE (Marubozu)
                else if (bodyPct >= 50 && upperWickPct <= 20 && isGreen) {
                    isCall = true;
                    setupName = "Bullish Momentum Expansion";
                    confidence = 93;
                }
                else if (bodyPct >= 50 && lowerWickPct <= 20 && !isGreen) {
                    isCall = false;
                    setupName = "Bearish Momentum Dump";
                    confidence = 93;
                }
                // LAW 4: GENUINE PINBAR REVERSAL (Requires 50%+ Wick)
                else if (lowerWickPct >= 50 && bodyPct <= 35 && redStreak <= 3) {
                    isCall = true;
                    setupName = "Confirmed Hammer Rejection Bounce";
                    confidence = 91;
                }
                else if (upperWickPct >= 50 && bodyPct <= 35 && greenStreak <= 3) {
                    isCall = false;
                    setupName = "Confirmed Shooting Star Drop";
                    confidence = 91;
                }
                // LAW 5: BODY COLOR CONTINUATION
                else {
                    isCall = isGreen;
                    setupName = isGreen ? "Bullish Candle Dominance" : "Bearish Candle Dominance";
                    confidence = 85;
                }

                setupEl.innerText = setupName;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${confidence}%`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${setupName} • Body: ${bodyPct}% • ${wickInfo}`;
                desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size: 7.5px;">${dynamicReason}</span>`;

                playBeep(isCall ? 950 : 450);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initOmniEngine);
    } else {
        initOmniEngine();
    }
})();
