PROJECT: POCKET OPTION OTC V3 LIVE QUANT SIGNAL ENGINE
MASTER REPLACEMENT BUILD — INSTALLABLE USERSCRIPT
====================================================

MISSION
=======

Completely replace the old Pocket Option OTC V620 userscript with a
production-grade V3 LIVE OTC QUANT SIGNAL ENGINE.

The final deliverable MUST be a real, installable browser userscript,
NOT a markdown explanation, NOT pseudocode, NOT a demo, NOT simulated
market data, and NOT an HTML mockup.

The primary output MUST be:

    pocket-option-otc-v3.user.js

The first lines of the file MUST contain a valid userscript metadata
header so that Userscripts/Tampermonkey/Greasemonkey can detect it.

CRITICAL INSTALLATION REQUIREMENT
==================================

The generated file MUST be directly recognized as a userscript.

Use this exact style of metadata header:

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

IMPORTANT:

1. DO NOT put Markdown fences around the final userscript.
2. DO NOT put explanatory text before the metadata header.
3. The file extension MUST be .user.js.
4. Do not use ES module imports that can prevent Userscripts from loading.
5. Make the script self-contained.
6. Do not require npm.
7. Do not require a build step.
8. Do not require a backend merely to display the analysis HUD.
9. It must run directly after installation.
10. It must work on iPhone/Safari Userscripts as far as the userscript
    environment permits.
11. Avoid APIs unavailable in Safari iOS.
12. Do not create a Chrome-only Manifest V3 extension instead of a
    userscript.
13. Do not create multiple files for the core installation.
14. The final result must be ONE self-contained .user.js file.

====================================================
IMPORTANT SAFETY / TRADING MODE
====================================================

THIS IS A SIGNAL/ANALYSIS TOOL ONLY.

NEVER:

- automatically click CALL
- automatically click PUT
- automatically submit orders
- automatically place trades
- manipulate account balance
- access passwords
- collect credentials
- request Pocket Option login credentials
- scrape private account information
- bypass authentication
- bypass anti-bot systems
- exploit vulnerabilities
- guess undocumented private APIs
- inject orders into Pocket Option
- perform automatic trading

The user manually decides whether to act on any displayed signal.

====================================================
DO NOT DESTROY USEFUL OLD ARCHITECTURE
====================================================

The old V620 contained useful components.

Preserve and improve the useful concepts:

- live price reader
- canvas price reader
- DOM price reader
- pair detector
- candle engine
- minute rollover logic
- tick tracking
- candle OHLC
- body/wick geometry
- RSI
- Bollinger Bands
- ADX
- VWAP
- tick delta/CVD proxy
- climax/exhaustion detector
- scan button
- countdown timer
- touch-drag HUD
- audio alert
- signal display
- mobile-friendly UI

DO NOT blindly delete working functionality.

Replace weak logic with robust V3 architecture.

====================================================
DATA INTEGRITY — ABSOLUTE PRIORITY
====================================================

The most important rule:

NEVER invent market data.

NEVER generate:

- fake candles
- random ticks
- simulated prices
- placeholder OHLC
- fake RSI
- fake MACD
- fake confidence
- fake historical results
- fake win rate
- fake backtest results

If valid live Pocket Option chart data cannot be obtained:

DISPLAY:

    DATA NOT READY
    LIVE DATA REQUIRED

and signal must be:

    NO TRADE

Do not substitute fake values.

Every calculated indicator must contain a data-quality state:

VALID
WARMING_UP
STALE
INSUFFICIENT_DATA
INVALID

====================================================
V3 DATA ACQUISITION LAYER
====================================================

Implement a layered live-data architecture.

Priority:

1. Observable authorized page data
2. DOM price/chart data
3. Canvas-rendered chart values
4. Observable browser-side chart state where safely accessible
5. Observable WebSocket/message data ONLY when available through the
   page context without guessing undocumented endpoints
6. Fallback readers

Do NOT assume that an undocumented Pocket Option API exists.

Do NOT invent a WebSocket URL.

Do NOT scrape credentials.

Do NOT bypass authentication.

Create a unified:

LiveMarketFeed

interface internally:

{
    connected,
    pair,
    isOTC,
    timestamp,
    price,
    bid,
    ask,
    ticks,
    dataAgeMs,
    source,
    quality
}

Every tick must have timestamp and price.

Reject:

- duplicate timestamps
- impossible jumps
- stale ticks
- invalid prices
- wrong pair data
- mixed asset data

