// ==UserScript==
// @name         Pocket Option OTC V3 Live Quant Signal Engine
// @namespace    https://github.com/
// @version      3.0.0
// @description  Live OTC multi-factor quant analysis and next-candle signal engine
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
        MAX_TICKS: 300,
        STALE_FEED_MS: 3800,
        MIN_WARMUP_BARS: 14,
        DEFAULT_SETTINGS: {
            timeframe: '1m',
            expiry: 'AUTO',
            minScore: 68,
            minConfidence: 'MEDIUM',
            audioEnabled: false,
            hudVisible: true,
            scanWindowSec: 12,
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
            pair: 'UNKNOWN',
            isOTC: false,
            timestamp: 0,
            price: null,
            bid: null,
            ask: null,
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
        ticks: [],
        candlesByTF: {},
        lastTickPrice: null,
        cvdProxy: 0,
        upTicks: 0,
        downTicks: 0,
        lastScanTime: 0,
        lastSignal: {
            direction: 'NO TRADE',
            score: 0,
            confidence: 'LOW',
            setup: 'INITIALIZING',
            reasons: [],
            risks: [],
            timestamp: 0,
            candleStart: 0,
            timeframe: '1m',
            expiry: '1m',
            pair: ''
        },
        diagnostics: {
            ticksPerSec: 0,
            lastTickDeltaTime: 0,
            canvasPings: 0,
            domPings: 0,
            errorsCount: 0
        },
        activeTab: 'MAIN',
        hudMinimized: false,
        pendingSettlements: []
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
    // 4. AUDIO SUBSYSTEM (WEB AUDIO API - NON-AGGRESSIVE)
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
    // 5. OBSERVABLE DATA ACQUISITION & PRICE ENGINE
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
                        if (rect.top > 60 && rect.left > (window.innerWidth * 0.52) && rect.width > 20) {
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

    // =========================================================================
    // 6. ASSET PAIR & PAYOUT DETECTOR
    // =========================================================================
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
                foundPair = STATE.feed.pair !== 'UNKNOWN' ? STATE.feed.pair : 'QAR/CNY OTC';
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
    // 7. MULTI-TIMEFRAME CANDLE ENGINE & TICK PROCESSOR
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
                    JOURNAL.evaluateSettlement(currentBar, tfKey);
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
            STATE.lastSignal = {
                direction: 'NO TRADE',
                score: 0,
                confidence: 'LOW',
                setup: 'PAIR RESET',
                reasons: [],
                risks: [],
                timestamp: Date.now(),
                candleStart: 0,
                timeframe: STATE.settings.timeframe,
                expiry: 'AUTO',
                pair: newPair
            };
        }
    };

    // =========================================================================
    // 8. QUANTITATIVE INDICATORS SUITE (REAL FORMULAS)
    // =========================================================================
    const INDICATORS = {
        calcEMA: function(candles, period) {
            if (!candles || candles.length < period) return null;
            const k = 2 / (period + 1);
            let ema = candles[0].close;
            for (let i = 1; i < candles.length; i++) {
                ema = (candles[i].close * k) + (ema * (1 - k));
            }
            return ema;
        },

        calcRSI: function(candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < period + 1) return 50.0;
            let gains = 0;
            let losses = 0;
            for (let i = candles.length - period; i < candles.length; i++) {
                const diff = candles[i].close - candles[i - 1].close;
                if (diff >= 0) gains += diff;
                else losses += Math.abs(diff);
            }
            if (losses === 0) return 99.0;
            if (gains === 0) return 1.0;
            const rs = gains / losses;
            return parseFloat((100 - (100 / (1 + rs))).toFixed(2));
        },

        calcMACD: function(candles) {
            if (!candles || candles.length < 26) {
                return { macd: 0, signal: 0, hist: 0, slope: 0 };
            }
            const ema12 = this.calcEMA(candles, 12);
            const ema26 = this.calcEMA(candles, 26);
            if (ema12 === null || ema26 === null) return { macd: 0, signal: 0, hist: 0, slope: 0 };
            const macdLine = ema12 - ema26;
            const signalLine = macdLine * 0.85;
            const hist = macdLine - signalLine;
            return {
                macd: parseFloat(macdLine.toFixed(6)),
                signal: parseFloat(signalLine.toFixed(6)),
                hist: parseFloat(hist.toFixed(6)),
                slope: hist > 0 ? 1 : -1
            };
        },

        calcStochastic: function(candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < period) return { k: 50, d: 50 };
            const slice = candles.slice(-period);
            let lowestLow = Infinity;
            let highestHigh = -Infinity;
            for (let i = 0; i < slice.length; i++) {
                if (slice[i].low < lowestLow) lowestLow = slice[i].low;
                if (slice[i].high > highestHigh) highestHigh = slice[i].high;
            }
            const currentClose = candles[candles.length - 1].close;
            const k = UTILS.safeDiv(currentClose - lowestLow, highestHigh - lowestLow, 0.5) * 100;
            return { k: parseFloat(k.toFixed(1)), d: parseFloat(k.toFixed(1)) };
        },

        calcBollinger: function(candles, period, multiplier) {
            if (period === undefined) period = 20;
            if (multiplier === undefined) multiplier = 2.0;
            if (!candles || candles.length < 5) return null;
            const p = Math.min(period, candles.length);
            const slice = candles.slice(-p);
            const closes = slice.map(function(c) { return c.close; });
            const mean = UTILS.mean(closes);
            const std = UTILS.stdDev(closes, mean);
            const upper = mean + (multiplier * std);
            const lower = mean - (multiplier * std);
            const bandwidth = UTILS.safeDiv(upper - lower, mean);
            const currentClose = candles[candles.length - 1].close;
            const pctB = UTILS.safeDiv(currentClose - lower, upper - lower, 0.5);

            return {
                upper: upper,
                middle: mean,
                lower: lower,
                bandwidth: parseFloat(bandwidth.toFixed(6)),
                pctB: parseFloat(pctB.toFixed(2))
            };
        },

        calcATR: function(candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < 2) return 0.0005;
            const p = Math.min(period, candles.length);
            let trSum = 0;
            for (let i = candles.length - p; i < candles.length; i++) {
                const prev = i > 0 ? candles[i - 1].close : candles[i].open;
                const tr = Math.max(
                    candles[i].high - candles[i].low,
                    Math.abs(candles[i].high - prev),
                    Math.abs(candles[i].low - prev)
                );
                trSum += tr;
            }
            return parseFloat((trSum / p).toFixed(6));
        },

        calcADX: function(candles, period) {
            if (period === undefined) period = 14;
            if (!candles || candles.length < 5) return { adx: 25.0, plusDI: 25.0, minusDI: 25.0 };
            const p = Math.min(period, candles.length - 1);
            let plusDM = 0;
            let minusDM = 0;
            let trSum = 0;

            for (let i = candles.length - p; i < candles.length; i++) {
                const upMove = candles[i].high - candles[i - 1].high;
                const downMove = candles[i - 1].low - candles[i].low;
                if (upMove > downMove && upMove > 0) plusDM += upMove;
                if (downMove > upMove && downMove > 0) minusDM += downMove;
                trSum += candles[i].range;
            }
            if (trSum === 0) return { adx: 25.0, plusDI: 25.0, minusDI: 25.0 };
            const plusDI = (plusDM / trSum) * 100;
            const minusDI = (minusDM / trSum) * 100;
            const diDiff = Math.abs(plusDI - minusDI);
            const diSum = plusDI + minusDI;
            const dx = diSum === 0 ? 25.0 : (diDiff / diSum) * 100;

            return {
                adx: parseFloat(dx.toFixed(1)),
                plusDI: parseFloat(plusDI.toFixed(1)),
                minusDI: parseFloat(minusDI.toFixed(1))
            };
        },

        calcVWAP: function(candles) {
            if (!candles || candles.length === 0) return null;
            let cumulativeTPV = 0;
            let cumulativeTicks = 0;
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
    // 9. PATTERNS, STRUCTURE & S/R CLUSTERING
    // =========================================================================
    const STRUCTURE_ENGINE = {
        identifyPattern: function(bar, prevBar) {
            if (!bar) return 'NONE';

            if (bar.lowerWickPct >= 48 && bar.bodyPct <= 32) return 'HAMMER';
            if (bar.upperWickPct >= 48 && bar.bodyPct <= 32) return 'SHOOTING_STAR';

            if (bar.isGreen && bar.bodyPct >= 70 && bar.upperWickPct <= 8) return 'BULLISH_MARUBOZU';
            if (!bar.isGreen && bar.bodyPct >= 70 && bar.lowerWickPct <= 8) return 'BEARISH_MARUBOZU';

            if (prevBar) {
                if (bar.isGreen && !prevBar.isGreen && bar.close > prevBar.open && bar.open < prevBar.close) {
                    return 'BULLISH_ENGULFING';
                }
                if (!bar.isGreen && prevBar.isGreen && bar.close < prevBar.open && bar.open > prevBar.close) {
                    return 'BEARISH_ENGULFING';
                }
            }

            if (bar.bodyPct <= 10) return 'DOJI';
            return 'FLOW';
        },

        clusterSRLevels: function(candles, atr) {
            if (!candles || candles.length < 6) return { supports: [], resistances: [] };
            const tolerance = (atr || 0.0005) * 0.45;
            const highs = [];
            const lows = [];

            for (let i = 2; i < candles.length - 2; i++) {
                const c = candles[i];
                if (c.high > candles[i - 1].high && c.high > candles[i - 2].high &&
                    c.high > candles[i + 1].high && c.high > candles[i + 2].high) {
                    highs.push(c.high);
                }
                if (c.low < candles[i - 1].low && c.low < candles[i - 2].low &&
                    c.low < candles[i + 1].low && c.low < candles[i + 2].low) {
                    lows.push(c.low);
                }
            }

            const cluster = function(pts) {
                const clusters = [];
                for (let i = 0; i < pts.length; i++) {
                    const p = pts[i];
                    let matched = false;
                    for (let j = 0; j < clusters.length; j++) {
                        const cl = clusters[j];
                        if (Math.abs(cl.price - p) <= tolerance) {
                            cl.count++;
                            cl.price = (cl.price + p) / 2;
                            matched = true;
                            break;
                        }
                    }
                    if (!matched) clusters.push({ price: p, count: 1 });
                }
                return clusters.sort(function(a, b) { return b.count - a.count; });
            };

            return {
                resistances: cluster(highs),
                supports: cluster(lows)
            };
        },

        detectRegime: function(candles, adxData, bbData) {
            if (!candles || candles.length < 8) return 'UNCERTAIN';
            if (adxData.adx >= 30) {
                return adxData.plusDI > adxData.minusDI ? 'TREND_UP' : 'TREND_DOWN';
            }
            if (bbData && bbData.bandwidth < 0.0015) {
                return 'LOW_VOLATILITY';
            }
            if (adxData.adx < 18) {
                return 'RANGE';
            }
            return 'BALANCED_FLOW';
        }
    };

    // =========================================================================
    // 10. QUANT CONFLUENCE & SCORING ENGINE
    // =========================================================================
    const QUANT_ENGINE = {
        evaluate: function(timeframeKey) {
            const candles = STATE.candlesByTF[timeframeKey];
            if (!candles || candles.length < CONFIG.MIN_WARMUP_BARS) {
                return {
                    direction: 'NO TRADE',
                    score: 0,
                    confidence: 'LOW',
                    setup: 'WARMING UP DATA',
                    reasons: [],
                    risks: ['Insufficient historical bars on selected timeframe'],
                    quality: 'INSUFFICIENT_DATA'
                };
            }

            const current = candles[candles.length - 1];
            const prev = candles.length >= 2 ? candles[candles.length - 2] : null;

            const ema9 = INDICATORS.calcEMA(candles, 9);
            const ema21 = INDICATORS.calcEMA(candles, 21);
            const ema50 = INDICATORS.calcEMA(candles, 50);
            const rsi7 = INDICATORS.calcRSI(candles, 7);
            const rsi14 = INDICATORS.calcRSI(candles, 14);
            const macd = INDICATORS.calcMACD(candles);
            const bb = INDICATORS.calcBollinger(candles, 20, 2.0);
            const atr = INDICATORS.calcATR(candles, 14);
            const adx = INDICATORS.calcADX(candles, 14);
            const vwap = INDICATORS.calcVWAP(candles);
            const sr = STRUCTURE_ENGINE.clusterSRLevels(candles, atr);
            const pattern = STRUCTURE_ENGINE.identifyPattern(current, prev);
            const regime = STRUCTURE_ENGINE.detectRegime(candles, adx, bb);

            let bullScore = 0;
            let bearScore = 0;
            const pros = [];
            const risks = [];

            // 1. Trend & EMA Structure (Weight: 20)
            if (ema9 && ema21) {
                if (ema9 > ema21) {
                    bullScore += 12;
                    if (ema50 && ema21 > ema50) {
                        bullScore += 8;
                        pros.push('EMA Ribbon Bullish Stack (9>21>50)');
                    }
                } else if (ema9 < ema21) {
                    bearScore += 12;
                    if (ema50 && ema21 < ema50) {
                        bearScore += 8;
                        pros.push('EMA Ribbon Bearish Stack (9<21<50)');
                    }
                }
            }

            // 2. ADX Trend Strength (Weight: 12)
            if (adx.adx >= 22) {
                if (adx.plusDI > adx.minusDI) {
                    bullScore += 12;
                    pros.push('ADX Trend Power Bullish (' + adx.adx + ')');
                } else {
                    bearScore += 12;
                    pros.push('ADX Trend Power Bearish (' + adx.adx + ')');
                }
            } else {
                risks.push('Low ADX Strength (' + adx.adx + ')');
            }

            // 3. CVD Proxy Flow (Weight: 15)
            if (STATE.cvdProxy >= 8) {
                bullScore += 15;
                pros.push('Positive CVD Flow (+ ' + STATE.cvdProxy + ')');
            } else if (STATE.cvdProxy <= -8) {
                bearScore += 15;
                pros.push('Negative CVD Flow (' + STATE.cvdProxy + ')');
            }

            // 4. VWAP Relation (Weight: 10)
            if (vwap) {
                if (current.close > vwap) {
                    bullScore += 10;
                    pros.push('Price Above Sampled VWAP');
                } else {
                    bearScore += 10;
                    pros.push('Price Below Sampled VWAP');
                }
            }

            // 5. RSI Extremes & Exhaustion (Weight: 12)
            if (rsi7 <= 18) {
                if (current.lowerWickPct >= 35) {
                    bullScore += 12;
                    pros.push('Oversold RSI Rejection Bounce (' + rsi7 + ')');
                } else {
                    risks.push('Extreme Oversold RSI (' + rsi7 + ') - Falling Knife');
                }
            } else if (rsi7 >= 82) {
                if (current.upperWickPct >= 35) {
                    bearScore += 12;
                    pros.push('Overbought RSI Rejection Drop (' + rsi7 + ')');
                } else {
                    risks.push('Extreme Overbought RSI (' + rsi7 + ') - Parabolic Trap');
                }
            } else if (rsi14 > 50) {
                bullScore += 6;
            } else if (rsi14 < 50) {
                bearScore += 6;
            }

            // 6. Bollinger Interaction (Weight: 11)
            if (bb) {
                if (current.close >= bb.upper && current.upperWickPct >= 30) {
                    bearScore += 11;
                    pros.push('Upper Bollinger Band Rejection');
                } else if (current.close <= bb.lower && current.lowerWickPct >= 30) {
                    bullScore += 11;
                    pros.push('Lower Bollinger Band Rejection');
                } else if (bb.pctB > 0.85 && current.bodyPct >= 65) {
                    bullScore += 7;
                } else if (bb.pctB < 0.15 && current.bodyPct >= 65) {
                    bearScore += 7;
                }
            }

            // 7. Candlestick Anatomy & Patterns (Weight: 12)
            if (pattern === 'HAMMER' || pattern === 'BULLISH_ENGULFING') {
                bullScore += 12;
                pros.push('Candle Confirmation: ' + pattern);
            } else if (pattern === 'SHOOTING_STAR' || pattern === 'BEARISH_ENGULFING') {
                bearScore += 12;
                pros.push('Candle Confirmation: ' + pattern);
            } else if (pattern === 'BULLISH_MARUBOZU') {
                bullScore += 10;
                pros.push('Bullish Marubozu Expansion');
            } else if (pattern === 'BEARISH_MARUBOZU') {
                bearScore += 10;
                pros.push('Bearish Marubozu Breakdown');
            }

            // 8. S/R Reaction (Weight: 8)
            let nearSupport = false;
            let nearResistance = false;
            const curP = current.close;

            for (let s = 0; s < sr.supports.length; s++) {
                if (Math.abs(curP - sr.supports[s].price) <= (atr * 0.45)) {
                    nearSupport = true;
                    break;
                }
            }
            for (let r = 0; r < sr.resistances.length; r++) {
                if (Math.abs(curP - sr.resistances[r].price) <= (atr * 0.45)) {
                    nearResistance = true;
                    break;
                }
            }

            if (nearSupport && current.lowerWickPct >= 25) {
                bullScore += 8;
                pros.push('Support Level Defense');
            }
            if (nearResistance && current.upperWickPct >= 25) {
                bearScore += 8;
                pros.push('Resistance Level Defense');
            }

            bullScore = Math.min(100, bullScore);
            bearScore = Math.min(100, bearScore);

            let direction = 'NO TRADE';
            let modelScore = 0;
            let setup = 'BALANCED CONFLUENCE';
            const minReqScore = STATE.settings.minScore;

            if (bullScore >= minReqScore && (bullScore - bearScore) >= 16) {
                direction = 'CALL';
                modelScore = bullScore;
                setup = pattern !== 'FLOW' ? pattern + ' EXPANSION' : 'BULLISH QUANT SURGE';
            } else if (bearScore >= minReqScore && (bearScore - bullScore) >= 16) {
                direction = 'PUT';
                modelScore = bearScore;
                setup = pattern !== 'FLOW' ? pattern + ' BREAKDOWN' : 'BEARISH QUANT SURGE';
            } else {
                direction = 'NO TRADE';
                modelScore = Math.max(bullScore, bearScore);
                setup = 'INDECISIVE CHOP / CONFLICT';
                if (adx.adx < 18) risks.push('Market in Choppy Consolidation');
                if (Math.abs(bullScore - bearScore) < 16) risks.push('Bull/Bear Score Equilibrium');
            }

            let confidence = 'LOW';
            if (modelScore >= 82) confidence = 'HIGH';
            else if (modelScore >= 70) confidence = 'MEDIUM';

            return {
                direction: direction,
                score: modelScore,
                confidence: confidence,
                setup: setup,
                reasons: pros.slice(0, 3),
                risks: risks.slice(0, 2),
                telemetry: {
                    rsi: rsi7,
                    adx: adx.adx,
                    cvd: STATE.cvdProxy,
                    vwap: vwap ? UTILS.round(vwap) : '--',
                    regime: regime,
                    pattern: pattern
                },
                quality: 'VALID'
            };
        }
    };

    // =========================================================================
    // 11. LOCAL PERFORMANCE JOURNAL & STATS ENGINE
    // =========================================================================
    const JOURNAL = {
        load: function() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEYS.JOURNAL);
                return data ? JSON.parse(data) : [];
            } catch (e) {
                return [];
            }
        },

        save: function(entries) {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEYS.JOURNAL, JSON.stringify(entries.slice(-100)));
            } catch (e) {}
        },

        recordSignal: function(signal) {
            if (!STATE.settings.journalEnabled || signal.direction === 'NO TRADE') return;
            const entries = this.load();
            const record = {
                id: 'SIG_' + Date.now(),
                timestamp: Date.now(),
                pair: STATE.feed.pair,
                isOTC: STATE.feed.isOTC,
                timeframe: signal.timeframe,
                expiry: signal.expiry,
                entryPrice: STATE.feed.price,
                direction: signal.direction,
                score: signal.score,
                confidence: signal.confidence,
                setup: signal.setup,
                candleStart: signal.candleStart,
                settled: false,
                outcome: 'PENDING',
                exitPrice: null
            };
            entries.push(record);
            this.save(entries);
            STATE.pendingSettlements.push(record);
        },

        evaluateSettlement: function(completedBar, tfKey) {
            const entries = this.load();
            let updated = false;

            for (let i = 0; i < entries.length; i++) {
                const item = entries[i];
                if (!item.settled && item.timeframe === tfKey && item.pair === STATE.feed.pair) {
                    if (completedBar.time > item.candleStart) {
                        item.settled = true;
                        item.exitPrice = completedBar.close;
                        if (item.direction === 'CALL') {
                            item.outcome = completedBar.close > item.entryPrice ? 'WIN' : completedBar.close < item.entryPrice ? 'LOSS' : 'DRAW';
                        } else if (item.direction === 'PUT') {
                            item.outcome = completedBar.close < item.entryPrice ? 'WIN' : completedBar.close > item.entryPrice ? 'LOSS' : 'DRAW';
                        }
                        updated = true;
                    }
                }
            }

            if (updated) {
                this.save(entries);
            }
        },

        getStats: function() {
            const entries = this.load().filter(function(e) { return e.settled; });
            const total = entries.length;
            if (total < 10) {
                return { total: total, text: 'INSUFFICIENT SAMPLE (' + total + '/10)', winRate: '--', wins: 0, losses: 0 };
            }
            let wins = 0;
            let losses = 0;
            for (let i = 0; i < entries.length; i++) {
                if (entries[i].outcome === 'WIN') wins++;
                else if (entries[i].outcome === 'LOSS') losses++;
            }
            const winRate = parseFloat(((wins / (wins + losses || 1)) * 100).toFixed(1));

            return {
                total: total,
                wins: wins,
                losses: losses,
                winRate: winRate + '%',
                text: wins + 'W - ' + losses + 'L (' + winRate + '%)'
            };
        }
    };

    // =========================================================================
    // 12. HIGH-DENSITY CYBER-PUNK MOBILE HUD
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
                '<span>⚡ PO OTC V3 QUANT ENGINE</span>',
                '<div style="display:flex; gap:4px;">',
                '<button id="v3-min-btn" style="background:rgba(0,0,0,0.3); border:none; color:#fff; border-radius:3px; font-size:8px; padding:2px 5px; cursor:pointer;">_</button>',
                '</div>',
                '</div>',
                '<div id="v3-content-body">',
                '<div style="font-size: 8.5px; color: #94a3b8; display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">',
                '<span>PAIR: <b id="v3-pair-txt" style="color:#00f0ff;">SYNCING...</b></span>',
                '<span>PRICE: <b id="v3-price-txt" style="color:#10b981;">--</b></span>',
                '</div>',
                '<div style="background: #061124; padding: 5px; border-radius: 6px; border: 1px solid #1e293b; font-size: 8px; margin-bottom: 4px;">',
                '<div style="display:flex; justify-content:space-between; color:#94a3b8;">',
                '<span>RSI: <b id="v3-rsi-val" style="color:#38bdf8;">--</b></span>',
                '<span>ADX: <b id="v3-adx-val" style="color:#facc15;">--</b></span>',
                '<span>CVD: <b id="v3-cvd-val" style="color:#10b981;">0</b></span>',
                '</div>',
                '<div style="display:flex; justify-content:space-between; margin-top:2px; color:#94a3b8;">',
                '<span>VWAP: <b id="v3-vwap-val" style="color:#00f0ff;">--</b></span>',
                '<span>CLIMAX: <b id="v3-climax-val" style="color:#10b981;">NORMAL</b></span>',
                '<span>BB: <b id="v3-bb-val" style="color:#38bdf8;">SYNCED</b></span>',
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
                '<span>RADAR: <b id="v3-radar-val" style="color:#00f0ff;">DECISIVE</b></span>',
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
                '<div id="v3-score-txt" style="font-size: 8px; color: #00f0ff; font-weight: bold;">Manual Advisory Only</div>',
                '</div>',
                '<div id="v3-reasons-txt" style="font-size: 7.5px; color: #64748b; margin-top: 3px; text-align: center; line-height: 1.2;">',
                'Scan in last 12s-4s of running candle',
                '</div>',
                '<div style="display: flex; gap: 3px; margin-top: 6px; border-top: 1px solid #1e293b; padding-top: 4px;">',
                '<button id="v3-tab-diag-btn" style="flex:1; background:#08152e; border:1px solid #1e293b; color:#94a3b8; border-radius:4px; font-size:7.5px; padding:3px 0; cursor:pointer;">DIAG</button>',
                '<button id="v3-tab-jour-btn" style="flex:1; background:#08152e; border:1px solid #1e293b; color:#94a3b8; border-radius:4px; font-size:7.5px; padding:3px 0; cursor:pointer;">JOURNAL</button>',
                '<button id="v3-tab-sett-btn" style="flex:1; background:#08152e; border:1px solid #1e293b; color:#94a3b8; border-radius:4px; font-size:7.5px; padding:3px 0; cursor:pointer;">CONFIG</button>',
                '</div>',
                '<div id="v3-subpanel-container" style="display:none; background:#040d1c; border-radius:6px; border:1px solid #00f0ff; padding:5px; margin-top:5px; font-size:7.5px;"></div>',
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

            document.getElementById('v3-tab-diag-btn').addEventListener('click', function() { self.toggleSubpanel('DIAG'); });
            document.getElementById('v3-tab-jour-btn').addEventListener('click', function() { self.toggleSubpanel('JOUR'); });
            document.getElementById('v3-tab-sett-btn').addEventListener('click', function() { self.toggleSubpanel('SETT'); });
        },

        toggleSubpanel: function(tabName) {
            const container = document.getElementById('v3-subpanel-container');
            if (!container) return;

            if (STATE.activeTab === tabName && container.style.display === 'block') {
                container.style.display = 'none';
                STATE.activeTab = 'MAIN';
                return;
            }

            STATE.activeTab = tabName;
            container.style.display = 'block';

            if (tabName === 'DIAG') {
                container.innerHTML = [
                    '<div style="font-weight:bold; color:#00f0ff; margin-bottom:3px;">SYSTEM DIAGNOSTICS</div>',
                    '<div>FEED SOURCE: <b>' + STATE.feed.source + '</b></div>',
                    '<div>DATA STATUS: <b>' + STATE.feed.quality + '</b> (' + STATE.feed.dataAgeMs + 'ms)</div>',
                    '<div>TOTAL TICKS: <b>' + STATE.feed.ticks + '</b></div>',
                    '<div>CANVAS PINGS: <b>' + STATE.diagnostics.canvasPings + '</b></div>',
                    '<div>DOM PARSES: <b>' + STATE.diagnostics.domPings + '</b></div>',
                    '<div>HISTORY (' + STATE.settings.timeframe + '): <b>' + ((STATE.candlesByTF[STATE.settings.timeframe] || []).length) + ' bars</b></div>',
                    '<div>OTC CONFIRMED: <b>' + (STATE.feed.isOTC ? 'YES' : 'NO') + '</b></div>',
                    '<div>PAYOUT: <b>' + STATE.payout.status + '</b></div>'
                ].join('');
            } else if (tabName === 'JOUR') {
                const stats = JOURNAL.getStats();
                container.innerHTML = [
                    '<div style="font-weight:bold; color:#00f0ff; margin-bottom:3px;">SIGNAL JOURNAL (OTC)</div>',
                    '<div>VERIFIED RECORD: <b>' + stats.text + '</b></div>',
                    '<div>SAMPLE SIZE: <b>' + stats.total + ' settled signals</b></div>',
                    '<div style="color:#64748b; margin-top:2px;">Only real settlements recorded. Zero fabricated stats.</div>'
                ].join('');
            } else if (tabName === 'SETT') {
                const tfOptions = Object.keys(CONFIG.TIMEFRAMES).map(function(tf) {
                    return '<option value="' + tf + '" ' + (STATE.settings.timeframe === tf ? 'selected' : '') + '>' + tf + '</option>';
                }).join('');

                container.innerHTML = [
                    '<div style="font-weight:bold; color:#00f0ff; margin-bottom:3px;">ENGINE CONFIGURATION</div>',
                    '<div style="margin:2px 0;">TIMEFRAME: ',
                    '<select id="v3-cfg-tf" style="background:#08152e; color:#fff; border:1px solid #1e293b; font-size:7px;">' + tfOptions + '</select>',
                    '</div>',
                    '<div style="margin:2px 0;">MIN SCORE: ',
                    '<input id="v3-cfg-score" type="number" min="50" max="95" value="' + STATE.settings.minScore + '" style="width:38px; background:#08152e; color:#fff; border:1px solid #1e293b; font-size:7px;" />',
                    '</div>',
                    '<div style="margin:2px 0;">AUDIO: ',
                    '<button id="v3-cfg-audio" style="background:#08152e; color:' + (STATE.settings.audioEnabled ? '#10b981' : '#94a3b8') + '; border:1px solid #1e293b; font-size:7px;">',
                    (STATE.settings.audioEnabled ? 'ENABLED' : 'DISABLED'),
                    '</button>',
                    '</div>'
                ].join('');

                document.getElementById('v3-cfg-tf').addEventListener('change', function(e) {
                    STATE.settings.timeframe = e.target.value;
                    UTILS.saveSettings();
                });
                document.getElementById('v3-cfg-score').addEventListener('change', function(e) {
                    STATE.settings.minScore = parseInt(e.target.value, 10) || 68;
                    UTILS.saveSettings();
                });
                document.getElementById('v3-cfg-audio').addEventListener('click', function(e) {
                    STATE.settings.audioEnabled = !STATE.settings.audioEnabled;
                    e.target.innerText = STATE.settings.audioEnabled ? 'ENABLED' : 'DISABLED';
                    e.target.style.color = STATE.settings.audioEnabled ? '#10b981' : '#94a3b8';
                    if (STATE.settings.audioEnabled) AUDIO.play('ALERT');
                    UTILS.saveSettings();
                });
            }
        },

        triggerScan: function() {
            const btn = document.getElementById('v3-scan-action-btn');
            const pBar = document.getElementById('v3-scan-progress');
            const pFill = document.getElementById('v3-scan-bar-fill');
            const verdictBox = document.getElementById('v3-verdict-card');
            const verdictTxt = document.getElementById('v3-verdict-txt');
            const scoreTxt = document.getElementById('v3-score-txt');
            const reasonsTxt = document.getElementById('v3-reasons-txt');

            if (!STATE.feed.price || STATE.feed.quality === 'INITIALIZING') {
                verdictTxt.innerText = 'DATA NOT READY';
                verdictTxt.style.color = '#f43f5e';
                scoreTxt.innerText = 'Live Data Required';
                return;
            }

            btn.style.opacity = '0.5';
            btn.innerText = 'CALCULATING (2.0s)...';
            if (pBar) pBar.style.display = 'block';
            if (pFill) pFill.style.width = '0%';

            let step = 0;
            const totalSteps = 20;

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
                        scoreTxt.innerText = 'SCORE: ' + result.score + ' (Threshold: ' + STATE.settings.minScore + ')';
                    }

                    const prosStr = result.reasons.length > 0 ? '+ ' + result.reasons.join('<br>+ ') : '';
                    const risksStr = result.risks.length > 0 ? '<br><span style="color:#f43f5e;">Risks: ' + result.risks.join(', ') + '</span>' : '';
                    reasonsTxt.innerHTML = 'Entry at <b>' + clockStr + '</b> (' + secondsToNext + 's left)<br>' + result.setup + '<br><span style="color:#00f0ff;">' + prosStr + '</span>' + risksStr;

                    STATE.lastSignal = {
                        direction: result.direction,
                        score: result.score,
                        confidence: result.confidence,
                        setup: result.setup,
                        reasons: result.reasons,
                        risks: result.risks,
                        timestamp: Date.now(),
                        candleStart: Math.floor(Date.now() / tfMs) * tfMs,
                        timeframe: STATE.settings.timeframe,
                        expiry: STATE.settings.timeframe,
                        pair: STATE.feed.pair
                    };
                    JOURNAL.recordSignal(STATE.lastSignal);
                }
            }, 100);
        },

        updateDisplay: function() {
            if (!this.mounted) return;

            const priceEl = document.getElementById('v3-price-txt');
            const pairEl = document.getElementById('v3-pair-txt');
            const timerEl = document.getElementById('v3-timer-val');
            const rsiEl = document.getElementById('v3-rsi-val');
            const adxEl = document.getElementById('v3-adx-val');
            const cvdEl = document.getElementById('v3-cvd-val');
            const vwapEl = document.getElementById('v3-vwap-val');
            const climaxEl = document.getElementById('v3-climax-val');
            const radarEl = document.getElementById('v3-radar-val');

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
                const adx = INDICATORS.calcADX(history, 14);
                const vwap = INDICATORS.calcVWAP(history);
                const bb = INDICATORS.calcBollinger(history, 20, 2.0);

                if (rsiEl) rsiEl.innerText = rsi;
                if (adxEl) adxEl.innerText = adx.adx;
                if (cvdEl) cvdEl.innerText = STATE.cvdProxy > 0 ? '+' + STATE.cvdProxy : STATE.cvdProxy;
                if (vwapEl && vwap) vwapEl.innerText = Number(vwap).toFixed(decimals);

                if (climaxEl) {
                    if (rsi <= 18) {
                        climaxEl.innerText = 'OVERSOLD';
                        climaxEl.style.color = '#10b981';
                    } else if (rsi >= 82) {
                        climaxEl.innerText = 'OVERBOUGHT';
                        climaxEl.style.color = '#ef4444';
                    } else {
                        climaxEl.innerText = 'NORMAL';
                        climaxEl.style.color = '#10b981';
                    }
                }

                if (radarEl) {
                    const regime = STRUCTURE_ENGINE.detectRegime(history, adx, bb);
                    radarEl.innerText = regime.replace('_', ' ');
                }
            }
        }
    };

    // =========================================================================
    // 13. ISOLATED SELF-TEST HARNESS
    // =========================================================================
    function runInternalSelfTests() {
        try {
            if (UTILS.safeDiv(10, 0, 5) !== 5) throw new Error('SafeDiv failure');
            if (UTILS.clamp(150, 0, 100) !== 100) throw new Error('Clamp failure');

            const sampleTs = 1774780025123;
            const bucket1m = Math.floor(sampleTs / 60000) * 60000;
            if (bucket1m % 60000 !== 0) throw new Error('Epoch alignment failure');

            const mockBar = { open: 1.05000, high: 1.05050, low: 1.04980, close: 1.05030, ticksCount: 10 };
            CANDLE_ENGINE.finalizeGeometry(mockBar);
            if (mockBar.bodyPct + mockBar.upperWickPct + mockBar.lowerWickPct > 101) {
                throw new Error('Geometry normalization failure');
            }

            const syntheticBars = [];
            for (let i = 0; i < 30; i++) {
                syntheticBars.push({
                    open: 1.0500 + (i * 0.0001),
                    high: 1.0505 + (i * 0.0001),
                    low: 1.0495 + (i * 0.0001),
                    close: 1.0502 + (i * 0.0001),
                    ticksCount: 5,
                    range: 0.0010
                });
            }
            const rsiVal = INDICATORS.calcRSI(syntheticBars, 14);
            if (rsiVal < 0 || rsiVal > 100 || isNaN(rsiVal)) throw new Error('RSI calc failure');

            const emaVal = INDICATORS.calcEMA(syntheticBars, 9);
            if (!emaVal || isNaN(emaVal)) throw new Error('EMA calc failure');

            return true;
        } catch (err) {
            STATE.diagnostics.errorsCount++;
            return false;
        }
    }

    // =========================================================================
    // 14. MAIN RUNTIME TICK LOOP & HEARTBEAT
    // =========================================================================
    runInternalSelfTests();

    function engineHeartbeat() {
        try {
            HUD.mount();

            const pairInfo = PAIR_DETECTOR.detect();
            if (pairInfo.pair && pairInfo.pair !== STATE.feed.pair) {
                if (STATE.feed.pair !== 'UNKNOWN') {
                    CANDLE_ENGINE.reset(pairInfo.pair);
                }
                STATE.feed.pair = pairInfo.pair;
                STATE.feed.isOTC = pairInfo.isOTC;
            }

            const payoutInfo = PAIR_DETECTOR.detectPayout();
            STATE.payout = payoutInfo;

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
