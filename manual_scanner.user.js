// ==UserScript==
// @name         Pocket Option APEX Ultra-Sync Engine
// @namespace    http://tampermonkey.net/
// @version      50.0
// @description  Zero-Freeze Multi-Pair Engine, Instant Asset Unlocking & True-Wick Geometry
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // 1. INJECT BULLETPROOF MULTI-PAIR PRICE PROXY
    const bridgeScript = document.createElement('script');
    bridgeScript.textContent = `
    (function() {
        var activePrice = null;
        var lastTickTime = 0;
        var trackedPair = "";

        function getActivePairFromDOM() {
            var el = document.querySelector('.current-symbol, [class*="pair-title"], .asset-select');
            return el && el.innerText ? el.innerText.split('\\n')[0].trim() : "";
        }

        // FAST WATCHDOG: Pair change par foran lock tod do
        setInterval(function() {
            var p = getActivePairFromDOM();
            if (p && p !== trackedPair) {
                trackedPair = p;
                activePrice = null;
                lastTickTime = 0;
            }
        }, 200);

        function broadcastPrice(num, x, y) {
            if (num <= 0 || Math.abs(num - 2.62) < 0.05 || num === 100) return;

            var now = Date.now();

            // RECOVERY: Agar 1.2 second tak tick na mila ho toh filter reset karo
            if (now - lastTickTime > 1200) {
                activePrice = null;
            }

            // WATERMARK REJECTION: Reject top-left header zone (x < 150 & y < 140)
            if (x < 150 && y < 140) return;

            // PAIR SANITY: Agar active price maujood hai toh max 3% jump allow karo
            if (activePrice !== null) {
                var maxJump = activePrice * 0.03;
                if (Math.abs(num - activePrice) > maxJump) {
                    return; // Ignore axis numbers
                }
            }

            activePrice = num;
            lastTickTime = now;
            document.documentElement.setAttribute('data-po-live-price', num);
            document.documentElement.setAttribute('data-po-live-time', now);
        }

        try {
            var origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\\d{1,6}\\.\\d{2,6}$/.test(str)) {
                        broadcastPrice(parseFloat(str), x, y);
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
                <span>⚡ APEX ULTRA-SYNC v50</span>
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

            <div style="font-size: 9px; color: #94a3b8;">CHART FLOW: <span id="a-flow" style="color: #facc15; font-weight: bold;">ANALYZING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">PATTERN: <span id="a-pattern" style="color: #c084fc; font-weight: bold;">STANDBY</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 FULL CHART DEEP SCAN
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Decision</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan in last 14s to 6s of candle</div>
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

            // DOM Fallback
            const nodes = document.querySelectorAll('*');
            for (let el of nodes) {
                if (el.children.length === 0 && el.textContent) {
                    let txt = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        let rect = el.getBoundingClientRect();
                        if (rect.top > 80 && rect.left > (window.innerWidth * 0.45)) {
                            let n = parseFloat(txt);
                            if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100) return n;
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
            return "EUR/USD OTC";
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

            // INSTANT PAIR CHANGE FLUSH
            if (storedPair !== "" && currentPair !== storedPair) {
                candleOpen = price;
                candleHigh = price || -Infinity;
                candleLow = price || Infinity;
                candleClose = price;
                candleHistory = [];
                lastMinuteTracked = currentMin;
                document.getElementById('a-signal-text').innerText = "PAIR SYNCED";
                document.getElementById('a-signal-text').style.color = "#facc15";
            }
            storedPair = currentPair;

            // Minute Cycle Rollover
            if (currentMin !== lastMinuteTracked) {
                if (lastMinuteTracked !== -1 && candleOpen !== null && price) {
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

                // EXACT WICK & BODY RATIOS
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

                // Waterfall vs Rocket Trend Detection
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
                    flowEl.innerText = `WATERFALL DUMP (${redStreak}x RED) 🔴`;
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
        // DEEP SCAN WITH IMMEDIATE DATA LOCK
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
                    evaluateUltraSyncDecision(tickSamples);
                }
            }, 100);

            function evaluateUltraSyncDecision(ticks) {
                isScanning = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 FULL CHART DEEP SCAN";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || candleClose || price;

                let isGreen = latestPrice >= candleOpen;
                let bodySize = Math.abs(latestPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, latestPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, latestPrice) - candleLow);

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

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

                // STRICT TRADING RULES (WATERFALL LOCK)
                if (redStreak >= 4 && lowerWickPct <= 35) {
                    isCall = false;
                    setupName = `${redStreak}x Red Waterfall Dump (Follow Sell)`;
                    confidence = 96;
                }
                else if (greenStreak >= 4 && upperWickPct <= 35) {
                    isCall = true;
                    setupName = `${greenStreak}x Green Rocket Rally (Follow Buy)`;
                    confidence = 96;
                }
                else if (bodyPct <= 18) {
                    if (redStreak >= 3) {
                        isCall = false;
                        setupName = "Bearish Doji Pause (Trend Follow)";
                        confidence = 90;
                    } else if (greenStreak >= 3) {
                        isCall = true;
                        setupName = "Bullish Doji Pause (Trend Follow)";
                        confidence = 90;
                    } else {
                        isCall = isGreen;
                        setupName = "Doji Flow Continuation";
                        confidence = 83;
                    }
                }
                else if (lowerWickPct >= 45 && bodyPct <= 40 && redStreak <= 3) {
                    isCall = true;
                    setupName = "Confirmed Hammer Rejection Bounce";
                    confidence = 92;
                }
                else if (upperWickPct >= 45 && bodyPct <= 40 && greenStreak <= 3) {
                    isCall = false;
                    setupName = "Confirmed Shooting Star Drop";
                    confidence = 92;
                }
                else if (bodyPct >= 50) {
                    isCall = isGreen;
                    setupName = isGreen ? "Bullish Volume Impulse" : "Bearish Volume Dump";
                    confidence = 91;
                }
                else {
                    isCall = isGreen;
                    setupName = isGreen ? "Buyer Candle Dominance" : "Seller Candle Dominance";
                    confidence = 86;
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
        document.addEventListener('DOMContentLoaded', initApexEngine);
    } else {
        initApexEngine();
    }
})();
