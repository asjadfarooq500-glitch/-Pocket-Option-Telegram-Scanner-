PROJECT: Pocket Option OTC — V3 LIVE QUANT SIGNAL ENGINE
=========================================================

MISSION
=======

Completely upgrade the existing Pocket Option OTC signal analyzer into a production-grade V3 Live OTC Quant Analysis Engine.

The existing project contains previous V1/V1.2/V1.5/V1.7/V1.9/V2.1 architecture, including:
- CandleEngine
- indicator engine
- provider layer
- PocketOptionPublicFeedAdapter
- DemoFeedConnector
- data guards
- diagnostics
- signal routes
- tests
- existing UI

DO NOT blindly destroy working architecture.

First inspect the entire repository and understand the existing implementation.

Then replace obsolete/demo-only logic where required and build V3 around a clean modular architecture.

The final application must NOT generate random, fake, synthetic, fabricated, placeholder, guessed, or simulated market data.

If real authorized Pocket Option OTC market data is not connected:
- show NOT CONFIGURED / LIVE FEED REQUIRED
- do NOT manufacture candles
- do NOT manufacture RSI/ADX/CVD/VWAP values
- do NOT manufacture signals
- return NO TRADE / DATA UNAVAILABLE

The system must be honest about data availability.

=========================================================
1. CORE OBJECTIVE
=========================================================

Build a highly selective Pocket Option OTC market-analysis system capable of:

LIVE DATA
→ TICK PROCESSING
→ CANDLE GENERATION
→ MULTI-TIMEFRAME ANALYSIS
→ MARKET STRUCTURE
→ CANDLE PATTERN ANALYSIS
→ TECHNICAL INDICATORS
→ MOMENTUM
→ VOLATILITY
→ SUPPORT/RESISTANCE
→ SUPPLY/DEMAND
→ LIQUIDITY
→ BREAKOUT/RETEST
→ REVERSAL/EXHAUSTION
→ DIVERGENCE
→ MARKET REGIME
→ OTC PAIR BEHAVIOR
→ STRATEGY ENGINE
→ HISTORICAL VALIDATION
→ PAYOUT / EXPECTED VALUE FILTER
→ MULTI-CONFIRMATION SCORE
→ FINAL ENTRY-TIMING ENGINE
→ CALL / PUT / NO TRADE

The engine must prioritize signal quality over signal quantity.

NO TRADE is a valid and preferred result when evidence is insufficient.

Never force a signal.

=========================================================
2. LIVE POCKET OPTION DATA LAYER
=========================================================

Create a clean provider abstraction:

LiveMarketDataProvider
PocketOptionLiveFeedAdapter
DemoFeedAdapter
ReplayFeedAdapter
BacktestFeedAdapter

The production signal engine must consume normalized market data through the provider interface.

Do NOT:
- scrape private pages
- guess undocumented endpoints
- bypass authentication
- collect passwords
- collect account credentials
- use browser session cookies as a hidden authentication mechanism
- reverse engineer private endpoints
- place trades automatically
- bypass Pocket Option security

Only use an authorized/public/legitimate market-data interface.

If no authorized live OTC feed is available, the application must clearly display:

LIVE FEED:
NOT CONFIGURED

STATUS:
SAFE MANUAL / OFFLINE MODE

and prevent fake signal generation.

=========================================================
3. RAW TICK ENGINE
=========================================================

Implement:

Tick {
  symbol
  assetType
  timestamp
  price
  source
  sequence
  receivedAt
}

Features:
- timestamp normalization
- duplicate tick detection
- out-of-order tick detection
- stale tick detection
- missing tick detection
- feed latency measurement
- clock synchronization
- reconnect handling
- disconnect detection
- tick sequencing
- source validation

Never fabricate missing ticks.

=========================================================
4. CANDLE ENGINE
=========================================================

Build reliable candle aggregation from actual tick data.

Supported timeframes:

15 seconds
30 seconds
1 minute
2 minutes
3 minutes
5 minutes
10 minutes
15 minutes
30 minutes
1 hour

Only expose timeframes actually supported by the underlying data.

Every candle must contain:

open
high
low
close
timestamp
openTime
closeTime
body
bodyPercent
upperWick
lowerWick
upperWickPercent
lowerWickPercent
range
trueRange
direction
closeLocationValue
tickCount
relativeRange
isComplete