====================================================
POINT 1 — LIVE TICK ENGINE
====================================================

Capture every valid observable price update.

Track:

- timestamp
- price
- delta
- direction
- tick velocity
- tick acceleration
- up ticks
- down ticks
- tick imbalance
- price change
- short-term momentum

Do not confuse UI repaint events with new market ticks.

Deduplicate identical ticks.

====================================================
POINT 2 — MULTI-TIMEFRAME CANDLE ENGINE
====================================================

Build candles from validated live ticks.

Supported timeframes:

15 seconds
30 seconds
45 seconds
1 minute
2 minutes
3 minutes
4 minutes
5 minutes

Also provide:

ALL

The user can select the analysis timeframe.

Maintain independent candle histories.

Minimum warm-up:

- 15s: 100+ candles where available
- 30s: 100+
- 45s: 100+
- 1m: 100+
- 2m: 100+
- 3m: 100+
- 4m: 100+
- 5m: 100+

If insufficient:

NO TRADE.

====================================================
POINT 3 — COMPLETE OHLC / CANDLE GEOMETRY
====================================================

For every candle calculate:

Open
High
Low
Close
Range
Body
Body %
Upper wick
Lower wick
Upper wick %
Lower wick %
Bullish/bearish
Close position in range
Momentum
Expansion/compression

Detect:

Doji
Long-legged Doji
Dragonfly Doji
Gravestone Doji
Hammer
Inverted Hammer
Hanging Man
Shooting Star
Bullish Engulfing
Bearish Engulfing
Bullish Harami
Bearish Harami
Piercing Line
Dark Cloud Cover
Morning Star
Evening Star
Three White Soldiers
Three Black Crows
Inside Bar
Outside Bar
Marubozu
Pin Bar
Tweezer Top
Tweezer Bottom

Do NOT trade merely because a candle pattern exists.

Require contextual confirmation.

====================================================
POINT 4 — TREND ENGINE
====================================================

Classify:

Strong Bull Trend
Bull Trend
Weak Bull
Range
Weak Bear
Bear Trend
Strong Bear Trend

Use:

- EMA structure
- slope
- price location
- ADX
- swing highs/lows
- momentum
- volatility

Detect:

Higher High
Higher Low
Lower High
Lower Low
Break of Structure
Change of Character

====================================================
POINT 5 — EMA SYSTEM
====================================================

Calculate:

EMA 9
EMA 21
EMA 50
EMA 100
EMA 200

Analyze:

- crossovers
- separation
- compression
- slope
- alignment
- price position
- trend direction

Detect:

Bullish EMA stack
Bearish EMA stack
Mixed EMA structure
EMA compression
EMA expansion

====================================================
POINT 6 — RSI ENGINE
====================================================

Calculate:

RSI 7
RSI 14
RSI 21

Detect:

- overbought
- oversold
- RSI slope
- RSI acceleration
- bullish divergence
- bearish divergence
- failure swing
- centerline behavior

Do NOT use:

RSI < 30 = automatic CALL

or

RSI > 70 = automatic PUT

Extreme conditions may indicate trend continuation or exhaustion.

====================================================
POINT 7 — MACD ENGINE
====================================================

Calculate:

MACD 12/26/9

Track:

- MACD line
- signal line
- histogram
- histogram slope
- histogram acceleration
- zero-line
- bullish cross
- bearish cross
- divergence

====================================================
POINT 8 — STOCHASTIC ENGINE
====================================================

Calculate:

Stochastic %K
Stochastic %D

Detect:

- overbought
- oversold
- crossover
- slope
- momentum shift
- divergence

====================================================
POINT 9 — BOLLINGER ENGINE
====================================================

Calculate:

Bollinger 20,2
Bollinger 14,2

Track:

Upper
Middle
Lower
Bandwidth
Bandwidth slope
%B

Detect:

- squeeze
- expansion
- upper-band rejection
- lower-band rejection
- walking the band
- mean reversion
- volatility breakout

Never assume touching a band means reversal.

====================================================
POINT 10 — ATR / VOLATILITY ENGINE
====================================================

Calculate:

ATR 14
ATR percentage
short-term volatility
volatility expansion
volatility contraction

Detect:

- dead market
- normal market
- high volatility
- extreme volatility

Avoid signals during abnormal instability.

====================================================
POINT 11 — ADX / DMI ENGINE
====================================================

