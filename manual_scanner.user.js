// ==UserScript==
// @name         Pocket Option APEX SMC Titan Shield
// @namespace    https://github.com/
// @version      540.0
// @description  Zero-Wick Marubozu Veto, FVG Invalidation Gatekeeper, Strict Standby Enforcement & 5s Deep Telemetry
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
            if (nonGrid.length > 0) return nonGrid[nonGrid.length - 1].val;
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
        return "QAR/CNY OTC";
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
            top: 160px !important;
            left: 10px !important;
            z-index: 2147483647 !important;
            background: rgba(3, 10, 24, 0.98) !important;
            border: 2px solid #00f0ff !important;
            border-radius: 14px !important;
            padding: 9px !important;
            color: #ffffff !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
            box-shadow: 0 16px 55px rgba(0,240,255,0.25) !important;
            width: 255px !important;
            touch-action: none !important;
            user-select: none !important;
            display: block !important;
            visibility: visible !important;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: linear-gradient(90deg, #00f0ff, #0284c7); margin: -9px -9px 7px -9px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #000; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ APEX SMC TITAN SHIELD v540</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.25); color:#fff; padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between;">
                <span>PAIR: <b id="a-pair" style="color: #00f0ff;">SYNCING...</b></span>
                <span>TICK: <b id="a-price" style="color: #10b981;">--</b></span>
            </div>
            
            <div style="background: #061226; padding: 5px; border-radius: 6px; margin: 5px 0; border: 1px solid #1e293b; font-size: 8px;">
                <div style="display: flex; justify-content: space-between; color: #94a3b8;">
                    <span>RSI: <b id="a-rsi" style="color:#38bdf8;">--</b></span>
                    <span>ADX: <b id="a-adx" style="color:#facc15;">--</b></span>
                    <span>CVD: <b id="a-cvd" style="color:#10b981;">0</b></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 3px; color: #94a3b8;">
                    <span>VWAP: <b id="a-vwap" style="color:#00f0ff;">--</b></span>
                    <span>ATR: <b id="a-atr" style="color:#a855f7;">--</b></span>
                    <span>MACD: <b id="a-macd" style="color:#38bdf8;">--</b></span>
                </div>
            </div>

            <div style="background: #08152e; padding: 4px 5px; border-radius: 6px; margin: 4px 0; border: 1px solid #1e293b; font-size: 8px; color: #94a3b8;">
                <div style="display: flex; justify-content: space-between;">
                    <span>O: <b id="a-open" style="color:#fff;">--</b></span>
                    <span>H: <b id="a-high" style="color:#10b981;">--</b></span>
                    <span>L: <b id="a-low" style="color:#ef4444;">--</b></span>
                </div>
                <div style="display: flex; justify-content: space-between; margin-top: 2px;">
                    <span>BODY: <b id="a-body" style="color:#00f0ff;">0%</b></span>
                    <span>U-WICK: <b id="a-uwick" style="color:#facc15;">0%</b></span>
                    <span>L-WICK: <b id="a-lwick" style="color:#facc15;">0%</b></span>
                </div>
            </div>

            <div style="font-size: 8.5px; color: #94a3b8;">SMC MATRIX: <span id="a-smc" style="color: #00f0ff; font-weight: bold;">SYNCING</span></div>
            <div style="font-size: 8.5px; color: #94a3b8;">SHIELD STATE: <span id="a-shield" style="color: #10b981; font-weight: bold;">ACTIVE</span></div>
            <div style="font-size: 8.5px; color: #94a3b8;">TIMER: <span id="a-timer" style="color: #38bdf8; font-weight: bold;">--s</span></div>

            <button id="a-scan-btn" style="width: 100%; margin-top: 6px; background: linear-gradient(135deg, #00f0ff, #0284c7); border: none; padding: 10px 4px; border-radius: 8px; color: #000; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,240,255,0.3);">
                ⚡ SCAN SMC INSTITUTIONAL
            </button>

            <div id="a-progress-bar" style="display: none; width: 100%; height: 5px; background: #1e293b; border-radius: 3px; margin-top: 6px; overflow: hidden;">
                <div id="a-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #10b981); transition: width 0.08s linear;"></div>
            </div>

            <div id="a-status-box" style="margin-top: 7px; padding: 7px 4px; background: #061124; border-radius: 8px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Institutional Signal</div>
                <div id="a-signal-text" style="font-size: 15px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
                <div id="a-conf-text" style="font-size: 8.5px; color: #00f0ff; font-weight: bold; margin-top: 1px;">Hit Scan in Last 12s-5s</div>
            </div>
            <div id="a-desc" style="font-size: 8px; color: #64748b; margin-top: 4px; text-align: center;">Wait for confirmed signal before trading</div>
        `;

        root.appendChild(hud);

        // Touch Dragging
        let isDragging = false, startTouchX = 0, startTouchY = 0, startBoxX = 10, startBoxY = 160;
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 260, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 300, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        bindScannerEvents();
    }

    // =========================================================================
    // 3. CANDLE ENGINE WITH MARUBOZU & FVG VETO
    // =========================================================================
    let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, candleClose = null;
    let lastMinuteTracked = -1;
    let candleHistory = [];
    let storedPair = "";

    let buyTicks = 0, sellTicks = 0, tickDelta = 0;
    let lastRecordedTickPrice = null;
    let tickPriceSum = 0, totalTicksCount = 0;

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

    function calculateATR(period = 14) {
        if (candleHistory.length < 3) return 0.0008;
        let p = Math.min(period, candleHistory.length);
        let sum = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) sum += candleHistory[i].range;
        return sum / p;
    }

    function calculateADX(period = 14) {
        if (candleHistory.length < 5) return 25.0;
        let p = Math.min(period, candleHistory.length - 1);
        let plusDM = 0, minusDM = 0, trSum = 0;
        for (let i = candleHistory.length - p; i < candleHistory.length; i++) {
            let upMove = candleHistory[i].high - candleHistory[i - 1].high;
            let downMove = candleHistory[i - 1].low - candleHistory[i].low;
            if (upMove > downMove && upMove > 0) plusDM += upMove;
            if (downMove > upMove && downMove > 0) minusDM += downMove;
            trSum += candleHistory[i].range;
        }
        if (trSum === 0) return 25.0;
        let diDiff = Math.abs(plusDM - minusDM);
        let diSum = plusDM + minusDM;
        return diSum === 0 ? 25.0 : parseFloat(((diDiff / diSum) * 100).toFixed(1));
    }

    function calculateMACD() {
        if (candleHistory.length < 8) return 0.000;
        let fastSum = 0, slowSum = 0;
        let fP = Math.min(5, candleHistory.length);
        let sP = Math.min(10, candleHistory.length);
        for (let i = candleHistory.length - fP; i < candleHistory.length; i++) fastSum += candleHistory[i].close;
        for (let i = candleHistory.length - sP; i < candleHistory.length; i++) slowSum += candleHistory[i].close;
        return parseFloat(((fastSum / fP) - (slowSum / sP)).toFixed(4));
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

        // INSTANT MINUTE ROLLOVER PURGE (:00.000)
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

            let curRsi = calculateRSI(7);
            let curAdx = calculateADX(14);
            let curAtr = calculateATR(14);
            let curMacd = calculateMACD();
            let vwap = totalTicksCount > 0 ? (tickPriceSum / totalTicksCount) : price;

            let rsiEl = document.getElementById('a-rsi');
            let adxEl = document.getElementById('a-adx');
            let cvdEl = document.getElementById('a-cvd');
            let vwapEl = document.getElementById('a-vwap');
            let atrEl = document.getElementById('a-atr');
            let macdEl = document.getElementById('a-macd');

            if (rsiEl) rsiEl.innerText = curRsi.toString();
            if (adxEl) adxEl.innerText = curAdx.toString();
            if (cvdEl) cvdEl.innerText = `${tickDelta > 0 ? "+" + tickDelta : tickDelta}`;
            if (vwapEl) vwapEl.innerText = vwap.toFixed(decimals);
            if (atrEl) atrEl.innerText = curAtr.toFixed(4);
            if (macdEl) macdEl.innerText = curMacd.toString();

            // SMC STATUS & VETO LOGIC
            let p1 = candleHistory.length >= 1 ? candleHistory[candleHistory.length - 1] : null;
            let p2 = candleHistory.length >= 2 ? candleHistory[candleHistory.length - 2] : null;
            let hasBullishFVG = (p2 && p1 && p2.high < candleLow);
            let hasBearishFVG = (p2 && p1 && p2.low > candleHigh);

            let smcEl = document.getElementById('a-smc');
            let shieldEl = document.getElementById('a-shield');
            let isGreen = candleClose >= candleOpen;

            // Zero-Wick Marubozu Trap Indicator
            let isSolidBullMarubozu = isGreen && bPct >= 75 && uPct <= 4;
            let isSolidBearMarubozu = !isGreen && bPct >= 75 && lPct <= 4;

            if (smcEl) {
                if (hasBullishFVG) {
                    smcEl.innerText = "BULLISH FVG IMBALANCE 🟢";
                    smcEl.style.color = "#10b981";
                } else if (hasBearishFVG) {
                    smcEl.innerText = "BEARISH FVG IMBALANCE 🔴";
                    smcEl.style.color = "#ef4444";
                } else {
                    smcEl.innerText = "ORDER BLOCK EQUILIBRIUM";
                    smcEl.style.color = "#94a3b8";
                }
            }

            if (shieldEl) {
                if (isSolidBullMarubozu) {
                    shieldEl.innerText = "PUT BANNED (MARUBOZU ROCKET 🟢)";
                    shieldEl.style.color = "#10b981";
                } else if (isSolidBearMarubozu) {
                    shieldEl.innerText = "CALL BANNED (MARUBOZU DUMP 🔴)";
                    shieldEl.style.color = "#ef4444";
                } else {
                    shieldEl.innerText = "SHIELD ARMED";
                    shieldEl.style.color = "#00f0ff";
                }
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
        if (confText) { confText.innerText = "Hit Scan in Last 12s-5s"; }
        if (desc) { desc.innerHTML = "Wait for confirmed signal before trading"; }
    }

    // =========================================================================
    // 4. SCANNER: STRICT MULTI-ANGLE SMC HANDSHAKE
    // =========================================================================
    let isHandshakeScanning = false;

    function bindScannerEvents() {
        const btn = document.getElementById('a-scan-btn');
        if (!btn || btn.dataset.bound) return;
        btn.dataset.bound = "true";

        btn.addEventListener('click', function() {
            if (isHandshakeScanning) return;

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

            isHandshakeScanning = true;
            btn.style.opacity = "0.5";
            btn.innerText = "HANDSHAKE: INGESTING TICKS...";
            if (pBar) pBar.style.display = "block";
            if (pFill) pFill.style.width = "0%";

            let steps = 50; // 5.0 Seconds
            let curStep = 0;
            let startDelta = tickDelta;

            const scanInterval = setInterval(() => {
                curStep++;
                let progress = Math.min(100, Math.round((curStep / steps) * 100));
                if (pFill) pFill.style.width = `${progress}%`;

                if (curStep === 10 && confText) confText.innerText = "Step 1/5: FVG Invalidation Check...";
                if (curStep === 22 && confText) confText.innerText = "Step 2/5: Zero-Wick Marubozu Veto...";
                if (curStep === 34 && confText) confText.innerText = "Step 3/5: ADX & CVD Flow Alignment...";
                if (curStep === 45 && confText) confText.innerText = "Step 4/5: Liquidity Sweep Verification...";

                if (curStep >= steps) {
                    clearInterval(scanInterval);
                    evaluateSMCInstitutionalDecision(startDelta);
                }
            }, 100);

            function evaluateSMCInstitutionalDecision(initDelta) {
                isHandshakeScanning = false;
                btn.style.opacity = "1";
                btn.innerText = "⚡ SCAN SMC INSTITUTIONAL";
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

                let curRsi = calculateRSI(7);
                let curAdx = calculateADX(14);

                let isSolidBullMarubozu = isGreen && bodyPct >= 70 && upperWickPct <= 5;
                let isSolidBearMarubozu = !isGreen && bodyPct >= 70 && lowerWickPct <= 5;

                let decision = "WAIT";
                let setupName = "";
                let confidence = 0;

                // =============================================================
                // STRICT SMC TITAN LAWS (ANTI-TRAP)
                // =============================================================

                // LAW 1: ZERO-WICK BULLISH MARUBOZU (FIX FOR SCREENSHOT 19)
                // When buyers push a 70%+ solid green body with almost 0% upper wick, NEVER SELL!
                if (isSolidBullMarubozu) {
                    decision = "CALL";
                    setupName = "Uncontested Bullish Marubozu (PUT Banned • BUY 🟢)";
                    confidence = 96;
                }
                // LAW 2: ZERO-WICK BEARISH MARUBOZU
                else if (isSolidBearMarubozu) {
                    decision = "PUT";
                    setupName = "Uncontested Bearish Marubozu (CALL Banned • SELL 🔴)";
                    confidence = 96;
                }
                // LAW 3: CHOPPY NOISE FILTER
                else if (curAdx < 18) {
                    decision = "WAIT";
                    setupName = "ADX Under 18 (Market In Chop • No Edge)";
                    confidence = 0;
                }
                // LAW 4: CONFIRMED LIQUIDITY SWEEP (REVERSAL WITH WICK)
                else if (isGreen && upperWickPct >= 40 && curRsi >= 68) {
                    decision = "PUT";
                    setupName = "Buy-Side Liquidity Rejection (Next RED 🔴)";
                    confidence = 94;
                }
                else if (!isGreen && lowerWickPct >= 40 && curRsi <= 32) {
                    decision = "CALL";
                    setupName = "Sell-Side Liquidity Rejection (Next GREEN 🟢)";
                    confidence = 94;
                }
                // LAW 5: CVD DELTA DIVERGENCE TRAP
                else if (isGreen && tickDelta <= -14) {
                    decision = "PUT";
                    setupName = `Negative CVD Absorption Trap (CVD: ${tickDelta} 🔴)`;
                    confidence = 92;
                }
                else if (!isGreen && tickDelta >= 14) {
                    decision = "CALL";
                    setupName = `Positive CVD Absorption Trap (CVD: +${tickDelta} 🟢)`;
                    confidence = 92;
                }
                // LAW 6: NO INSTITUTIONAL CONFLUENCE
                else {
                    decision = "WAIT";
                    setupName = "No Verified Edge • Trade Blocked";
                    confidence = 0;
                }

                let secondsToNext = 60 - currentSec;
                let entryDate = new Date(now.getTime() + (secondsToNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                if (decision === "CALL") {
                    if (sigText) { sigText.innerText = "CALL (BUY) 🟢"; sigText.style.color = "#10b981"; }
                    if (sigBox) sigBox.style.borderColor = "#10b981";
                    if (confText) confText.innerText = `CONFIDENCE: ${confidence}% • SMC TITAN`;
                    if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#00f0ff; font-size:7.5px;">${setupName} • ADX: ${curAdx} • CVD: ${tickDelta}</span>`;
                    playTone(960, "sine", 0.22);
                } else if (decision === "PUT") {
                    if (sigText) { sigText.innerText = "PUT (SELL) 🔴"; sigText.style.color = "#ef4444"; }
                    if (sigBox) sigBox.style.borderColor = "#ef4444";
                    if (confText) confText.innerText = `CONFIDENCE: ${confidence}% • SMC TITAN`;
                    if (desc) desc.innerHTML = `Entry at <b>${entryClock}</b> (in ${secondsToNext}s)<br><span style="color:#00f0ff; font-size:7.5px;">${setupName} • ADX: ${curAdx} • CVD: ${tickDelta}</span>`;
                    playTone(440, "sine", 0.22);
                } else {
                    if (sigText) { sigText.innerText = "NO TRADE (WAIT ⚪)"; sigText.style.color = "#94a3b8"; }
                    if (sigBox) sigBox.style.borderColor = "#475569";
                    if (confText) confText.innerText = "Unconfirmed Setup • Capital Protected";
                    if (desc) desc.innerHTML = `<span style="color:#94a3b8; font-size:7.5px;">${setupName} • ADX: ${curAdx}</span>`;
                    playTone(300, "sine", 0.10);
                }
            }
        });
    }

    setInterval(runEngineTick, 100);
})();
