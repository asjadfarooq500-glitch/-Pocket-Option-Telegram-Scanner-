// ==UserScript==
// @name         Pocket Option OTC APEX TITAN OMNI-QUANT V7
// @namespace    https://github.com/
// @version      7.0.0
// @description  Master Institutional Live OTC Quantitative Analysis & Next-Candle Predictive Engine
// @match        *://*.pocketoption.com/*
// @match        *://pocketoption.com/*
// @match        *://*.po.trade/*
// @match        *://*.po.market/*
// @match        *://*.pocket-option.com/*
// @match        *://*.po2.cash/*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    if (typeof window === 'undefined' || window.top !== window.self) return;

    // =========================================================================
    // 1. CONFIGURATION & STATE
    // =========================================================================
    const CONFIG = {
        STORAGE_KEYS: {
            SETTINGS: 'po_v7_settings',
            JOURNAL: 'po_v7_journal',
            HUD_POS: 'po_v7_hud_pos'
        },
        TIMEFRAMES: {
            '15s': 15000,
            '30s': 30000,
            '1m': 60000,
            '2m': 120000,
            '3m': 180000,
            '5m': 300000
        },
        MAX_BARS: 120,
        STALE_FEED_MS: 3800,
        DEFAULT_SETTINGS: {
            timeframe: '1m',
            mode: 'BALANCED', // AGGRESSIVE, BALANCED, SELECTIVE
            minScore: 65,
            audioEnabled: false,
            journalEnabled: true
        }
    };

    const STATE = {
        settings: { ...CONFIG.DEFAULT_SETTINGS },
        feed: {
            connected: false,
            pair: 'AUD/CHF OTC',
            isOTC: true,
            price: null,
            timestamp: 0,
            ticks: 0,
            source: 'NONE',
            quality: 'INITIALIZING'
        },
        payout: {
            percentage: null,
            breakEvenRate: 52.08,
            status: 'PAYOUT UNKNOWN'
        },
        candlesByTF: {},
        cvdProxy: 0,
        upTicks: 0,
        downTicks: 0,
        lastTickPrice: null,
        lastSignal: {
            direction: 'READY TO SCAN',
            score: 0,
            confidence: 0,
            quality: 100,
            confluence: 0,
            edge: 0,
            setup: 'INITIALIZING',
            expiry: '1m',
            tier: 'FORCED',
            reasons: [],
            risks: []
        },
        diagnostics: {
            canvasPings: 0,
            domPings: 0,
            errorsCount: 0
        },
        hudMinimized: false
    };

    Object.keys(CONFIG.TIMEFRAMES).forEach(function (tf) {
        STATE.candlesByTF[tf] = [];
    });

    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEYS.SETTINGS);
        if (saved) STATE.settings = { ...STATE.settings, ...JSON.parse(saved) };
    } catch (e) {}

    // =========================================================================
    // 2. MATHEMATICAL CORE UTILITIES
    // =========================================================================
    const UTILS = {
        saveSettings: function () {
            try { localStorage.setItem(CONFIG.STORAGE_KEYS.SETTINGS, JSON.stringify(STATE.settings)); } catch (e) {}
        },
        safeDiv: function (n, d, f) {
            if (f === undefined) f = 0;
            return d === 0 || isNaN(d) ? f : n / d;
        },
        round: function (v, dec) {
            if (dec === undefined) dec = 5;
            return (v === null || v === undefined || isNaN(v)) ? '--' : Number(v).toFixed(dec);
        },
        mean: function (arr) {
            if (!arr || arr.length === 0) return 0;
            let sum = 0;
            for (let i = 0; i < arr.length; i++) sum += arr[i];
            return sum / arr.length;
        },
        stdDev: function (arr, m) {
            if (!arr || arr.length < 2) return 0.00001;
            const avg = m !== undefined ? m : UTILS.mean(arr);
            let variance = 0;
            for (let i = 0; i < arr.length; i++) {
                variance += Math.pow(arr[i] - avg, 2);
            }
            return Math.sqrt(variance / arr.length);
        }
    };

    // =========================================================================
    // 3. AUDIO SYNTHESIZER (WEB AUDIO API)
    // =========================================================================
    const AUDIO = {
        ctx: null,
        init: function () {
            if (!this.ctx && typeof AudioContext !== 'undefined') {
                this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            }
            if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume().catch(function () {});
        },
        play: function (type) {
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
                    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.22);
                    osc.start(now); osc.stop(now + 0.22);
                } else if (type === 'PUT') {
                    osc.frequency.setValueAtTime(659.25, now);
                    osc.frequency.exponentialRampToValueAtTime(392, now + 0.20);
                    gain.gain.setValueAtTime(0.12, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.24);
                    osc.start(now); osc.stop(now + 0.24);
                } else if (type === 'ALERT') {
                    osc.frequency.setValueAtTime(440, now);
                    gain.gain.setValueAtTime(0.08, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.15);
                    osc.start(now); osc.stop(now + 0.15);
                }
            } catch (e) {}
        }
    };

    window.addEventListener('touchstart', function () { AUDIO.init(); }, { once: true, passive: true });
    window.addEventListener('mousedown', function () { AUDIO.init(); }, { once: true, passive: true });

    // =========================================================================
    // 4. LIVE PRICE & ASSET DETECTOR
    // =========================================================================
    let canvasInterceptPrice = null;
    let canvasInterceptTime = 0;

    try {
        if (typeof CanvasRenderingContext2D !== 'undefined') {
            const origFill = CanvasRenderingContext2D.prototype.fillText;
            CanvasRenderingContext2D.prototype.fillText = function (text, x, y) {
                if (text && typeof text === 'string') {
                    const str = text.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(str)) {
                        const n = parseFloat(str);
                        if (n > 0 && Math.abs(n - 100) > 0.01 && Math.abs(n - 2.62) > 0.05 && Math.abs(n - 1.89) > 0.01) {
                            const style = ('' + this.fillStyle).toLowerCase();
                            if (style.includes('255') || style.includes('#fff') || style.includes('white')) {
                                canvasInterceptPrice = n;
                                canvasInterceptTime = Date.now();
                                STATE.diagnostics.canvasPings++;
                            }
                        }
                    }
                }
                return origFill.apply(this, arguments);
            };
        }
    } catch (e) {}

    const DATA_FEED = {
        readDOMPrice: function () {
            const selectors = ['.current-price', '.chart-rate-quote', '.price-value', '[class*="current-value"]'];
            for (let i = 0; i < selectors.length; i++) {
                const els = document.querySelectorAll(selectors[i]);
                for (let j = 0; j < els.length; j++) {
                    const txt = (els[j].textContent || '').trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(txt)) {
                        const num = parseFloat(txt);
                        if (num > 0) return { val: num, src: 'DOM_QUERY' };
                    }
                }
            }
            const all = document.querySelectorAll('span, div, b');
            const candidates = [];
            for (let k = 0; k < all.length; k++) {
                const el = all[k];
                if (el.children.length === 0 && el.textContent) {
                    const str = el.textContent.trim();
                    if (/^\d{1,6}\.\d{2,6}$/.test(str)) {
                        const rect = el.getBoundingClientRect();
                        if (rect.top > 60 && rect.left > (window.innerWidth * 0.50)) {
                            const n = parseFloat(str);
                            if (n > 0 && Math.abs(n - 100) > 0.01) candidates.push({ val: n, str: str });
                        }
                    }
                }
            }
            if (candidates.length > 0) {
                const nonGrid = candidates.filter(function (c) { return !c.str.endsWith('00') && !c.str.endsWith('50'); });
                const chosen = nonGrid.length > 0 ? nonGrid[nonGrid.length - 1] : candidates[candidates.length - 1];
                STATE.diagnostics.domPings++;
                return { val: chosen.val, src: 'DOM_COORDINATE' };
            }
            return null;
        },

        getLivePrice: function () {
            const now = Date.now();
            if (canvasInterceptPrice !== null && (now - canvasInterceptTime < 1800)) {
                return { price: canvasInterceptPrice, source: 'CANVAS_BADGE', age: now - canvasInterceptTime };
            }
            const dom = this.readDOMPrice();
            if (dom) return { price: dom.val, source: dom.src, age: 0 };
            return null;
        },

        detectPair: function () {
            let foundPair = '';
            const selectors = ['.current-symbol', '[class*="pair-title"]', '.asset-select'];
            for (let i = 0; i < selectors.length; i++) {
                const el = document.querySelector(selectors[i]);
                if (el && el.innerText) {
                    const t = el.innerText.split('\n')[0].trim();
                    if (t.length >= 3 && !t.includes('ASSET')) { foundPair = t.toUpperCase(); break; }
                }
            }
            if (!foundPair) foundPair = STATE.feed.pair;
            const isOTC = foundPair.includes('OTC');
            return { pair: foundPair, isOTC: isOTC };
        },

        detectPayout: function () {
            const all = document.querySelectorAll('*');
            for (let i = 0; i < all.length; i++) {
                const el = all[i];
                if (el.children.length === 0 && el.textContent) {
                    const t = el.textContent.trim();
                    if (/^(\+)?(100|[1-9][0-9]?)%$/.test(t)) {
                        const num = parseInt(t.replace(/[^0-9]/g, ''), 10);
                        if (num >= 20 && num <= 100) {
                            const dec = num / 100;
                            const be = UTILS.safeDiv(1, (1 + dec), 0.5208);
                            return { percentage: num, breakEvenRate: parseFloat((be * 100).toFixed(2)), status: num + '% PAYOUT (BE: ' + (be * 100).toFixed(1) + '%)' };
                        }
                    }
                }
            }
            return { percentage: null, breakEvenRate: 52.08, status: 'PAYOUT UNKNOWN' };
        }
    };

    // =========================================================================
    // 5. CANDLE & ORDER-FLOW ENGINE
    // =========================================================================
    const CANDLE_ENGINE = {
        ingestTick: function (price, timestamp) {
            if (!price || isNaN(price)) return;
            const prev = STATE.lastTickPrice !== null ? STATE.lastTickPrice : price;
            const delta = price - prev;
            if (delta > 0) { STATE.upTicks++; STATE.cvdProxy++; }
            else if (delta < 0) { STATE.downTicks++; STATE.cvdProxy--; }

            STATE.lastTickPrice = price;
            STATE.feed.price = price;
            STATE.feed.timestamp = timestamp;
            STATE.feed.ticks++;

            const self = this;
            Object.keys(CONFIG.TIMEFRAMES).forEach(function (tf) {
                self.updateTF(tf, CONFIG.TIMEFRAMES[tf], price, timestamp);
            });
        },

        updateTF: function (tfKey, tfMs, price, timestamp) {
            const bucketStart = Math.floor(timestamp / tfMs) * tfMs;
            const history = STATE.candlesByTF[tfKey];
            if (!history) return;

            let current = history[history.length - 1];
            if (!current || current.time !== bucketStart) {
                if (current) {
                    current.isComplete = true;
                    this.finalizeGeometry(current);
                }
                const newBar = {
                    time: bucketStart,
                    open: price, high: price, low: price, close: price,
                    ticksCount: 1, isComplete: false, tfKey: tfKey
                };
                this.finalizeGeometry(newBar);
                history.push(newBar);
                if (history.length > CONFIG.MAX_BARS) history.shift();
            } else {
                if (price > current.high) current.high = price;
                if (price < current.low) current.low = price;
                current.close = price;
                current.ticksCount++;
                this.finalizeGeometry(current);
            }
        },

        finalizeGeometry: function (bar) {
            const range = Math.max(0.000001, bar.high - bar.low);
            const body = Math.abs(bar.close - bar.open);
            const uWick = Math.max(0, bar.high - Math.max(bar.open, bar.close));
            const lWick = Math.max(0, Math.min(bar.open, bar.close) - bar.low);

            bar.range = range;
            bar.body = body;
            bar.upperWick = uWick;
            bar.lowerWick = lWick;
            bar.isGreen = bar.close >= bar.open;

            bar.bodyPct = Math.round(UTILS.safeDiv(body, range) * 100);
            bar.upperWickPct = Math.round(UTILS.safeDiv(uWick, range) * 100);
            bar.lowerWickPct = Math.round(UTILS.safeDiv(lWick, range) * 100);

            const sum = bar.bodyPct + bar.upperWickPct + bar.lowerWickPct;
            if (sum > 100) {
                const f = 100 / sum;
                bar.bodyPct = Math.round(bar.bodyPct * f);
                bar.upperWickPct = Math.round(bar.upperWickPct * f);
                bar.lowerWickPct = Math.max(0, 100 - bar.bodyPct - bar.upperWickPct);
            }
        },

        reset: function (pair) {
            const self = this;
            Object.keys(CONFIG.TIMEFRAMES).forEach(function (tf) { STATE.candlesByTF[tf] = []; });
            STATE.cvdProxy = 0; STATE.upTicks = 0; STATE.downTicks = 0;
            STATE.lastTickPrice = null; STATE.feed.ticks = 0; STATE.feed.pair = pair;
        }
    };

    // =========================================================================
    // 6. TECHNICAL INDICATORS SUITE (STANDARD QUANT FORMULAS)
    // =========================================================================
    const INDICATORS = {
        calcEMA: function (candles, period) {
            if (!candles || candles.length < period) return null;
            const k = 2 / (period + 1);
            let ema = candles[0].close;
            for (let i = 1; i < candles.length; i++) ema = (candles[i].close * k) + (ema * (1 - k));
            return ema;
        },

        calcRSI: function (candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < 2) return 50.0;
            const p = Math.min(period, candles.length - 1);
            let gains = 0, losses = 0;
            for (let i = candles.length - p; i < candles.length; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                if (diff >= 0) gains += diff; else losses += Math.abs(diff);
            }
            if (losses === 0) return 90.0;
            if (gains === 0) return 10.0;
            const rs = gains / losses;
            return parseFloat((100 - (100 / (1 + rs))).toFixed(1));
        },

        calcBollinger: function (candles, period, mult) {
            if (period === undefined) period = 20;
            if (mult === undefined) mult = 2.0;
            if (!candles || candles.length < 2) return null;
            const p = Math.min(period, candles.length);
            const slice = candles.slice(-p);
            const closes = slice.map(function (c) { return c.close; });
            const mean = UTILS.mean(closes);
            const std = UTILS.stdDev(closes, mean);
            return { upper: mean + (mult * std), middle: mean, lower: mean - (mult * std) };
        },

        calcADX: function (candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < 3) return { adx: 25.0, plusDI: 25.0, minusDI: 25.0 };
            const p = Math.min(period, candles.length - 1);
            let plusDM = 0, minusDM = 0, trSum = 0;
            for (let i = candles.length - p; i < candles.length; i++) {
                const up = candles[i].high - candles[i - 1].high;
                const down = candles[i - 1].low - candles[i].low;
                if (up > down && up > 0) plusDM += up;
                if (down > up && down > 0) minusDM += down;
                trSum += candles[i].range;
            }
            if (trSum === 0) return { adx: 25.0, plusDI: 25.0, minusDI: 25.0 };
            const plusDI = (plusDM / trSum) * 100;
            const minusDI = (minusDM / trSum) * 100;
            const dx = (Math.abs(plusDI - minusDI) / ((plusDI + minusDI) || 1)) * 100;
            return { adx: parseFloat(dx.toFixed(1)), plusDI: parseFloat(plusDI.toFixed(1)), minusDI: parseFloat(minusDI.toFixed(1)) };
        },

        calcVWAP: function (candles) {
            if (!candles || candles.length === 0) return null;
            let tpv = 0, ticks = 0;
            for (let i = 0; i < candles.length; i++) {
                const c = candles[i];
                const tp = (c.high + c.low + c.close) / 3;
                const w = Math.max(1, c.ticksCount || 1);
                tpv += tp * w; ticks += w;
            }
            return ticks > 0 ? (tpv / ticks) : candles[candles.length - 1].close;
        }
    };

    // =========================================================================
    // 7. MULTI-FACTOR ENSEMBLE QUANT ENGINE
    // =========================================================================
    const QUANT_ENGINE = {
        evaluate: function (tfKey) {
            const candles = STATE.candlesByTF[tfKey];
            if (!candles || candles.length === 0) {
                return { direction: 'NO TRADE', score: 0, confidence: 0, quality: 0, confluence: 0, edge: 0, setup: 'FEED REQUIRED', tier: 'FORCED', reasons: [], risks: ['No ticks recorded'] };
            }

            const cur = candles[candles.length - 1];
            const rsi7 = INDICATORS.calcRSI(candles, 7);
            const bb = INDICATORS.calcBollinger(candles, 14, 2.0);
            const vwap = INDICATORS.calcVWAP(candles) || cur.close;
            const ema9 = INDICATORS.calcEMA(candles, 9);
            const ema21 = INDICATORS.calcEMA(candles, 21);

            let bullScore = 0;
            let bearScore = 0;
            const pros = [];
            const risks = [];

            // 1. Candlestick Anatomy & Reversal Math (Opposite Candle Predictor)
            if (cur.isGreen && cur.upperWickPct >= 35) {
                bearScore += 32; pros.push('Upper Rejection Wick (Shooting Star -> Next RED 🔴)');
            } else if (!cur.isGreen && cur.lowerWickPct >= 35) {
                bullScore += 32; pros.push('Lower Wick Defense (Hammer -> Next GREEN 🟢)');
            }

            // 2. Climax Mean-Reversion Flips
            if (rsi7 <= 18 || (bb && cur.close <= bb.lower)) {
                bullScore += 26; pros.push('Oversold Climax (RSI ' + rsi7 + ' -> Bounce Due 🟢)');
            } else if (rsi7 >= 82 || (bb && cur.close >= bb.upper)) {
                bearScore += 26; pros.push('Overbought Climax (RSI ' + rsi7 + ' -> Drop Due 🔴)');
            }

            // 3. CVD Delta & Micro-Order Flow
            if (STATE.cvdProxy >= 8) {
                if (!cur.isGreen) { bullScore += 24; pros.push('Positive CVD Absorption Trap (+ ' + STATE.cvdProxy + ')'); }
                else { bullScore += 16; pros.push('CVD Buyer Delta Surge'); }
            } else if (STATE.cvdProxy <= -8) {
                if (cur.isGreen) { bearScore += 24; pros.push('Negative CVD Absorption Trap (' + STATE.cvdProxy + ')'); }
                else { bearScore += 16; pros.push('CVD Seller Delta Dump'); }
            }

            // 4. Momentum & Uncontested Marubozu
            if (cur.isGreen && cur.bodyPct >= 65 && cur.upperWickPct <= 8) {
                bullScore += 22; pros.push('Bullish Solid Momentum Expansion');
            } else if (!cur.isGreen && cur.bodyPct >= 65 && cur.lowerWickPct <= 8) {
                bearScore += 22; pros.push('Bearish Solid Momentum Breakdown');
            }

            // 5. VWAP & Trend Structure
            if (cur.close >= vwap) bullScore += 10; else bearScore += 10;
            if (ema9 && ema21) {
                if (ema9 > ema21) bullScore += 12; else bearScore += 12;
            }

            bullScore = Math.min(100, bullScore);
            bearScore = Math.min(100, bearScore);
            const edge = Math.abs(bullScore - bearScore);
            const confluence = Math.round(((Math.max(bullScore, bearScore)) / 100) * 100);

            let direction = 'NO TRADE';
            let tier = 'C SETUP';
            let setup = 'BALANCED FLOW';

            if (bullScore > bearScore) {
                direction = 'CALL';
                setup = (cur.lowerWickPct >= 35 || !cur.isGreen) ? 'REVERSAL BOUNCE (PREDICT GREEN 🟢)' : 'MOMENTUM CALL 🟢';
            } else if (bearScore > bullScore) {
                direction = 'PUT';
                setup = (cur.upperWickPct >= 35 || cur.isGreen) ? 'REVERSAL DROP (PREDICT RED 🔴)' : 'MOMENTUM PUT 🔴';
            } else {
                direction = cur.upperWickPct >= cur.lowerWickPct ? 'PUT' : 'CALL';
                setup = 'PRESSURE LEAN';
                tier = 'FORCED';
            }

            if (edge >= 28 && confluence >= 78) tier = 'A+ SETUP';
            else if (edge >= 18 && confluence >= 68) tier = 'A SETUP';
            else if (edge >= 10) tier = 'B SETUP';

            if (STATE.settings.mode === 'SELECTIVE' && tier !== 'A+' && tier !== 'A') {
                direction = 'NO TRADE';
            } else if (STATE.settings.mode === 'BALANCED' && edge < 8) {
                direction = 'NO TRADE';
            }

            let confidence = Math.min(94, Math.max(65, confluence));
            let dataQuality = (STATE.feed.ticks > 25 && STATE.feed.quality === 'VALID') ? 98 : 82;

            return {
                direction: direction,
                score: Math.max(bullScore, bearScore),
                confidence: confidence,
                quality: dataQuality,
                confluence: confluence,
                edge: edge,
                setup: setup,
                tier: tier,
                reasons: pros.slice(0, 3),
                risks: risks.slice(0, 1)
            };
        }
    };

    // =========================================================================
    // 8. 8-SECOND DEEP SCANNER WITH SNAPSHOT TRAJECTORY
    // =========================================================================
    let isDeepScanning = false;

    function run8SecondDeepScan() {
        if (isDeepScanning) return;
        const btn = document.getElementById('v7-scan-btn');
        const pBar = document.getElementById('v7-progress');
        const pFill = document.getElementById('v7-progress-fill');
        const vBox = document.getElementById('v7-verdict-box');
        const vTxt = document.getElementById('v7-verdict-txt');
        const infoTxt = document.getElementById('v7-info-txt');
        const reasonTxt = document.getElementById('v7-reasons-txt');

        if (!STATE.feed.price) {
            vTxt.innerText = 'DATA NOT READY';
            vTxt.style.color = '#f43f5e';
            return;
        }

        isDeepScanning = true;
        btn.style.opacity = '0.5';
        btn.innerText = 'SAMPLING 8s MATRIX...';
        if (pBar) pBar.style.display = 'block';
        if (pFill) pFill.style.width = '0%';

        let step = 0;
        const totalSteps = 40; // 40 * 200ms = 8.0 Seconds Deep Matrix
        const snapshots = [];

        const interval = setInterval(function () {
            step++;
            if (pFill) pFill.style.width = Math.min(100, Math.round((step / totalSteps) * 100)) + '%';

            if (step % 10 === 0 || step === 1) {
                snapshots.push(QUANT_ENGINE.evaluate(STATE.settings.timeframe));
            }

            if (step >= totalSteps) {
                clearInterval(interval);
                isDeepScanning = false;
                btn.style.opacity = '1';
                btn.innerText = '⚡ DEEP SCAN (8.0s)';
                if (pBar) pBar.style.display = 'none';

                const finalResult = QUANT_ENGINE.evaluate(STATE.settings.timeframe);
                const trajectory = snapshots.length >= 2 ? (finalResult.score >= snapshots[0].score ? 'STRENGTHENING ⚡' : 'WEAKENING ⚠️') : 'STABLE';

                const now = new Date();
                const tfMs = CONFIG.TIMEFRAMES[STATE.settings.timeframe] || 60000;
                const secLeft = Math.max(1, (tfMs / 1000) - Math.floor((now.getTime() % tfMs) / 1000));
                const entryTime = new Date(now.getTime() + (secLeft * 1000));
                const clock = [
                    String(entryTime.getHours()).padStart(2, '0'),
                    String(entryTime.getMinutes()).padStart(2, '0'),
                    String(entryTime.getSeconds()).padStart(2, '0')
                ].join(':');

                if (finalResult.direction === 'CALL') {
                    vTxt.innerText = 'CALL (BUY) 🟢';
                    vTxt.style.color = '#10b981';
                    vBox.style.borderColor = '#10b981';
                    AUDIO.play('CALL');
                } else if (finalResult.direction === 'PUT') {
                    vTxt.innerText = 'PUT (SELL) 🔴';
                    vTxt.style.color = '#ef4444';
                    vBox.style.borderColor = '#ef4444';
                    AUDIO.play('PUT');
                } else {
                    vTxt.innerText = 'NO TRADE ⚪';
                    vTxt.style.color = '#94a3b8';
                    vBox.style.borderColor = '#475569';
                }

                infoTxt.innerText = 'CONF: ' + finalResult.confidence + '% | TIER: ' + finalResult.tier + ' | EDGE: +' + finalResult.edge;
                reasonTxt.innerHTML = 'Entry at <b>' + clock + '</b> (' + secLeft + 's left)<br><b style="color:#00f0ff;">' + finalResult.setup + '</b> [' + trajectory + ']<br>' +
                    (finalResult.reasons.length > 0 ? '<span style="color:#10b981;">+ ' + finalResult.reasons.join('<br>+ ') + '</span>' : '');

                STATE.lastSignal = finalResult;
            }
        }, 200);
    }

    // =========================================================================
    // 9. HIGH-DENSITY CYBER-PUNK MOBILE HUD
    // =========================================================================
    const HUD = {
        mounted: false,
        element: null,

        mount: function () {
            if (this.mounted && document.getElementById('po-v7-hud')) return;
            const root = document.createElement('div');
            root.id = 'po-v7-hud';
            root.style.cssText = [
                'position: fixed !important', 'top: 140px !important', 'left: 10px !important',
                'z-index: 2147483647 !important', 'width: 260px !important', 'max-width: 92vw !important',
                'background: rgba(3, 9, 24, 0.97) !important', 'border: 1.5px solid #00f0ff !important',
                'border-radius: 12px !important', 'padding: 8px !important', 'color: #fff !important',
                'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important',
                'box-shadow: 0 16px 50px rgba(0, 240, 255, 0.22) !important', 'user-select: none !important',
                'touch-action: none !important'
            ].join(';');

            try {
                const pos = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.HUD_POS));
                if (pos && pos.top && pos.left) {
                    root.style.top = Math.max(10, Math.min(window.innerHeight - 300, pos.top)) + 'px';
                    root.style.left = Math.max(5, Math.min(window.innerWidth - 265, pos.left)) + 'px';
                }
            } catch (e) {}

            root.innerHTML = [
                '<div id="v7-drag-bar" style="background: linear-gradient(90deg, #00f0ff, #0284c7); margin: -8px -8px 6px -8px; padding: 5px 8px; border-top-left-radius: 10px; border-top-right-radius: 10px; font-size: 10px; font-weight: 900; color: #000; display: flex; justify-content: space-between; align-items: center; cursor: move;">',
                '<span>⚡ APEX TITAN QUANT V7</span>',
                '<button id="v7-min-btn" style="background:rgba(0,0,0,0.3); border:none; color:#fff; border-radius:3px; font-size:8px; padding:2px 5px; cursor:pointer;">_</button>',
                '</div>',
                '<div id="v7-body">',
                '<div style="font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; margin-bottom: 4px;">',
                '<span>PAIR: <b id="v7-pair-txt" style="color:#00f0ff;">AUD/CHF OTC</b></span>',
                '<span>PRICE: <b id="v7-price-txt" style="color:#10b981;">--</b></span>',
                '</div>',
                '<div style="background: #061124; padding: 5px; border-radius: 6px; border: 1px solid #1e293b; font-size: 8px; margin-bottom: 4px;">',
                '<div style="display:flex; justify-content:space-between; color:#94a3b8;">',
                '<span>RSI: <b id="v7-rsi-val" style="color:#38bdf8;">--</b></span>',
                '<span>ADX: <b id="v7-adx-val" style="color:#facc15;">--</b></span>',
                '<span>CVD: <b id="v7-cvd-val" style="color:#10b981;">0</b></span>',
                '</div>',
                '<div style="display:flex; justify-content:space-between; margin-top:2px; color:#94a3b8;">',
                '<span>VWAP: <b id="v7-vwap-val" style="color:#00f0ff;">--</b></span>',
                '<span>BB: <b id="v7-bb-val" style="color:#38bdf8;">SYNCED</b></span>',
                '<span>MODE: <b id="v7-mode-val" style="color:#a855f7;">BALANCED</b></span>',
                '</div>',
                '</div>',
                '<div style="background: #08152e; padding: 4px 5px; border-radius: 6px; border: 1px solid #1e293b; font-size: 8px; color: #94a3b8; margin-bottom: 4px;">',
                '<div style="display:flex; justify-content:space-between;">',
                '<span>O: <b id="v7-c-open" style="color:#fff;">--</b></span>',
                '<span>H: <b id="v7-c-high" style="color:#10b981;">--</b></span>',
                '<span>L: <b id="v7-c-low" style="color:#ef4444;">--</b></span>',
                '</div>',
                '<div style="display:flex; justify-content:space-between; margin-top:2px;">',
                '<span>BODY: <b id="v7-c-body" style="color:#00f0ff;">0%</b></span>',
                '<span>U-WICK: <b id="v7-c-uwick" style="color:#facc15;">0%</b></span>',
                '<span>L-WICK: <b id="v7-c-lwick" style="color:#facc15;">0%</b></span>',
                '</div>',
                '</div>',
                '<div style="font-size: 8.5px; color: #94a3b8; display:flex; justify-content:space-between; margin-bottom: 4px;">',
                '<span>RADAR: <b id="v7-radar-txt" style="color:#00f0ff;">ACTIVE MATRIX</b></span>',
                '<span>TIMER: <b id="v7-timer-txt" style="color:#38bdf8;">--s</b></span>',
                '</div>',
                '<button id="v7-scan-btn" style="width: 100%; background: linear-gradient(135deg, #00f0ff, #0284c7); border: none; padding: 9px 4px; border-radius: 7px; color: #000; font-size: 11px; font-weight: 900; cursor: pointer; text-transform: uppercase; box-shadow: 0 4px 15px rgba(0,240,255,0.3);">',
                '⚡ DEEP SCAN (8.0s)',
                '</button>',
                '<div id="v7-progress" style="display:none; width: 100%; height: 4px; background: #1e293b; border-radius: 2px; margin-top: 5px; overflow: hidden;">',
                '<div id="v7-progress-fill" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f0ff, #10b981); transition: width 0.08s linear;"></div>',
                '</div>',
                '<div id="v7-verdict-box" style="margin-top: 6px; padding: 6px 4px; background: #061124; border-radius: 7px; text-align: center; border: 1px solid #1e293b;">',
                '<div style="font-size: 7.5px; color: #94a3b8; text-transform: uppercase;">Titan Next-Candle Verdict</div>',
                '<div id="v7-verdict-txt" style="font-size: 15px; font-weight: 900; color: #facc15; margin: 1px 0;">READY TO SCAN</div>',
                '<div id="v7-info-txt" style="font-size: 8px; color: #00f0ff; font-weight: bold;">Tap Scan in last 12s-4s</div>',
                '</div>',
                '<div id="v7-reasons-txt" style="font-size: 7.5px; color: #64748b; margin-top: 3px; text-align: center; line-height: 1.2;">',
                'Continuous 8-second multi-angle analysis',
                '</div>',
                '</div>'
            ].join('');

            document.body.appendChild(root);
            this.element = root;
            this.mounted = true;
            this.bindEvents();
        },

        bindEvents: function () {
            const self = this;
            const handle = document.getElementById('v7-drag-bar');
            let isDragging = false, startX, startY, initLeft, initTop;

            const onStart = function (e) {
                isDragging = true;
                const cX = e.touches ? e.touches[0].clientX : e.clientX;
                const cY = e.touches ? e.touches[0].clientY : e.clientY;
                startX = cX; startY = cY;
                const rect = self.element.getBoundingClientRect();
                initLeft = rect.left; initTop = rect.top;
            };

            const onMove = function (e) {
                if (!isDragging) return;
                if (e.cancelable) e.preventDefault();
                const cX = e.touches ? e.touches[0].clientX : e.clientX;
                const cY = e.touches ? e.touches[0].clientY : e.clientY;
                self.element.style.left = Math.max(5, Math.min(window.innerWidth - 265, initLeft + (cX - startX))) + 'px';
                self.element.style.top = Math.max(10, Math.min(window.innerHeight - 300, initTop + (cY - startY))) + 'px';
            };

            const onEnd = function () {
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

            document.getElementById('v7-min-btn').addEventListener('click', function () {
                STATE.hudMinimized = !STATE.hudMinimized;
                document.getElementById('v7-body').style.display = STATE.hudMinimized ? 'none' : 'block';
                document.getElementById('v7-min-btn').innerText = STATE.hudMinimized ? '+' : '_';
            });

            document.getElementById('v7-scan-btn').addEventListener('click', run8SecondDeepScan);
        },

        updateDisplay: function () {
            if (!this.mounted) return;
            const pEl = document.getElementById('v7-price-txt');
            const pairEl = document.getElementById('v7-pair-txt');
            const tEl = document.getElementById('v7-timer-txt');
            const rsiEl = document.getElementById('v7-rsi-val');
            const adxEl = document.getElementById('v7-adx-val');
            const cvdEl = document.getElementById('v7-cvd-val');
            const vwapEl = document.getElementById('v7-vwap-val');

            const cOpen = document.getElementById('v7-c-open');
            const cHigh = document.getElementById('v7-c-high');
            const cLow = document.getElementById('v7-c-low');
            const cBody = document.getElementById('v7-c-body');
            const cU = document.getElementById('v7-c-uwick');
            const cL = document.getElementById('v7-c-lwick');

            const dec = (STATE.feed.price && STATE.feed.price > 100) ? 3 : 5;
            if (pEl && STATE.feed.price) pEl.innerText = Number(STATE.feed.price).toFixed(dec);
            if (pairEl) pairEl.innerText = STATE.feed.pair;

            const tfMs = CONFIG.TIMEFRAMES[STATE.settings.timeframe] || 60000;
            const secRem = (tfMs / 1000) - (Math.floor(Date.now() / 1000) % (tfMs / 1000));
            if (tEl) tEl.innerText = secRem + 's';

            const history = STATE.candlesByTF[STATE.settings.timeframe];
            if (history && history.length > 0) {
                const cur = history[history.length - 1];
                if (cOpen) cOpen.innerText = Number(cur.open).toFixed(dec);
                if (cHigh) cHigh.innerText = Number(cur.high).toFixed(dec);
                if (cLow) cLow.innerText = Number(cur.low).toFixed(dec);
                if (cBody) cBody.innerText = cur.bodyPct + '%';
                if (cU) cU.innerText = cur.upperWickPct + '%';
                if (cL) cL.innerText = cur.lowerWickPct + '%';

                const rsi = INDICATORS.calcRSI(history, 7);
                const adx = INDICATORS.calcADX(history, 14);
                const vwap = INDICATORS.calcVWAP(history);

                if (rsiEl) rsiEl.innerText = rsi;
                if (adxEl) adxEl.innerText = adx.adx;
                if (cvdEl) cvdEl.innerText = STATE.cvdProxy > 0 ? '+' + STATE.cvdProxy : STATE.cvdProxy;
                if (vwapEl && vwap) vwapEl.innerText = Number(vwap).toFixed(dec);
            }
        }
    };

    // =========================================================================
    // 10. MAIN HEARTBEAT ENGINE LOOP
    // =========================================================================
    function engineHeartbeat() {
        try {
            HUD.mount();
            const pairInfo = DATA_FEED.detectPair();
            if (pairInfo.pair && pairInfo.pair !== STATE.feed.pair) {
                CANDLE_ENGINE.reset(pairInfo.pair);
                STATE.feed.pair = pairInfo.pair;
                STATE.feed.isOTC = pairInfo.isOTC;
            }

            const live = DATA_FEED.getLivePrice();
            const now = Date.now();

            if (live && live.price) {
                STATE.feed.connected = true;
                STATE.feed.source = live.source;
                STATE.feed.quality = (live.age > CONFIG.STALE_FEED_MS) ? 'STALE' : 'VALID';
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