Calculate:

ADX 14
+DI
-DI

Classify:

Trend strength
Trend direction
Weak trend
Strong trend
Trend expansion
Trend exhaustion

====================================================
POINT 12 — VWAP ENGINE
====================================================

Calculate session/instrument VWAP from available valid ticks.

Track:

price vs VWAP
VWAP slope
distance from VWAP
reclaim
rejection
cross

Do not fabricate volume.

If actual volume is unavailable, label it:

VWAP FROM PRICE-TICK SAMPLE

not volume-based institutional VWAP.

====================================================
POINT 13 — MOMENTUM ENGINE
====================================================

Calculate:

ROC
short momentum
medium momentum
tick velocity
tick acceleration
candle acceleration

Detect:

momentum surge
momentum decay
momentum divergence
momentum reversal

====================================================
POINT 14 — SUPPORT / RESISTANCE
====================================================

Build dynamic levels using validated historical candles.

Detect:

- swing highs
- swing lows
- repeated rejection
- recent high
- recent low
- local support
- local resistance
- breakout
- failed breakout
- retest
- rejection

Cluster nearby levels instead of treating every candle high/low as a
separate level.

====================================================
POINT 15 — SUPPLY / DEMAND + LIQUIDITY STRUCTURE
====================================================

Identify probable:

Demand zones
Supply zones
Liquidity pools
Equal highs
Equal lows
Stop-run style spikes
False breakout
Breakout/retest
Rejection zones

These are statistical structures, NOT guaranteed institutional orders.

====================================================
POINT 16 — BREAKOUT / RETEST ENGINE
====================================================

Detect:

range breakout
trend breakout
volatility breakout
false breakout
breakout continuation
breakout retest
failed retest

Require confirmation before signal.

====================================================
POINT 17 — REVERSAL ENGINE
====================================================

Detect reversal candidates using combinations of:

- exhaustion
- wick rejection
- RSI divergence
- MACD divergence
- Bollinger extremes
- support/resistance
- momentum loss
- candle reversal
- structure break

Never reverse a strong trend using one indicator.

====================================================
POINT 18 — CLIMAX / EXHAUSTION ENGINE
====================================================

Preserve the V620 concept but remove hardcoded forced flips.

Detect:

Extreme buying climax
Extreme selling climax
Volatility climax
Momentum climax
Wick climax
Band extreme
RSI extreme

IMPORTANT:

An extreme does NOT automatically mean CALL or PUT.

It creates an exhaustion/reversal candidate.

Require confirmation.

====================================================
POINT 19 — TICK DELTA / CVD PROXY
====================================================

Where actual trade volume/CVD is unavailable, calculate only a clearly
labeled price-tick proxy:

upTicks
downTicks
tickDelta
delta acceleration

Label:

CVD PROXY

Never falsely label it as real exchange CVD.

====================================================
POINT 20 — MARKET REGIME ENGINE
====================================================

Classify the current regime:

TREND_UP
TREND_DOWN
RANGE
HIGH_VOLATILITY
LOW_VOLATILITY
BREAKOUT
REVERSAL_CANDIDATE
EXHAUSTION
UNCERTAIN

Use regime-specific strategies.

Example:

Trend regime:
favor continuation confirmation.

Range regime:
favor confirmed rejection/mean-reversion setups.

Breakout regime:
wait for confirmation/retest.

Uncertain:
NO TRADE.

====================================================
POINT 21 — MULTI-TIMEFRAME CONFLUENCE
====================================================

Analyze:

Higher timeframe
Selected timeframe
Entry timeframe

Example:

5m = market structure
1m = directional confirmation
15s/30s = entry timing

Do not require every timeframe to point identically.

Instead calculate:

HTF alignment
MTF alignment
LTF timing

If major timeframes strongly conflict:

NO TRADE.

====================================================
POINT 22 — CANDLE + INDICATOR CONFLUENCE
====================================================

Combine:

Trend
EMA
RSI
MACD
Stochastic
Bollinger
ATR
ADX
VWAP
Momentum
Support/resistance
Market structure
Candle pattern
Tick delta
Exhaustion
Multi-timeframe alignment

No single indicator may dominate the entire decision.

====================================================
POINT 23 — QUANT SCORE ENGINE
====================================================

Create independent:

BULL_SCORE
BEAR_SCORE

Use normalized weighted scoring.

Example architecture:

