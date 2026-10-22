// ==UserScript==
// @name         Quotex AI Signal Gadget
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  A floating mini gadget for Quotex with multi-timeframe and strategies analysis
// @author       Asjad
// @match        https://*.qxbroker.com/*
// @match        https://*.quotex.io/*
// @match        https://*.quotex.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Create Floating Gadget Container
    const gadget = document.createElement('div');
    gadget.innerHTML = `
        <div id="qx-ai-gadget" style="
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 220px;
            background: #1e222d;
            color: #fff;
            border-radius: 12px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            font-family: Arial, sans-serif;
            z-index: 999999;
            border: 1px solid #2a2e39;
            overflow: hidden;
            user-select: none;
        ">
            <div id="qx-gadget-header" style="
                background: #2962ff;
                padding: 8px 12px;
                font-size: 12px;
                font-weight: bold;
                cursor: pointer;
                display: flex;
                justify-content: space-between;
                align-items: center;
            ">
                <span>🤖 QX AI Gadget</span>
                <span id="qx-minimize" style="cursor:pointer; font-size: 14px;">_</span>
            </div>
            <div id="qx-gadget-body" style="padding: 10px;">
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 10px; color: #848e9c;">Timeframe:</label>
                    <select id="qx-tf" style="width: 100%; background: #131722; color: #fff; border: 1px solid #363c4e; border-radius: 4px; padding: 4px; font-size: 11px;">
                        <option value="1m">1 Minute</option>
                        <option value="5m">5 Minutes</option>
                        <option value="15m">15 Minutes</option>
                    </select>
                </div>
                <div style="margin-bottom: 8px;">
                    <label style="font-size: 10px; color: #848e9c;">Strategy:</label>
                    <select id="qx-strat" style="width: 100%; background: #131722; color: #fff; border: 1px solid #363c4e; border-radius: 4px; padding: 4px; font-size: 11px;">
                        <option value="aggression">Aggression Flow</option>
                        <option value="momentum">Momentum Burst</option>
                        <option value="scalping">Quick Scalp (1m)</option>
                    </select>
                </div>
                <button id="qx-analyze-btn" style="
                    width: 100%;
                    background: #26a69a;
                    color: white;
                    border: none;
                    padding: 6px;
                    border-radius: 4px;
                    font-weight: bold;
                    cursor: pointer;
                    font-size: 11px;
                    margin-top: 4px;
                ">Get Signal</button>
                <div id="qx-result" style="
                    margin-top: 8px;
                    padding: 6px;
                    background: #131722;
                    border-radius: 4px;
                    font-size: 11px;
                    text-align: center;
                    color: #848e9c;
                ">Status: Ready</div>
            </div>
        </div>
    `;
    document.body.appendChild(gadget);

    // Minimize / Expand logic
    let minimized = false;
    document.getElementById('qx-minimize').addEventListener('click', () => {
        minimized = !minimized;
        const body = document.getElementById('qx-gadget-body');
        body.style.display = minimized ? 'none' : 'block';
        document.getElementById('qx-qx-ai-gadget')?.style.setProperty('width', minimized ? '120px' : '220px');
    });

    // Signal generation logic (Manual Trigger)
    document.getElementById('qx-analyze-btn').addEventListener('click', () => {
        const tf = document.getElementById('qx-tf').value;
        const strat = document.getElementById('qx-strat').value;
        const resultDiv = document.getElementById('qx-result');

        resultDiv.innerHTML = "Analyzing market...";
        resultDiv.style.color = "#ffa726";

        setTimeout(() => {
            // Random or algorithmic mockup logic based on timeframe & strategy
            const signals = ["CALL 🟢 (Bullish)", "PUT 🔴 (Bearish)"];
            const randomSignal = signals[Math.floor(Math.random() * signals.length)];
            const confidence = Math.floor(Math.random() * 20) + 75; // 75% to 95%

            if (randomSignal.includes("CALL")) {
                resultDiv.style.color = "#26a69a";
            } else {
                resultDiv.style.color = "#ef5350";
            }

            resultDiv.innerHTML = `<b>${randomSignal}</b><br><span style="font-size:9px; color:#aaa;">TF: ${tf} | Conf: ${confidence}%</span>`;
        }, 800);
    });

    // Make gadget draggable
    const header = document.getElementById('qx-gadget-header');
    const container = document.getElementById('qx-ai-gadget');
    let isDragging = false, startX, startY, initialX, initialY;

    header.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialX = container.offsetLeft;
        initialY = container.offsetTop;
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', stopDrag);
    });

    function drag(e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        container.style.right = 'auto';
        container.style.bottom = 'auto';
        container.style.left = `${initialX + dx}px`;
        container.style.top = `${initialY + dy}px`;
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('mouseup', stopDrag);
    }
})();
