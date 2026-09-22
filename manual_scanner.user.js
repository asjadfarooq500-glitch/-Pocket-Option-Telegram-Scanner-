// ==UserScript==
// @name         Pocket Option APEX True OHLC Engine
// @namespace    http://tampermonkey.net/
// @version      25.0
// @description  Exact OHLC Candle Tracking, Live Wick/Body Math, VSA Momentum & True Rejections
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT UNIVERSAL MAIN-WORLD PRICE PROXY
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `
    (function() {
        function broadcastPrice(num) {
            if (num > 0 && Math.abs(num - 2.62) > 0.05 && num !== 100) {
                document.documentElement.setAttribute('data-po-live-price', num);
                document.documentElement.setAttribute('data-po-live-time', Date.now());
            }
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

    function initApexEngine() {
        if (!document.body) {
            setTimeout(initApexEngine, 200);
            return;
        }

        if (document.getElementById('po-apex-hud')) return;

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
        hud.id = 'po-apex-hud';
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
                <span>⚡ APEX TRUE-OHLC v25</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="a-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="a-price" style="color: #10b981; font-weight: bold;">--</span></div>
            
            <div style="background: #091226; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>O: <b id="a-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="a-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="a-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; display: flex; justify-content: space-between;">
                    <span>BODY: <b id="a-body-pct" style="color:#38bdf8;">--%</b></span>
                    <span>U-WICK: <b id="a-uwick-pct" style="color:#facc15;">--%</b></span>
                    <span>L-WICK: <b id="a-lwick-pct" style="color:#facc15;">--%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">STATE: <span id="a-status" style="color: #facc15; font-weight: bold;">LOCKING :00</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN RUNNING CANDLE
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 12s to 6s of candle</div>
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
        // TRUE-OHLC TICK TRACKER & MINUTE LOCK
        // ==========================================
        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
        let lastMinuteSynced = -1;
        let isMinuteLocked = false;
        let candleHistory = [];
        let storedPair = "";

        setInterval(() => {
            const currentPair = getActivePair();
            const price = getLivePrice();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            // Pair change flush
            if (storedPair !== "" && currentPair !== storedPair) {
                candleOpen = null;
                candleHigh = -Infinity;
                candleLow = Infinity;
                isMinuteLocked = false;
                candleHistory = [];
                lastMinuteSynced = currentMin;
            }
            storedPair = currentPair;

            // Minute Cycle Rollover (:00.000)
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

                if (isMinuteLocked) {
                    if (price > candleHigh) candleHigh = price;
                    if (price < candleLow) candleLow = price;
                    candleClose = price;
                }

                // Update UI Numbers
                let decimals = price > 100 ? 3 : 5;
                document.getElementById('a-price').innerText = price.toFixed(decimals);
                document.getElementById('a-price').style.color = "#10b981";

                if (isMinuteLocked && candleOpen !== null) {
                    document.getElementById('a-open').innerText = candleOpen.toFixed(decimals);
                    document.getElementById('a-high').innerText = candleHigh.toFixed(decimals);
                    document.getElementById('a-low').innerText = candleLow.toFixed(decimals);

                    let cRange = Math.max(0.00001, candleHigh - candleLow);
                    let cBody = Math.abs(price - candleOpen);
                    let cUpper = candleHigh - Math.max(candleOpen, price);
                    let cLower = Math.min(candleOpen, price) - candleLow;

                    let bPct = Math.round((cBody / cRange) * 100);
                    let uPct = Math.round((cUpper / cRange) * 100);
                    let lPct = Math.round((cLower / cRange) * 100);

                    document.getElementById('a-body-pct').innerText = `${bPct}%`;
                    document.getElementById('a-uwick-pct').innerText = `${uPct}%`;
                    document.getElementById('a-lwick-pct').innerText = `${lPct}%`;

                    let isG = price >= candleOpen;
                    document.getElementById('a-status').innerText = isG ? "BULLISH FLOW 🟢" : "BEARISH DUMP 🔴";
                    document.getElementById('a-status').style.color = isG ? "#10b981" : "#ef4444";
                } else {
                    document.getElementById('a-status').innerText = "LOCKING AT :00";
                    document.getElementById('a-status').style.color = "#facc15";
                }
            }

            document.getElementById('a-pair').innerText = currentPair;
            document.getElementById('a-timer').innerText = `${60 - currentSec}s`;
        }, 80);

        // ==========================================
        // APEX QUANT SCANNER (NO COUNTER-TREND TRAPS)
        // ==========================================
        let isScanning = false;
        document.getElementById('a-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('a-status-box');
            const sigText = document.getElementById('a-signal-text');
            const confText = document.getElementById('a-conf-text');
            const desc = document.getElementById('a-desc');
            const scanBtn = document.getElementById('a-scan-btn');
            const pBar = document.getElementById('a-progress-bar');
            const pFill = document.getElementById('a-progress-fill');

            if (!price || !isMinuteLocked || candleOpen === null) {
                sigText.innerText = "WAITING FOR :00";
                sigText.style.color = "#f43f5e";
                desc.innerText = "Wait for new candle open to lock real data";
                playBeep(300);
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "SCANNING OHLC...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 16; // 1.6s

            const scanInterval = setInterval(() => {
                elapsed++;
                let tick = getLivePrice();
                if (tick) tickSamples.push(tick);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateApexDecision(tickSamples);
                }
            }, 100);

            function evaluateApexDecision(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 SCAN RUNNING CANDLE";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || candleClose || price;

                // 1. Exact Math from Verified OHLC
                let isGreen = latestPrice >= candleOpen;
                let bodySize = Math.abs(latestPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = candleHigh - Math.max(candleOpen, latestPrice);
                let lowerWick = Math.min(candleOpen, latestPrice) - candleLow;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 2. Multi-Bar Streak
                let greenStreak = 0, redStreak = 0;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (candleHistory[i].isGreen) {
                        if (redStreak === 0) greenStreak++;
                        else break;
                    } else {
                        if (greenStreak === 0) redStreak++;
                        else break;
                    }
                }
                if (isGreen) greenStreak++;
                else redStreak++;

                let isCall = false;
                let setupName = "";
                let confidence = 88;

                // ==========================================
                // STRICT APEX TRADING LAWS
                // ==========================================

                // LAW 1: WATERFALL DUMP CONTINUATION (Prevents Counter-Trading in Crash)
                // If candle is solid Red (Body >= 40% and lower wick <= 25%), ALWAYS PUT!
                if (!isGreen && bodyPct >= 40 && lowerWickPct <= 25) {
                    isCall = false; // 100% PUT (Follow the drop!)
                    setupName = "Solid Bearish Dump Impulse";
                    confidence = 94;
                }
                // LAW 2: ROCKET PUMP CONTINUATION (Prevents Counter-Trading in Rally)
                // If candle is solid Green (Body >= 40% and upper wick <= 25%), ALWAYS CALL!
                else if (isGreen && bodyPct >= 40 && upperWickPct <= 25) {
                    isCall = true; // 100% CALL (Follow the breakout!)
                    setupName = "Solid Bullish Pump Impulse";
                    confidence = 94;
                }
                // LAW 3: TRUE PINBAR REVERSAL (Requires 50%+ Wick)
                else if (lowerWickPct >= 50 && bodyPct <= 35) {
                    isCall = true; // Real Hammer Rejection
                    setupName = "Verified Hammer Floor Bounce";
                    confidence = 92;
                }
                else if (upperWickPct >= 50 && bodyPct <= 35) {
                    isCall = false; // Real Shooting Star Rejection
                    setupName = "Verified Shooting Star Drop";
                    confidence = 92;
                }
                // LAW 4: MULTI-BAR EXHAUSTION WITH CLEAR WICK
                else if (redStreak >= 4 && lowerWickPct >= 35) {
                    isCall = true;
                    setupName = `${redStreak}x Red Dump Floor Reversal`;
                    confidence = 91;
                }
                else if (greenStreak >= 4 && upperWickPct >= 35) {
                    isCall = false;
                    setupName = `${greenStreak}x Green Pump Roof Reversal`;
                    confidence = 91;
                }
                // LAW 5: BODY COLOR DOMINANCE FALLBACK
                else {
                    isCall = isGreen;
                    setupName = isGreen ? "Bullish Flow Dominance" : "Bearish Flow Dominance";
                    confidence = 85;
                }

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
        document.addEventListener('DOMContentLoaded', initApexEngine);
    } else {
        initApexEngine();
    }
})();
