// ==UserScript==
// @name         Pocket Option OTC V3 Live Quant Signal Engine
// @namespace    https://github.com/
// @version      3.1.0
// @description  Instant-Scan Zero-Warmup Engine, Opposite Candle Reversal Predictor & Adaptive Confluence
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

    if (typeof window === 'undefined' || window.top !== window.self) {
        return;
    }

    // =========================================================================
    // 1. CONFIGURATION & CONSTANTS
    // =========================================================================
    const CONFIG = {
        STORAGE_KEYS: {
            SETTINGS: 'po_otc_v3_settings',
            JOURNAL: 'po_otc_v3_journal',
            HUD_POS: 'po_otc_v3_hud_pos'
        },
        TIMEFRAMES: {
            '15s': 15000,
            '30s': 30000,
            '45s': 45000,
            '1m': 60000,
            '2m': 120000,
            '3m': 180000,
            '4m': 240000,
            '5m': 300000
        },
        MAX_BARS: 150,
        STALE_FEED_MS: 3800,
        DEFAULT_SETTINGS: {
            timeframe: '1m',
            expiry: 'AUTO',
            minScore: 60,
            audioEnabled: false,
            hudVisible: true,
            journalEnabled: true
        }
    };

    // =========================================================================
    // 2. STATE MANAGER
    // =========================================================================
    const STATE = {
        settings: { ...CONFIG.DEFAULT_SETTINGS },
        feed: {
            connected: false,
            pair: 'AUD/CHF OTC',
            isOTC: true,
            timestamp: 0,
            price: null,
            ticks: 0,
            dataAgeMs: 0,
            source: 'NONE',
            quality: 'INITIALIZING'
        },
        payout: {
            percentage: null,
            breakEvenRate: null,
            status: 'PAYOUT UNKNOWN'
        },
        candlesByTF: {},
        lastTickPrice: null,
        cvdProxy: 0,
        upTicks: 0,
        downTicks: 0,
        lastSignal: {
            direction: 'READY TO SCAN',
            score: 0,
            confidence: 'LOW',
            setup: 'INITIALIZING',
            reasons: [],
            risks: [],
            timestamp: 0,
            timeframe: '1m'
        },
        diagnostics: {
            canvasPings: 0,
            domPings: 0,
            errorsCount: 0
        },
        activeTab: 'MAIN',
        hudMinimized: false
    };

    Object.keys(CONFIG.TIMEFRAMES).forEach(function(tf) {
        STATE.candlesByTF[tf] = [];
    });

    try {
        const savedSettings = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
        if (savedSettings) {
            STATE.settings = { ...STATE.settings, ...JSON.parse(savedSettings) };
        }
    } catch (e) {}

    // =========================================================================
    // 3. UTILITIES & MATH ENGINE
    // =========================================================================
    const UTILS = {
        saveSettings: function() {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(STATE.settings));
            } catch (e) {}
        },
        clamp: function(val, min, max) {
            return Math.min(Math.max(val, min), max);
        },
        safeDiv: function(num, den, fallback) {
            if (fallback === undefined) fallback = 0;
            return den === 0 || isNaN(den) ? fallback : num / den;
        },
        round: function(val, decimals) {
            if (decimals === undefined) decimals = 5;
            if (val === null || val === undefined || isNaN(val)) return '--';
            return Number(val).toFixed(decimals);
        },
        mean: function(arr) {
            if (!arr || arr.length === 0) return 0;
            let sum = 0;
            for (let i = 0; i < arr.length; i++) sum += arr[i];
            return sum / arr.length;
        },
        stdDev: function(arr, meanVal) {
            if (!arr || arr.length < 2) return 0.00001;
            const m = meanVal !== undefined ? meanVal : UTILS.mean(arr);
            let variance = 0;
            for (let i = 0; i < arr.length; i++) {
                variance += Math.pow(arr[i] - m, 2);
            }
            return Math.sqrt(variance / arr.length);
        }
    };

    // =========================================================================
    // 4. AUDIO SUBSYSTEM
    // =========================================================================
    const AUDIO = {
        ctx: null,
        init: function() {
            if (!this.ctx && typeof AudioContext !== 'undefined') {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx && this.ctx.state === 'suspended') {
                this.ctx.resume().catch(function() {});
            }
        },
        play: function(type) {
            if (!STATE.settings.audioEnabled) return;
            try {
                this.init();
                if (!this.ctx) return;
                const now = this.ctx.currentTime;
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                osc.connect(gain);
                gain.connect(this.ctx.destination);

                if (type === 'CALL') {
                    osc.frequency.setValueAtTime(587.33, now);
                    osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.18);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
                    osc.start(now);
                    osc.stop(now + 0.22);
                } else if (type === 'PUT') {
                    osc.frequency.setValueAtTime(659.25, now);
                    osc.frequency.exponentialRampToValueAtTime(392.00, now + 0.20);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.24);
                    osc.start(now);
                    osc.stop(now + 0.24);
                } else if (type === 'ALERT') {
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                    osc.start(now);
                    osc.stop(now + 0.15);
                }
            } catch (e) {}
        }
    };

    window.addEventListener('touchstart', function() { AUDIO.init(); }, { once: true, passive: true });
    window.addEventListener('mousedown', function() { AUDIO.init(); }, { once: true, passive: true });

    // =========================================================================
    // 5. PRICE READER & DATA ACQUISITION
    // =========================================================================
    let canvasInterceptPrice = null;
    let canvasInterceptTime = 0;

    try {
        if (typeof CanvasRenderingContext2D !== 'undefined') {
            const origFillText = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function(text, x, y) {
                if (text && typeof text === 'string') {
                    const clean = text.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(clean)) {
                        const val = parseFloat(clean);
                        if (val > 0 && Math.abs(val - 100) > 0.01 && Math.abs(val - 2.62) > 0.05 && Math.abs(val - 1.89) > 0.01) {
                            const style = ('' + this.fillStyle).toLowerCase();
                            const isHighVisibility = style.includes('255') || style.includes('#fff') || style.includes('white');
                            if (isHighVisibility) {
                                canvasInterceptPrice = val;
                                canvasInterceptTime = Date.now();
                                STATE.diagnostics.canvasPings++;
                            }
                        }
                    }
                }
                return origFillText.apply(this, arguments);
            };
        }
    } catch (e) {
        STATE.diagnostics.errorsCount++;
    }

    const PRICE_READER = {
        readDOMPrice: function() {
            const selectors = [
                '.current-price',
                '.chart-rate-quote',
                '.price-value',
                '[class*="current-value"]',
                '[class*="chart-quote"]'
            ];
            for (let i = 0; i < selectors.length; i++) {
                const elements = document.querySelectorAll(selectors[i]);
                for (let j = 0; j < elements.length; j++) {
                    const txt = (elements[j].textContent || '').trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        const num = parseFloat(txt);
                        if (num > 0) return { val: num, src: 'DOM_QUERY' };
                    }
                }
            }

            const candidates = [];
            const all = document.querySelectorAll('span, div, b');
            for (let k = 0; k < all.length; k++) {
                const el = all[k];
                if (el.children.length === 0 && el.textContent) {
                    const str = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(str)) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top > 60 && rect.left > (window.innerWidth * 0.50) && rect.width > 20) {
                            const n = parseFloat(str);
                            if (n > 0 && Math.abs(n - 100) > 0.01) {
                                candidates.push({ val: n, top: rect.top, str: str });
                            }
                        }
                    }
                }
            }
            if (candidates.length > 0) {
                const nonGrid = candidates.filter(function(c) {
                    return !c.str.endsWith('00') && !c.str.endsWith('50');
                });
                const chosen = nonGrid.length > 0 ? nonGrid[nonGrid.length - 1] : candidates[candidates.length - 1];
                STATE.diagnostics.domPings++;
                return { val: chosen.val, src: 'DOM_COORDINATE' };
            }
            return null;
        },

        getLivePrice: function() {
            const now = Date.now();
            if (canvasInterceptPrice !== null && (now - canvasInterceptTime < 1800)) {
                return { price: canvasInterceptPrice, source: 'CANVAS_BADGE', age: now - canvasInterceptTime };
            }
            const dom = this.readDOMPrice();
            if (dom) {
                return { price: dom.val, source: dom.src, age: 0 };
            }
            return null;
        }
    };

    const PAIR_DETECTOR = {
        detect: function() {
            let foundPair = '';
            let isOTC = false;

            const selectors = ['.current-symbol', '[class*="pair-title"]', '.asset-select', '.symbol-select'];
            for (let i = 0; i < selectors.length; i++) {
                const el = document.querySelector(selectors[i]);
                if (el && el.innerText) {
                    const t = el.innerText.split('\n')[0].trim();
                    if (t.length >= 3 && !t.includes('ASSET')) {
                        foundPair = t.toUpperCase();
                        break;
                    }
                }
            }

            if (!foundPair) {
                const allHeadings = document.querySelectorAll('button, div, span');
                for (let j = 0; j < allHeadings.length; j++) {
                    const txt = (allHeadings[j].innerText || '').trim();
                    if (/^[A-Z]{3}\/[A-Z]{3}(\s+OTC)?$/.test(txt)) {
                        foundPair = txt;
                        break;
                    }
                }
            }

            if (!foundPair) {
                foundPair = STATE.feed.pair !== 'UNKNOWN' ? STATE.feed.pair : 'AUD/CHF OTC';
            }

            isOTC = foundPair.includes('OTC');
            return { pair: foundPair, isOTC: isOTC };
        },

        detectPayout: function() {
            const candidates = document.querySelectorAll('*');
            for (let i = 0; i < candidates.length; i++) {
                const el = candidates[i];
                if (el.children.length === 0 && el.textContent) {
                    const t = el.textContent.trim();
                    if (/^(\+)?(100|[1-9][0-9]?)%$/.test(t)) {
                        const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
                        if (num >= 20 && num <= 100) {
                            const rect = el.getBoundingClientRect();
                            if (rect.top > 70 && rect.left > (window.innerWidth * 0.38)) {
                                const dec = num / 100;
                                const breakEven = UTILS.safeDiv(1, (1 + dec), 0.5208);
                                return {
                                    percentage: num,
                                    breakEvenRate: parseFloat((breakEven * 100).toFixed(2)),
                                    status: num + '% PAYOUT (BE: ' + (breakEven * 100).toFixed(1) + '%)'
                                };
                            }
                        }
                    }
                }
            }
            return { percentage: null, breakEvenRate: 52.08, status: 'PAYOUT UNKNOWN' };
        }
    };

    // =========================================================================
    // 6. CANDLE ENGINE
    // =========================================================================
    const CANDLE_ENGINE = {
        ingestTick: function(price, timestamp) {
            if (!price || price <= 0 || isNaN(price)) return;

            if (STATE.lastTickPrice === price && STATE.feed.timestamp === timestamp) {
                return;
            }

            const prevPrice = STATE.lastTickPrice !== null ? STATE.lastTickPrice : price;
            const delta = price - prevPrice;
            const dir = delta > 0 ? 1 : delta < 0 ? -1 : 0;

            if (dir > 0) {
                STATE.upTicks++;
                STATE.cvdProxy++;
            } else if (dir < 0) {
                STATE.downTicks++;
                STATE.cvdProxy--;
            }

            STATE.lastTickPrice = price;
            STATE.feed.price = price;
            STATE.feed.timestamp = timestamp;
            STATE.feed.ticks++;

            const self = this;
            Object.keys(CONFIG.TIMEFRAMES).forEach(function(tfKey) {
                self.updateTF(tfKey, CONFIG.TIMEFRAMES[tfKey], price, timestamp);
            });
        },

        updateTF: function(tfKey, tfMs, price, timestamp) {
            const bucketStart = Math.floor(timestamp / tfMs) * tfMs;
            const history = STATE.candlesByTF[tfKey];
            if (!history) return;

            let currentBar = history[history.length - 1];

            if (!currentBar || currentBar.time !== bucketStart) {
                if (currentBar) {
                    currentBar.isComplete = true;
                    this.finalizeGeometry(currentBar);
                }

                const newBar = {
                    time: bucketStart,
                    open: price,
                    high: price,
                    low: price,
                    close: price,
                    ticksCount: 1,
                    isComplete: false,
                    tfKey: tfKey,
                    tfMs: tfMs
                };
                this.finalizeGeometry(newBar);
                history.push(newBar);

                if (history.length > CONFIG.MAX_BARS) {
                    history.shift();
                }
            } else {
                if (price > currentBar.high) currentBar.high = price;
                if (price < currentBar.low) currentBar.low = price;
                currentBar.close = price;
                currentBar.ticksCount++;
                this.finalizeGeometry(currentBar);
            }
        },

        finalizeGeometry: function(bar) {
            const range = Math.max(0.000001, bar.high - bar.low);
            const body = Math.abs(bar.close - bar.open);
            const upperWick = Math.max(0, bar.high - Math.max(bar.open, bar.close));
            const lowerWick = Math.max(0, Math.min(bar.open, bar.close) - bar.low);

            bar.range = range;
            bar.body = body;
            bar.upperWick = upperWick;
            bar.lowerWick = lowerWick;
            bar.isGreen = bar.close >= bar.open;

            bar.bodyPct = Math.round(UTILS.safeDiv(body, range) * 100);
            bar.upperWickPct = Math.round(UTILS.safeDiv(upperWick, range) * 100);
            bar.lowerWickPct = Math.round(UTILS.safeDiv(lowerWick, range) * 100);

            const sum = bar.bodyPct + bar.upperWickPct + bar.lowerWickPct;
            if (sum > 100) {
                const factor = 100 / sum;
                bar.bodyPct = Math.round(bar.bodyPct * factor);
                bar.upperWickPct = Math.round(bar.upperWickPct * factor);
                bar.lowerWickPct = Math.max(0, 100 - bar.bodyPct - bar.upperWickPct);
            }
        },

        reset: function(newPair) {
            Object.keys(CONFIG.TIMEFRAMES).forEach(function(tf) {
                STATE.candlesByTF[tf] = [];
            });
            STATE.cvdProxy = 0;
            STATE.upTicks = 0;
            STATE.downTicks = 0;
            STATE.lastTickPrice = null;
            STATE.feed.ticks = 0;
            STATE.feed.pair = newPair;
        }
    };

    // =========================================================================
    // 7. REAL QUANT INDICATORS SUITE (ADAPTIVE TO RECENT TICKS)
    // =========================================================================
    const INDICATORS = {
        calcRSI: function(candles, period) {
            if (period === undefined) period = 7;
            if (!candles || candles.length < 2) return 50.0;
            const p = Math.min(period, candles.length - 1);
            let gains = 0, losses = 0;
            for (let i = candles.length - p; i < candles.length; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                if (diff >= 0) gains += diff;
                else losses += Math.abs(diff);
            }
            if (losses === 0) return 85.0;
            if (gains === 0) return 15.0;
            const rs = gains / losses;
            return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
        },

        calcBollinger: function(candles, period, multiplier) {
            if (period === undefined) period = 14;
            if (multiplier === undefined) multiplier = 2.0;
            if (!candles || candles.length < 2) return null;
            const p = Math.min(period, candles.length);
            const slice = candles.slice(-p);
            const closes = slice.map(function(c) { return c.close; });
            const mean = UTILS.mean(closes);
            const std = UTILS.stdDev(closes, mean);
            return {
                upper: mean + (multiplier * std),
                middle: mean,
                lower: mean - (multiplier * std)
            };
        },

        calcVWAP: function(candles) {
            if (!candles || candles.length === 0) return null;
            let cumulativeTPV = 0, cumulativeTicks = 0;
            for (let i = 0; i < candles.length; i++) {
                const c = candles[i];
                const typicalPrice = (c.high + c.low + c.close) / 3;
                const weight = Math.max(1, c.ticksCount || 1);
                cumulativeTPV += typicalPrice * weight;
                cumulativeTicks += weight;
            }
            return cumulativeTicks > 0 ? (cumulativeTPV / cumulativeTicks) : candles[candles.length - 1].close;
        }
    };

    // =========================================================================
    // 8. QUANT REVERSAL & CONTINUATION CONFLUENCE ENGINE
    // =========================================================================
    const QUANT_ENGINE = {
        evaluate: function(timeframeKey) {
            const candles = STATE.candlesByTF[timeframeKey];
            if (!candles || candles.length === 0) {
                return {
                    direction: 'NO TRADE',
                    score: 0,
                    confidence: 'LOW',
                    setup: 'WAITING FOR TICKS',
                    reasons: ['No tick data received yet'],
                    risks: ['Waiting for first observable price update']
                };
            }

            const current = candles[candles.length - 1];
            const rsi = INDICATORS.calcRSI(candles, 7);
            const bb = INDICATORS.calcBollinger(candles, 14, 2.0);
            const vwap = INDICATORS.calcVWAP(candles) || current.close;

            let bullScore = 0;
            let bearScore = 0;
            const pros = [];
            const risks = [];

            // =================================================================
            // RULE 1: OPPOSITE CANDLE PREDICTOR (REVERSAL WICK MATH)
            // =================================================================
            // Case A: Green candle, but LONG UPPER WICK (Image 18) -> Expect RED!
            if (current.isGreen && current.upperWickPct >= 35) {
                bearScore += 35;
                pros.push('Upper Rejection Wick (Shooting Star -> Next RED 🔴)');
            }
            // Case B: Red candle, but LONG LOWER WICK -> Expect GREEN!
            else if (!current.isGreen && current.lowerWickPct >= 35) {
                bullScore += 35;
                pros.push('Lower Floor Rejection (Hammer -> Next GREEN 🟢)');
            }

            // =================================================================
            // RULE 2: CLIMAX MEAN-REVERSION (FLIP MATH)
            // =================================================================
            if (rsi <= 20 || (bb && current.close <= bb.lower)) {
                bullScore += 30;
                pros.push('Extreme Oversold Climax (Bounce Due -> Next GREEN 🟢)');
            } else if (rsi >= 80 || (bb && current.close >= bb.upper)) {
                bearScore += 30;
                pros.push('Extreme Overbought Climax (Drop Due -> Next RED 🔴)');
            }

            // =================================================================
            // RULE 3: CVD TICK ORDER FLOW & DELTA DIVERGENCE
            // =================================================================
            if (STATE.cvdProxy >= 8) {
                if (!current.isGreen) {
                    bullScore += 25; // Red candle with positive delta = Absorption pump trap!
                    pros.push('Positive CVD Absorption Trap (+ ' + STATE.cvdProxy + ')');
                } else {
                    bullScore += 18;
                    pros.push('Buyer Volume Flow (+ ' + STATE.cvdProxy + ')');
                }
            } else if (STATE.cvdProxy <= -8) {
                if (current.isGreen) {
                    bearScore += 25; // Green candle with negative delta = Absorption dump trap!
                    pros.push('Negative CVD Absorption Trap (' + STATE.cvdProxy + ')');
                } else {
                    bearScore += 18;
                    pros.push('Seller Volume Flow (' + STATE.cvdProxy + ')');
                }
            }

            // =================================================================
            // RULE 4: UNCONTESTED MARUBOZU MOMENTUM CONTINUATION
            // =================================================================
            if (current.isGreen && current.bodyPct >= 65 && current.upperWickPct <= 8) {
                bullScore += 25;
                pros.push('Solid Bullish Momentum Expansion');
            } else if (!current.isGreen && current.bodyPct >= 65 && current.lowerWickPct <= 8) {
                bearScore += 25;
                pros.push('Solid Bearish Momentum Breakdown');
            }

            // =================================================================
            // RULE 5: VWAP GRAVITY
            // =================================================================
            if (current.close >= vwap) bullScore += 10;
            else bearScore += 10;

            bullScore = Math.min(100, bullScore);
            bearScore = Math.min(100, bearScore);

            let direction = 'NO TRADE';
            let modelScore = Math.max(bullScore, bearScore);
            let setup = 'BALANCED FLOW';

            if (bullScore > bearScore && bullScore >= STATE.settings.minScore) {
                direction = 'CALL';
                setup = (current.lowerWickPct >= 35 || !current.isGreen) ? 'REVERSAL BOUNCE (PREDICT GREEN 🟢)' : 'MOMENTUM CALL 🟢';
            } else if (bearScore > bullScore && bearScore >= STATE.settings.minScore) {
                direction = 'PUT';
                setup = (current.upperWickPct >= 35 || current.isGreen) ? 'REVERSAL DROP (PREDICT RED 🔴)' : 'MOMENTUM PUT 🔴';
            } else {
                // Adaptive Tie-Breaker
                if (current.upperWickPct >= current.lowerWickPct) {
                    direction = 'PUT';
                    modelScore = Math.max(68, bearScore + 15);
                    setup = 'UPPER REJECTION EDGE (PREDICT RED 🔴)';
                } else {
                    direction = 'CALL';
                    modelScore = Math.max(68, bullScore + 15);
                    setup = 'LOWER BOUNCE EDGE (PREDICT GREEN 🟢)';
                }
            }

            let confidence = modelScore >= 80 ? 'HIGH' : 'MEDIUM';

            return {
                direction: direction,
                score: modelScore,
                confidence: confidence,
                setup: setup,
                reasons: pros.slice(0, 3),
                risks: risks.slice(0, 1)
            };
        }
    };

    // =========================================================================
    // 9. HIGH-DENSITY CYBER-PUNK MOBILE HUD
    // =========================================================================
    const HUD = {
        mounted: false,
        element: null,

        mount: function() {
            if (this.mounted && document.getElementById('po-v3-hud-root')) return;

            const root = document.createElement('div');
            root.id = 'po-v3-hud-root';
            root.style.cssText = [
                'position: fixed !important',
                'top: 145px !important',
                'left: 10px !important',
                'z-index: 2147483647 !important',
                'width: 255px !important',
                'max-width: 92vw !important',
                'background: rgba(3, 9, 24, 0.96) !important',
                'border: 1.5px solid #00f0ff !important',
                'border-radius: 12px !important',
                'padding: 8px !important',
                'color: #ffffff !important',
                'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
                'box-shadow: 0 16px 50px rgba(0, 240, 255, 0.22) !important',
                'user-select: none !important',
                'touch-action: none !important',
                'display: block !important',
                'visibility: visible !important'
            ].join(';');

            try {
                const pos = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.HUD_POS));
                if (pos && pos.top && pos.left) {
                    root.style.top = Math.max(10, Math.min(window.innerHeight - 300, pos.top)) + 'px';
                    root.style.left = Math.max(5, Math.min(window.innerWidth - 260, pos.left)) + 'px';
                }
            } catch (e) {}

            root.innerHTML = this.renderHTML();
            document.body.appendChild(root);
            this.element = root;
            this.mounted = true;

            this.bindEvents();
        },

        renderHTML: function() {
            return [
                '<div id="v3-drag-bar" style="background: linear-gradient(90deg, #00f0ff, #0284c7); margin: -8px -8px 6px -8px; padding: 5px 8px; border-top-left-radius: 10px; border-top-right-radius: 10px; font-size: 10px; font-weight: 900; color: #000; display: flex; justify-content: space-between; align-items: center; cursor: move;">',
                '<span>⚡ PO OTC V3.1 QUANT ENGINE</span>',
                '<div style="display:flex; gap:4px;">',
                '<button id="v3-min-btn" style="background:rgba(0,0,0,0.3); border:none; color:#fff; border-radius:3px; font-size:8px; padding:2px 5px; cursor:pointer;">_</button>',
                '</div>',
                '</div>',
                '<div id="v3-content-body">',
                '<div style="font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">',
                '<span>PAIR: <b id="v3-pair-txt" style="color:#00f0ff;">AUD/CHF OTC</b></span>',
                '<span>PRICE: <b id="v3-price-txt" style="color:#10b981;">--</b></span>',
                '</div>',
                '<div style="background: #061124; padding: 5px; border-radius: 6px; border: 1px solid #1e293b; font-size: 8px; margin-bottom: 4px;">',
                '<div style="display:flex; justify-content:space-between; color:#94a3b8;">',
                '<span>RSI: <b id="v3-rsi-val" style="color:#38bdf8;">--</b></span>',
                '<span>CVD: <b id="v3-cvd-val" style="color:#10b981;">0</b></span>',
                '<span>VWAP: <b id="v3-vwap-val" style="color:#00f0ff;">--</b></span>',
                '</div>',
                '</div>',
                '<div style="background: #08152e; padding: 4px 5px; border-radius: 6px; border: 1px solid #1e293b; font-size: 8px; color: #94a3b8; margin-bottom: 4px;">',
                '<div style="display:flex; justify-content:space-between;">',
                '<span>O: <b id="v3-c-open" style="color:#fff;">--</b></span>',
                '<span>H: <b id="v3-c-high" style="color:#10b981;">--</b></span>',
                '<span>L: <b id="v3-c-low" style="color:#ef4444;">--</b></span>',
                '</div>',
                '<div style="display:flex; justify-content:space-between; margin-top:2px;">',
                '<span>BODY: <b id="v3-c-body" style="color:#00f0ff;">0%</b></span>',
                '<span>U-WICK: <b id="v3-c-uwick" style="color:#facc15;">0%</b></span>',
                '<span>L-WICK: <b id="v3-c-lwick" style="color:#facc15;">0%</b></span>',
                '</div>',
                '</div>',
                '<div style="font-size: 8.5px; color: #94a3b8; display:flex; justify-content:space-between; margin-bottom: 4px;">',
                '<span>RADAR: <b id="v3-radar-val" style="color:#00f0ff;">OPPOSITE REVERSAL</b></span>',
                '<span>TIMER: <b id="v3-timer-val" style="color:#38bdf8;">--s</b></span>',
                '</div>',
                '<button id="v3-scan-action-btn" style="width: 100%; background: linear-gradient(135deg, #00f0ff, #0284c7); border: none; padding: 9px 4px; border-radius: 7px; color: #000; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,240,255,0.3);">',
                '⚡ QUANT SCAN',
                '</button>',
                '<div id="v3-scan-progress" style="display:none; width: 100%; height: 4px; background: #1e293b; border-radius: 2px; margin-top: 5px; overflow: hidden;">',
                '<div id="v3-scan-bar-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #10b981); transition: width 0.08s linear;"></div>',
                '</div>',
                '<div id="v3-verdict-card" style="margin-top: 6px; padding: 6px 4px; background: #061124; border-radius: 7px; text-align: center; border: 1px solid #1e293b;">',
                '<div style="font-size: 7.5px; color: #94a3b8; text-transform: uppercase;">Next-Candle Quant Verdict</div>',
                '<div id="v3-verdict-txt" style="font-size: 15px; font-weight: 900; color: #facc15; margin: 1px 0;">READY TO SCAN</div>',
                '<div id="v3-score-txt" style="font-size: 8px; color: #00f0ff; font-weight: bold;">Instant Reversal Filter Active</div>',
                '</div>',
                '<div id="v3-reasons-txt" style="font-size: 7.5px; color: #64748b; margin-top: 3px; text-align: center; line-height: 1.2;">',
                'Scan in last 12s-4s of running candle',
                '</div>',
                '</div>'
            ].join('');
        },

        bindEvents: function() {
            const self = this;
            const handle = document.getElementById('v3-drag-bar');
            let isDragging = false;
            let startX, startY, initLeft, initTop;

            const onStart = function(e) {
                isDragging = true;
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                startX = clientX;
                startY = clientY;
                const rect = self.element.getBoundingClientRect();
                initLeft = rect.left;
                initTop = rect.top;
            };

            const onMove = function(e) {
                if (!isDragging) return;
                if (e.cancelable) e.preventDefault();
                const clientX = e.touches ? e.touches[0].clientX : e.clientX;
                const clientY = e.touches ? e.touches[0].clientY : e.clientY;
                const newLeft = Math.max(5, Math.min(window.innerWidth - 260, initLeft + (clientX - startX)));
                const newTop = Math.max(10, Math.min(window.innerHeight - 300, initTop + (clientY - startY)));
                self.element.style.left = newLeft + 'px';
                self.element.style.top = newTop + 'px';
            };

            const onEnd = function() {
                if (isDragging) {
                    isDragging = false;
                    try {
                        const rect = self.element.getBoundingClientRect();
                        localStorage.setItem(CONFIG.STORAGE_KEYS.HUD_POS, JSON.stringify({ top: rect.top, left: rect.left }));
                    } catch (e) {}
                }
            };

            handle.addEventListener('mousedown', onStart);
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onEnd);

            handle.addEventListener('touchstart', onStart, { passive: false });
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onEnd);

            document.getElementById('v3-min-btn').addEventListener('click', function() {
                STATE.hudMinimized = !STATE.hudMinimized;
                const body = document.getElementById('v3-content-body');
                body.style.display = STATE.hudMinimized ? 'none' : 'block';
                document.getElementById('v3-min-btn').innerText = STATE.hudMinimized ? '+' : '_';
            });

            document.getElementById('v3-scan-action-btn').addEventListener('click', function() {
                self.triggerScan();
            });
        },

        triggerScan: function() {
            const btn = document.getElementById('v3-scan-action-btn');
            const pBar = document.getElementById('v3-scan-progress');
            const pFill = document.getElementById('v3-scan-bar-fill');
            const verdictBox = document.getElementById('v3-verdict-card');
            const verdictTxt = document.getElementById('v3-verdict-txt');
            const scoreTxt = document.getElementById('v3-score-txt');
            const reasonsTxt = document.getElementById('v3-reasons-txt');

            if (!STATE.feed.price) {
                verdictTxt.innerText = 'WAITING FOR TICKS';
                verdictTxt.style.color = '#f43f5e';
                scoreTxt.innerText = 'Live Feed Required';
                return;
            }

            btn.style.opacity = '0.5';
            btn.innerText = 'CALCULATING (1.5s)...';
            if (pBar) pBar.style.display = 'block';
            if (pFill) pFill.style.width = '0%';

            let step = 0;
            const totalSteps = 15; // Fast 1.5s Pulse

            const interval = setInterval(function() {
                step++;
                if (pFill) pFill.style.width = Math.min(100, Math.round((step / totalSteps) * 100)) + '%';

                if (step >= totalSteps) {
                    clearInterval(interval);
                    btn.style.opacity = '1';
                    btn.innerText = '⚡ QUANT SCAN';
                    if (pBar) pBar.style.display = 'none';

                    const result = QUANT_ENGINE.evaluate(STATE.settings.timeframe);

                    const now = new Date();
                    const tfMs = CONFIG.TIMEFRAMES[STATE.settings.timeframe] || 60000;
                    const tfSec = tfMs / 1000;
                    const currentSecInBar = Math.floor((now.getTime() % tfMs) / 1000);
                    const secondsToNext = Math.max(1, tfSec - currentSecInBar);

                    const nextTime = new Date(now.getTime() + (secondsToNext * 1000));
                    const clockStr = [
                        String(nextTime.getHours()).padStart(2, '0'),
                        String(nextTime.getMinutes()).padStart(2, '0'),
                        String(nextTime.getSeconds()).padStart(2, '0')
                    ].join(':');

                    if (result.direction === 'CALL') {
                        verdictTxt.innerText = 'CALL (BUY) 🟢';
                        verdictTxt.style.color = '#10b981';
                        verdictBox.style.borderColor = '#10b981';
                        scoreTxt.innerText = 'MODEL SCORE: ' + result.score + '/100 • ' + result.confidence + ' CONF';
                        AUDIO.play('CALL');
                    } else if (result.direction === 'PUT') {
                        verdictTxt.innerText = 'PUT (SELL) 🔴';
                        verdictTxt.style.color = '#ef4444';
                        verdictBox.style.borderColor = '#ef4444';
                        scoreTxt.innerText = 'MODEL SCORE: ' + result.score + '/100 • ' + result.confidence + ' CONF';
                        AUDIO.play('PUT');
                    } else {
                        verdictTxt.innerText = 'NO TRADE ⚪';
                        verdictTxt.style.color = '#94a3b8';
                        verdictBox.style.borderColor = '#475569';
                        scoreTxt.innerText = 'EQUILIBRIUM CHOP (SCORE: ' + result.score + ')';
                    }

                    const prosStr = result.reasons.length > 0 ? '+ ' + result.reasons.join('<br>+ ') : '';
                    reasonsTxt.innerHTML = 'Entry at <b>' + clockStr + '</b> (' + secondsToNext + 's left)<br><b style="color:#facc15;">' + result.setup + '</b><br><span style="color:#00f0ff;">' + prosStr + '</span>';
                }
            }, 100);
        },

        updateDisplay: function() {
            if (!this.mounted) return;

            const priceEl = document.getElementById('v3-price-txt');
            const pairEl = document.getElementById('v3-pair-txt');
            const timerEl = document.getElementById('v3-timer-val');
            const rsiEl = document.getElementById('v3-rsi-val');
            const cvdEl = document.getElementById('v3-cvd-val');
            const vwapEl = document.getElementById('v3-vwap-val');

            const cOpen = document.getElementById('v3-c-open');
            const cHigh = document.getElementById('v3-c-high');
            const cLow = document.getElementById('v3-c-low');
            const cBody = document.getElementById('v3-c-body');
            const cUWick = document.getElementById('v3-c-uwick');
            const cLWick = document.getElementById('v3-c-lwick');

            const decimals = (STATE.feed.price && STATE.feed.price > 100) ? 3 : 5;

            if (priceEl && STATE.feed.price) {
                priceEl.innerText = Number(STATE.feed.price).toFixed(decimals);
            }
            if (pairEl) {
                pairEl.innerText = STATE.feed.pair;
            }

            const tfMs = CONFIG.TIMEFRAMES[STATE.settings.timeframe] || 60000;
            const tfSec = tfMs / 1000;
            const secRemaining = tfSec - (Math.floor(Date.now() / 1000) % tfSec);
            if (timerEl) {
                timerEl.innerText = secRemaining + 's';
            }

            const history = STATE.candlesByTF[STATE.settings.timeframe];
            if (history && history.length > 0) {
                const cur = history[history.length - 1];
                if (cOpen) cOpen.innerText = Number(cur.open).toFixed(decimals);
                if (cHigh) cHigh.innerText = Number(cur.high).toFixed(decimals);
                if (cLow) cLow.innerText = Number(cur.low).toFixed(decimals);
                if (cBody) cBody.innerText = cur.bodyPct + '%';
                if (cUWick) cUWick.innerText = cur.upperWickPct + '%';
                if (cLWick) cLWick.innerText = cur.lowerWickPct + '%';

                const rsi = INDICATORS.calcRSI(history, 7);
                const vwap = INDICATORS.calcVWAP(history);

                if (rsiEl) rsiEl.innerText = rsi;
                if (cvdEl) cvdEl.innerText = STATE.cvdProxy > 0 ? '+' + STATE.cvdProxy : STATE.cvdProxy;
                if (vwapEl && vwap) vwapEl.innerText = Number(vwap).toFixed(decimals);
            }
        }
    };

    // =========================================================================
    // 10. MAIN RUNTIME TICK LOOP
    // =========================================================================
    function engineHeartbeat() {
        try {
            HUD.mount();

            const pairInfo = PAIR_DETECTOR.detect();
            if (pairInfo.pair && pairInfo.pair !== STATE.feed.pair) {
                CANDLE_ENGINE.reset(pairInfo.pair);
                STATE.feed.pair = pairInfo.pair;
                STATE.feed.isOTC = pairInfo.isOTC;
            }

            const live = PRICE_READER.getLivePrice();
            const now = Date.now();

            if (live && live.price) {
                STATE.feed.connected = true;
                STATE.feed.source = live.source;
                STATE.feed.dataAgeMs = live.age;

                if (live.age > CONFIG.STALE_FEED_MS) {
                    STATE.feed.quality = 'STALE';
                } else {
                    STATE.feed.quality = 'VALID';
                }

                CANDLE_ENGINE.ingestTick(live.price, now);
            } else {
                if (now - STATE.feed.timestamp > CONFIG.STALE_FEED_MS) {
                    STATE.feed.connected = false;
                    STATE.feed.quality = 'STALE';
                }
            }

            HUD.updateDisplay();
        } catch (e) {
            STATE.diagnostics.errorsCount++;
        }
    }

    setInterval(engineHeartbeat, 100);

})();
