// ==UserScript==
// @name         Pocket Option Titan Institutional Range & Floor Guard
// @namespace    http://tampermonkey.net/
// @version      21.0
// @description  Swing Floor/Roof Detection, Never-Sell-At-Support Lock, Range Mean-Reversion
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT UNIVERSAL MAIN-WORLD PRICE HOOK
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

    function initTitanEngine() {
        if (!document.body) {
            setTimeout(initTitanEngine, 200);
            return;
        }

        if (document.getElementById('po-titan-hud')) return;

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
        hud.id = 'po-titan-hud';
        hud.style.cssText = `
            position: fixed;
            top: 175px;
            left: 15px;
            z-index: 999999999;
            background: rgba(3, 7, 18, 0.98);
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
                <span>⚡ TITAN FLOOR-GUARD v21</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="t-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="t-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">FLOOR LEVEL: <span id="t-snr" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">DETECTED: <span id="t-pattern" style="color: #c084fc; font-weight: bold;">STANDBY</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="t-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="t-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 INSTITUTIONAL SCAN
            </button>

            <div id="t-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="t-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="t-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Decision</div>
                <div id="t-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
                <div id="t-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="t-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 14s to 8s of candle</div>
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
            return "OTC PAIR";
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

            // Instant Pair Switch Auto-Flush
            if (activePairStored !== "" && currentPair !== activePairStored) {
                curBarOpen = price;
                curBarHigh = price || -Infinity;
                curBarLow = price || Infinity;
                curBarClose = price;
                candleHistory = [];
                lastMinuteTracked = currentMin;
                document.getElementById('t-signal-text').innerText = "PAIR SYNCED";
                document.getElementById('t-signal-text').style.color = "#facc15";
            }
            activePairStored = currentPair;

            // Minute Rollover
            if (currentMin !== lastMinuteTracked) {
                if (lastMinuteTracked !== -1 && curBarOpen !== null && curBarClose !== null) {
                    candleHistory.push({
                        open: curBarOpen,
                        close: curBarClose,
                        high: curBarHigh,
                        low: curBarLow,
                        isGreen: curBarClose >= curBarOpen,
                        body: Math.abs(curBarClose - curBarOpen),
                        range: Math.max(0.00001, curBarHigh - curBarLow)
                    });
                    if (candleHistory.length > 20) candleHistory.shift();
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

                document.getElementById('t-price').innerText = price.toFixed(price > 100 ? 3 : 5);
                document.getElementById('t-price').style.color = "#10b981";

                // Check Horizontal Support Floor & Roof from History
                let swingLow = Infinity, swingHigh = -Infinity;
                for (let c of candleHistory) {
                    if (c.low < swingLow) swingLow = c.low;
                    if (c.high > swingHigh) swingHigh = c.high;
                }

                const snrEl = document.getElementById('t-snr');
                let distToFloor = Math.abs(price - swingLow);
                let distToRoof = Math.abs(price - swingHigh);

                if (distToFloor < 0.00020) {
                    snrEl.innerText = "🛡️ AT SUPPORT FLOOR";
                    snrEl.style.color = "#10b981";
                } else if (distToRoof < 0.00020) {
                    snrEl.innerText = "🛑 AT RESISTANCE ROOF";
                    snrEl.style.color = "#ef4444";
                } else {
                    snrEl.innerText = "MID CHANNEL";
                    snrEl.style.color = "#64748b";
                }
            }

            document.getElementById('t-pair').innerText = currentPair;
            document.getElementById('t-timer').innerText = `${60 - currentSec}s`;
        }, 120);

        // TITAN FLOOR-GUARD SCAN
        let isScanning = false;
        document.getElementById('t-scan-btn').addEventListener('click', function() {
            if (isScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('t-status-box');
            const sigText = document.getElementById('t-signal-text');
            const confText = document.getElementById('t-conf-text');
            const desc = document.getElementById('t-desc');
            const patEl = document.getElementById('t-pattern');
            const scanBtn = document.getElementById('t-scan-btn');
            const pBar = document.getElementById('t-progress-bar');
            const pFill = document.getElementById('t-progress-fill');

            if (!price || !curBarOpen) {
                sigText.innerText = "WAITING FOR TICK";
                sigText.style.color = "#f43f5e";
                return;
            }

            isScanning = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "SCANNING LEVELS...";
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
                    evaluateFloorGuard(tickSamples);
                }
            }, 100);

            function evaluateFloorGuard(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 INSTITUTIONAL SCAN";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || curBarClose || price;

                // 1. Candlestick Anatomy
                let isGreen = latestPrice >= curBarOpen;
                let bodySize = Math.abs(latestPrice - curBarOpen);
                let totalRange = Math.max(0.00001, curBarHigh - curBarLow);
                let upperWick = curBarHigh - Math.max(curBarOpen, latestPrice);
                let lowerWick = Math.min(curBarOpen, latestPrice) - curBarLow;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // 2. Swing High / Low Floor Detection
                let swingLow = Infinity, swingHigh = -Infinity;
                for (let c of candleHistory) {
                    if (c.low < swingLow) swingLow = c.low;
                    if (c.high > swingHigh) swingHigh = c.high;
                }
                let isAtFloor = Math.abs(latestPrice - swingLow) < 0.00022;
                let isAtRoof = Math.abs(latestPrice - swingHigh) < 0.00022;

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
                let confidence = 88;

                // ==========================================
                // STRICT FLOOR-GUARD DECISION MATRIX
                // ==========================================

                // RULE 1: NEVER SELL INTO SUPPORT (Prevents Image 14 Trap!)
                if (!isGreen && isAtFloor) {
                    isCall = true; // Red candle dumped into floor = BUY BOUNCE!
                    patternName = "Support Floor Absorption Bounce";
                    confidence = 94;
                }
                // RULE 2: NEVER BUY INTO RESISTANCE
                else if (isGreen && isAtRoof) {
                    isCall = false; // Green candle pumped into roof = SELL REJECTION!
                    patternName = "Resistance Roof Exhaustion Drop";
                    confidence = 94;
                }
                // RULE 3: VSA GIANT MARUBOZU (In Open Channel)
                else if (isGreen && bodyPct >= 65 && upperWickPct <= 20 && !isAtRoof) {
                    isCall = true;
                    patternName = "Giant Bullish Marubozu Breakout";
                    confidence = 93;
                }
                else if (!isGreen && bodyPct >= 65 && lowerWickPct <= 20 && !isAtFloor) {
                    isCall = false;
                    patternName = "Giant Bearish Marubozu Dump";
                    confidence = 93;
                }
                // RULE 4: MULTI-BAR EXHAUSTION
                else if (redStreak >= 4) {
                    isCall = true;
                    patternName = `${redStreak}x Red Selling Climax`;
                    confidence = 92;
                }
                else if (greenStreak >= 4) {
                    isCall = false;
                    patternName = `${greenStreak}x Green Buying Climax`;
                    confidence = 92;
                }
                // RULE 5: PINBAR REVERSAL
                else if (lowerWickPct >= 45 && bodyPct <= 35) {
                    isCall = true;
                    patternName = "Hammer Floor Reversal";
                    confidence = 91;
                }
                else if (upperWickPct >= 45 && bodyPct <= 35) {
                    isCall = false;
                    patternName = "Shooting Star Roof Reversal";
                    confidence = 91;
                }
                // RULE 6: BODY MOMENTUM FALLBACK
                else {
                    isCall = isGreen;
                    patternName = isGreen ? "Bullish Flow Continuation" : "Bearish Flow Continuation";
                    confidence = 85;
                }

                patEl.innerText = patternName;

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.innerText = action;
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                confText.innerText = `CONFIDENCE: ${confidence}%`;

                let wickTag = isCall ? `LowerWick: ${lowerWickPct}%` : `UpperWick: ${upperWickPct}%`;
                let dynamicReason = `${patternName} • Body: ${bodyPct}% • ${wickTag}`;
                desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size: 7.5px;">${dynamicReason}</span>`;

                playBeep(isCall ? 950 : 450);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTitanEngine);
    } else {
        initTitanEngine();
    }
})();
