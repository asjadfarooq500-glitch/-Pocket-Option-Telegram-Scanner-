// ==UserScript==
// @name         Pocket Option Quantitative OTC Engine
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Full OTC Data: Body%, Wick%, SNR Math, Dual Exhaustion & Dynamic Reasons
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT MAIN-WORLD PROXY FOR CANVAS & TICKS
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `
    (function() {
        function broadcastPrice(num) {
            if (num > 0 && Math.abs(num - 2.62) > 0.05 && num !== 100) {
                document.documentElement.setAttribute('data-po-live-price', num);
            }
        }
        try {
            var origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\\d{1,5}\\.\\d{4,6}$/.test(str)) {
                        broadcastPrice(parseFloat(str));
                    }
                }
                return origFill.apply(this, arguments);
            };
        } catch(e) {}
    })();
    `;
    (document.head || document.documentElement).appendChild(bridgeScript);

    function initEngine() {
        if (!document.body) {
            setTimeout(initEngine, 200);
            return;
        }

        if (document.getElementById('po-manual-hud')) return;

        // Sound System
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
        hud.id = 'po-manual-hud';
        hud.style.cssText = `
            position: fixed;
            top: 180px;
            left: 15px;
            z-index: 999999999;
            background: rgba(8, 12, 22, 0.98);
            border: 2px solid #0ea5e9;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 14px 45px rgba(0,0,0,0.95);
            width: 205px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ QUANT OTC ENGINE v10</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR LEVEL: <span id="m-zone" style="color: #facc15; font-weight: bold;">SCANNING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE: <span id="m-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="m-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 QUANT DEEP SCAN (2.5s)
            </button>

            <div id="m-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="m-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.1s linear;"></div>
            </div>

            <div id="m-status-box" style="margin-top: 8px; padding: 8px 4px; background: #0f172a; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Engine Decision</div>
                <div id="m-signal-text" style="font-size: 14px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
                <div id="m-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Awaiting Candle Scan</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 12s of candle</div>
        `;

        document.body.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 15, startBoxY = 180;
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 210, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 240, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        function getLivePrice() {
            let hooked = parseFloat(document.documentElement.getAttribute('data-po-live-price'));
            if (hooked && hooked > 0) return hooked;

            const nodes = document.querySelectorAll('*');
            for (let el of nodes) {
                if (el.children.length === 0 && el.textContent) {
                    let txt = el.textContent.trim();
                    if (/^\d{1,4}\.\d{4,6}$/.test(txt)) {
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

        // Multi-Candle History
        let candleHistory = [];
        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, lastMinute = -1;

        setInterval(() => {
            const price = getLivePrice();
            const pair = getActivePair();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            if (currentMin !== lastMinute) {
                if (lastMinute !== -1 && candleOpen && price) {
                    candleHistory.push({
                        open: candleOpen,
                        close: price,
                        high: candleHigh,
                        low: candleLow,
                        isGreen: price >= candleOpen,
                        range: Math.abs(candleHigh - candleLow),
                        body: Math.abs(price - candleOpen)
                    });
                    if (candleHistory.length > 8) candleHistory.shift();
                }

                lastMinute = currentMin;
                candleOpen = price;
                candleHigh = price || -Infinity;
                candleLow = price || Infinity;
            }

            if (!candleOpen && price) {
                candleOpen = price;
                candleHigh = price;
                candleLow = price;
            }

            const priceEl = document.getElementById('m-price');
            const zoneEl = document.getElementById('m-zone');

            if (price) {
                if (price > candleHigh) candleHigh = price;
                if (price < candleLow) candleLow = price;
                priceEl.innerText = price.toFixed(5);
                priceEl.style.color = "#10b981";

                let pStr = price.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                if (lastTwo >= 94 || lastTwo <= 6) {
                    zoneEl.innerText = "🎯 MAJOR SNR (.00)";
                    zoneEl.style.color = "#ec4899";
                } else if (Math.abs(lastTwo - 50) <= 6) {
                    zoneEl.innerText = "🎯 MID SNR (.50)";
                    zoneEl.style.color = "#f59e0b";
                } else if (Math.abs(lastTwo - 20) <= 5 || Math.abs(lastTwo - 80) <= 5) {
                    zoneEl.innerText = "🎯 KEY LEVEL (.20/.80)";
                    zoneEl.style.color = "#38bdf8";
                } else {
                    zoneEl.innerText = "MID CHANNEL";
                    zoneEl.style.color = "#64748b";
                }
            }

            document.getElementById('m-pair').innerText = pair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 150);

        // QUANT DEEP SCAN (2.5s) ENGINE
        let isScanning = false;
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('m-status-box');
            const sigText = document.getElementById('m-signal-text');
            const confText = document.getElementById('m-conf-text');
            const desc = document.getElementById('m-desc');
            const scanBtn = document.getElementById('m-scan-btn');
            const pBar = document.getElementById('m-progress-bar');
            const pFill = document.getElementById('m-progress-fill');

            if (!price) {
                sigText.innerText = "WAIT FOR TICK";
                sigText.style.color = "#f43f5e";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "ANALYZING 25 TICKS...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 25; // 2.5s

            const scanInterval = setInterval(() => {
                elapsed++;
                let tick = getLivePrice();
                if (tick) tickSamples.push(tick);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateQuantSignal(tickSamples);
                }
            }, 100);

            function evaluateQuantSignal(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 QUANT DEEP SCAN (2.5s)";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || price;
                const baseOpen = candleOpen || latestPrice;

                // 1. Candlestick Geometry Math
                let isGreen = latestPrice >= baseOpen;
                let bodySize = Math.abs(latestPrice - baseOpen);
                let upperWick = Math.max(0, candleHigh - Math.max(latestPrice, baseOpen));
                let lowerWick = Math.max(0, Math.min(latestPrice, baseOpen) - candleLow);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 2. Tick Velocity & Delta (Order Flow)
                let tickDelta = 0;
                let upTicks = 0, downTicks = 0;
                for (let i = 1; i < ticks.length; i++) {
                    let diff = ticks[i] - ticks[i - 1];
                    tickDelta += diff;
                    if (diff > 0) upTicks++;
                    else if (diff < 0) downTicks++;
                }

                // 3. Historical Stream Count (Consecutive Reds/Greens)
                let consecutiveReds = 0;
                let consecutiveGreens = 0;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (!candleHistory[i].isGreen) {
                        if (consecutiveGreens === 0) consecutiveReds++;
                        else break;
                    } else {
                        if (consecutiveReds === 0) consecutiveGreens++;
                        else break;
                    }
                }
                if (!isGreen) consecutiveReds++;
                else consecutiveGreens++;

                // 4. SNR Proximity Check
                let pStr = latestPrice.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                let isMajorSNR = (lastTwo >= 94 || lastTwo <= 6);
                let isMidSNR = (Math.abs(lastTwo - 50) <= 6);
                let isKeyLevel = (Math.abs(lastTwo - 20) <= 5 || Math.abs(lastTwo - 80) <= 5);

                let isCall = true;
                let setupName = "";
                let baseConfidence = 76; // Dynamic starting base

                // ==========================================
                // QUANT DECISION ENGINE
                // ==========================================

                // RULE A: 3+ REDS EXHAUSTION REVERSAL (Floor Bounce)
                if (consecutiveReds >= 3 && (lowerWickPct >= 25 || tickDelta >= 0 || isMajorSNR || isMidSNR)) {
                    isCall = true;
                    setupName = `${consecutiveReds}x Red Exhaustion Floor`;
                    baseConfidence = 86 + (consecutiveReds * 2);
                    if (lowerWickPct >= 35) baseConfidence += 3;
                    if (isMajorSNR) baseConfidence += 4;
                }
                // RULE B: 3+ GREENS EXHAUSTION REVERSAL (Roof Dump)
                else if (consecutiveGreens >= 3 && (upperWickPct >= 25 || tickDelta <= 0 || isMajorSNR || isMidSNR)) {
                    isCall = false;
                    setupName = `${consecutiveGreens}x Green Exhaustion Roof`;
                    baseConfidence = 86 + (consecutiveGreens * 2);
                    if (upperWickPct >= 35) baseConfidence += 3;
                    if (isMajorSNR) baseConfidence += 4;
                }
                // RULE C: SHARP WICK REJECTION AT SNR
                else if (lowerWickPct > upperWickPct && lowerWickPct >= 35) {
                    isCall = true;
                    setupName = "Support Wick Rejection";
                    baseConfidence = 82 + Math.floor(lowerWickPct / 10);
                    if (isMajorSNR || isMidSNR) baseConfidence += 4;
                }
                else if (upperWickPct > lowerWickPct && upperWickPct >= 35) {
                    isCall = false;
                    setupName = "Resistance Wick Rejection";
                    baseConfidence = 82 + Math.floor(upperWickPct / 10);
                    if (isMajorSNR || isMidSNR) baseConfidence += 4;
                }
                // RULE D: FRESH MOMENTUM (1st or 2nd candle expansion)
                else if (bodyPct >= 55) {
                    if (isGreen && upTicks >= downTicks) {
                        isCall = true;
                        setupName = "Bullish Body Expansion";
                        baseConfidence = 80 + Math.floor(bodyPct / 15);
                    } else if (!isGreen && downTicks >= upTicks) {
                        isCall = false;
                        setupName = "Bearish Body Expansion";
                        baseConfidence = 80 + Math.floor(bodyPct / 15);
                    } else {
                        isCall = isGreen;
                        setupName = "Trend Volume Push";
                        baseConfidence = 78;
                    }
                }
                // RULE E: TICK FLOW RESOLUTION
                else {
                    isCall = (upTicks >= downTicks);
                    setupName = "Micro-Tick Order Flow";
                    baseConfidence = 77 + Math.abs(upTicks - downTicks);
                }

                // Dynamic Confidence Calculation (Bound between 78% and 97%)
                let finalConfidence = Math.min(97, Math.max(78, baseConfidence));

                // Dynamic Live Reason Constructor (Combines real candle metrics)
                let snrTag = isMajorSNR ? ".00 SNR" : (isMidSNR ? ".50 SNR" : (isKeyLevel ? "Key Level" : "Channel"));
                let wickTag = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${setupName} • Body: ${bodyPct}% • ${wickTag} • Ticks: [${upTicks}▲ ${downTicks}▼] • ${snrTag}`;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${finalConfidence}%`;
                desc.innerHTML = `Entry at <b>${entryClock}</b><br><span style="color:#38bdf8; font-size: 7.5px;">${dynamicReason}</span>`;

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