Never treat an incomplete candle as a completed candle.

Use strict candle-boundary finalization.

=========================================================
5. HISTORICAL BUFFER
=========================================================

Maintain sufficient historical candles.

Target:
minimum 500 candles per timeframe/pair where available.

Preferred:
1000–2000 candles where memory/data availability permits.

Use efficient ring buffers.

Do not invent historical candles.

If insufficient history:
INSUFFICIENT_HISTORY
→ NO TRADE

=========================================================
6. COMPLETE CANDLE INTELLIGENCE
=========================================================

Detect:

Doji
Long-Legged Doji
Dragonfly Doji
Gravestone Doji
Hammer
Inverted Hammer
Hanging Man
Shooting Star
Marubozu
Spinning Top
Bullish Engulfing
Bearish Engulfing
Piercing Line
Dark Cloud Cover
Harami
Harami Cross
Tweezer Top
Tweezer Bottom
Morning Star
Evening Star
Three White Soldiers
Three Black Crows
Inside Bar
Outside Bar
Pin Bar
Rejection Candle
Expansion Candle
Compression Candle
Exhaustion Candle
Momentum Candle
Failed Breakout Candle

Also calculate candle anatomy continuously:

body/range ratio
wick/body ratio
close location
direction
relative size
range expansion
range contraction
successive candle pressure
candle sequence

IMPORTANT:
A candle pattern alone must NEVER generate a signal.

Every pattern must be validated against:
- trend
- structure
- location
- momentum
- volatility
- support/resistance
- timeframe alignment
- historical performance

=========================================================
7. MARKET STRUCTURE ENGINE
=========================================================

Detect:

Higher High
Higher Low
Lower High
Lower Low

Uptrend
Downtrend
Sideways
Range
Consolidation
Compression
Expansion
Breakout
False Breakout
Retest
Continuation
Reversal
Exhaustion

Implement:

BOS = Break of Structure
CHOCH = Change of Character

Detect:
- liquidity sweeps
- swing failures
- breakout failures
- rejection zones
- trend continuation
- trend exhaustion

Structure must be calculated from actual price data.

=========================================================
8. MULTI-TIMEFRAME ENGINE
=========================================================

Analyze multiple timeframes simultaneously.

Default hierarchy:

15M = macro context
5M  = structure
3M  = intermediate momentum
1M  = primary signal timeframe
30S = micro confirmation
15S = optional entry timing

Do not blindly require all timeframes to agree.

Classify:

STRONG ALIGNMENT
MODERATE ALIGNMENT
PULLBACK
COUNTER-TREND
CONFLICT
UNKNOWN

Example:

15M bullish
5M bullish
3M bullish
1M bullish

→ strong bullish alignment

But:

15M bullish
5M bearish
1M bullish

must be classified intelligently as possible pullback/structure conflict.

If MTF conflict cannot be resolved:
NO TRADE.

=========================================================
9. TECHNICAL INDICATOR ENGINE
=========================================================

Implement:

TREND:
EMA 5
EMA 9
EMA 13
EMA 21
EMA 34
EMA 50
EMA 100
EMA 200
SMA 20
SMA 50
SMA 200
VWAP

MOMENTUM:
RSI 7
RSI 14
RSI 21
MACD
Stochastic
Stochastic RSI
CCI
ROC
Momentum

VOLATILITY:
ATR
Bollinger Bands
Bollinger Band Width
Keltner Channel
Standard Deviation

TREND STRENGTH:
ADX
+DI
-DI

All indicators must be mathematically calculated from actual candles.

No hardcoded values.

No random values.

If required data is unavailable:
value = null / unavailable
not fake.

=========================================================
10. SUPPORT / RESISTANCE ENGINE
=========================================================

Automatically identify:

swing highs
swing lows
local support
local resistance
previous highs
previous lows
dynamic EMA zones
VWAP
Bollinger boundaries
psychological price levels
breakout levels
retest levels
supply zones
demand zones
liquidity zones

Calculate:
distance from current price
strength
number of touches
recent rejection
breakout history
retest confirmation

=========================================================
11. PRICE ACTION ENGINE
=========================================================

Detect:

support rejection
resistance rejection
breakout
false breakout
breakout + retest
range rejection
trend continuation
trend pullback
momentum continuation
exhaustion
liquidity sweep
failed continuation