Trend            15
Market Structure 15
EMA              10
RSI              8
MACD             8
Stochastic       5
Bollinger        7
ADX/DMI          7
ATR/Volatility   5
VWAP             5
Momentum         5
S/R              5
Candle Pattern  5

Normalize to 0–100.

Do NOT simply add arbitrary points to produce fake confidence.

Signal quality must depend on:

score
score difference
data quality
regime
timeframe agreement
recent signal performance

====================================================
POINT 24 — SIGNAL DECISION ENGINE
====================================================

Possible outputs ONLY:

CALL
PUT
NO TRADE

Rules:

CALL only when bullish evidence exceeds minimum threshold.

PUT only when bearish evidence exceeds minimum threshold.

NO TRADE when:

- data stale
- insufficient history
- conflicting indicators
- conflicting timeframes
- extreme volatility
- weak edge
- poor payout
- late entry
- candle timing invalid
- feed quality invalid
- asset detection uncertain
- signal confidence unsupported
- recent performance below configured threshold

NEVER force CALL/PUT.

====================================================
POINT 25 — ENTRY TIMING + EXPIRY ENGINE
====================================================

The engine must analyze the current candle and determine whether the
signal should be generated for the NEXT candle.

Supported expiry choices:

15s
30s
45s
1m
2m
3m
4m
5m
ALL

The user can select:

AUTO
or a specific expiry.

For AUTO, select the expiry with the strongest validated historical
edge for the current regime/setup, but ONLY if sufficient historical
data exists.

Never randomly choose expiry.

Do not use future candle information.

STRICT NO-LOOKAHEAD:

The engine must never use the future candle close to calculate the
signal that supposedly predicted that candle.

Preferred scan window:

last 12 seconds to last 4 seconds of the current candle,

but only if the selected timeframe and feed timing make that valid.

Show:

CURRENT CANDLE
TIME REMAINING
NEXT CANDLE ENTRY
SELECTED EXPIRY
ENTRY TIMING QUALITY

====================================================
POINT 26 — PERFORMANCE / BACKTEST / JOURNAL / DIAGNOSTICS
====================================================

Implement a local signal journal.

For every signal store:

timestamp
pair
OTC/non-OTC
timeframe
expiry
entry price
signal
score
confidence band
regime
setup
indicator snapshot
data quality
payout
result
outcome
settlement price
duration

Never fabricate historical results.

Support:

win
loss
draw
expired/unknown

Calculate when enough REAL observations exist:

win rate
loss rate
draw rate
profit factor
maximum losing streak
maximum winning streak
drawdown
expectancy
sample size

Display:

INSUFFICIENT SAMPLE

until the sample is statistically meaningful.

====================================================
PAYOUT / EXPECTANCY FILTER
====================================================

Read the currently displayed payout when safely observable.

Do not hardcode 92%.

Calculate approximate break-even win rate:

breakEven = 1 / (1 + payoutDecimal)

Example:

92% payout => approximately 52.08% break-even.

The engine should display:

PAYOUT
BREAK-EVEN
EXPECTED EDGE
EV STATUS

If payout is unavailable:

PAYOUT UNKNOWN

Do not invent it.

Do not call a signal "high probability" merely because technical
indicators agree.

====================================================
ANTI-OVERFITTING
====================================================

The strategy must NOT be optimized to historical data and then falsely
presented as guaranteed.

Support:

in-sample
out-of-sample
walk-forward
regime-separated evaluation

Do not display a backtested percentage unless the underlying sample
actually exists.

====================================================
OTC-SPECIFIC ENGINE
====================================================

Clearly identify:

asset
OTC status
timeframe
feed source
data age

Treat OTC as its own statistical environment.

Do not mix:

normal market statistics

with

OTC statistics

without explicitly labeling the difference.

Maintain separate journal statistics for OTC.

If the current asset is not confidently identified as OTC:

OTC STATUS UNKNOWN
NO TRADE

====================================================
PAIR HANDLING
====================================================

Read the currently selected Pocket Option asset.

Examples may include:

AUD/CAD OTC
AUD/CHF OTC
EUR/USD OTC
GBP/USD OTC
USD/JPY OTC
etc.

DO NOT hardcode AUD/CHF OTC.

When pair changes:

flush incompatible live candle state.

Never mix two different pairs into one candle history.

Display:

PAIR
OTC STATUS
DATA SOURCE

====================================================
LIVE DATA DIAGNOSTICS
====================================================

