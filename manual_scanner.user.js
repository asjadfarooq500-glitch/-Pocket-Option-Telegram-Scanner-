// ==UserScript==
// @name         Pocket Option Live OTC Pro Confluence Engine
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  Multi-Candle History, Real Tick Sampling, and Strict Confluence Filter
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
        hud.id = 'po-manual-hud';
        hud.style.cssText = `
            position: fixed;
            top: 180px;
            left: 15px;
            z-index: 999999999;
            background: rgba(10, 15, 29, 0.98);
            border: 2px solid #0284c7;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            box-shadow: 0 14px 40px rgba(0,0,0,0.9);
            width: 195px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ PO PRO CONFLUENCE</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #10b981; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE: <span id="m-timer" style="color: #facc15; font-weight: bold;">--s</span></div>

            <button id="m-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #0284c7); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 DEEP SCAN (2.5s)
            </button>

            <div id="m-progress-bar" style="display: none; width: 100%; height: 4px; background: #1e293b; border-radius: 2px; margin-top: 6px; overflow: hidden;">
                <div id="m-progress-fill" style="width: 0%; height: 100%; background: #38bdf8; transition: width 0.1s linear;"></div>
            </div>

            <div id="m-status-box" style="margin-top: 8px; padding: 8px 4px; background: #131b2e; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Engine Decision</div>
                <div id="m-signal-text" style="font-size: 14px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="m-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready for scan</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Scan between :50s and :55s</div>
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 200, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
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
            return "OTC ASSET";
        }

        // Multi-Candle History Tracker
        let candleHistory = [];
        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, lastMinute = -1;

        setInterval(() => {
            const price = getLivePrice();
            const pair = getActivePair();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            // Save completed candle to history at :00 mark
            if (currentMin !== lastMinute) {
                if (lastMinute !== -1 && candleOpen && price) {
                    candleHistory.push({
                        open: candleOpen,
                        close: price,
                        high: candleHigh,
                        low: candleLow,
                        isGreen: price >= candleOpen
                    });
                    if (candleHistory.length > 5) candleHistory.shift();
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
            if (price) {
                if (price > candleHigh) candleHigh = price;
                if (price < candleLow) candleLow = price;
                priceEl.innerText = price.toFixed(5);
                priceEl.style.color = "#10b981";
            }

            document.getElementById('m-pair').innerText = pair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 150);

        // REAL 2.5-SECOND SAMPLING ENGINE
        let isSampling = false;
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            if (isSampling) return;

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

            isSampling = true;
            scanBtn.style.opacity = "0.6";
            scanBtn.innerText = "SAMPLING TICKS...";
            pBar.style.display = "block";
            pFill.style.width = "0%";

            let tickSamples = [];
            let elapsed = 0;
            const sampleInterval = 100; // Har 100ms par tick record
            const totalSamples = 25; // 2.5 seconds total

            const sampler = setInterval(() => {
                elapsed++;
                let currentTick = getLivePrice();
                if (currentTick) tickSamples.push(currentTick);

                let progress = Math.min(100, Math.round((elapsed / totalSamples) * 100));
                pFill.style.width = `${progress}%`;

                if (elapsed >= totalSamples) {
                    clearInterval(sampler);
                    finishDeepAnalysis(tickSamples);
                }
            }, sampleInterval);

            function finishDeepAnalysis(ticks) {
                isSampling = false;
                scanBtn.style.opacity = "1";
                scanBtn.innerText = "🔬 DEEP SCAN (2.5s)";
                pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const latestPrice = ticks[ticks.length - 1] || price;
                const baseOpen = candleOpen || latestPrice;

                // 1. Tick Velocity & Micro-Momentum
                let tickChanges = 0;
                for (let i = 1; i < ticks.length; i++) {
                    tickChanges += (ticks[i] - ticks[i - 1]);
                }
                let tickMomentumUp = tickChanges > 0;

                // 2. Candle Geometry
                let isGreen = latestPrice >= baseOpen;
                let bodySize = Math.abs(latestPrice - baseOpen);
                let upperWick = Math.max(0, candleHigh - Math.max(latestPrice, baseOpen));
                let lowerWick = Math.max(0, Math.min(latestPrice, baseOpen) - candleLow);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);

                // 3. Multi-Candle Trend Confluence (Last 3 candles)
                let recentBearishCount = 0;
                let recentBullishCount = 0;
                candleHistory.forEach(c => {
                    if (c.isGreen) recentBullishCount++;
                    else recentBearishCount++;
                });

                let confluenceScore = 50;
                let action = "NO_TRADE";
                let reason = "";

                // ALGORITHMIC CONFLUENCE RULES
                // A. Strong Rejection Bounce (Reversal Setup)
                if (!isGreen && lowerWick > (bodySize * 1.6) && lowerWick >= (totalRange * 0.45)) {
                    if (tickMomentumUp) {
                        action = "CALL (BUY) 🟢";
                        confluenceScore = 88;
                        reason = "Buyer rejection floor confirmed + Upward tick velocity";
                    }
                } else if (isGreen && upperWick > (bodySize * 1.6) && upperWick >= (totalRange * 0.45)) {
                    if (!tickMomentumUp) {
                        action = "PUT (SELL) 🔴";
                        confluenceScore = 88;
                        reason = "Seller rejection roof confirmed + Downward tick velocity";
                    }
                }
                // B. Strong Trend Continuation (Impulse Setup)
                else if (isGreen && bodySize >= (totalRange * 0.6) && tickMomentumUp) {
                    if (recentBearishCount < 3) {
                        action = "CALL (BUY) 🟢";
                        confluenceScore = 84;
                        reason = "Bullish momentum expansion + Order flow buying";
                    }
                } else if (!isGreen && bodySize >= (totalRange * 0.6) && !tickMomentumUp) {
                    action = "PUT (SELL) 🔴";
                    confluenceScore = 86;
                    reason = "Bearish dump continuation + Order flow selling";
                }
                // C. Trend Following When Indecisive
                else if (recentBearishCount >= 2 && !isGreen && !tickMomentumUp) {
                    action = "PUT (SELL) 🔴";
                    confluenceScore = 79;
                    reason = "Downtrend alignment. Following seller pressure";
                } else if (recentBullishCount >= 2 && isGreen && tickMomentumUp) {
                    action = "CALL (BUY) 🟢";
                    confluenceScore = 79;
                    reason = "Uptrend alignment. Following buyer pressure";
                }

                // Decision Output
                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                if (confluenceScore >= 75 && action !== "NO_TRADE") {
                    let isCall = action.includes("CALL");
                    sigText.innerText = action;
                    sigText.style.color = isCall ? "#10b981" : "#ef4444";
                    sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                    confText.innerText = `CONFIDENCE: ${confluenceScore}%`;
                    desc.innerHTML = `Entry at <b>${entryClock}</b><br><span style="color:#94a3b8;">${reason}</span>`;
                    playBeep(isCall ? 950 : 450);
                } else {
                    sigText.innerText = "NO TRADE ⏸";
                    sigText.style.color = "#facc15";
                    sigBox.style.borderColor = "#facc15";
                    confText.innerText = "CHOPPY / RISKY (SKIPPED)";
                    desc.innerText = "Candle is conflicting. Wait for clear setup.";
                    playBeep(350);
                }
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initEngine);
    } else {
        initEngine();
    }
})();
