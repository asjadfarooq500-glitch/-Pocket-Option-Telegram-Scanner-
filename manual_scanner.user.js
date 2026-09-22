// ==UserScript==
// @name         Pocket Option Live Canvas Tick Engine
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  Direct Canvas & DOM Hook - Reads exact right-axis price badge
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let capturedLivePrice = null;

    // 1. CANVAS HOOK: Captures the exact price drawn on chart axis
    const origFillText = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function(text, x, y, maxWidth) {
        if (text && typeof text === 'string') {
            let str = text.trim();
            // Match formats like 0.07934, 1.23456, 154.230
            if (/^\d{1,5}\.\d{3,6}$/.test(str)) {
                let num = parseFloat(str);
                // Exclude balance (2.62), 100%, and require right-side drawing
                if (num > 0 && Math.abs(num - 2.62) > 0.05 && num !== 100) {
                    if (x > 140) {
                        capturedLivePrice = num;
                    }
                }
            }
        }
        return origFillText.apply(this, arguments);
    };

    function initManualBot() {
        if (!document.body) {
            setTimeout(initManualBot, 250);
            return;
        }

        if (document.getElementById('po-manual-hud')) return;

        // Sound alert
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
                gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.16);
            } catch(e) {}
        }
        document.addEventListener('touchstart', () => {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }, { once: true });

        // HUD Setup
        const hud = document.createElement('div');
        hud.id = 'po-manual-hud';
        hud.style.cssText = `
            position: fixed;
            top: 180px;
            left: 15px;
            z-index: 999999999;
            background: rgba(10, 15, 29, 0.97);
            border: 2px solid #0284c7;
            border-radius: 14px;
            padding: 10px;
            color: #ffffff;
            font-family: -apple-system, sans-serif;
            box-shadow: 0 12px 35px rgba(0,0,0,0.85);
            width: 185px;
            touch-action: none;
            user-select: none;
        `;

        hud.innerHTML = `
            <div id="hud-drag" style="background: #0284c7; margin: -10px -10px 8px -10px; padding: 6px 8px; border-top-left-radius: 11px; border-top-right-radius: 11px; font-size: 10px; font-weight: 900; color: #fff; display: flex; justify-content: space-between; cursor: move;">
                <span>⚡ PO TICK ENGINE</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">SYNCING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #f43f5e; font-weight: bold;">SEARCHING</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE: <span id="m-timer" style="color: #facc15; font-weight: bold;">--s</span></div>

            <div style="margin: 6px 0;">
                <select id="m-tf" style="width: 100%; padding: 4px; font-size: 10px; background: #131b2e; border: 1px solid #1e293b; color: #fff; border-radius: 6px; outline: none;">
                    <option value="60" selected>1 Minute (M1)</option>
                    <option value="30">30 Seconds (S30)</option>
                </select>
            </div>

            <button id="m-scan-btn" style="width: 100%; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 10px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase;">
                🔍 SCAN CANDLE
            </button>

            <div id="m-status-box" style="margin-top: 6px; padding: 8px 4px; background: #131b2e; border-radius: 6px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8; text-transform: uppercase;">Next Candle Verdict</div>
                <div id="m-signal-text" style="font-size: 14px; font-weight: 900; color: #facc15; margin-top: 2px;">STANDBY</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 4px; text-align: center;">Waiting for tick...</div>
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
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 190, startBoxX + (e.touches[0].clientX - startTouchX))) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 220, startBoxY + (e.touches[0].clientY - startTouchY))) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        // DOM Fallback Scan
        function getDomPrice() {
            const nodes = document.querySelectorAll('*');
            for (let el of nodes) {
                if (el.textContent) {
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

        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, lastMinute = -1;

        setInterval(() => {
            const price = capturedLivePrice || getDomPrice();
            const pair = getActivePair();
            const now = new Date();
            const currentSec = now.getSeconds();
            const currentMin = now.getMinutes();

            if (currentMin !== lastMinute) {
                lastMinute = currentMin;
                candleOpen = price;
                candleHigh = price || -Infinity;
                candleLow = price || Infinity;
            }

            const priceEl = document.getElementById('m-price');
            if (price) {
                if (price > candleHigh) candleHigh = price;
                if (price < candleLow) candleLow = price;
                priceEl.innerText = price.toFixed(5);
                priceEl.style.color = "#10b981"; // GREEN when tick is active
            } else {
                priceEl.innerText = "NO TICK";
                priceEl.style.color = "#f43f5e";
            }

            document.getElementById('m-pair').innerText = pair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 150);

        // Scan Event
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            const price = capturedLivePrice || getDomPrice();
            const now = new Date();
            const sigBox = document.getElementById('m-status-box');
            const sigText = document.getElementById('m-signal-text');
            const desc = document.getElementById('m-desc');

            if (!price || !candleOpen) {
                sigText.innerText = "NO TICK SYNC";
                sigText.style.color = "#f43f5e";
                sigBox.style.borderColor = "#f43f5e";
                desc.innerText = "Wait 2 seconds for tick hook.";
                playBeep(300);
                return;
            }

            let isGreen = price >= candleOpen;
            let bodySize = Math.abs(price - candleOpen);
            let upperWick = candleHigh - Math.max(price, candleOpen);
            let lowerWick = Math.min(price, candleOpen) - candleLow;
            let totalRange = candleHigh - candleLow;

            let isCall = true;
            let reason = "";

            if (lowerWick > upperWick && lowerWick >= (totalRange * 0.3)) {
                isCall = true;
                reason = "Lower wick buyer rejection";
            } else if (upperWick > lowerWick && upperWick >= (totalRange * 0.3)) {
                isCall = false;
                reason = "Upper wick seller rejection";
            } else if (bodySize >= (totalRange * 0.5)) {
                isCall = isGreen;
                reason = isGreen ? "Bullish trend push" : "Bearish trend drop";
            } else {
                isCall = isGreen;
                reason = "Momentum trend follow";
            }

            let nextSec = 60 - now.getSeconds();
            let entryDate = new Date(now.getTime() + (nextSec * 1000));
            let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

            let action = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
            sigText.innerText = action;
            sigText.style.color = isCall ? "#10b981" : "#ef4444";
            sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
            desc.innerHTML = `Entry at <b>${entryClock}</b><br><span style="color:#94a3b8;">${reason}</span>`;

            playBeep(isCall ? 950 : 450);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initManualBot);
    } else {
        initManualBot();
    }
})();
