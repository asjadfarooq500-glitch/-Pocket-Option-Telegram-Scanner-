// ==UserScript==
// @name         PO OTC Scanner V3
// @namespace    po-otc-scanner-v3
// @version      3.0.0
// @description  Mobile floating scanner with draggable panel and manual OHLC analysis
// @match        https://pocketoption.com/*
// @match        https://*.pocketoption.com/*
// @match        http://pocketoption.com/*
// @match        http://*.pocketoption.com/*
// @match        https://po.trade/*
// @match        https://*.po.trade/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'po-scanner-v3-panel';
    const BUTTON_ID = 'po-scanner-v3-open';

    function mountScanner() {
        if (!document.body) {
            setTimeout(mountScanner, 250);
            return;
        }

        // If already installed, make it visible again.
        let existing = document.getElementById(PANEL_ID);

        if (existing) {
            existing.style.setProperty('display', 'block', 'important');
            existing.style.setProperty('visibility', 'visible', 'important');
            existing.style.setProperty('z-index', '2147483647', 'important');
            return;
        }

        const panel = document.createElement('div');
        panel.id = PANEL_ID;

        Object.assign(panel.style, {
            position: 'fixed',
            top: '100px',
            left: '10px',
            width: 'min(310px, calc(100vw - 20px))',
            maxHeight: '72vh',
            overflowY: 'auto',
            background: '#101820',
            color: '#ffffff',
            border: '2px solid #10b981',
            borderRadius: '12px',
            boxShadow: '0 5px 25px rgba(0,0,0,.65)',
            zIndex: '2147483647',
            fontFamily: 'Arial, sans-serif',
            fontSize: '14px',
            lineHeight: '1.4',
            display: 'block',
            visibility: 'visible',
            opacity: '1',
            pointerEvents: 'auto'
        });

        panel.innerHTML = `
          <div id="po-v3-header" style="
            padding:12px;background:#064e3b;border-radius:9px 9px 0 0;
            display:flex;align-items:center;justify-content:space-between;
            gap:6px;touch-action:none;user-select:none;">
            <strong>⚡ PO OTC SCANNER V3</strong>
            <span>
              <button id="po-v3-min">−</button>
              <button id="po-v3-close">×</button>
            </span>
          </div>

          <div id="po-v3-content" style="padding:12px;">
            <div id="po-v3-status" style="
              padding:9px;background:#243746;border-radius:7px;margin-bottom:10px;">
              🟢 SCANNER RUNNING
            </div>

            <div style="font-size:12px;color:#cbd5e1;margin-bottom:8px;">
              Candle data: NOT CONNECTED automatically.<br>
              For manual analysis, enter real OHLC candles below.
              Newest candle must be last.
            </div>

            <label for="po-v3-input">Open, High, Low, Close</label>

            <textarea id="po-v3-input" placeholder="Paste at least 30 candles:
1.0840,1.0850,1.0830,1.0845
1.0845,1.0860,1.0840,1.0855"
              style="width:100%;height:105px;box-sizing:border-box;
              margin-top:7px;padding:8px;background:#07111b;color:white;
              border:1px solid #64748b;border-radius:7px;font-size:12px;">
            </textarea>

            <div style="display:flex;gap:7px;margin-top:9px;">
              <button id="po-v3-analyze" style="flex:1;">ANALYZE</button>
              <button id="po-v3-clear" style="flex:1;">CLEAR</button>
            </div>

            <div id="po-v3-result" style="
              margin-top:10px;padding:10px;background:#1e293b;border-radius:8px;">
              Waiting for real candle data.
            </div>

            <div style="font-size:11px;color:#cbd5e1;margin-top:10px;">
              Manual analysis only. No automatic orders. Signals are not guaranteed.
            </div>
          </div>
        `;

        // Style buttons independently of the website's CSS.
        panel.querySelectorAll('button').forEach(button => {
            Object.assign(button.style, {
                background: '#087f5b',
                color: '#ffffff',
                border: '0',
                borderRadius: '6px',
                padding: '7px 10px',
                fontWeight: 'bold',
                fontSize: '13px',
                cursor: 'pointer'
            });
        });

        document.body.appendChild(panel);

        // Floating button used to reopen the panel.
        let reopen = document.getElementById(BUTTON_ID);

        if (!reopen) {
            reopen = document.createElement('button');
            reopen.id = BUTTON_ID;
            reopen.textContent = '⚡ OPEN SCANNER';

            Object.assign(reopen.style, {
                position: 'fixed',
                right: '12px',
                bottom: '90px',
                zIndex: '2147483647',
                background: '#087f5b',
                color: '#ffffff',
                border: '2px solid #ffffff',
                borderRadius: '24px',
                padding: '12px 15px',
                fontSize: '13px',
                fontWeight: 'bold',
                display: 'none'
            });

            document.body.appendChild(reopen);
        }

        const content = panel.querySelector('#po-v3-content');
        const status = panel.querySelector('#po-v3-status');
        const result = panel.querySelector('#po-v3-result');

        panel.querySelector('#po-v3-min').onclick = function () {
            content.style.display =
                content.style.display === 'none' ? 'block' : 'none';
        };

        panel.querySelector('#po-v3-close').onclick = function () {
            panel.style.display = 'none';
            reopen.style.display = 'block';
        };

        reopen.onclick = function () {
            panel.style.display = 'block';
            reopen.style.display = 'none';
        };

        panel.querySelector('#po-v3-clear').onclick = function () {
            panel.querySelector('#po-v3-input').value = '';
            result.textContent = 'Data cleared. Enter real candles to analyze.';
            status.textContent = '🟡 WAITING FOR CANDLE DATA';
        };

        // Mobile drag support.
        const header = panel.querySelector('#po-v3-header');
        let dragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        header.addEventListener('pointerdown', function (event) {
            if (event.target.closest('button')) return;

            dragging = true;

            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            startX = event.clientX;
            startY = event.clientY;

            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            try {
                header.setPointerCapture(event.pointerId);
            } catch (_) {}

            event.preventDefault();
        });

        header.addEventListener('pointermove', function (event) {
            if (!dragging) return;

            const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
            const maxTop = Math.max(0, window.innerHeight - 60);

            const newLeft = initialLeft + event.clientX - startX;
            const newTop = initialTop + event.clientY - startY;

            panel.style.left =
                Math.min(maxLeft, Math.max(0, newLeft)) + 'px';

            panel.style.top =
                Math.min(maxTop, Math.max(0, newTop)) + 'px';
        });

        function stopDragging() {
            dragging = false;
        }

        header.addEventListener('pointerup', stopDragging);
        header.addEventListener('pointercancel', stopDragging);

        // Manual OHLC analysis; never creates synthetic candles.
        panel.querySelector('#po-v3-analyze').onclick = function () {
            const raw = panel.querySelector('#po-v3-input').value.trim();

            if (!raw) {
                result.textContent =
                    'No candle data entered. Paste real OHLC candles first.';
                return;
            }

            const rows = raw.split(/\n+/).map(s => s.trim()).filter(Boolean);
            const candles = [];

            for (let i = 0; i < rows.length; i++) {
                const values = rows[i].split(/[,\s;]+/).map(Number);

                if (
                    values.length !== 4 ||
                    values.some(v => !Number.isFinite(v))
                ) {
                    result.textContent =
                        'Invalid row ' + (i + 1) +
                        '. Required format: open,high,low,close.';
                    return;
                }

                const [open, high, low, close] = values;

                if (
                    high < low ||
                    high < Math.max(open, close) ||
                    low > Math.min(open, close)
                ) {
                    result.textContent =
                        'Invalid high/low values in row ' + (i + 1) + '.';
                    return;
                }

                candles.push({ open, high, low, close });
            }

            if (candles.length < 30) {
                result.textContent =
                    'Only ' + candles.length +
                    ' candles received. At least 30 are required.';
                return;
            }

            const closes = candles.map(c => c.close);

            function calculateEMA(period) {
                const multiplier = 2 / (period + 1);
                let value = closes[0];

                for (let i = 1; i < closes.length; i++) {
                    value = closes[i] * multiplier +
                        value * (1 - multiplier);
                }

                return value;
            }

            let gains = 0;
            let losses = 0;

            for (let i = closes.length - 14; i < closes.length; i++) {
                const change = closes[i] - closes[i - 1];

                if (change > 0) gains += change;
                else losses -= change;
            }

            const averageGain = gains / 14;
            const averageLoss = losses / 14;

            const rsi = averageLoss === 0
                ? 100
                : 100 - 100 / (1 + averageGain / averageLoss);

            const ema9 = calculateEMA(9);
            const ema21 = calculateEMA(21);
            const ema50 = calculateEMA(50);

            const last = candles[candles.length - 1];
            const previous = candles[candles.length - 2];

            const uptrend = ema9 > ema21 && ema21 > ema50;
            const downtrend = ema9 < ema21 && ema21 < ema50;

            const bullish = last.close > last.open;
            const bearish = last.close < last.open;

            let signal = 'WAIT — NO CLEAR SETUP';
            let reason = 'Trend and momentum do not agree sufficiently.';

            if (
                uptrend &&
                rsi >= 50 &&
                rsi <= 68 &&
                bullish &&
                last.close > previous.close
            ) {
                signal = 'CALL BIAS';
                reason = 'Uptrend and bullish momentum agree.';
            } else if (
                downtrend &&
                rsi <= 50 &&
                rsi >= 32 &&
                bearish &&
                last.close < previous.close
            ) {
                signal = 'PUT BIAS';
                reason = 'Downtrend and bearish momentum agree.';
            }

            result.replaceChildren();

            const heading = document.createElement('strong');
            heading.textContent = signal;
            heading.style.fontSize = '18px';
            result.appendChild(heading);

            const details = document.createElement('div');
            details.style.marginTop = '8px';
            details.style.whiteSpace = 'pre-line';
            details.textContent =
                reason +
                '\n\nEMA 9: ' + ema9.toFixed(6) +
                '\nEMA 21: ' + ema21.toFixed(6) +
                '\nEMA 50: ' + ema50.toFixed(6) +
                '\nRSI 14: ' + rsi.toFixed(1) +
                '\nLast close: ' + last.close +
                '\n\nRule-based indication only; not a guaranteed prediction.';

            result.appendChild(details);

            status.textContent =
                '🟢 ANALYSIS COMPLETE — ' + candles.length +
                ' candles supplied manually.';
        };

        status.textContent = '🟢 SCANNER RUNNING — PANEL CREATED';

        console.log('[PO Scanner V3] Panel created successfully.');
    }

    // Retry mounting in case the trading page loads slowly.
    let attempts = 0;

    function boot() {
        if (document.getElementById(PANEL_ID)) return;

        attempts++;

        try {
            mountScanner();
        } catch (error) {
            console.error('[PO Scanner V3] Error:', error);
        }

        if (attempts < 12 && !document.getElementById(PANEL_ID)) {
            setTimeout(boot, 500);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