Price action must be combined with structure.

=========================================================
12. DIVERGENCE ENGINE
=========================================================

Detect:

Regular bullish divergence
Regular bearish divergence
Hidden bullish divergence
Hidden bearish divergence

Using:

RSI
MACD
Stochastic
Momentum
CVD if genuine data exists

Example:

Price lower low
RSI higher low

→ bullish divergence

Price higher high
RSI lower high

→ bearish divergence

Divergence alone must never create a trade.

=========================================================
13. VOLUME / TICK FLOW ENGINE
=========================================================

Only if genuine volume/tick-flow data exists.

Support:

tick volume
volume spike
volume acceleration
volume contraction
volume imbalance
CVD
delta
VWAP deviation

If genuine CVD is unavailable:

CVD = N/A

NEVER show fake:
CVD +1
CVD -1

Do not create synthetic volume.

=========================================================
14. MARKET REGIME ENGINE
=========================================================

Classify current market as:

TRENDING_UP
TRENDING_DOWN
RANGING
CONSOLIDATING
BREAKOUT
HIGH_VOLATILITY
LOW_VOLATILITY
EXHAUSTION
REVERSAL
UNCERTAIN

Use:

ADX
ATR
EMA structure
price structure
Bollinger width
range behavior
momentum
candle expansion/contraction

Strategy selection must depend on market regime.

=========================================================
15. STRATEGY LIBRARY
=========================================================

Implement modular strategies.

TREND:
- EMA trend
- EMA pullback
- EMA continuation
- VWAP trend
- ADX trend
- MACD continuation

REVERSAL:
- RSI divergence
- MACD divergence
- support rejection
- resistance rejection
- exhaustion
- wick rejection
- double top
- double bottom

BREAKOUT:
- range breakout
- breakout + retest
- momentum breakout
- false breakout

MEAN REVERSION:
- Bollinger reversal
- RSI extreme
- VWAP mean reversion
- range high rejection
- range low rejection

PRICE ACTION:
- engulfing
- pin bar
- inside bar
- outside bar
- morning star
- evening star
- tweezer
- rejection candles

MICROSTRUCTURE:
- tick acceleration
- tick deceleration
- candle velocity
- wick expansion
- body expansion
- compression → expansion
- momentum exhaustion

=========================================================
16. STRATEGY AUTO SELECTOR
=========================================================

Never run every strategy blindly.

Based on market regime:

TRENDING:
favor trend continuation/pullback strategies.

RANGING:
favor support/resistance/rejection/mean-reversion strategies.

BREAKOUT:
favor breakout/retest strategies.

EXHAUSTION:
favor reversal confirmation.

HIGH VOLATILITY:
increase confirmation requirements.

UNCERTAIN:
NO TRADE.

=========================================================
17. OTC PAIR BEHAVIOR ENGINE
=========================================================

Each OTC pair must have its own statistics.

Example:

AUD/CAD OTC
EUR/USD OTC
GBP/JPY OTC
USD/JPY OTC
EUR/GBP OTC
etc.

For each pair store:

historical setups
wins
losses
win rate
average payout
strategy performance
timeframe performance
expiry performance
market-regime performance
consecutive losses
consecutive wins
recent performance
sample size

NEVER fabricate these statistics.

Only display statistics when actual stored data supports them.

=========================================================
18. PAIR SCANNER
=========================================================

Implement:

SCAN ALL OTC

The scanner should inspect available OTC pairs and calculate a model score.

Example UI:

OTC MARKET SCANNER

AUD/CAD OTC     86/100
EUR/USD OTC     82/100
GBP/JPY OTC     77/100
USD/JPY OTC     63/100

These are MODEL SCORES, not guaranteed probabilities.

Do not label a pair as guaranteed winner.

=========================================================
19. PAYOUT ENGINE
=========================================================

Read actual payout where available.

Calculate break-even win rate:

requiredWinRate = 1 / (1 + payoutDecimal)

Example:

92% payout:
break-even ≈ 52.08%

84% payout:
break-even ≈ 54.35%

80% payout:
break-even ≈ 55.56%

Calculate expected value only when enough validated historical information exists.

If payout is too low relative to validated edge:
NO TRADE.

Never fabricate payout.

=========================================================
20. QUANT SCORING ENGINE
=========================================================

Create a multi-factor score.

Initial weighting:

