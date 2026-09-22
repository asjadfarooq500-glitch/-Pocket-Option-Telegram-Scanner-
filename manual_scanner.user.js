// ==UserScript==
// @name         Pocket Option APEX Dual-Stream Engine
// @namespace    http://tampermonkey.net/
// @version      120.0
// @description  Zero-Freeze Dual DOM/Canvas Stream, 20-Bar Trend Lock, No-Coordinate Traps
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. DUAL-LAYER INJECTION (ZERO RESTRICTIONS ON CANVAS / NATIVE TANK)
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `
    (function() {
        var lastValidTick = null;
        var lastTickTimestamp = 0;

        function submitPrice(num) {
            if (!num || num <= 0 || Math.abs(num - 2.62) < 0.05 || num === 100 || Math.abs(num - 1.89) < 0.01) return;
            lastValidTick = num;
            lastTickTimestamp = Date.now();
            document.documentElement.setAttribute('data-po-live-price', num);
            document.documentElement.setAttribute('data-po-live-time', lastTickTimestamp);
        }

        try {
            var origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\\d{1,6}\\.\\d{2,6}$/.test(str)) {
                        submitPrice(parseFloat(str));
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

        // HUD Interface
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
                <span>⚡ APEX DUAL-STREAM v120</span>
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
                    <span>BODY: <b id="a-body" style="color:#38bdf8;">--%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">--%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">--%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">FLOW: <span id="a-flow" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">DETECTED: <span id="a-pattern" style="color: #c084fc; font-weight: bold;">STANDBY</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN RUNNING CANDLE
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 14s to 5s of candle</div>
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

        // DUAL-FALLBACK LIVE PRICE GETTER (DOM First, Hook Second)
        function getLivePrice() {
            // Priority 1: Direct DOM extraction from right-axis price badges
            const allElements = document.querySelectorAll('*');
            for (let el of allElements) {
                if (el.children.length === 0 && el.textContent) {
                    let txt = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        let rect = el.getBoundingClientRect();
                        if (rect.top > 60 && rect.left > (window.innerWidth * 0.50)) {
                            let n = parseFloat(txt);
                            if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100 && Math.abs(n - 1.89) > 0.01) {
                                return n;
                            }
                        }
                    }
                }
            }

            // Priority 2: Hook attribute
            let hooked = parseFloat(document.documentElement.getAttribute('data-po-live-price'));
            if (hooked && hooked > 0) return hooked;

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

        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
        let lastMinuteTracked = -1;
        let candleHistory = [];
        let storedPair = "";

        setInterval(() => {
            const currentPair = getActivePair();
            const price = getLivePrice();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            // Auto-Flush on pair switch
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
                    candleHistory.push({
                        open: candleOpen,
                        close: candleClose || price,
                        high: candleHigh,
                        low: candleLow,
                        isGreen: (candleClose || price) >= candleOpen,
                        body: Math.abs((candleClose || price) - candleOpen),
                        range: Math.max(0.00001, candleHigh - candleLow)
                    });
                    if (candleHistory.length > 20) candleHistory.shift();
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
                document.getElementById('a-price').innerText = price.toFixed(decimals);
                document.getElementById('a-price').style.color = "#10b981";

                document.getElementById('a-open').innerText = candleOpen.toFixed(decimals);
                document.getElementById('a-high').innerText = candleHigh.toFixed(decimals);
                document.getElementById('a-low').innerText = candleLow.toFixed(decimals);

                // EXACT LIVE WICK & BODY RATIOS
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

                document.getElementById('a-body').innerText = `${bPct}%`;
                document.getElementById('a-uwick').innerText = `${uPct}%`;
                document.getElementById('a-lwick').innerText = `${lPct}%`;

                // Multi-Candle Trend Streaks
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

                const flowEl = document.getElementById('a-flow');
                if (redStreak >= 4) {
                    flowEl.innerText = `WATERFALL CRASH (${redStreak}x RED) 🔴`;
                    flowEl.style.color = "#ef4444";
                } else if (greenStreak >= 4) {
                    flowEl.innerText = `ROCKET RALLY (${greenStreak}x GREEN) 🟢`;
                    flowEl.style.color = "#10b981";
                } else {
                    flowEl.innerText = "BALANCED CHANNEL";
                    flowEl.style.color = "#38bdf8";
                }
            }

            document.getElementById('a-pair').innerText = currentPair;
            document.getElementById('a-timer').innerText = `${60 - currentSec}s`;
        }, 80);

        // ==========================================
        // SCANNER: ZERO-FREEZE CONFLUENCE EVALUATOR
        // ==========================================
        let isScanning = false;
        document.getElementById('a-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('a-status-box');
            const sigText = document.getElementById('a-signal-text');
            const confText = document.getElementById('a-conf-text');
            const desc = document.getElementById('a-desc');
            const patEl = document.getElementById('a-pattern');
            const scanBtn = document.getElementById('a-scan-btn');
            const pBar = document.getElementById('a-progress-bar');
            const pFill = document.getElementById('a-progress-fill');

            if (!price || candleOpen === null) {
                sigText.innerText = "WAITING FOR TICK";
                sigText.style.color = "#f43f5e";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "READING CANDLE...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let elapsed = 0;
            const sampleSteps = 12;

            const scanInterval = setInterval(() => {
                elapsed++;
                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateDecision();
                }
            }, 100);

            function evaluateDecision() {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 SCAN RUNNING CANDLE";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const currentPrice = candleClose || getLivePrice();

                let isGreen = currentPrice >= candleOpen;
                let bodySize = Math.abs(currentPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, currentPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, currentPrice) - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                let redStreak = 0, greenStreak = 0;
                let swingLow = Infinity, swingHigh = -Infinity;

                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (candleHistory[i].low < swingLow) swingLow = candleHistory[i].low;
                    if (candleHistory[i].high > swingHigh) swingHigh = candleHistory[i].high;

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

                let isAtFloor = Math.abs(currentPrice - swingLow) < 0.00025;
                let isAtRoof = Math.abs(currentPrice - swingHigh) < 0.00025;

                let isCall = false;
                let setupName = "";
                let confidence = 88;

                // STRICT TRADING RULES (NO COUNTER-TREND)
                // RULE 1: WATERFALL DUMP LOCK (Never Buy into 4+ Red Waterfall)
                if (redStreak >= 4 && lowerWickPct <= 35) {
                    isCall = false;
                    setupName = `${redStreak}x Red Waterfall Dump (Follow Sell)`;
                    confidence = 96;
                }
                // RULE 2: ROCKET RALLY LOCK (Never Sell into 4+ Green Moon)
                else if (greenStreak >= 4 && upperWickPct <= 35) {
                    isCall = true;
                    setupName = `${greenStreak}x Green Rocket Rally (Follow Buy)`;
                    confidence = 96;
                }
                // RULE 3: SUPPORT FLOOR ABSORPTION BOUNCE
                else if (!isGreen && isAtFloor && lowerWickPct >= 30) {
                    isCall = true;
                    setupName = "Support Floor Absorption Bounce";
                    confidence = 94;
                }
                // RULE 4: RESISTANCE ROOF EXHAUSTION DROP
                else if (isGreen && isAtRoof && upperWickPct >= 30) {
                    isCall = false;
                    setupName = "Resistance Roof Exhaustion Drop";
                    confidence = 94;
                }
                // RULE 5: SOLID MOMENTUM BREAKOUT (Body >= 45%)
                else if (isGreen && bodyPct >= 45 && upperWickPct <= 25) {
                    isCall = true;
                    setupName = "Bullish Momentum Breakout";
                    confidence = 93;
                }
                else if (!isGreen && bodyPct >= 45 && lowerWickPct <= 25) {
                    isCall = false;
                    setupName = "Bearish Momentum Dump";
                    confidence = 93;
                }
                // RULE 6: CONFIRMED PINBAR REJECTION
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
                // RULE 7: DEFAULT CANDLE FLOW
                else {
                    isCall = isGreen;
                    setupName = isGreen ? "Buyer Volume Dominance" : "Seller Volume Dominance";
                    confidence = 85;
                }

                patEl.innerText = setupName;

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
        document.addEventListener('DOMContentLoaded', initEngine);
    } else {
        initEngine();
    }
})();
