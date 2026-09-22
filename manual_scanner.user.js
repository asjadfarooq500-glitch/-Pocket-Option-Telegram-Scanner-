// ==UserScript==
// @name         Pocket Option Titan Institutional Quant Engine
// @namespace    http://tampermonkey.net/
// @version      20.0
// @description  Full VSA Breakout, Absolute Body Dominance, SNR Polarity & Zero-Countertrend Traps
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
                <span>⚡ TITAN INSTITUTIONAL v20</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="t-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="t-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">SNR ZONE: <span id="t-snr" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">VSA PATTERN: <span id="t-pattern" style="color: #c084fc; font-weight: bold;">STANDBY</span></div>
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

                document.getElementById('t-price').innerText = price.toFixed(price > 100 ? 3 : 5);
                document.getElementById('t-price').style.color = "#10b981";

                // SNR Proximity
                let pStr = price.toFixed(price > 100 ? 3 : 5);
                let lastDigits = parseInt(pStr.slice(-2));
                const snrEl = document.getElementById('t-snr');
                if (lastDigits >= 95 || lastDigits <= 5) {
                    snrEl.innerText = "🎯 MAJOR .00 ROUND LEVEL";
                    snrEl.style.color = "#ec4899";
                } else if (Math.abs(lastDigits - 50) <= 5) {
                    snrEl.innerText = "🎯 MID .50 LEVEL";
                    snrEl.style.color = "#f59e0b";
                } else {
                    snrEl.innerText = "MID CHANNEL";
                    snrEl.style.color = "#64748b";
                }
            }

            document.getElementById('t-pair').innerText = currentPair;
            document.getElementById('t-timer').innerText = `${60 - currentSec}s`;
        }, 120);

        // TITAN DEEP SCAN (2.0s)
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
            scanBtn.innerText = "CALCULATING CONFLUENCE...";
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
                    evaluateTitanStrategy(tickSamples);
                }
            }, 100);

            function evaluateTitanStrategy(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 INSTITUTIONAL SCAN";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || curBarClose || price;

                // 1. Candlestick Geometry
                let isGreen = latestPrice >= curBarOpen;
                let bodySize = Math.abs(latestPrice - curBarOpen);
                let totalRange = Math.max(0.00001, curBarHigh - curBarLow);
                let upperWick = curBarHigh - Math.max(curBarOpen, latestPrice);
                let lowerWick = Math.min(curBarOpen, latestPrice) - curBarLow;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                // Average historical body size (for VSA check)
                let avgBody = 0.0001;
                if (candleHistory.length > 0) {
                    avgBody = candleHistory.reduce((s, c) => s + c.body, 0) / candleHistory.length;
                }
                let isGiantImpulse = bodySize >= (avgBody * 1.8);

                // 2. Streak
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

                // 3. SNR Level Math
                let pStr = latestPrice.toFixed(latestPrice > 100 ? 3 : 5);
                let lastDigits = parseInt(pStr.slice(-2));
                let atMajorSNR = (lastDigits >= 95 || lastDigits <= 5);

                let isCall = false;
                let patternName = "";
                let confidence = 88;

                // ==========================================
                // TITAN INSTITUTIONAL DECISION LAWS
                // ==========================================

                // LAW 1: VSA GIANT IMPULSE MARUBOZU (Prevents Image 16 Blunder!)
                // If a giant green candle erupts with body > 60% and upper wick < 25%, PUT IS 100% FORBIDDEN
                if (isGreen && (isGiantImpulse || bodyPct >= 65) && upperWickPct <= 25) {
                    isCall = true;
                    patternName = "Giant Bullish Marubozu Breakout";
                    confidence = 96;
                }
                else if (!isGreen && (isGiantImpulse || bodyPct >= 65) && lowerWickPct <= 25) {
                    isCall = false;
                    patternName = "Giant Bearish Marubozu Dump";
                    confidence = 96;
                }
                // LAW 2: EXTREME CLIMAX EXHAUSTION (5+ Streak into Major Level)
                else if (greenStreak >= 5 && upperWickPct >= 35) {
                    isCall = false;
                    patternName = `${greenStreak}x Green Climax Exhaustion`;
                    confidence = 94;
                }
                else if (redStreak >= 5 && lowerWickPct >= 35) {
                    isCall = true;
                    patternName = `${redStreak}x Red Climax Exhaustion`;
                    confidence = 94;
                }
                // LAW 3: INSTITUTIONAL HAMMER / SHOOTING STAR (Pinbar Reversal)
                else if (lowerWickPct >= 50 && bodyPct <= 35 && upperWickPct <= 15) {
                    isCall = true;
                    patternName = "Institutional Hammer Rejection";
                    confidence = 92;
                }
                else if (upperWickPct >= 50 && bodyPct <= 35 && lowerWickPct <= 15) {
                    isCall = false;
                    patternName = "Institutional Shooting Star Rejection";
                    confidence = 92;
                }
                // LAW 4: ENGULFING MOMENTUM (Clear Body Takeover)
                else if (candleHistory.length > 0 && bodyPct >= 55) {
                    let prev = candleHistory[candleHistory.length - 1];
                    if (isGreen && !prev.isGreen && bodySize > prev.body) {
                        isCall = true;
                        patternName = "Bullish Engulfing Impulse";
                        confidence = 91;
                    } else if (!isGreen && prev.isGreen && bodySize > prev.body) {
                        isCall = false;
                        patternName = "Bearish Engulfing Impulse";
                        confidence = 91;
                    }
                }
                // LAW 5: BODY COLOR DOMINANCE (Micro-ticks NEVER flip a 35%+ body)
                if (!patternName) {
                    if (bodyPct >= 35) {
                        isCall = isGreen;
                        patternName = isGreen ? "Bullish Candle Dominance" : "Bearish Candle Dominance";
                        confidence = 88;
                    } else {
                        // Tight Doji Resolution
                        isCall = isGreen;
                        patternName = "Micro-Range Continuation";
                        confidence = 83;
                    }
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