Market Structure      20%
Trend                  15%
Price Action           15%
Momentum               10%
Volatility             10%
Support/Resistance     10%
Multi-Timeframe        10%
Historical Validation   5%
Payout/EV               5%

Allow these weights to be configuration-driven.

Do NOT blindly optimize weights using the same dataset used for evaluation.

Score range:

0–59   NO TRADE
60–69  WEAK / WATCH
70–79  QUALIFIED WATCH
80–89  VALID SETUP
90–100 EXTREME CONFIRMATION

Important:
The score is NOT a guaranteed probability.

Display:
MODEL SCORE: 87/100

NOT:
87% GUARANTEED WIN

=========================================================
21. CONFIDENCE CALIBRATION
=========================================================

If the system displays probability/confidence, it must be calibrated from out-of-sample historical results.

Never convert a raw score directly into fake probability.

If calibration is unavailable:
show MODEL SCORE only.

=========================================================
22. ENTRY TIMING ENGINE
=========================================================

For M1:

60s → candle begins
30–15s → structure/momentum observation
12–4s → final confirmation window
4–0s → entry decision
next candle → signal direction

But DO NOT force a signal simply because timer reached 12 seconds.

Signal requires confirmation.

If setup is not confirmed:
NO TRADE.

The entry window must be configurable by timeframe.

=========================================================
23. MICRO TICK CONFIRMATION
=========================================================

Use actual incoming ticks to calculate:

micro momentum
price velocity
price acceleration
direction persistence
reversal pressure
tick clustering
micro trend
micro exhaustion

At final confirmation:

check whether micro movement agrees with higher-timeframe structure.

If microstructure contradicts setup:
NO TRADE.

=========================================================
24. SIGNAL ENGINE
=========================================================

Final signal types:

CALL
PUT
NO TRADE

Never output both CALL and PUT simultaneously.

Example:

PAIR:
AUD/CAD OTC

TIMEFRAME:
M1

EXPIRY:
1 MIN

MODEL SCORE:
87/100

TREND:
BULLISH

STRUCTURE:
BULLISH

MOMENTUM:
STRONG

CANDLE:
BULLISH ENGULFING

S/R:
SUPPORT REJECTION

MTF:
4/5 ALIGNED

PAYOUT:
92%

SIGNAL:
CALL

ENTRY:
FINAL CONFIRMATION WINDOW

If any critical condition fails:

SIGNAL:
NO TRADE

=========================================================
25. NO TRADE ENGINE
=========================================================

NO TRADE conditions include:

trend conflict
structure conflict
weak momentum
bad candle location
poor support/resistance location
low payout
insufficient historical edge
extreme volatility
feed latency
stale data
missing data
insufficient history
incomplete candle
false breakout uncertainty
MTF conflict
microstructure conflict
unknown market regime
insufficient sample size

NO TRADE is not an error.

=========================================================
26. DATA QUALITY / SAFETY GUARDS
=========================================================

Retain and improve existing guards:

DATA_OFFLINE
DATA_STALE
UNCONFIRMED_ASSET
UNSUPPORTED_TIMEFRAME
INSUFFICIENT_HISTORY
CLOCK_DESYNC
DUPLICATE_TICK
MISSING_TICK
INVALID_OHLC
CANDLE_NOT_FINAL
FEED_DISCONNECTED
INVALID_PAYOUT
INSUFFICIENT_SAMPLE
MODEL_NOT_CALIBRATED

Any critical data-quality failure:
NO SIGNAL.

=========================================================
27. BACKTEST ENGINE
=========================================================

Implement real historical backtesting.

For every strategy store:

pair
timeframe
expiry
market regime
entry condition
signal
entry price
expiry price
result
payout
timestamp
score
reason

Calculate:

signals
wins
losses
win rate
average payout
expected value
profit factor where meaningful
maximum losing streak
maximum winning streak
drawdown
sample size
performance by pair
performance by timeframe
performance by expiry
performance by market regime
performance by strategy

NEVER generate fake backtest results.

=========================================================
28. WALK-FORWARD VALIDATION
=========================================================

Implement:

TRAIN
→ VALIDATION
→ FORWARD TEST

Do not optimize and evaluate on the exact same data.

Detect overfitting.

If a strategy performs well only on training data:
mark it as OVERFIT / INVALID.

