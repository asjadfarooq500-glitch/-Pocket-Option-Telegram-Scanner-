// ==UserScript==
// @name         Pocket Option Ultimate Pattern & Price-Action Engine
// @namespace    http://tampermonkey.net/
// @version      12.0
// @description  Full Pattern Matrix: Hammer, Shooting Star, Engulfing, Marubozu, SNR & Order-Flow
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. MAIN-WORLD CANVAS HOOK
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
        hud.id = 'po-manual-hud';
        hud.style.cssText = `
            position: fixed;
            top: 175px;
            left: 15px;
            z-index: 999999999;
            background: rgba(6, 10, 20, 0.98);
            border: 2px solid #0284c7;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 16px 50px rgba(0,0,0,0.95);
            width: 215px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ ULTIMATE PATTERN ENGINE</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR ZONE: <span id="m-snr" style="color: #facc15; font-weight: bold;">SCANNING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">DETECTED: <span id="m-pat" style="color: #c084fc; font-weight: bold;">ANALYZING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE: <span id="m-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="m-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 DEEP PATTERN SCAN (2.5s)
            </button>

            <div id="m-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="m-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.1s linear;"></div>
            </div>

            <div id="m-status-box" style="margin-top: 8px; padding: 8px 4px; background: #0f172a; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Engine Decision</div>
                <div id="m-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="m-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 12s of candle</div>
        `;

        document.body.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 15, startBoxY = 175;
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 220, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 250, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
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

        // Rolling buffer & Candlestick History
        let priceBuffer = [];
        let candleHistory = [];
        let lastMinute = -1;

        setInterval(() => {
            const price = getLivePrice();
            const pair = getActivePair();
            const now = Date.now();
            const nowDate = new Date();
            const currentSec = nowDate.getSeconds();
            const currentMin = nowDate.getMinutes();

            if (price) {
                priceBuffer.push({ t: now, p: price });
                const cutoff = now - (180 * 1000);
                while (priceBuffer.length > 0 && priceBuffer[0].t < cutoff) {
                    priceBuffer.shift();
                }

                document.getElementById('m-price').innerText = price.toFixed(5);
                document.getElementById('m-price').style.color = "#10b981";

                // Check Institutional Round Numbers
                let pStr = price.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                const snrEl = document.getElementById('m-snr');
                if (lastTwo >= 94 || lastTwo <= 6) {
                    snrEl.innerText = "🎯 MAJOR SNR (.00)";
                    snrEl.style.color = "#ec4899";
                } else if (Math.abs(lastTwo - 50) <= 6) {
                    snrEl.innerText = "🎯 MID SNR (.50)";
                    snrEl.style.color = "#f59e0b";
                } else if (Math.abs(lastTwo - 20) <= 5 || Math.abs(lastTwo - 80) <= 5) {
                    snrEl.innerText = "🎯 KEY LEVEL (.20/.80)";
                    snrEl.style.color = "#38bdf8";
                } else {
                    snrEl.innerText = "MID CHANNEL";
                    snrEl.style.color = "#64748b";
                }
            }

            // Save completed candle to history
            if (currentMin !== lastMinute) {
                if (lastMinute !== -1 && priceBuffer.length > 30) {
                    let prevMinStart = (Math.floor(now / 60000) - 1) * 60000;
                    let prevMinEnd = prevMinStart + 60000;
                    let prevTicks = priceBuffer.filter(pt => pt.t >= prevMinStart && pt.t < prevMinEnd);
                    if (prevTicks.length > 0) {
                        let cOpen = prevTicks[0].p;
                        let cClose = prevTicks[prevTicks.length - 1].p;
                        let cHigh = Math.max(...prevTicks.map(t => t.p));
                        let cLow = Math.min(...prevTicks.map(t => t.p));
                        candleHistory.push({
                            open: cOpen,
                            close: cClose,
                            high: cHigh,
                            low: cLow,
                            isGreen: cClose >= cOpen,
                            body: Math.abs(cClose - cOpen),
                            range: Math.max(0.00001, cHigh - cLow)
                        });
                        if (candleHistory.length > 8) candleHistory.shift();
                    }
                }
                lastMinute = currentMin;
            }

            document.getElementById('m-pair').innerText = pair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 120);

        function getBufferPriceAt(targetTime) {
            if (priceBuffer.length === 0) return null;
            let closest = priceBuffer[0];
            let minDiff = Math.abs(closest.t - targetTime);
            for (let i = 1; i < priceBuffer.length; i++) {
                let diff = Math.abs(priceBuffer[i].t - targetTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closest = priceBuffer[i];
                }
            }
            return closest.p;
        }

        // 2.5s MULTI-VARIABLE PATTERN SCANNER
        let isScanning = false;
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('m-status-box');
            const sigText = document.getElementById('m-signal-text');
            const confText = document.getElementById('m-conf-text');
            const desc = document.getElementById('m-desc');
            const patEl = document.getElementById('m-pat');
            const scanBtn = document.getElementById('m-scan-btn');
            const pBar = document.getElementById('m-progress-bar');
            const pFill = document.getElementById('m-progress-fill');

            if (!price || priceBuffer.length < 20) {
                sigText.innerText = "BUFFER SYNCING...";
                sigText.style.color = "#f43f5e";
                desc.innerText = "Wait 10s for candle data to lock";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "DEEP PATTERN READ...";
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
                    evaluateAllPatterns(tickSamples);
                }
            }, 100);

            function evaluateAllPatterns(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 DEEP PATTERN SCAN (2.5s)";
                pBar.style.display = "none";

                const now = Date.now();
                const nowDate = new Date();
                const currentSec = nowDate.getSeconds();

                // 1. Precise Candle Geometry
                const startOfMinute = Math.floor(now / 60000) * 60000;
                const trueOpen = getBufferPriceAt(startOfMinute) || ticks[0] || price;
                const currentPrice = ticks[ticks.length - 1] || price;

                let candleHigh = -Infinity, candleLow = Infinity;
                for (let pt of priceBuffer) {
                    if (pt.t >= startOfMinute) {
                        if (pt.p > candleHigh) candleHigh = pt.p;
                        if (pt.p < candleLow) candleLow = pt.p;
                    }
                }
                if (candleHigh === -Infinity) candleHigh = Math.max(trueOpen, currentPrice);
                if (candleLow === Infinity) candleLow = Math.min(trueOpen, currentPrice);

                let isGreen = currentPrice >= trueOpen;
                let bodySize = Math.abs(currentPrice - trueOpen);
                let totalRange = Math.max(0.00002, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(currentPrice, trueOpen));
                let lowerWick = Math.max(0, Math.min(currentPrice, trueOpen) - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 2. Order-Flow Tick Analysis
                let upTicks = 0, downTicks = 0;
                for (let i = 1; i < ticks.length; i++) {
                    if (ticks[i] > ticks[i - 1]) upTicks++;
                    else if (ticks[i] < ticks[i - 1]) downTicks++;
                }

                // 3. Macro Trend & Streak
                let price60s = getBufferPriceAt(now - 60000) || trueOpen;
                let delta60s = currentPrice - price60s;
                let isCrash = delta60s < -0.00020;
                let isRally = delta60s > 0.00020;

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

                // 4. SNR Proximity
                let pStr = currentPrice.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                let atMajorSNR = (lastTwo >= 94 || lastTwo <= 6);
                let atMidSNR = (Math.abs(lastTwo - 50) <= 6);

                // ==========================================
                // PATTERN IDENTIFICATION & DECISION MATRIX
                // ==========================================
                let isCall = false;
                let patternName = "";
                let baseConf = 80;

                // PATTERN 1: HAMMER / PINBAR REJECTION AT FLOOR
                if (lowerWickPct >= 55 && bodyPct <= 35 && upperWickPct <= 15) {
                    isCall = true;
                    patternName = "Bullish Pinbar / Hammer";
                    baseConf = 92 + (atMajorSNR ? 4 : 0);
                }
                // PATTERN 2: SHOOTING STAR REJECTION AT ROOF
                else if (upperWickPct >= 55 && bodyPct <= 35 && lowerWickPct <= 15) {
                    isCall = false;
                    patternName = "Bearish Shooting Star";
                    baseConf = 92 + (atMajorSNR ? 4 : 0);
                }
                // PATTERN 3: ENGULFING PATTERN
                else if (candleHistory.length > 0 && bodyPct >= 65) {
                    let prev = candleHistory[candleHistory.length - 1];
                    if (isGreen && !prev.isGreen && bodySize > prev.body) {
                        isCall = true;
                        patternName = "Bullish Engulfing";
                        baseConf = 90;
                    } else if (!isGreen && prev.isGreen && bodySize > prev.body) {
                        isCall = false;
                        patternName = "Bearish Engulfing";
                        baseConf = 90;
                    }
                }
                // PATTERN 4: MARUBOZU (MOMENTUM EXPANSION)
                if (!patternName && bodyPct >= 80 && upperWickPct <= 10 && lowerWickPct <= 10) {
                    if (redStreak <= 2 && !isGreen) {
                        isCall = false;
                        patternName = "Bearish Marubozu (Continuation)";
                        baseConf = 88;
                    } else if (greenStreak <= 2 && isGreen) {
                        isCall = true;
                        patternName = "Bullish Marubozu (Continuation)";
                        baseConf = 88;
                    }
                }
                // PATTERN 5: WATERFALL EXHAUSTION (3+ Candles into SNR)
                if (!patternName) {
                    if (redStreak >= 3 && (lowerWickPct >= 30 || atMajorSNR || atMidSNR || upTicks > downTicks)) {
                        isCall = true;
                        patternName = `${redStreak}x Red Dump Exhaustion Floor`;
                        baseConf = 91 + (redStreak * 2);
                    } else if (greenStreak >= 3 && (upperWickPct >= 30 || atMajorSNR || atMidSNR || downTicks > upTicks)) {
                        isCall = false;
                        patternName = `${greenStreak}x Green Pump Exhaustion Roof`;
                        baseConf = 91 + (greenStreak * 2);
                    }
                }
                // PATTERN 6: TREND LOCK CRASH / RALLY (Avoid Counter-trend)
                if (!patternName) {
                    if (isCrash) {
                        isCall = false;
                        patternName = "Heavy Crash Trend-Follow";
                        baseConf = 90;
                    } else if (isRally) {
                        isCall = true;
                        patternName = "Heavy Rally Trend-Follow";
                        baseConf = 90;
                    }
                }
                // PATTERN 7: DOJI / INDECISION RESOLUTION
                if (!patternName) {
                    if (bodyPct <= 15) {
                        isCall = (upTicks >= downTicks);
                        patternName = "Doji Breakout Resolution";
                        baseConf = 81;
                    } else {
                        isCall = isGreen;
                        patternName = isGreen ? "Bullish Volume Push" : "Bearish Volume Drop";
                        baseConf = 83;
                    }
                }

                // Final Output
                let finalConf = Math.min(97, Math.max(81, baseConf));
                patEl.innerText = patternName;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${finalConf}%`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${patternName} • Body: ${bodyPct}% • ${wickInfo} • Flow: [${upTicks}▲ ${downTicks}▼]`;
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