Add a diagnostics panel showing:

Feed:
CONNECTED / DISCONNECTED

Source:
DOM / CANVAS / OBSERVABLE PAGE DATA / OTHER

Data:
LIVE / STALE / INVALID

Last tick:
X ms ago

Ticks:
count

Candle:
VALID / WARMING / INVALID

History:
X candles

Pair:
detected pair

OTC:
YES / NO / UNKNOWN

Indicator readiness:
READY / WARMING

Signal engine:
READY / NO TRADE

This is critical for debugging.

====================================================
NO FALSE CONFIDENCE
====================================================

Do NOT display:

96%
98%
99%
100%

unless the number is mathematically justified by a documented
calibration system and sufficient real data.

Instead use:

CONFIDENCE: LOW
CONFIDENCE: MEDIUM
CONFIDENCE: HIGH

and optionally:

MODEL SCORE: 0–100

Make it clear that MODEL SCORE is NOT probability.

====================================================
SIGNAL COOL-DOWN
====================================================

Prevent duplicate signals during the same setup.

Track:

lastSignalTime
lastSignalCandle
lastSignalDirection
lastSignalPair

Prevent repeated CALL/CALL/CALL spam.

Allow a new signal only when a new valid setup appears.

====================================================
RECENT SIGNAL PERFORMANCE
====================================================

Display a compact local performance section:

Last 10
Last 25
Last 50

Only display values when real journal observations exist.

Separate:

ALL OTC
CURRENT PAIR
CURRENT TIMEFRAME
CURRENT EXPIRY
CURRENT SETUP

Do not make a small sample look statistically reliable.

====================================================
USER INTERFACE
====================================================

The HUD must preserve the visual idea of the V620 but upgrade it.

Header:

⚡ PO OTC V3 QUANT ENGINE

Show:

PAIR
OTC
PRICE
DATA STATUS

Telemetry:

RSI
ADX
MACD
STOCH
ATR
VWAP
CVD PROXY
BB
EMA STATE

Candle geometry:

O
H
L
C
BODY
U-WICK
L-WICK

Market state:

TREND
REGIME
STRUCTURE
MOMENTUM
VOLATILITY

Signal section:

QUANT SCAN

Then:

CALL / PUT / NO TRADE

Show:

MODEL SCORE
CONFIDENCE BAND
SETUP
TIMEFRAME
EXPIRY
ENTRY TIME
PAYOUT
BREAK-EVEN
DATA QUALITY

If NO TRADE:

show the MAIN REASON.

Example:

NO TRADE
Weak confluence
HTF conflict
Wait for confirmation

====================================================
MOBILE UI
====================================================

Must be optimized for:

iPhone
Safari
Userscripts

Requirements:

- touch draggable
- no horizontal page overflow
- no tiny unusable controls
- large scan button
- readable text
- compact HUD
- does not cover critical trading controls unnecessarily
- safe z-index
- responsive width
- safe-area support
- prevent accidental page scrolling while dragging
- do not block normal Pocket Option interaction outside HUD

Provide:

MINIMIZE
MOVE
DIAGNOSTICS
SETTINGS

====================================================
AUDIO ALERTS
====================================================

Preserve optional audio alerts.

Audio must be disabled by default until the user interacts with the
page if required by browser policy.

Alert for:

CALL
PUT
NO TRADE state change only if configured
DATA LOST
DATA RESTORED

Never use repeated aggressive sounds.

====================================================
SETTINGS
====================================================

Add settings:

Timeframe:
AUTO / 15s / 30s / 45s / 1m / 2m / 3m / 4m / 5m

Expiry:
AUTO / 15s / 30s / 45s / 1m / 2m / 3m / 4m / 5m

Minimum model score:
configurable

Minimum confidence band:
configurable

Scan window:
configurable

Audio:
ON/OFF

HUD:
ON/OFF

Diagnostics:
ON/OFF

Journal:
ON/OFF

Persist settings with localStorage.

Never store passwords or authentication credentials.

====================================================
SIGNAL EXPLANATION
====================================================

Every CALL/PUT signal must explain WHY.

Example:

CALL
MODEL SCORE: 84
CONFIDENCE: HIGH

Reasons:
+ 5m trend bullish
+ EMA alignment bullish
+ MACD momentum rising
+ price above VWAP
+ bullish rejection at support
+ 1m structure confirmation

Risks:
- RSI elevated

ENTRY:
Next candle

