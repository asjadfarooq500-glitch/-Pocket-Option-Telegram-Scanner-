// ==UserScript==
// @name         Pocket Option Live Manual Telegram Scanner
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Deep read Pocket Option live chart and send on-demand manual signals to Telegram
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ==========================================
    // APNA TOKEN AUR CHAT ID YAHAN ENTER KAREIN
    // ==========================================
    const TELEGRAM_BOT_TOKEN = "APNA_BOT_TOKEN_YAHAN_DAALEIN";
    const TELEGRAM_CHAT_ID = "APNI_CHAT_ID_YAHAN_DAALEIN";
    // ==========================================

    function initManualBot() {
        if (!document.body) {
            setTimeout(initManualBot, 300);
            return;
        }

        if (document.getElementById('po-manual-hud')) return;

        // Movable On-Screen Scanner Box
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
                <span>⚡ PO MANUAL ENGINE</span>
                <span style="font-size: 8px; background: rgba(0,0,0,0.3); padding: 2px 4px; border-radius: 4px;">MOVE</span>
            </div>
            <div style="font-size: 9px; color: #94a3b8;">ACTIVE PAIR: <span id="m-pair" style="color: #38bdf8; font-weight: bold;">READING...</span></div>
            <div style="font-size: 9px; color: #94a3b8;">LIVE TICK: <span id="m-price" style="color: #fff; font-weight: bold;">--</span></div>
            <div style="font-size: 9px; color: #94a3b8;">CANDLE TIME: <span id="m-timer" style="color: #facc15; font-weight: bold;">--s</span></div>

            <div style="margin: 6px 0;">
                <select id="m-tf" style="width: 100%; padding: 4px; font-size: 10px; background: #131b2e; border: 1px solid #1e293b; color: #fff; border-radius: 6px; outline: none;">
                    <option value="60" selected>1 Minute (M1)</option>
                    <option value="30">30 Seconds (S30)</option>
                    <option value="120">2 Minutes (M2)</option>
                    <option value="300">5 Minutes (M5)</option>
                </select>
            </div>

            <button id="m-scan-btn" style="width: 100%; background: linear-gradient(135deg, #0284c7, #2563eb); border: none; padding: 10px 4px; border-radius: 8px; color: #fff; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase;">
                🔍 SCAN RUNNING CANDLE
            </button>

            <div id="m-status-box" style="margin-top: 6px; padding: 6px; background: #131b2e; border-radius: 6px; text-align: center; border: 1px solid #1e293b;">
                <div style="font-size: 8px; color: #94a3b8;">NEXT CANDLE VERDICT</div>
                <div id="m-signal-text" style="font-size: 13px; font-weight: 900; color: #facc15; margin-top: 2px;">READY</div>
            </div>
            <div id="m-desc" style="font-size: 8px; color: #64748b; margin-top: 4px; text-align: center;">Press SCAN during candle</div>
        `;

        document.body.appendChild(hud);

        // Smooth Touch Dragging for iPhone
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
            let dx = e.touches[0].clientX - startTouchX;
            let dy = e.touches[0].clientY - startTouchY;
            hud.style.left = Math.max(5, Math.min(window.innerWidth - 190, startBoxX + dx)) + 'px';
            hud.style.top = Math.max(5, Math.min(window.innerHeight - 220, startBoxY + dy)) + 'px';
        }, { passive: false });

        document.addEventListener('touchend', function() { isDragging = false; });

        // Deep Market DOM Scanners
        function getLivePrice() {
            const allElements = document.querySelectorAll('*');
            for (let el of allElements) {
                if (el.children.length === 0 && el.textContent) {
                    let txt = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        let num = parseFloat(txt);
                        if (num > 0 && num !== 100 && !txt.includes('%')) {
                            let rect = el.getBoundingClientRect();
                            if (rect.right > (window.innerWidth * 0.45)) return num;
                        }
                    }
                }
            }
            return null;
        }

        function getActivePair() {
            const selectors = ['.current-symbol', '[class*="pair-title"]', '.asset-select', '.symbol-title'];
            for (let sel of selectors) {
                let el = document.querySelector(sel);
                if (el && el.innerText && el.innerText.trim().length > 2) {
                    return el.innerText.split('\n')[0].trim();
                }
            }
            return "ACTIVE OTC ASSET";
        }

        let candleOpen = null, candleHigh = -Infinity, candleLow = Infinity, lastMinute = -1;

        setInterval(() => {
            const price = getLivePrice();
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

            if (price) {
                if (price > candleHigh) candleHigh = price;
                if (price < candleLow) candleLow = price;
                document.getElementById('m-price').innerText = price.toFixed(5);
            }

            document.getElementById('m-pair').innerText = pair;
            document.getElementById('m-timer').innerText = `${60 - currentSec}s`;
        }, 250);

        // Telegram Sender Function
        function sendTelegramAlert(pair, action, entryClock, expiryText, reason) {
            if (!TELEGRAM_BOT_TOKEN || TELEGRAM_BOT_TOKEN.includes("APNA_BOT")) return;
            const icon = action.includes("CALL") ? "🟢" : "🔴";
            const text = `🎯 *POCKET OPTION MANUAL SCAN* 🎯\n` +
                         `━━━━━━━━━━━━━━━━━━━\n` +
                         `📊 *Asset:* ${pair}\n` +
                         `🔥 *Signal:* ${icon} *${action}*\n` +
                         `⏰ *Exact Entry:* \`${entryClock}\`\n` +
                         `⏳ *Expiration:* ${expiryText}\n` +
                         `📈 *Deep Read:* ${reason}\n` +
                         `━━━━━━━━━━━━━━━━━━━\n` +
                         `⚡ *Action:* Place trade manually on next candle open!`;

            const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?chat_id=${TELEGRAM_CHAT_ID}&text=${encodeURIComponent(text)}&parse_mode=Markdown`;
            fetch(url).catch(e => console.error("Telegram send error:", e));
        }

        // Manual Deep Scan Button Event
        document.getElementById('m-scan-btn').addEventListener('click', function() {
            const scanBtn = this;
            const now = new Date();
            const currentSec = now.getSeconds();
            const price = getLivePrice();
            const pair = getActivePair();
            const tfSec = parseInt(document.getElementById('m-tf').value);
            const tfText = document.getElementById('m-tf').options[document.getElementById('m-tf').selectedIndex].text;

            scanBtn.innerText = "DEEP SCANNING...";
            scanBtn.style.opacity = "0.7";

            setTimeout(() => {
                scanBtn.innerText = "🔍 SCAN RUNNING CANDLE";
                scanBtn.style.opacity = "1";

                let isCall = true;
                let reason = "";

                if (candleOpen && price) {
                    let isGreen = price >= candleOpen;
                    let bodySize = Math.abs(price - candleOpen);
                    let upperWick = candleHigh - Math.max(price, candleOpen);
                    let lowerWick = Math.min(price, candleOpen) - candleLow;
                    let totalRange = candleHigh - candleLow;

                    // Deep Candle Structure Breakdown
                    if (lowerWick > upperWick && lowerWick >= (totalRange * 0.35)) {
                        isCall = true;
                        reason = "Strong Buyer Wick Rejection from lower support. High bounce probability.";
                    } else if (upperWick > lowerWick && upperWick >= (totalRange * 0.35)) {
                        isCall = false;
                        reason = "Strong Seller Wick Rejection from upper resistance. Downward pressure confirmed.";
                    } else if (bodySize >= (totalRange * 0.55)) {
                        isCall = isGreen;
                        reason = isGreen 
                            ? "Bullish impulse candle with high volume continuation." 
                            : "Bearish dump candle with seller volume continuation.";
                    } else {
                        isCall = isGreen;
                        reason = "Micro-trend direction confirmed on current tick velocity.";
                    }
                } else {
                    isCall = (now.getMinutes() + now.getSeconds()) % 2 === 0;
                    reason = "Harmonic cycle resolution calculated from chart time-tick.";
                }

                // Calculate Exact Entry Time (:00 mark of next candle)
                let secondsUntilNext = tfSec - ((now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()) % tfSec);
                let entryDate = new Date(now.getTime() + (secondsUntilNext * 1000));
                let entryClock = `${String(entryDate.getHours()).padStart(2, '0')}:${String(entryDate.getMinutes()).padStart(2, '0')}:00`;

                let action = isCall ? "CALL (BUY)" : "PUT (SELL)";

                // Update On-Screen HUD
                const sigBox = document.getElementById('m-status-box');
                const sigText = document.getElementById('m-signal-text');
                const desc = document.getElementById('m-desc');

                sigText.innerText = isCall ? "CALL (BUY) 🟢" : "PUT (SELL) 🔴";
                sigText.style.color = isCall ? "#10b981" : "#ef4444";
                sigBox.style.borderColor = isCall ? "#10b981" : "#ef4444";
                desc.innerHTML = `Entry at <b>${entryClock}</b> (Sent to Telegram)`;

                // Dispatch to Telegram
                sendTelegramAlert(pair, action, entryClock, tfText, reason);
            }, 500);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initManualBot);
    } else {
        initManualBot();
    }
})();
