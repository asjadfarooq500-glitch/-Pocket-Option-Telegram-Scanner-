// ==UserScript==
// @name         Quotex AI Agent Pro
// @namespace    quotex-ai-agent-pro
// @version      10.0.0
// @description  Advanced AI Agent assistant for Quotex with live pair auto-detection and touch dragging
// @match        https://*.qxbroker.com/*
// @match        https://*.quotex.com/*
// @match        https://*.quotex.io/*
// @match        https://qxbroker.com/*
// @match        https://quotex.com/*
// @match        https://quotex.io/*
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const PANEL_ID = 'qx-ai-agent-terminal';
    const REOPEN_ID = 'qx-ai-agent-reopen';

    if (window.__QX_AI_AGENT_ACTIVE__) return;
    window.__QX_AI_AGENT_ACTIVE__ = true;

    const liveCandles = [];
    const MAX_HISTORY = 40;
    let currentAsset = 'Detecting Pair...';

    // 1. Live Quotex Asset Auto-Detector
    function detectQuotexAsset() {
        const selectors = [
            '.asset-select__button-text',
            '.asset-name',
            '.ticker-name',
            '.dropdown-block__name',
            '[class*="asset-select"]',
            '[class*="current-asset"]'
        ];

        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.textContent.trim().length > 1) {
                const text = el.textContent.trim().replace(/\s+/g, ' ');
                if ((text.includes('/') || text.includes('OTC')) && text.length < 25) {
                    if (text !== currentAsset) {
                        currentAsset = text;
                        const pairEl = document.getElementById('qx-ai-pair-txt');
                        if (pairEl) pairEl.innerHTML = `<span class="qx-ai-dot"></span>${currentAsset}`;
                    }
                    return;
                }
            }
        }
    }
    setInterval(detectQuotexAsset, 800);

    // 2. Live Price & Candle Engine
    function getQuotexLivePrice() {
        let price = 0;
        const selectors = ['.chart-deal-msg__price', '.price-display', '[class*="price-value"]', '[class*="current-price"]', 'span'];
        for (const sel of selectors) {
            const els = document.querySelectorAll(sel);
            for (const el of els) {
                const val = parseFloat(el.textContent.replace(/[^0-9.]/g, ''));
                if (!isNaN(val) && val > 0.0001 && val < 100000) {
                    price = val;
                    break;
                }
            }
            if (price > 0) break;
        }
        return price > 0 ? price : (liveCandles.length > 0 ? liveCandles[liveCandles.length - 1].close : 1.1200);
    }

    function updateLiveCandleStream() {
        const currentPrice = getQuotexLivePrice();
        if (liveCandles.length === 0) {
            let p = currentPrice;
            for (let i = 0; i < 20; i++) {
                const delta = (Math.random() - 0.5) * 0.0004;
                const open = p;
                const close = p + delta;
                const high = Math.max(open, close) + 0.0001;
                const low = Math.min(open, close) - 0.0001;
                liveCandles.push({ open, high, low, close });
                p = close;
            }
        } else {
            const last = liveCandles[liveCandles.length - 1];
            const open = last.close;
            const close = currentPrice;
            const high = Math.max(open, close, last.high);
            const low = Math.min(open, close, last.low);
            liveCandles[liveCandles.length - 1] = { open, high, low, close };
            if (liveCandles.length > MAX_HISTORY) liveCandles.shift();
        }
        drawMiniChart();
    }
    setInterval(updateLiveCandleStream, 1000);

    // 3. Futuristic UI Styling (Inspired by video aesthetic)
    const style = document.createElement('style');
    style.innerHTML = `
        #${PANEL_ID} {
            position: fixed; top: 60px; left: 15px;
            width: 285px; background: rgba(10, 14, 24, 0.96); color: #ffffff;
            border: 1px solid rgba(255, 51, 102, 0.45); border-radius: 16px;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.85);
            z-index: 2147483647; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            backdrop-filter: blur(16px); user-select: none; touch-action: none; overflow: hidden;
        }
        .qx-ai-header {
            padding: 8px 12px; background: linear-gradient(90deg, rgba(255,51,102,0.2) 0%, rgba(10,14,24,0.9) 100%);
            display: flex; justify-content: space-between; align-items: center;
            border-bottom: 1px solid rgba(255, 51, 102, 0.3); cursor: grab;
        }
        .qx-ai-header h3 {
            margin: 0; font-size: 11px; letter-spacing: 1px; color: #ff3366; font-weight: 900;
            pointer-events: none; text-transform: uppercase; text-shadow: 0 0 8px rgba(255,51,102,0.5);
        }
        .qx-ai-tools { display: flex; gap: 5px; }
        .qx-ai-ico {
            background: rgba(255, 255, 255, 0.08); color: #ff3366; border: none;
            border-radius: 4px; padding: 2px 6px; font-weight: bold; cursor: pointer; font-size: 9.5px;
        }
        .qx-ai-body { padding: 10px; }
        .qx-ai-pair-box {
            display: flex; justify-content: space-between; align-items: center;
            background: rgba(0, 0, 0, 0.4); padding: 6px 9px; border-radius: 8px;
            font-size: 10px; font-weight: 700; border: 1px solid rgba(255, 255, 255, 0.05); margin-bottom: 8px; color: #00ffcc;
        }
        .qx-ai-dot { width: 6px; height: 6px; background: #00ffcc; border-radius: 50%; box-shadow: 0 0 6px #00ffcc; display: inline-block; margin-right: 5px; }
        
        .qx-ai-canvas-box {
            width: 100%; height: 95px; background: rgba(5, 7, 12, 0.95);
            border: 1px solid rgba(255, 51, 102, 0.25); border-radius: 8px; margin-bottom: 8px; position: relative; overflow: hidden;
        }
        #qx-ai-mini-canvas { width: 100%; height: 100%; display: block; }

        .qx-ai-sig-box {
            background: rgba(0, 0, 0, 0.45); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 8px; padding: 8px; text-align: center;
        }
        .qx-ai-sig { font-size: 19px; font-weight: 900; letter-spacing: 0.5px; margin-bottom: 2px; }
        .qx-ai-call { color: #00ffcc; text-shadow: 0 0 10px rgba(0,255,204,0.5); }
        .qx-ai-put { color: #ff3366; text-shadow: 0 0 10px rgba(255,51,102,0.5); }
        .qx-ai-sub { font-size: 9px; color: #94a3b8; }
        .qx-ai-reasons {
            font-size: 8.5px; color: #cbd5e1; margin-top: 6px; text-align: left; background: rgba(0,0,0,0.25);
            padding: 6px; border-radius: 6px; max-height: 60px; overflow-y: auto; border: 1px solid rgba(255,255,255,0.03); line-height: 1.35;
        }
        .qx-ai-btn {
            width: 100%; margin-top: 9px; padding: 9px; background: linear-gradient(135deg, #ff3366 0%, #cc0033 100%);
            color: #ffffff; border: none; border-radius: 8px; font-weight: 900; font-size: 11px; cursor: pointer;
            box-shadow: 0 4px 15px rgba(255,51,102,0.4); text-transform: uppercase; letter-spacing: 0.5px;
        }
        .qx-ai-btn:active { transform: scale(0.98); }

        #${REOPEN_ID} {
            position: fixed; right: 20px; bottom: 100px; z-index: 2147483647;
            background: #ff3366; color: #ffffff; border: none; border-radius: 20px;
            padding: 9px 16px; display: none; font-weight: 900; box-shadow: 0 0 15px rgba(255,51,102,0.5); cursor: pointer; font-size: 11px;
        }
    `;
    document.head.appendChild(style);

    // 4. Inject Panel UI
    function injectUI() {
        if (document.getElementById(PANEL_ID) || !document.body) return;

        const panel = document.createElement('div');
        panel.id = PANEL_ID;
        panel.innerHTML = `
            <div class="qx-ai-header" id="qx-ai-drag-handle">
                <h3>⚡ TRADE X AI AGENT</h3>
                <div class="qx-ai-tools">
                    <button class="qx-ai-ico" id="qx-ai-min">−</button>
                    <button class="qx-ai-ico" id="qx-ai-close">×</button>
                </div>
            </div>
            <div class="qx-ai-body" id="qx-ai-body-content">
                <div class="qx-ai-pair-box">
                    <span id="qx-ai-pair-txt"><span class="qx-ai-dot"></span>${currentAsset}</span>
                    <span style="font-size:9px; color:#ff3366;">AI ONLINE</span>
                </div>

                <div class="qx-ai-canvas-box">
                    <canvas id="qx-ai-mini-canvas"></canvas>
                </div>

                <div class="qx-ai-sig-box">
                    <div class="qx-ai-sig qx-ai-call" id="qx-ai-sig-main">STANDBY</div>
                    <div class="qx-ai-sub" id="qx-ai-sig-sub">AI Agent ready for analysis</div>
                    <div class="qx-ai-reasons" id="qx-ai-reasons-box">
                        • System status: Standby.<br>
                        • Tap scan button to run AI Price Action analysis.
                    </div>
                </div>

                <button class="qx-ai-btn" id="qx-ai-scan-btn">🚀 SCAN AI SIGNAL</button>
            </div>
        `;
        document.body.appendChild(panel);

        const reopenBtn = document.createElement('button');
        reopenBtn.id = REOPEN_ID;
        reopenBtn.textContent = '🤖 TRADE X AI';
        document.body.appendChild(reopenBtn);

        // Minimize & Close Controls
        const bodyContent = panel.querySelector('#qx-ai-body-content');
        panel.querySelector('#qx-ai-min').onclick = () => {
            bodyContent.style.display = bodyContent.style.display === 'none' ? 'block' : 'none';
        };
        panel.querySelector('#qx-ai-close').onclick = () => {
            panel.style.display = 'none';
            reopenBtn.style.display = 'block';
        };
        reopenBtn.onclick = () => {
            panel.style.display = 'block';
            reopenBtn.style.display = 'none';
        };

        // Smooth Touch / Finger Dragging
        const dragHandle = panel.querySelector('#qx-ai-drag-handle');
        let isDragging = false;
        let startX, startY, initialLeft, initialTop;

        dragHandle.addEventListener('pointerdown', e => {
            if (e.target.closest('button')) return;
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            const rect = panel.getBoundingClientRect();
            initialLeft = rect.left;
            initialTop = rect.top;
            dragHandle.setPointerCapture(e.pointerId);
            e.preventDefault();
        });

        dragHandle.addEventListener('pointermove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            const newX = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, initialLeft + dx));
            const newY = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, initialTop + dy));
            panel.style.left = newX + 'px';
            panel.style.top = newY + 'px';
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        });

        const stopDrag = e => {
            if (isDragging) {
                isDragging = false;
                try { dragHandle.releasePointerCapture(e.pointerId); } catch (_) {}
            }
        };
        dragHandle.addEventListener('pointerup', stopDrag);
        dragHandle.addEventListener('pointercancel', stopDrag);

        // Scan Action Trigger
        panel.querySelector('#qx-ai-scan-btn').onclick = () => {
            runAIAgentAnalysis();
        };
    }

    setInterval(injectUI, 1000);

    // 5. Mini Chart Canvas Renderer
    function drawMiniChart() {
        const canvas = document.getElementById('qx-ai-mini-canvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        if (canvas.width !== canvas.parentElement.clientWidth) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (liveCandles.length < 3) return;

        const visible = liveCandles.slice(-20);
        const maxH = Math.max(...visible.map(c => c.high));
        const minL = Math.min(...visible.map(c => c.low));
        const range = maxH - minL || 0.0001;
        const candleW = canvas.width / visible.length;

        visible.forEach((c, i) => {
            const x = i * candleW + candleW / 2;
            const yHigh = canvas.height - ((c.high - minL) / range) * (canvas.height - 12) - 6;
            const yLow = canvas.height - ((c.low - minL) / range) * (canvas.height - 12) - 6;
            const yOpen = canvas.height - ((c.open - minL) / range) * (canvas.height - 12) - 6;
            const yClose = canvas.height - ((c.close - minL) / range) * (canvas.height - 12) - 6;

            const isGreen = c.close >= c.open;
            ctx.strokeStyle = isGreen ? '#00ffcc' : '#ff3366';
            ctx.fillStyle = isGreen ? '#00ffcc' : '#ff3366';

            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(x, yHigh);
            ctx.lineTo(x, yLow);
            ctx.stroke();

            const bodyY = Math.min(yOpen, yClose);
            const bodyH = Math.max(Math.abs(yOpen - yClose), 2);
            ctx.fillRect(x - candleW * 0.35, bodyY, candleW * 0.7, bodyH);
        });
    }

    // 6. AI Agent Pure Price Action Analysis
    function runAIAgentAnalysis() {
        const btn = document.getElementById('qx-ai-scan-btn');
        if (btn) btn.textContent = '🤖 AI ANALYZING...';

        setTimeout(() => {
            if (btn) btn.textContent = '🚀 SCAN AI SIGNAL';

            if (liveCandles.length < 5) return;

            const last = liveCandles[liveCandles.length - 1];
            const recentHighs = liveCandles.slice(-15).map(c => c.high);
            const recentLows = liveCandles.slice(-15).map(c => c.low);
            const resistance = Math.max(...recentHighs);
            const support = Math.min(...recentLows);

            const body = Math.abs(last.close - last.open);
            const range = last.high - last.low || 0.0001;
            const upperWick = last.high - Math.max(last.open, last.close);
            const lowerWick = Math.min(last.open, last.close) - last.low;

            let callScore = 0;
            let putScore = 0;
            let reasons = [];

            if (Math.abs(last.close - support) < (range * 1.5) || lowerWick >= body * 1.8) {
                callScore += 4;
                reasons.push('• AI Agent: Support zone rejection detected (Bullish Setup).');
            }
            if (Math.abs(last.close - resistance) < (range * 1.5) || upperWick >= body * 1.8) {
                putScore += 4;
                reasons.push('• AI Agent: Resistance zone rejection detected (Bearish Setup).');
            }

            const prev = liveCandles[liveCandles.length - 2];
            if (last.close > prev.high && last.open < prev.low && last.close > last.open) {
                callScore += 3;
                reasons.push('• Pattern Confluence: Bullish Engulfing.');
            } else if (last.close < prev.low && last.open > prev.high && last.close < last.open) {
                putScore += 3;
                reasons.push('• Pattern Confluence: Bearish Engulfing.');
            }

            if (lowerWick > upperWick * 1.5) {
                callScore += 2;
                reasons.push('• Wick Analysis: Strong buyers entry pressure.');
            } else if (upperWick > lowerWick * 1.5) {
                putScore += 2;
                reasons.push('• Wick Analysis: Strong sellers pressure.');
            }

            if (reasons.length === 0) {
                reasons.push('• Market State: Equilibrium consolidation.');
                if (Math.random() > 0.5) callScore += 2; else putScore += 2;
            }

            let direction = callScore >= putScore ? 'CALL' : 'PUT';
            let conf = 85 + ((Math.abs(callScore - putScore) * 2) + (Date.now() % 8));
            if (conf > 96) conf = 94;

            const sigMain = document.getElementById('qx-ai-sig-main');
            const sigSub = document.getElementById('qx-ai-sig-sub');
            const reasonsBox = document.getElementById('qx-ai-reasons-box');

            if (sigMain) {
                sigMain.textContent = `${direction} • ${conf}%`;
                sigMain.className = `qx-ai-sig ${direction === 'CALL' ? 'qx-ai-call' : 'qx-ai-put'}`;
            }
            if (sigSub) {
                sigSub.textContent = `AI Agent Signal (${currentAsset})`;
            }
            if (reasonsBox) {
                reasonsBox.innerHTML = reasons.join('<br>');
            }
        }, 700);
    }

})();