EXPIRY:
1m

If evidence conflicts:

NO TRADE

Reason:
HTF bullish / LTF bearish conflict.

====================================================
CANDLE BOUNDARY PROTECTION
====================================================

The engine must accurately detect candle boundaries.

Never use:

new Date().getSeconds() % timeframe

as the only source of truth.

Use a timeframe-aware epoch calculation:

bucketStart =
Math.floor(timestamp / timeframeMs) * timeframeMs

Handle:

- minute changes
- multi-minute boundaries
- page sleep
- device clock drift
- delayed ticks
- duplicate ticks
- pair changes

====================================================
STALE DATA PROTECTION
====================================================

Define a configurable maximum data age.

If:

Date.now() - lastTickTimestamp > threshold

then:

DATA STALE
NO TRADE

When data resumes:

DATA RESTORED

Rebuild only from valid new data.

====================================================
MEMORY / PERFORMANCE
====================================================

The script runs on a mobile browser.

Do not scan the entire DOM every 100ms.

Use throttled observers.

Cache DOM references.

Use MutationObserver only where useful.

Limit history size.

Avoid memory leaks.

Clear intervals/listeners when necessary.

Do not create hundreds of timers.

Target smooth performance on iPhone.

====================================================
PRICE READER
====================================================

Implement multiple readers:

A. Canvas reader
B. DOM text reader
C. observable page-state reader if available

Do NOT blindly accept every decimal number on the page.

Reject:

balance
payout
percentage
timer
account numbers
UI labels
axis labels
unrelated numbers

Use:

location
font/color/context
position
update frequency
pair context
price continuity

to identify candidate live price values.

If uncertain:

PRICE SOURCE UNCERTAIN
NO TRADE

====================================================
SECURITY
====================================================

Never:

- request credentials
- read passwords
- store credentials
- send private data to external servers
- upload trading data externally
- collect account tokens
- bypass security
- access private APIs without authorization

Keep calculations local.

====================================================
NO AUTOMATIC TRADING
====================================================

The final userscript must NEVER click:

CALL
PUT
BUY
SELL

It only provides:

CALL
PUT
NO TRADE

The human manually decides.

====================================================
TESTING
====================================================

Before finishing, create internal self-tests for:

1. indicator calculations
2. candle construction
3. timeframe bucketing
4. duplicate tick rejection
5. stale feed detection
6. pair switching
7. OTC detection
8. signal scoring
9. no-lookahead protection
10. expiry calculation
11. payout/break-even calculation
12. journal recording
13. localStorage settings
14. HUD mounting
15. mobile touch dragging
16. data-quality guards
17. signal cooldown
18. extreme-climax protection

No test may use fake market data to make the live engine appear
connected.

Synthetic data may be used ONLY inside isolated unit tests and MUST
never reach the production signal path.

====================================================
V3 ARCHITECTURE
====================================================

Internally organize the code into modules/functions:

CONFIG
STATE
LIVE_FEED
PRICE_READER
PAIR_DETECTOR
TICK_ENGINE
CANDLE_ENGINE
TIMEFRAME_ENGINE
INDICATOR_ENGINE
PATTERN_ENGINE
TREND_ENGINE
STRUCTURE_ENGINE
VOLATILITY_ENGINE
MOMENTUM_ENGINE
S/R_ENGINE
LIQUIDITY_ENGINE
REGIME_ENGINE
MTF_ENGINE
CONFLUENCE_ENGINE
SCORE_ENGINE
SIGNAL_ENGINE
PAYOUT_ENGINE
JOURNAL_ENGINE
DIAGNOSTICS
HUD
SETTINGS
AUDIO
UTILITIES

Even though everything is contained in ONE .user.js file, keep the
architecture clearly separated internally.

====================================================
V3 SIGNAL PIPELINE
====================================================

The final pipeline must be:

LIVE PAGE
   ↓
LIVE DATA ACQUISITION
   ↓
DATA VALIDATION
   ↓
TICK ENGINE
   ↓
CANDLE ENGINE
   ↓
MULTI-TIMEFRAME ENGINE
   ↓
INDICATORS
   ↓
CANDLE PATTERNS
   ↓
TREND / STRUCTURE
   ↓
SUPPORT / RESISTANCE
   ↓
MOMENTUM / VOLATILITY
   ↓
REGIME
   ↓
MULTI-TIMEFRAME CONFLUENCE
   ↓
QUANT SCORING
   ↓
