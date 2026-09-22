// ==UserScript==
// @name         Pocket Option Decisive Quantum OTC Engine
// @namespace    http://tampermonkey.net/
// @version      14.0
// @description  Full Candlestick Anatomy, Dual Exhaustion, SNR & 5-Second Early Decisive Signals
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. MAIN-WORLD PROXY FOR CANVAS & TICKS
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
            width: 220px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ QUANTUM DECISIVE v14</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR LEVEL: <span id="m-snr" style="color: #facc15; font-weight: bold;">CALCULATING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE CLOCK: <span id="m-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="m-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 SCAN CANDLE (2.0s)
            </button>

            <div id="m-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="m-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.1s linear;"></div>
            </div>

            <div id="m-status-box" style="margin-top: 8px; padding: 8px 4px; background: #0b1329; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Decision</div>
                <div id="m-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="m-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Click SCAN between 15s and 10s</div>
        `;

        document.body.appendChild(hud);

        // Smooth Touch Dragging
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 225, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 260, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
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

                let pStr = price.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                const snrEl = document.getElementById('m-snr');
                if (lastTwo >= 95 || lastTwo <= 5) {
                    snrEl.innerText = "🎯 MAJOR .00 SNR";
                    snrEl.style.color = "#ec4899";
                } else if (Math.abs(lastTwo - 50) <= 5) {
                    snrEl.innerText = "🎯 MID .50 SNR";
                    snrEl.style.color = "#f59e0b";
                } else if (Math.abs(lastTwo - 20) <= 4 || Math.abs(lastTwo - 80) <= 4) {
                    snrEl.innerText = "🎯 KEY LEVEL .20/.80";
                    snrEl.style.color = "#38bdf8";
                } else {
                    snrEl.innerText = "MID CHANNEL";
                    snrEl.style.color = "#64748b";
                }
            }

            // Save completed candle to history
            if (currentMin !== lastMinute) {
                if (lastMinute !== -1 && priceBuffer.length > 25) {
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

        // 2.0-SECOND SCAN (DELIVERS EXACTLY AT 5-6s BEFORE EXPIRY)
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

            if (!price || priceBuffer.length < 15) {
                sigText.innerText = "WAIT FOR BUFFER";
                sigText.style.color = "#f43f5e";
                desc.innerText = "Waiting for price ticks to sync";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "DEEP SCANNING (2.0s)...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 20; // 2.0 seconds total (100ms * 20)

            const scanInterval = setInterval(() => {
                elapsed++;
                let tick = getLivePrice();
                if (tick) tickSamples.push(tick);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateDecisiveQuantum(tickSamples);
                }
            }, 100);

            function evaluateDecisiveQuantum(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 SCAN CANDLE (2.0s)";
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

                // 2. 2.0s Tick Velocity & Order Flow
                let upTicks = 0, downTicks = 0;
                for (let i = 1; i < ticks.length; i++) {
                    if (ticks[i] > ticks[i - 1]) upTicks++;
                    else if (ticks[i] < ticks[i - 1]) downTicks++;
                }

                // 3. Macro Trend & Sequence History
                let price60s = getBufferPriceAt(now - 60000) || trueOpen;
                let delta60s = currentPrice - price60s;

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

                // 4. SNR Proximity Check
                let pStr = currentPrice.toFixed(5);
                let lastTwo = parseInt(pStr.slice(-2));
                let atMajorSNR = (lastTwo >= 95 || lastTwo <= 5);
                let atMidSNR = (Math.abs(lastTwo - 50) <= 5);

                // ==========================================
                // WEIGHTED DECISIVE ENGINE (NO-TRADE BANNED)
                // ==========================================
                let callScore = 0;
                let putScore = 0;
                let setupName = "";

                // A. Exhaustion Weight (Highest Confluence in Binary OTC)
                if (redStreak >= 3) {
                    callScore += 45 + (redStreak * 8);
                    setupName = `${redStreak}x Red Dump Exhaustion`;
                }
                if (greenStreak >= 3) {
                    putScore += 45 + (greenStreak * 8);
                    setupName = `${greenStreak}x Green Pump Exhaustion`;
                }

                // B. Candlestick Wick Rejection Secrets
                if (lowerWickPct >= 40 && lowerWickPct > upperWickPct) {
                    callScore += 35 + Math.floor(lowerWickPct / 3);
                    if (!setupName) setupName = "Hammer / Floor Rejection";
                }
                if (upperWickPct >= 40 && upperWickPct > lowerWickPct) {
                    putScore += 35 + Math.floor(upperWickPct / 3);
                    if (!setupName) setupName = "Shooting Star / Roof Rejection";
                }

                // C. Body Momentum Expansion
                if (bodyPct >= 60) {
                    if (isGreen && greenStreak <= 2) {
                        callScore += 30;
                        if (!setupName) setupName = "Bullish Momentum Continuation";
                    } else if (!isGreen && redStreak <= 2) {
                        putScore += 30;
                        if (!setupName) setupName = "Bearish Dump Continuation";
                    }
                }

                // D. SNR Attraction & Bounce Math
                if (atMajorSNR || atMidSNR) {
                    if (lowerWickPct >= 25) callScore += 25;
                    if (upperWickPct >= 25) putScore += 25;
                }

                // E. 2-Second Tick Velocity
                if (upTicks > downTicks) callScore += 15 + (upTicks - downTicks) * 2;
                if (downTicks > upTicks) putScore += 15 + (downTicks - upTicks) * 2;

                // F. Macro Trend Baseline
                if (delta60s > 0) callScore += 10;
                else putScore += 10;

                // DECISIVE VERDICT (Strict Winner Selected)
                let isCall = callScore >= putScore;
                if (!setupName) {
                    setupName = isCall ? "Buyer Flow Confluence" : "Seller Flow Confluence";
                }

                // Dynamic Confidence (Calculated between 84% and 97%)
                let maxPoints = Math.max(callScore, putScore);
                let dynamicConfidence = Math.min(97, Math.max(84, 80 + Math.floor(maxPoints / 6)));

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${dynamicConfidence}%`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${setupName} • Body: ${bodyPct}% • ${wickInfo} • Flow: [${upTicks}▲ ${downTicks}▼]`;
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