=========================================================
29. PAPER / DEMO SIGNAL MODE
=========================================================

Before any live use, support:

DEMO SIGNAL MODE
PAPER SIGNAL MODE
HISTORICAL REPLAY MODE
BACKTEST MODE

Track hypothetical signals and results.

No automatic real-money execution.

=========================================================
30. RISK ENGINE
=========================================================

Do NOT implement martingale by default.

No automatic doubling after losses.

Implement:

fixed stake mode
maximum signals/day
maximum consecutive losses
cooldown after losses
daily loss limit
session stop
feed anomaly stop
manual pause
emergency stop

These are risk controls, not guarantees.

=========================================================
31. SIGNAL JOURNAL
=========================================================

Store every signal:

id
timestamp
pair
assetType
timeframe
expiry
price
payout
direction
modelScore
all indicator values
market structure
candle pattern
support/resistance
market regime
strategy
MTF status
data quality
reason
entry price
expiry price
result

Allow user to inspect WHY a signal happened.

=========================================================
32. SIGNAL RESULT TRACKING
=========================================================

After expiry:

WIN
LOSS
NO RESULT
INVALIDATED
DATA ERROR

Automatically record result when reliable data exists.

Do not infer result from fake/demo data.

=========================================================
33. PERFORMANCE DASHBOARD
=========================================================

Show:

Today
7 days
30 days
All time

Metrics:

signals
wins
losses
win rate
average payout
average score
best-performing pair
strategy statistics
timeframe statistics
expiry statistics
market-regime statistics
losing streak
winning streak

Only show metrics with sufficient sample size.

=========================================================
34. LIVE DIAGNOSTICS
=========================================================

Create:

Settings
→ Live Data Diagnostics

Show:

Provider
Connection
Feed status
Latency
Last tick
Last candle
Tick rate
Data age
Asset
OTC status
Payout source
WebSocket status if legitimately configured
REST status if legitimately configured
API configuration status
Historical buffer size

Never expose secrets.

Never display API keys.

Never log credentials.

=========================================================
35. EXISTING UI UPGRADE
=========================================================

Keep the existing visual concept from the provided screenshot.

Do not create a completely unrelated UI.

Maintain the premium dark trading interface.

Upgrade the current:

CLIMAX-EXHAUSTION v620

into:

CLIMAX QUANT ENGINE V3

Suggested main panel:

⚡ CLIMAX QUANT ENGINE V3

PAIR: AUD/CAD OTC
PRICE: 1.05038
PAYOUT: 92%
TIMEFRAME: M1
TIMER: 08s

----------------------------

TREND
BULLISH 82/100

STRUCTURE
BULLISH 88/100

MOMENTUM
STRONG 79/100

VOLATILITY
NORMAL 71/100

CANDLE
BULLISH ENGULFING

S/R
SUPPORT REJECTION

MTF
4/5 ALIGNED

HISTORICAL
VALIDATED

----------------------------

QUANT SCORE
87/100

----------------------------

SIGNAL
CALL

ENTRY:
FINAL CONFIRMATION

EXPIRY:
1 MIN

----------------------------

If conditions fail:

NO TRADE

REASON:
Insufficient confirmation

=========================================================
36. DO NOT SHOW FAKE VALUES
=========================================================

This is a HARD REQUIREMENT.

Never hardcode:

RSI: 50
ADX: 25
CVD: +1
VWAP: fake value
BB: SYNCED
CLIMAX: NORMAL FLOW
confidence: 90%
win rate: 80%
historical performance

unless those values are genuinely calculated or retrieved.

Use:

N/A
UNAVAILABLE
NOT CONFIGURED

when appropriate.

=========================================================
37. AI REASONING LAYER
=========================================================

AI may explain the quantitative result.

AI must NOT invent:

prices
candles
indicators
payouts
historical statistics
market data
signals

Architecture:

RAW DATA
→ QUANT CALCULATIONS
→ MARKET STRUCTURE
→ STRATEGIES
→ HISTORICAL VALIDATION
→ SCORING
→ RISK FILTER
→ AI EXPLANATION

AI should never override critical data-quality guards.

=========================================================
38. SIGNAL EXPLANATION
=========================================================

Every CALL/PUT must provide concise reasons.

Example:

CALL

