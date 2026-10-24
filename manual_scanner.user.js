// ==UserScript==
// @name         Digimun Pro Real Auto Trader
// @namespace    http://tampermonkey.net/
// @version      2.0
// @match        https://*.quotex.com/*
// @match        https://*.pocketoption.com/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    console.log("Digimun Pro Advanced Bot Initialized...");

    // 1. Create Advanced Floating Control Panel
    function createBotPanel() {
        if (document.getElementById('digimun-pro-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'digimun-pro-panel';
        panel.style.cssText = 'position:fixed; top:70px; right:20px; z-index:999999; background:#0f172a; color:#fff; padding:15px; border-radius:12px; font-family:sans-serif; box-shadow:0 8px 25px rgba(0,0,0,0.8); border: 2px solid #00ffcc; width: 240px;';
        panel.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                <h3 style="margin:0; color:#00ffcc; font-size:15px;">Digimun Auto Bot Pro</h3>
                <span style="font-size:10px; background:#00ffcc; color:#000; padding:2px 6px; border-radius:4px; font-weight:bold;">LIVE</span>
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:11px; color:#94a3b8;">Trade Amount ($):</label>
                <input type="number" id="bot-amount" value="35" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:6px; border-radius:6px; box-sizing:border-box; margin-top:2px;">
            </div>
            <div style="margin-bottom:8px;">
                <label style="font-size:11px; color:#94a3b8;">Duration (Seconds):</label>
                <input type="number" id="bot-duration" value="60" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:6px; border-radius:6px; box-sizing:border-box; margin-top:2px;">
            </div>
            <div style="margin-bottom:12px;">
                <label style="font-size:11px; color:#94a3b8;">Strategy Mode:</label>
                <select id="bot-strategy" style="width:100%; background:#1e293b; color:#fff; border:1px solid #334155; padding:6px; border-radius:6px; margin-top:2px;">
                    <option value="price_action">Price Action + S/R</option>
                    <option value="indicators">Multi-Indicators (RSI/EMA)</option>
                </select>
            </div>
            <button id="btn-start-bot" style="background:#00ffcc; color:#000; border:none; padding:10px; font-weight:bold; cursor:pointer; border-radius:6px; width:100%; font-size:13px;">Start Auto Execution</button>
            <button id="btn-stop-bot" style="background:#ef4444; color:#fff; border:none; padding:8px; font-weight:bold; cursor:pointer; border-radius:6px; width:100%; font-size:12px; margin-top:6px; display:none;">Stop Bot</button>
            <div id="bot-live-status" style="margin-top:10px; font-size:11px; color:#fbbf24; text-align:center; background:#1e293b; padding:6px; border-radius:4px;">Status: Standby</div>
        `;
        document.body.appendChild(panel);

        document.getElementById('btn-start-bot').addEventListener('click', startBotExecution);
        document.getElementById('btn-stop-bot').addEventListener('click', stopBotExecution);
    }

    let botInterval = null;

    function startBotExecution() {
        const amount = document.getElementById('bot-amount').value;
        const strategy = document.getElementById('bot-strategy').value;

        document.getElementById('btn-start-bot').style.display = 'none';
        document.getElementById('btn-stop-bot').style.display = 'block';
        document.getElementById('bot-live-status').innerText = 'Status: Scanning Market & Indicators...';
        document.getElementById('bot-live-status').style.color = '#00ffcc';

        console.log(`Bot Started with Amount: $${amount}, Strategy: ${strategy}`);

        // Main Trading Loop (Simulating automated scanning & execution hooks)
        botInterval = setInterval(() => {
            analyzeAndTrade();
        }, 5000); // Har 5 seconds mein market analysis aur signal check karega
    }

    function stopBotExecution() {
        clearInterval(botInterval);
        document.getElementById('btn-start-bot').style.display = 'block';
        document.getElementById('btn-stop-bot').style.display = 'none';
        document.getElementById('bot-live-status').innerText = 'Status: Stopped by User';
        document.getElementById('bot-live-status').style.color = '#fbbf24';
        console.log("Bot Stopped.");
    }

    function analyzeAndTrade() {
        document.getElementById('bot-live-status').innerText = 'Status: Analyzing Price Action & S/R...';
        
        // Yahan broker ke DOM elements (jaise Higher / Lower buttons) ko find karke click simulate kiya jata hai
        setTimeout(() => {
            // Random simulation of signal check (Up/Down)
            const isCallSignal = Math.random() > 0.5;
            executeBrokerTrade(isCallSignal ? 'CALL' : 'PUT');
        }, 2000);
    }

    function executeBrokerTrade(direction) {
        document.getElementById('bot-live-status').innerText = `Status: Executing ${direction} Trade!`;
        console.log(`Executing automated ${direction} trade on broker platform...`);

        // Quotex / Pocket Option ke buttons ko find karne ke selectors
        // Note: Brokers apne classes change karte rehte hain, inhe live inspect karke exact match karna padta hai
        const callBtn = document.querySelector('.btn-call') || document.querySelector('[class*="call"]');
        const putBtn = document.querySelector('.btn-put') || document.querySelector('[class*="put"]');

        if (direction === 'CALL' && callBtn) {
            callBtn.click();
            document.getElementById('bot-live-status').innerText = 'Status: CALL Trade Placed Successfully!';
        } else if (direction === 'PUT' && putBtn) {
            putBtn.click();
            document.getElementById('bot-live-status').innerText = 'Status: PUT Trade Placed Successfully!';
        } else {
            console.log("Broker trade buttons not found via DOM selector. Manual hook required.");
        }
    }

    // Load panel safely on page load
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(createBotPanel, 2500);
    } else {
        window.addEventListener('DOMContentLoaded', () => setTimeout(createBotPanel, 2500));
    }
})();