PAYOUT / EXPECTANCY FILTER
   ↓
NO-TRADE FILTER
   ↓
NEXT-CANDLE SIGNAL
   ↓
JOURNAL
   ↓
RESULT TRACKING

====================================================
CRITICAL SIGNAL RULE
====================================================

The engine must prefer:

NO TRADE

over

a weak CALL or weak PUT.

The objective is NOT maximum number of signals.

The objective is maximum quality of VALIDATED setups while avoiding
forced predictions.

====================================================
V620 CLIMAX LOGIC UPGRADE
====================================================

The old V620 had:

RSI extreme
Bollinger extreme
tick delta
wick ratios
climax detection

Preserve the concept but remove the dangerous hardcoded rule:

"RSI <= 18 means automatically BUY"

and:

"RSI >= 82 means automatically SELL"

Instead:

EXTREME CONDITION
→ EXHAUSTION CANDIDATE
→ REQUIRE STRUCTURE/CANDLE/MOMENTUM CONFIRMATION
→ THEN CALL/PUT
→ otherwise NO TRADE.

====================================================
EXACT OLD UI CONCEPT TO PRESERVE
====================================================

Keep a compact floating HUD similar to:

⚡ PO OTC V3 QUANT ENGINE

PAIR: AUD/CAD OTC
TICK: 1.05038

RSI: 50
ADX: 25
CVD: +1

VWAP: 1.05031
CLIMAX: NORMAL
BB: SYNCED

O:
H:
L:

BODY:
U-WICK:
L-WICK:

RADAR:
TIMER:

[ ⚡ QUANT SCAN ]

VERDICT:

NO TRADE / CALL / PUT

But upgrade it with the complete V3 information architecture.

====================================================
INSTALLATION COMPATIBILITY
====================================================

The final code MUST be compatible with:

Userscripts
Tampermonkey
Greasemonkey where supported

The metadata must remain at the very top.

The file MUST be:

pocket-option-otc-v3.user.js

Do not rename it to:

.html
.txt
.js.txt
.md

Do not put the userscript inside another HTML file.

====================================================
GITHUB REQUIREMENT
====================================================

The final output must be suitable for saving directly as:

pocket-option-otc-v3.user.js

in a GitHub repository.

Ensure the raw GitHub file begins immediately with:

// ==UserScript==

No text before it.

No markdown code fence.

No comments before the metadata header.

No JSON wrapper.

No HTML wrapper.

====================================================
FINAL RESPONSE TO THE CODING AGENT
====================================================

Do NOT merely describe what you would build.

Actually modify/create the project.

If the repository already contains the old userscript:

- replace the old production userscript
- preserve useful logic
- upgrade it to V3
- remove obsolete broken logic
- ensure the final file is syntactically valid
- ensure no missing variables
- ensure no undefined functions
- ensure no broken event handlers
- ensure no duplicate listeners
- ensure no duplicate HUDs
- ensure no duplicate intervals

Then run every available syntax/build/test check.

Final validation must confirm:

[PASS] Userscript metadata
[PASS] .user.js format
[PASS] Pocket Option @match rules
[PASS] document-start
[PASS] Live-data-only production path
[PASS] No fake market data
[PASS] No automatic trading
[PASS] Multi-timeframe candles
[PASS] Indicators
[PASS] Candle patterns
[PASS] Trend engine
[PASS] Structure engine
[PASS] S/R engine
[PASS] Momentum
[PASS] Volatility
[PASS] Regime
[PASS] MTF confluence
[PASS] Quant scoring
[PASS] Payout/EV filter
[PASS] NO TRADE protection
[PASS] Journal
[PASS] Diagnostics
[PASS] Mobile HUD
[PASS] Touch dragging
[PASS] Audio
[PASS] Settings
[PASS] Syntax check
[PASS] No-lookahead protection

MOST IMPORTANT:

Do not claim that the system is "100% winning", "guaranteed",
"exact", or "never loses".

Do not fabricate live feed availability.

If Pocket Option's observable page data is unavailable, the correct
result is:

LIVE DATA NOT AVAILABLE
NO TRADE

NOT a simulated signal.

====================================================
FINAL DELIVERABLE
====================================================

Create the complete production-ready:

pocket-option-otc-v3.user.js

with all functionality above implemented in one self-contained
installable userscript.

The final userscript must start directly with the userscript metadata
header and must be usable by a userscript manager without a compilation
step.