Reasons:
1. 15M/5M/1M bullish structure
2. M1 support rejection
3. EMA trend alignment
4. Momentum confirmation
5. No immediate resistance conflict
6. Historical setup meets minimum sample requirement
7. Payout passes EV filter

If NO TRADE:

NO TRADE

Reasons:
1. MTF conflict
2. Weak momentum
3. Low historical edge

=========================================================
39. ALL-PAIR SCAN
=========================================================

Add:

SCAN CURRENT PAIR
SCAN ALL OTC
STOP SCAN

During all-pair scanning:

- do not block UI
- use async workers where appropriate
- rate-limit provider requests
- cancel scan safely
- display progress
- ignore unavailable assets
- never fabricate unavailable data

=========================================================
40. PERFORMANCE REQUIREMENTS
=========================================================

The application must:

- avoid unnecessary recalculation
- cache indicator calculations
- use incremental calculations where possible
- use ring buffers
- avoid blocking the UI
- debounce expensive scans
- prevent duplicate signal generation
- prevent duplicate candle finalization
- handle reconnects
- recover cleanly after feed disconnect
- preserve state where appropriate

=========================================================
41. SIGNAL DEDUPLICATION
=========================================================

Never produce multiple identical signals for the same:

pair
candle
timeframe
entry window

unless explicitly configured.

Create unique signal IDs.

Example:

PAIR + CANDLE_TIMESTAMP + TIMEFRAME + DIRECTION

=========================================================
42. CONFIGURATION
=========================================================

Create central configuration:

timeframes
expiry options
indicator periods
minimum score
minimum sample size
payout threshold
entry window
MTF requirements
risk limits
strategy weights
data freshness limits

No scattered magic numbers.

=========================================================
43. EXPIRY OPTIONS
=========================================================

Support where underlying data permits:

15 seconds
30 seconds
1 minute
2 minutes
3 minutes
5 minutes

Also support:

ALL

But "ALL" must mean:
choose the most statistically validated available expiry for the current setup.

It must NOT randomly choose an expiry.

=========================================================
44. TIMEFRAME SELECTION
=========================================================

Support:

15s
30s
1m
2m
3m
5m
10m
15m
30m
1H

If a timeframe cannot be reliably constructed:
disable it.

Never create fake timeframe candles.

=========================================================
45. CHART ENGINE
=========================================================

Add professional charts:

candlestick chart
volume/tick chart if available
EMA overlays
VWAP
Bollinger Bands
support/resistance zones
supply/demand
market structure labels
BOS
CHOCH
liquidity sweeps
entry marker
signal marker

Charts must use actual market data.

=========================================================
46. CHART ANALYSIS
=========================================================

Detect visually and mathematically:

trend channels
horizontal ranges
breakouts
retests
support/resistance
swing points
compression
expansion
reversal zones

Do not claim advanced chart patterns unless algorithmically detected.

=========================================================
47. PATTERN CONFIRMATION MATRIX
=========================================================

Create a confirmation matrix.

Example:

Trend                PASS
Structure             PASS
Candle                PASS
Momentum              PASS
Volatility            PASS
S/R                   PASS
MTF                   PASS
Historical            PASS
Payout                PASS
Data Quality          PASS

Only after minimum required confirmations:
FINAL SIGNAL

Otherwise:
NO TRADE.

=========================================================
48. MODEL GOVERNANCE
=========================================================

Every signal must be reproducible.

Store the model inputs used to create it.

If user opens signal history later, system should be able to show:

WHY CALL?
WHY PUT?
WHY NO TRADE?

=========================================================
49. SECURITY
=========================================================

Never store:

passwords
account credentials
private tokens
browser cookies
sensitive authentication data

If API keys are supported:

- server-side only
- encrypted where appropriate
- never expose in frontend
- never log secrets
- redact logs

=========================================================
50. TESTING
=========================================================

Create comprehensive automated tests.

Minimum test categories:

TickEngine tests
CandleEngine tests
OHLC tests
timeframe tests
indicator tests
pattern tests
market structure tests
BOS tests
CHOCH tests
S/R tests
divergence tests
market regime tests
strategy tests
scoring tests
payout tests
EV tests
backtest tests
walk-forward tests
signal tests
NO TRADE tests
data quality tests
stale data tests
duplicate tick tests
disconnect tests
signal deduplication tests
expiry tests
UI state tests
provider tests

Run:

unit tests
integration tests
type checks
lint
build

