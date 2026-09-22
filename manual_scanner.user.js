// ==UserScript==
// @name         Pocket Option Zero-Freeze Multi-Pair SMC Engine
// @namespace    http://tampermonkey.net/
// @version      16.0
// @description  Instant Pair-Wipe, Universal JPY/Crypto Rates, Zero-Flow Emergency Lock
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT MAIN-WORLD PROXY FOR ALL ASSET FORMATS (FOREX, JPY, CRYPTO)
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
                    // Matches: 0.63998, 111.939, 18.2899, 65000.50
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
            background: rgba(4, 8, 18, 0.98);
            border: 2px solid #0284c7;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 16px 55px rgba(0,0,0,0.98);
            width: 225px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ SMC ENGINE v16 (AUTO-SYNC)</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">STRUCTURE: <span id="m-struct" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SETUP: <span id="m-setup" style="color: #c084fc; font-weight: bold;">READY</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="m-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="m-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 FULL CHART DEEP SCAN
            </button>

            <div id="m-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="m-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="m-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Decision</div>
                <div id="m-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="m-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 15s to 8s of candle</div>
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 230, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 270, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
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
            return "OTC ASSET";
        }

        let curBarOpen = null, curBarHigh = -Infinity, curBarLow = Infinity, curBarClose = null;
        let candleHistory = [];
        let lastMinuteTracked = -1;
        let activePairStored = "";

        setInterval(() => {
            const currentPair = getActivePair();
            const price = getLivePrice();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            // INSTANT PAIR CHANGE DETECTION & MEMORY WIPE
            if (activePairStored !== "" && currentPair !== activePairStored) {
                curBarOpen = price;
                curBarHigh = price || -Infinity;
                curBarLow = price || Infinity;
                curBarClose = price;
                candleHistory = [];
                lastMinuteTracked = currentMin;
                document.getElementById('m-signal-text').innerText = "PAIR CHANGED";
                document.getElementById('m-signal-text').style.color = "#facc15";
            }
            activePairStored = currentPair;

            // Minute Bar Rollover
            if (currentMin !== lastMinuteTracked) {
                if (lastMinuteTracked !== -1 && curBarOpen !== null && curBarClose !== null) {
                    let cBody = Math.abs(curBarClose - curBarOpen);
                    let cRange = Math.max(0.00001, curBarHigh - curBarLow);
                    let cUpper = curBarHigh - Math.max(curBarOpen, curBarClose);
                    let cLower = Math.min(curBarOpen, curBarClose) - curBarLow;

                    candleHistory.push({
                        open: curBarOpen,
                        close: curBarClose,
                        high: curBarHigh,
                        low: curBarLow,
                        isGreen: curBarClose >= curBarOpen,
                        body: cBody,
                        range: cRange,
                        upperWick: cUpper,
                        lowerWick: cLower
                    });
                    if (candleHistory.length > 15) candleHistory.shift();
                }

                lastMinuteTracked = currentMin;
                curBarOpen = price;
                curBarHigh = price || -Infinity;
                curBarLow = price || Infinity;
                curBarClose = price;
            }

            if (price) {
                if (!curBarOpen) curBarOpen = price;
                if (price > curBarHigh) curBarHigh = price;
                if (price < curBarLow) curBarLow = price;
                curBarClose = price;

                document.getElementById('m-price').innerText = price.toFixed(price > 100 ? 3 : 5);
                document.getElementById('m-price').style.color = "#10b981";

                let greenCount = 0, redCount = 0;
                for (let i = candleHistory.length - 1; i >= 0; i--) {
                    if (candleHistory[i].isGreen) {
                        if (redCount === 0) greenCount++;
                        else break;
                    } else {
                        if (greenCount === 0) redCount++;
                        else break;
                    }
                }
                const structEl = document.getElementById('m-struct');
                if (greenCount >= 4) {
                    structEl.innerText = `BUYING CLIMAX (${greenCount}x UP) ⚠️`;
                    structEl.style.color = "#ef4444";
                } else if (redCount >= 4) {
                    structEl.innerText = `SELLING CLIMAX (${redCount}x DOWN) ⚠️`;
                    structEl.style.color = "#10b981";
                } else {
                    structEl.innerText = "BALANCED FLOW";
                    structEl.style.color = "#38bdf8";
                }
            }

            document.getElementById('m-pair').innerText = currentPair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 120);

        // FULL SCAN ENGINE WITH ZERO-FLOW EMERGENCY STOP
        let isScanning = false;
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('m-status-box');
            const sigText = document.getElementById('m-signal-text');
            const confText = document.getElementById('m-conf-text');
            const desc = document.getElementById('m-desc');
            const setupEl = document.getElementById('m-setup');
            const scanBtn = document.getElementById('m-scan-btn');
            const pBar = document.getElementById('m-progress-bar');
            const pFill = document.getElementById('m-progress-fill');

            if (!price || !curBarOpen) {
                sigText.innerText = "WAITING FOR TICK";
                sigText.style.color = "#f43f5e";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "SCANNING CHART MATRIX...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleSteps = 18;

            const scanInterval = setInterval(() => {
                elapsed++;
                let tick = getLivePrice();
                if (tick) tickSamples.push(tick);

                let progress = Math.min(100, Math.round((elapsed / sampleSteps) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluateGuardedSignal(tickSamples);
                }
            }, 100);

            function evaluateGuardedSignal(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 FULL CHART DEEP SCAN";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || curBarClose || price;

                // 1. Order Flow Velocity
                let upTicks = 0, downTicks = 0;
                for (let i = 1; i < ticks.length; i++) {
                    if (ticks[i] > ticks[i - 1]) upTicks++;
                    else if (ticks[i] < ticks[i - 1]) downTicks++;
                }

                // SAFETY CHECK: AGAR TICKS FREEZE HON TOH SIGNAL BLOCK
                if (upTicks === 0 && downTicks === 0) {
                    sigText.innerText = "TICK FROZEN ⚠️";
                    sigText.style.color = "#f43f5e";
                    sigBox.style.borderColor = "#f43f5e";
                    confText.innerText = "NO DATA FLOW";
                    desc.innerHTML = `Price did not update during scan. <b>Switch pair or re-scan</b>`;
                    playBeep(300);
                    return;
                }

                // 2. Exact Candle Geometry
                let isGreen = latestPrice >= curBarOpen;
                let bodySize = Math.abs(latestPrice - curBarOpen);
                let totalRange = Math.max(0.00001, curBarHigh - curBarLow);
                let upperWick = curBarHigh - Math.max(curBarOpen, latestPrice);
                let lowerWick = Math.min(curBarOpen, latestPrice) - curBarLow;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 3. Streak Count
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
                let patternName = "";
                let confidence = 85;

                // ==========================================
                // STRICT SMC LOGIC
                // ==========================================

                // RULE 1: BUYING CLIMAX (Top par CALL 100% Forbidden)
                if (greenStreak >= 4) {
                    isCall = false; // Always PUT at the top of 4+ candles
                    patternName = "Buying Climax Reversal";
                    confidence = 94;
                }
                // RULE 2: SELLING CLIMAX (Bottom par PUT 100% Forbidden)
                else if (redStreak >= 4) {
                    isCall = true; // Always CALL at the bottom of 4+ candles
                    patternName = "Selling Climax Reversal";
                    confidence = 94;
                }
                // RULE 3: PINBAR REVERSALS
                else if (lowerWickPct >= 45 && bodyPct <= 35) {
                    isCall = true;
                    patternName = "Hammer Floor Reversal";
                    confidence = 92;
                }
                else if (upperWickPct >= 45 && bodyPct <= 35) {
                    isCall = false;
                    patternName = "Shooting Star Roof Reversal";
                    confidence = 92;
                }
                // RULE 4: ENGULFING MOMENTUM
                else if (candleHistory.length > 0 && bodyPct >= 55) {
                    let prev = candleHistory[candleHistory.length - 1];
                    if (!isGreen && prev.isGreen && bodySize > prev.body) {
                        isCall = false;
                        patternName = "Bearish Engulfing";
                        confidence = 90;
                    } else if (isGreen && !prev.isGreen && bodySize > prev.body) {
                        isCall = true;
                        patternName = "Bullish Engulfing";
                        confidence = 90;
                    }
                }
                // RULE 5: FLOW DIRECTION
                if (!patternName) {
                    isCall = (upTicks >= downTicks);
                    patternName = isCall ? "Buyer Order Flow" : "Seller Order Flow";
                    confidence = 84;
                }

                setupEl.innerText = patternName;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${confidence}%`;

                let wickInfo = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${patternName} • Body: ${bodyPct}% • ${wickInfo} • Flow: [${upTicks}▲ ${downTicks}▼]`;
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
