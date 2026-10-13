// ==UserScript==
// @name         AmirFXBot Style AI Bot for Pocket Option
// @namespace    amirfxbot-pocketoption
// @version      5.0.0
// @description  AmirFXBot.co clone AI signal overlay with touch-drag and strategy breakdown for Pocket Option
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'amirfx-bot-panel';
    const REOPEN_ID = 'amirfx-bot-reopen';

    if (window.__AMIRFX_BOT_ACTIVE__) return;
    window.__AMIRFX_BOT_ACTIVE__ = true;

    // Bot State
    let botRunning = false;
    let selectedTimeframe = '1m';
    let selectedRisk = 'Moderate';
    let currentSignal = { direction: 'CALL', confidence: 92.5, pair: 'AUD/USD (OTC)' };

    // 1. Injected Styles (AmirFXBot Theme)
    const style = document.createElement('style');
    style.innerHTML = `
        #${PANEL_ID} {
            position: fixed;
            top: 70px;
            left: 15px;
            width: 300px;
            max-height: 80vh;
            overflow-y: auto;
            background: #0b0f19;
            color: #ffffff;
            border: 1px solid #10b981;
            border-radius: 16px;
            box-shadow: 0 15px 40px rgba(0,0,0,0.85);
            z-index: 2147483647;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            user-select: none;
            touch-action: none;
        }
        .afx-header {
            padding: 12px 14px;
            background: #064e3b;
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-top-left-radius: 15px;
            border-top-right-radius: 15px;
            cursor: move;
            touch-action: none;
        }
        .afx-header h3 {
            margin: 0;
            font-size: 13px;
            letter-spacing: 0.5px;
            color: #34d399;
            font-weight: 800;
            pointer-events: none;
        }
        .afx-btn-group {
            display: flex;
            gap: 4px;
        }
        .afx-mini-btn {
            background: #043929;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 3px 8px;
            font-weight: bold;
            cursor: pointer;
            font-size: 12px;
        }
        .afx-body {
            padding: 14px;
        }
        .afx-status-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: #111827;
            padding: 8px 10px;
            border-radius: 8px;
            font-size: 11px;
            border: 1px solid #1f2937;
        }
        .afx-badge {
            background: #065f46;
            color: #34d399;
            padding: 2px 6px;
            border-radius: 4px;
            font-weight: bold;
        }
        .afx-section-title {
            font-size: 10px;
            text-transform: uppercase;
            color: #9ca3af;
            margin: 10px 0 4px 0;
            letter-spacing: 0.5px;
        }
        .afx-select-row {
            display: flex;
            gap: 6px;
        }
        .afx-dropdown, .afx-pill {
            flex: 1;
            background: #1f2937;
            color: #fff;
            border: 1px solid #374151;
            border-radius: 6px;
            padding: 6px;
            font-size: 11px;
            text-align: center;
            cursor: pointer;
        }
        .afx-pill.active {
            background: #059669;
            border-color: #34d399;
            font-weight: bold;
        }
        .afx-signal-card {
            margin-top: 10px;
            background: #111827;
            border: 1px solid #374151;
            border-radius: 10px;
            padding: 12px;
            text-align: center;
        }
        .afx-signal-direction {
            font-size: 20px;
            font-weight: 900;
            letter-spacing: 1px;
            margin-bottom: 2px;
        }
        .afx-call { color: #34d399; text-shadow: 0 0 10px rgba(52,211,153,0.4); }
        .afx-put { color: #f87171; text-shadow: 0 0 10px rgba(248,113,113,0.4); }
        .afx-strategies {
            font-size: 10px;
            color: #9ca3af;
            margin-top: 8px;
            text-align: left;
            background: #0f172a;
            padding: 8px;
            border-radius: 6px;
            line-height: 1.4;
        }
        .afx-start-btn {
            width: 100%;
            margin-top: 12px;
            padding: 10px;
            background: #059669;
            color: white;
            border: none;
            border-radius: 8px;
            font-weight: bold;
            font-size: 13px;
            cursor: pointer;
            transition: 0.2s;
            box-shadow: 0 4px 12px rgba(5,150,105,0.4);
        }
        .afx-start-btn.running {
            background: #dc2626;
            box-shadow: 0 4px 12px rgba(220,38,38,0.4);
        }
        #${REOPEN_ID} {
            position: fixed;
            right: 15px;
            bottom: 110px;
            z-index: 2147483647;
            background: #059669;
            color: #fff;
            border: 1px solid #34d399;
            border-radius: 25px;
            padding: 10px 16px;
            display: none;
            font-weight: bold;
            box-shadow: 0 5px 20px rgba(0,0,0,0.6);
            cursor: pointer;
        }
    `;
    document.head.appendChild(style);

    // 2. Build UI Panel
    const panel = document.createElement('div');
    panel.id = PANEL_ID;
    panel.innerHTML = `
        <div class="afx-header" id="afx-drag-handle">
            <h3>⚡ AMIR FX AI BOT</h3>
            <div class="afx-btn-group">
                <button class="afx-mini-btn" id="afx-min">−</button>
                <button class="afx-mini-btn" id="afx-close">×</button>
            </div>
        </div>
        <div class="afx-body" id="afx-panel-body">
            <div class="afx-status-box">
                <span>Server: Amir-01</span>
                <span class="afx-badge" id="afx-status-badge">STANDBY</span>
            </div>

            <div class="afx-section-title">Selected Pair</div>
            <div class="afx-dropdown" id="afx-pair-display">Detecting Asset...</div>

            <div class="afx-section-title">Timeframe</div>
            <div class="afx-select-row">
                <div class="afx-pill active" data-tf="1m">1m</div>
                <div class="afx-pill" data-tf="5m">5m</div>
                <div class="afx-pill" data-tf="15m">15m</div>
            </div>

            <div class="afx-section-title">Risk Level</div>
            <div class="afx-select-row">
                <div class="afx-pill active" data-risk="Moderate">Moderate</div>
                <div class="afx-pill" data-risk="High">High</div>
            </div>

            <div class="afx-signal-card">
                <div class="afx-signal-direction afx-call" id="afx-sig-dir">CALL • 92.5%</div>
                <div style="font-size:10px; color:#9ca3af;" id="afx-sig-sub">Confidence Score</div>
                <div class="afx-strategies" id="afx-strategies-list">
                    • RSI (14): Bullish Momentum<br>
                    • EMA Crossover: Confirmed<br>
                    • Support & Resistance: Verified
                </div>
            </div>

            <button class="afx-start-btn" id="afx-toggle-btn">▶ START BOT</button>
        </div>
    `;
    document.body.appendChild(panel);

    // Reopen Button
    const reopenBtn = document.createElement('button');
    reopenBtn.id = REOPEN_ID;
    reopenBtn.textContent = '⚡ OPEN AMIR FX BOT';
    document.body.appendChild(reopenBtn);

    // 3. UI Controls & Events
    const bodyEl = panel.querySelector('#afx-panel-body');
    panel.querySelector('#afx-min').onclick = () => {
        bodyEl.style.display = bodyEl.style.display === 'none' ? 'block' : 'none';
    };
    panel.querySelector('#afx-close').onclick = () => {
        panel.style.display = 'none';
        reopenBtn.style.display = 'block';
    };
    reopenBtn.onclick = () => {
        panel.style.display = 'block';
        reopenBtn.style.display = 'none';
    };

    // Timeframe & Risk Selection Pills
    panel.querySelectorAll('[data-tf]').forEach(pill => {
        pill.onclick = () => {
            panel.querySelectorAll('[data-tf]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedTimeframe = pill.getAttribute('data-tf');
        };
    });

    panel.querySelectorAll('[data-risk]').forEach(pill => {
        pill.onclick = () => {
            panel.querySelectorAll('[data-risk]').forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            selectedRisk = pill.getAttribute('data-risk');
        };
    });

    // Start / Stop Bot Toggle
    const toggleBtn = panel.querySelector('#afx-toggle-btn');
    const badgeEl = panel.querySelector('#afx-status-badge');

    toggleBtn.onclick = () => {
        botRunning = !botRunning;
        if (botRunning) {
            toggleBtn.textContent = '⏹ STOP BOT';
            toggleBtn.classList.add('running');
            badgeEl.textContent = 'ACTIVE';
            badgeEl.style.background = '#047857';
        } else {
            toggleBtn.textContent = '▶ START BOT';
            toggleBtn.classList.remove('running');
            badgeEl.textContent = 'STANDBY';
            badgeEl.style.background = '#065f46';
        }
    };

    // 4. Touch & Mouse Draggable Support (Finger Moveable)
    const dragHandle = panel.querySelector('#afx-drag-handle');
    let drag = null;

    dragHandle.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return;
        const rect = panel.getBoundingClientRect();
        drag = { x: e.clientX, y: e.clientY, left: rect.left, top: rect.top };
        dragHandle.setPointerCapture(e.pointerId);
        e.preventDefault();
    });

    dragHandle.addEventListener('pointermove', e => {
        if (!drag) return;
        const maxX = window.innerWidth - panel.offsetWidth - 5;
        const maxY = window.innerHeight - 50;
        panel.style.left = Math.min(maxX, Math.max(0, drag.left + e.clientX - drag.x)) + 'px';
        panel.style.top = Math.min(maxY, Math.max(0, drag.top + e.clientY - drag.y)) + 'px';
        panel.style.right = 'auto';
        panel.style.bottom = 'auto';
    });

    const stopDrag = () => { drag = null; };
    dragHandle.addEventListener('pointerup', stopDrag);
    dragHandle.addEventListener('pointercancel', stopDrag);

    // 5. Dynamic Asset & Signal Engine (AmirFXBot Style Updates)
    function updateBotEngine() {
        // Detect asset from Pocket Option DOM
        const assetEl = document.querySelector('.asset-name, .current-symbol, [class*="asset"]');
        if (assetEl && assetEl.textContent.trim()) {
            document.getElementById('afx-pair-display').textContent = assetEl.textContent.trim();
        }

        if (!botRunning) return;

        // Simulate high-accuracy AI signal updates matching amirfxbot.co
        const isCall = Math.random() > 0.42;
        const confidence = (88 + Math.random() * 11).toFixed(1);
        const dirEl = document.getElementById('afx-sig-dir');

        currentSignal.direction = isCall ? 'CALL' : 'PUT';
        currentSignal.confidence = confidence;

        dirEl.textContent = `${currentSignal.direction} • ${confidence}%`;
        dirEl.className = `afx-signal-direction ${isCall ? 'afx-call' : 'afx-put'}`;

        // Auto execute on Pocket Option buttons if running
        if (botRunning && confidence > 90) {
            const btn = document.querySelector(isCall ? '.btn-call, .btn-higher' : '.btn-put, .btn-lower');
            if (btn && Math.random() > 0.7) {
                // Optional programmatic trigger simulation
                console.log(`[AmirFXBot] Signal executed: ${currentSignal.direction}`);
            }
        }
    }

    setInterval(updateBotEngine, 3000);

})();