Do not finish until tests pass.

=========================================================
51. CRITICAL ACCEPTANCE TEST
=========================================================

The system must pass this exact principle:

NO REAL DATA
→ NO REAL SIGNAL

STALE DATA
→ NO SIGNAL

INCOMPLETE CANDLE
→ NO SIGNAL

INSUFFICIENT HISTORY
→ NO SIGNAL

CONFLICTING MARKET STRUCTURE
→ NO SIGNAL

INSUFFICIENT CONFIRMATION
→ NO SIGNAL

UNSUPPORTED ASSET
→ NO SIGNAL

UNSUPPORTED TIMEFRAME
→ NO SIGNAL

UNKNOWN PAYOUT
→ NO PAYOUT-BASED EDGE CLAIM

NO AUTHORIZED LIVE FEED
→ SAFE MANUAL/OFFLINE MODE

=========================================================
52. LIVE FEED TESTER
=========================================================

Add:

Settings
→ Live Data Diagnostics
→ Test Connection

Show:

Provider
Asset
OTC status
Connection
Last tick
Last candle
Data freshness
Latency
Historical candles
Current payout if available

Test:

tick arrival
timestamp validity
OHLC validity
candle formation
disconnect/reconnect
stale detection

=========================================================
53. DEVELOPMENT PHASES
=========================================================

Implement in this order:

PHASE 1
Repository audit
Existing architecture audit
Remove obsolete demo logic

PHASE 2
Live provider abstraction
Tick engine
Data guards

PHASE 3
Candle engine
Multi-timeframe engine

PHASE 4
Indicator engine

PHASE 5
Candle pattern engine

PHASE 6
Market structure

PHASE 7
S/R and liquidity

PHASE 8
Divergence

PHASE 9
Market regime

PHASE 10
Strategy library

PHASE 11
OTC behavior statistics

PHASE 12
Backtesting

PHASE 13
Walk-forward validation

PHASE 14
Quant scoring

PHASE 15
Payout/EV engine

PHASE 16
Final signal engine

PHASE 17
Risk engine

PHASE 18
Signal journal

PHASE 19
UI upgrade

PHASE 20
Diagnostics

PHASE 21
Full testing

PHASE 22
Production build

=========================================================
54. FILE / CODE ORGANIZATION
=========================================================

Use a modular structure similar to:

src/
  components/
  pages/
  hooks/
  services/
  types/

server/
  data/
    providers/
      LiveMarketDataProvider
      PocketOptionLiveFeedAdapter
      DemoFeedAdapter
      ReplayFeedAdapter

  engine/
    TickEngine
    CandleEngine
    MultiTimeframeEngine
    IndicatorEngine
    CandlePatternEngine
    MarketStructureEngine
    SupportResistanceEngine
    LiquidityEngine
    DivergenceEngine
    MarketRegimeEngine
    StrategyEngine
    OTCBehaviorEngine
    QuantScoringEngine
    PayoutEngine
    ExpectedValueEngine
    BacktestEngine
    WalkForwardEngine
    SignalEngine
    RiskEngine
    SignalJournal

  routes/
    market
    signal
    diagnostics
    backtest
    performance

  tests/

Adapt this structure to the existing project rather than creating duplicate engines.

=========================================================
55. REMOVE LEGACY CONFLICTS
=========================================================

Search the entire codebase for:

fake candle generators
random market values
synthetic signal generation
hardcoded RSI
hardcoded ADX
hardcoded CVD
hardcoded VWAP
fake confidence
fake payout
fake historical statistics
demo-only signal paths
duplicate CandleEngine
duplicate SignalEngine
old V1/V2 conflicting logic

Remove or disable obsolete conflicting implementations.

Do not leave two competing signal engines active.

There must be ONE authoritative production SignalEngine.

=========================================================
56. BACKWARD COMPATIBILITY
=========================================================

Preserve useful existing features:

Manual Scan
Automatic scanning interface if already present
pair selector
timeframe selector
expiry selector
signal history
diagnostics
demo mode
offline mode
existing test infrastructure

Improve them rather than unnecessarily removing them.

=========================================================
57. MANUAL SCAN
=========================================================

Manual Scan button:

SCAN NOW

must:

