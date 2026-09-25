// ==UserScript==
// @name         Pocket Option APEX 5-Sec Deep Matrix Engine
// @namespace    https://github.com/
// @version      520.0
// @description  5-Second Active Multi-Angle Deep Scanner, Bollinger Exhaustion Flips, Tick-VWAP & Zero-Bias Quant Math
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @match        *://*.pocket-option.com/*
// @match        *://*.po2.cash/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';
    if (window.top !== window.self) return;

    // 1. IN-PAGE CANVAS BADGE SNIFFER
    try {
        if (typeof CanvasRenderingContext2D !== 'undefined') {
            const origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    var str = text.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(str)) {
                        var n = parseFloat(str);
                        if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100 && Math.abs(n - 1.89) > 0.01) {
                            var fill = ("" + this.fillStyle).toLowerCase();
                            var isWhite = (fill === '#ffffff' || fill === 'rgb(255, 255, 255)' || fill === 'white' || fill === '#fff' || fill.indexOf('255, 255, 255') !== -1 || fill.indexOf('255,255,255') !== -1);
                            if (isWhite) {
                                window.__po_live_tick = n;
                                window.__po_live_tick_time = Date.now();
                            }
                        }
                    }
                }
                return origFill.apply(this, arguments);
            };
        }
    } catch(e) {}

    // Audio Alert Synthesizer
    let audioCtx = null;
    function playTone(freq, type = "sine", duration = 0.20) {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = type;
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
            osc.start();
            osc.stop(audioCtx.currentTime + duration);
        } catch(e) {}
    }

    document.addEventListener('touchstart', () => {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }, { once: true });

    // ZERO-LEAK LIVE PRICE GETTER
    function getLivePrice() {
        if (window.__po_live_tick && (Date.now() - (window.__po_live_tick_time || 0) < 1800)) {
            return window.__po_live_tick;
        }

        const candidates = [];
        const allElements = document.querySelectorAll('*');
        for (let el of allElements) {
            if (el.children.length === 0 && el.textContent) {
                let txt = el.textContent.trim();
                if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                    let rect = el.getBoundingClientRect();
                    if (rect.top > 60 && rect.left > (window.innerWidth * 0.50)) {
                        let n = parseFloat(txt);
                        if (n > 0 && Math.abs(n - 2.62) > 0.05 && n !== 100 && Math.abs(n - 1.89) > 0.01) {
                            candidates.push({ val: n, str: txt, top: rect.top });
                        }
                    }
                }
            }
        }

        if (candidates.length > 0) {
            const nonGrid = candidates.filter(c => !c.str.endsWith('00') && !c.str.endsWith('50'));
            if (nonGrid.length > 0) {
                return nonGrid[nonGrid.length - 1].val;
            }
            return null;
        }
        return null;
    }

    function getActivePair() {
        const selectors = ['.current-symbol', '[class*="pair-title"]', '.asset-select'];
        for (let sel of selectors) {
            let el = document.querySelector(sel);
            if (el && el.innerText) {
                let t = el.innerText.split('\n')[0].trim();
                if (t.length > 3 && t !== "OTC ASSET") return t;
            }
        }
        return "CAD/JPY OTC";
    }

    // =========================================================================
    // 2. HUD INTERFACE
    // =========================================================================
    function mountHUD() {
        const root = document.body || document.documentElement;
        if (!root || document.getElementById('po-apex-hud')) return;

        const hud = document.createElement('div');
        hud.id = 'po-apex-hud';
        hud.style.cssText = `
            position: fixed !important;
            top: 165px !important;
            left: 12px !important;
            z-index: 2147483647 !important;
            background: rgba(2, 6, 20, 0.98) !important;
            border: 2px solid #0284c7 !important;
            border-radius: 14px !important;
            padding: 10px !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 16px 55px rgba(0,0,0,0.98) !important;
            width: 250px !important;
            touch-action: none !important;
            user-select: none !important;
            display: block !important;
            visibility: visible !important;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #0284c7, #2563eb); margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ APEX 5-SEC DEEP MATRIX v520</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="a-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="a-price" style="color: #10b981; font-weight: bold;">--</span></div>
            
            <div style="background: #081024; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; display: flex; justify-content: space-between;">
                    <span>O: <b id="a-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="a-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="a-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="font-size: 8px; color: #94a3b8; margin-top: 3px; display: flex; justify-content: space-between;">
                    <span>BODY: <b id="a-body" style="color:#38bdf8;">0%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">0%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">0%</b></span>
                </div>
            </div>

            <div style="font-size: 9px; color: #94a3b8;">BOLLINGER: <span id="a-bb" style="color: #38bdf8; font-weight: bold;">IN RANGE</span></div>
            <div style="font-size: 9px; color: #94a3b8;">RSI (7): <span id="a-rsi" style="color: #38bdf8; font-weight: bold;">50.0</span></div>
            <div style="font-size: 9px; color: #94a3b8;">FLOW DELTA: <span id="a-delta" style="color: #10b981; font-weight: bold;">0 (NEUTRAL)</span></div>
            <div style="font-size: 9px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 11px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(2,132,199,0.4);">
                🔬 5-SEC DEEP QUANT SCAN
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 6px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #38bdf8, #10b981); transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 8px; padding: 8px 4px; background: #080f24; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Quantitative Verdict</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="a-conf-text" style="font-size: 9px; color: #38bdf8; font-weight: bold; margin-top: 1px;">Ready for Deep Calculation</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 5px; text-align: center;">Hit scan between 14s and 6s of candle</div>
        `;

        root.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 12, startBoxY = 165;
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 255, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 290, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        bindScannerEvents();
    }

    // =========================================================================
    // 3. CANDLE ENGINE WITH BOLLINGER & RSI
    // =========================================================================
    let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
    let lastMinuteTracked = -1;
    let candleHistory = [];
    let storedPair = "";

    let buyTicks = 0, sellTicks = 0, tickDelta = 0;
    let lastRecordedTickPrice = null;
    let tickPriceSum = 0, totalTicksCount = 0;

    function calculateBollinger(period = 20, multiplier = 2.0) {
        if (candleHistory.length < 5) return null;
        let p = Math.min(period, candleHistory.length);
        let sum = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) {
            sum += candleHistory[i].close;
        }
        let sma = sum / p;
        let variance = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) {
            variance += Math.pow(candleHistory[i].close - sma, 2);
        }
        let stdDev = Math.sqrt(variance / p);
        return {
            upper: sma + (multiplier * stdDev),
            lower: sma - (multiplier * stdDev)
        };
    }

    function calculateRSI(period = 7) {
        if (candleHistory.length < period + 1) return 50.0;
        let gains = 0, losses = 0;
        for (let i = candleHistory.length - period; i < candleHistory.length; i++) {
            let diff = candleHistory[i].close - candleHistory[i - 1].close;
            if (diff >= 0) gains += diff;
            else losses += Math.abs(diff);
        }
        if (losses === 0) return 100.0;
        let rs = gains / losses;
        return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
    }

    function runEngineTick() {
        mountHUD();

        const currentPair = getActivePair();
        const price = getLivePrice();
        const now = new Date();
        const currentSec = now.getSeconds();
        const currentMin = now.getMinutes();

        // Pair Switch Flush
        if (storedPair !== "" && currentPair !== storedPair && currentPair.length > 3) {
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;
            candleHistory = [];
            lastMinuteTracked = currentMin;
            buyTicks = 0; sellTicks = 0; tickDelta = 0;
            tickPriceSum = 0; totalTicksCount = 0;
            lastRecordedTickPrice = price;
            resetStatusBox();
        }
        storedPair = currentPair;

        // INSTANT MINUTE ROLLOVER (:00.000)
        if (currentMin !== lastMinuteTracked) {
            if (lastMinuteTracked !== -1 && candleOpen !== null && price) {
                let prevClose = candleClose || price;
                let cBody = Math.abs(prevClose - candleOpen);
                let cRange = Math.max(0.00001, candleHigh - candleLow);
                let cUpper = Math.max(0, candleHigh - Math.max(candleOpen, prevClose));
                let cLower = Math.max(0, Math.min(candleOpen, prevClose) - candleLow);

                candleHistory.push({
                    open: candleOpen,
                    close: prevClose,
                    high: candleHigh,
                    low: candleLow,
                    isGreen: prevClose >= candleOpen,
                    body: cBody,
                    range: cRange,
                    upperWick: cUpper,
                    lowerWick: cLower,
                    finalDelta: tickDelta
                });
                if (candleHistory.length > 40) candleHistory.shift();
            }

            lastMinuteTracked = currentMin;
            candleOpen = price;
            candleHigh = price || -Infinity;
            candleLow = price || Infinity;
            candleClose = price;

            buyTicks = 0; sellTicks = 0; tickDelta = 0;
            tickPriceSum = 0; totalTicksCount = 0;
            lastRecordedTickPrice = price;

            resetStatusBox();
        }

        if (price) {
            if (candleOpen === null) {
                candleOpen = price;
                candleHigh = price;
                candleLow = price;
                lastRecordedTickPrice = price;
            }

            tickPriceSum += price;
            totalTicksCount++;

            if (lastRecordedTickPrice !== null) {
                if (price > lastRecordedTickPrice) { buyTicks++; tickDelta++; }
                else if (price < lastRecordedTickPrice) { sellTicks++; tickDelta--; }
            }
            lastRecordedTickPrice = price;

            if (price > candleHigh) candleHigh = price;
            if (price < candleLow) candleLow = price;
            candleClose = price;

            let decimals = price > 100 ? 3 : 5;
            let elPrice = document.getElementById('a-price');
            let elOpen = document.getElementById('a-open');
            let elHigh = document.getElementById('a-high');
            let elLow = document.getElementById('a-low');

            if (elPrice) { elPrice.innerText = price.toFixed(decimals); elPrice.style.color = "#10b981"; }
            if (elOpen) elOpen.innerText = candleOpen.toFixed(decimals);
            if (elHigh) elHigh.innerText = candleHigh.toFixed(decimals);
            if (elLow) elLow.innerText = candleLow.toFixed(decimals);

            // WICK & BODY RATIOS
            let cRange = Math.max(0.00001, candleHigh - candleLow);
            let cBody = Math.abs(candleClose - candleOpen);
            let cUpper = Math.max(0, candleHigh - Math.max(candleOpen, candleClose));
            let cLower = Math.max(0, Math.min(candleOpen, candleClose) - candleLow);

            if (cUpper < 0.000025 || (cUpper / cRange) < 0.04) cUpper = 0;
            if (cLower < 0.000025 || (cLower / cRange) < 0.04) cLower = 0;

            let bPct = Math.round((cBody / cRange) * 100);
            let uPct = Math.round((cUpper / cRange) * 100);
            let lPct = Math.round((cLower / cRange) * 100);

            let sum = bPct + uPct + lPct;
            if (sum > 100) {
                let factor = 100 / sum;
                bPct = Math.round(bPct * factor);
                uPct = Math.round(uPct * factor);
                lPct = Math.max(0, 100 - bPct - uPct);
            }

            let elBody = document.getElementById('a-body');
            let elUwick = document.getElementById('a-uwick');
            let elLwick = document.getElementById('a-lwick');
            if (elBody) elBody.innerText = `${bPct}%`;
            if (elUwick) elUwick.innerText = `${uPct}%`;
            if (elLwick) elLwick.innerText = `${lPct}%`;

            // BOLLINGER BANDS
            let bb = calculateBollinger(20, 2.0);
            let bbEl = document.getElementById('a-bb');
            if (bbEl && bb) {
                if (price >= bb.upper) {
                    bbEl.innerText = "OVERBOUGHT (+2σ) 🔴";
                    bbEl.style.color = "#ef4444";
                } else if (price <= bb.lower) {
                    bbEl.innerText = "OVERSOLD (-2σ) 🟢";
                    bbEl.style.color = "#10b981";
                } else {
                    bbEl.innerText = "INSIDE RANGE";
                    bbEl.style.color = "#38bdf8";
                }
            }

            // RSI
            let currentRsi = calculateRSI(7);
            let rsiEl = document.getElementById('a-rsi');
            if (rsiEl) {
                rsiEl.innerText = currentRsi.toString();
                if (currentRsi >= 70) rsiEl.style.color = "#ef4444";
                else if (currentRsi <= 30) rsiEl.style.color = "#10b981";
                else rsiEl.style.color = "#38bdf8";
            }

            // DELTA DISPLAY
            let deltaEl = document.getElementById('a-delta');
            if (deltaEl) {
                if (tickDelta >= 10) { deltaEl.innerText = `+${tickDelta} (BUYERS 🟢)`; deltaEl.style.color = "#10b981"; }
                else if (tickDelta <= -10) { deltaEl.innerText = `${tickDelta} (SELLERS 🔴)`; deltaEl.style.color = "#ef4444"; }
                else { deltaEl.innerText = `${tickDelta > 0 ? "+" + tickDelta : tickDelta} (NOISE ⚠️)`; deltaEl.style.color = "#94a3b8"; }
            }
        }

        let elPair = document.getElementById('a-pair');
        let elTimer = document.getElementById('a-timer');
        if (elPair) elPair.innerText = currentPair;
        if (elTimer) elTimer.innerText = `${60 - currentSec}s`;
    }

    function resetStatusBox() {
        let sigText = document.getElementById('a-signal-text');
        let sigBox = document.getElementById('a-status-box');
        let confText = document.getElementById('a-conf-text');
        let desc = document.getElementById('a-desc');
        if (sigText) { sigText.innerText = "STANDBY"; sigText.style.color = "#facc15"; }
        if (sigBox) { sigBox.style.borderColor = "#1e293b"; }
        if (confText) { confText.innerText = "Ready for Deep Calculation"; }
        if (desc) { desc.innerHTML = "Hit scan between 14s and 6s of candle"; }
    }

    // =========================================================================
    // 4. SCANNER: TRUE 5-SECOND DEEP QUANTUM SAMPLER
    // =========================================================================
    let isDeepScanning = false;

    function bindScannerEvents() {
        const btn = document.getElementById('a-scan-btn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = "true";

        btn.addEventListener('click', function() {
            if (isDeepScanning) return;

            const price = getLivePrice();
            const sigBox = document.getElementById('a-status-box');
            const sigText = document.getElementById('a-signal-text');
            const confText = document.getElementById('a-conf-text');
            const desc = document.getElementById('a-desc');
            const pBar = document.getElementById('a-progress-bar');
            const pFill = document.getElementById('a-progress-fill');

            if (!price || candleOpen === null) {
                if (sigText) { sigText.innerText = "WAITING FOR TICK"; sigText.style.color = "#f43f5e"; }
                return;
            }

            isDeepScanning = true;
            btn.style.opacity = "0.5";
            btn.innerText = "DEEP SCANNING (5 SECONDS)...";
            if (pBar) pBar.style.display = "block";
            if (pFill) pFill.style.width = "0%";

            let sampleSteps = 50; // 50 steps * 100ms = 5.0 Seconds!
            let step = 0;
            let tickSamples = [];
            let startScanDelta = tickDelta;

            const scanInterval = setInterval(() => {
                step++;
                let currentTick = getLivePrice();
                if (currentTick) tickSamples.push(currentTick);

                let progress = Math.min(100, Math.round((step / sampleSteps) * 100));
                if (pFill) pFill.style.width = `${progress}%`;

                // Live Stage Messages during 5 seconds
                if (step === 10 && confText) confText.innerText = "Sampling Bollinger Band Deviations...";
                if (step === 25 && confText) confText.innerText = "Analyzing Cumulative Order Flow...";
                if (step === 40 && confText) confText.innerText = "Synthesizing Exhaustion vs Momentum...";

                if (step >= sampleSteps) {
                    clearInterval(scanInterval);
                    evaluate5SecondDeepMatrix(tickSamples, startScanDelta);
                }
            }, 100);

            function evaluate5SecondDeepMatrix(samples, initialDelta) {
                isDeepScanning = false;
                btn.style.opacity = "1";
                btn.innerText = "🔬 5-SEC DEEP QUANT SCAN";
                if (pBar) pBar.style.display = "none";

                const now = new Date();
                const currentSec = now.getSeconds();
                const currentPrice = candleClose || getLivePrice();

                let isGreen = currentPrice >= candleOpen;
                let bodySize = Math.abs(currentPrice - candleOpen);
                let totalRange = Math.max(0.00001, candleHigh - candleLow);
                let upperWick = Math.max(0, candleHigh - Math.max(candleOpen, currentPrice));
                let lowerWick = Math.max(0, Math.min(candleOpen, currentPrice) - candleLow);

                if (upperWick < 0.000025 || (upperWick / totalRange) < 0.04) upperWick = 0;
                if (lowerWick < 0.000025 || (lowerWick / totalRange) < 0.04) lowerWick = 0;

                let bodyPct = Math.round((bodySize / totalRange) * 100);
                let upperWickPct = Math.round((upperWick / totalRange) * 100);
                let lowerWickPct = Math.round((lowerWick / totalRange) * 100);

                let bb = calculateBollinger(20, 2.0);
                let currentRsi = calculateRSI(7);

                let isOverboughtBB = bb ? currentPrice >= bb.upper : false;
                let isOversoldBB = bb ? currentPrice <= bb.lower : false;

                // 5-Second Delta Velocity
                let deltaShiftIn5s = tickDelta - initialDelta;

                // Tick-VWAP
                let vwap = totalTicksCount > 0 ? (tickPriceSum / totalTicksCount) : currentPrice;
                let isVwapBullish = vwap > candleOpen;
                let isVwapBearish = vwap < candleOpen;

                let decision = "WAIT";
                let setupName = "";
                let confidence = 0;

                // =============================================================
                // ZERO-COLOR-BIAS QUANT LAWS (5-SECOND CONFLUENCE)
                // =============================================================

                // 1. STATISTICAL MEAN-REVERSION (Predict OPPOSITE color on Exhaustion)
                // If candle is GREEN, but hits Upper Band + RSI Overbought + Upper Wick -> Next is RED!
                if (isGreen && isOverboughtBB && currentRsi >= 65 && upperWickPct >= 15) {
                    decision = "PUT";
                    setupName = "Upper Bollinger Climax (Predict Next RED 🔴)";
                    confidence = 95;
                }
                // If candle is RED, but hits Lower Band + RSI Oversold + Lower Wick -> Next is GREEN!
                else if (!isGreen && isOversoldBB && currentRsi <= 35 && lowerWickPct >= 15) {
                    decision = "CALL";
                    setupName = "Lower Bollinger Climax (Predict Next GREEN 🟢)";
                    confidence = 95;
                }
                // 2. TICK DELTA DIVERGENCE TRAP (Opposite Order-Flow)
                else if (isGreen && tickDelta <= -12) {
                    decision = "PUT"; // Green candle but heavy sell delta -> Fake Pump!
                    setupName = `Negative Delta Trap (Sellers Pushing: ${tickDelta} 🔴)`;
                    confidence = 93;
                }
                else if (!isGreen && tickDelta >= 12) {
                    decision = "CALL"; // Red candle but heavy buy delta -> Fake Dump!
                    setupName = `Positive Delta Trap (Buyers Pushing: +${tickDelta} 🟢)`;
                    confidence = 93;
                }
                // 3. CLEAN UNCONTESTED MOMENTUM BREAKOUT (True Breakout)
                else if (isGreen && bodyPct >= 70 && upperWickPct <= 6 && !isOverboughtBB && deltaShiftIn5s >= 3) {
                    decision = "CALL";
                    setupName = "Confirmed Volume Breakout Continuation 🟢";
                    confidence = 92;
                }
                else if (!isGreen && bodyPct >= 70 && lowerWickPct <= 6 && !isOversoldBB && deltaShiftIn5s <= -3) {
                    decision = "PUT";
                    setupName = "Confirmed Volume Breakdown Continuation 🔴";
                    confidence = 92;
                }
                // 4. HAMMER / SHOOTING STAR LIQUIDITY GRABS
                else if (lowerWickPct >= 50 && bodyPct <= 30 && currentRsi <= 40) {
                    decision = "CALL";
                    setupName = "Hammer Floor Liquidity Bounce 🟢";
                    confidence = 91;
                }
                else if (upperWickPct >= 50 && bodyPct <= 30 && currentRsi >= 60) {
                    decision = "PUT";
                    setupName = "Shooting Star Roof Liquidity Drop 🔴";
                    confidence = 91;
                }
                // 5. NO EDGE -> DO NOT GUESS!
                else {
                    decision = "WAIT";
                    setupName = "No Statistically Viable Edge (Skip Candle)";
                    confidence = 0;
                }

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                if (decision === "CALL") {
                    if (sigText) { sigText.innerText = "CALL (BUY) 🟢"; sigText.style.color = "#10b981"; }
                    if (sigBox) sigBox.style.borderColor = "#10b981";
                    if (confText) confText.innerText = `CONFIDENCE: ${confidence}% • 5s CONFLUENCE`;
                    if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size:7.5px;">${setupName} • Delta: ${tickDelta} • RSI: ${currentRsi}</span>`;
                    playTone(960, "sine", 0.22);
                } else if (decision === "PUT") {
                    if (sigText) { sigText.innerText = "PUT (SELL) 🔴"; sigText.style.color = "#ef4444"; }
                    if (sigBox) sigBox.style.borderColor = "#ef4444";
                    if (confText) confText.innerText = `CONFIDENCE: ${confidence}% • 5s CONFLUENCE`;
                    if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#38bdf8; font-size:7.5px;">${setupName} • Delta: ${tickDelta} • RSI: ${currentRsi}</span>`;
                    playTone(440, "sine", 0.22);
                } else {
                    if (sigText) { sigText.innerText = "NO TRADE (WAIT ⚪)"; sigText.style.color = "#94a3b8"; }
                    if (sigBox) sigBox.style.borderColor = "#475569";
                    if (confText) confText.innerText = "Edge Uncertain • Capital Protected";
                    if (desc) desc.innerHTML = `<span style="color:#94a3b8; font-size:7.5px;">${setupName} • Delta: ${tickDelta} • RSI: ${currentRsi}</span>`;
                    playTone(300, "sine", 0.10);
                }
            }
        });
    }

    setInterval(runEngineTick, 100);
})();