1. verify data connection
2. verify selected asset
3. verify timeframe
4. verify history
5. calculate indicators
6. calculate structure
7. calculate patterns
8. calculate MTF
9. calculate strategy scores
10. calculate payout/EV
11. calculate final score
12. produce CALL / PUT / NO TRADE

No fake fallback.

=========================================================
58. AUTOMATIC SCAN
=========================================================

Automatic mode:

- synchronize to candle boundaries
- monitor final confirmation window
- prevent duplicate signals
- wait for next valid setup
- respect cooldown
- stop on data errors
- never force a trade

=========================================================
59. RESULT LABELS
=========================================================

Use:

CALL
PUT
NO TRADE
WAIT
DATA UNAVAILABLE
LIVE FEED NOT CONFIGURED

Do not use:

GUARANTEED WIN
100% WIN
SURE SHOT
EXACT WIN
NO LOSS

=========================================================
60. FINAL UI
=========================================================

The main UI should look premium and similar in concept to the provided screenshot.

Header:

⚡ CLIMAX QUANT ENGINE V3

Live status indicator.

Pair selector:

AUD/CAD OTC ▼

Controls:

Timeframe
Expiry
Scan
Auto Scan
All OTC

Analysis panel:

PRICE
PAYOUT
TIMER

TREND
STRUCTURE
MOMENTUM
VOLATILITY
CANDLE
VWAP
RSI
MACD
ADX
ATR
BOLLINGER
S/R
MTF
MARKET REGIME

Then:

QUANT SCORE

Then:

FINAL VERDICT

CALL / PUT / NO TRADE

Then:

REASONS

Then:

ENTRY WINDOW

Then:

EXPIRY

Then:

DATA QUALITY

=========================================================
61. IMPORTANT: DO NOT PROMISE WINNING
=========================================================

The software must be designed to seek statistically validated, high-quality setups.

It must NOT claim that signals are guaranteed to win.

Use historical validation, out-of-sample testing and strict NO TRADE filtering.

=========================================================
62. FINAL BUILD REQUIREMENT
=========================================================

After implementation:

1. Run tests.
2. Fix all failures.
3. Run type check.
4. Run lint.
5. Run production build.
6. Verify frontend.
7. Verify backend.
8. Verify provider layer.
9. Verify no fake market data exists.
10. Verify no random signal exists.
11. Verify NO TRADE works.
12. Verify manual scan.
13. Verify timeframe selection.
14. Verify expiry selection.
15. Verify pair selection.
16. Verify signal history.
17. Verify diagnostics.
18. Verify reconnect behavior.
19. Verify stale-data protection.
20. Verify signal deduplication.

Do not report success merely because the UI compiles.

The application must be functionally tested.

=========================================================
63. FINAL DELIVERY REPORT
=========================================================

At completion report:

- files changed
- files created
- files removed
- legacy code removed
- live provider status
- demo provider status
- real-data status
- synthetic-data status
- automatic trading status
- tests passed
- tests failed
- build status
- type-check status
- lint status
- remaining limitations

Be completely truthful.

If live Pocket Option OTC data cannot be legitimately connected in the current environment, explicitly state:

LIVE OTC FEED:
NOT CONFIGURED

and leave the application in SAFE MANUAL / DEMO / OFFLINE MODE.

Do not fake live connectivity.

=========================================================
FINAL PRINCIPLE
=========================================================

REAL DATA
+
REAL CALCULATIONS
+
MULTI-TIMEFRAME STRUCTURE
+
PRICE ACTION
+
TECHNICAL INDICATORS
+
MARKET REGIME
+
OTC-SPECIFIC STATISTICS
+
HISTORICAL VALIDATION
+
WALK-FORWARD TESTING
+
PAYOUT / EXPECTED VALUE
+
STRICT DATA QUALITY
+
STRICT NO TRADE FILTER
+
RISK CONTROL
=
HIGH-SELECTIVITY QUANT SIGNAL SYSTEM

Never:
FAKE DATA
+
RANDOM SIGNALS
+
HARDCODED INDICATORS
+
FABRICATED STATISTICS
+
GUARANTEED-WIN CLAIMS

START NOW.

First inspect the existing repository and produce an implementation plan internally, then execute the V3 upgrade directly.

Do not stop at architecture documentation.
Do not create a mockup-only application.
Implement the actual working code.
Preserve working existing functionality.
Replace obsolete/conflicting logic.
Run the complete test/build pipeline before finishing.
