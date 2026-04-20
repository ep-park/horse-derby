# Horse Derby

`Horse Derby` is a simple 2D browser game where numbered horses race across lanes.

Each race includes:
- Randomized `strength` for each horse.
- Randomized `winRate` weighting for each horse.
- Random horse names each race (track still shows compact numbers).
- Randomized `mood` per horse each race: `bad`, `normal`, `good`, `great`.
- Mood value multipliers that impact race performance.
- Multiple track types (`Dirt`, `Grass`, `Muddy`, `Sandy`) selectable before each race.
- Randomized weather per race (`Sunny`, `Cloudy`, `Rainy`).
- Randomized per-horse track skills for every track each race.
- Randomized per-horse weather skill that affects performance in current weather.
- Hidden underdog determination surge chance near race end.
- Fake currency betting with a player wallet and NPC betting pool.
- Player can bet on a horse before each race.
- Live "potential earnings" table for every horse based on current bet amount and pool totals.
- Least-favorite horse bonus multiplier (underdog incentive) for bigger potential payouts.
- Payout multiplier cap of `50x` to prevent runaway odds.
- If multiple horses have `0%` pool share, their payout multipliers are randomized using mood and win rate.
- Liquidity-aware payout scaling so large bets self-adjust and do not flatten odds.
- Win: stake is returned and profit is paid out from the NPC pool.
- Loss: the stake is lost and added to the NPC pool.
- Animated movement based on strength, win rate, mood, track skill, and race-time luck.

## Production Hardening Added

- `localStorage` persistence for balance and race history.
- Explicit fake-currency safety note in UI.
- Race history panel with bankroll trend chart.
- Balance lab simulation tool to stress payout/economy behavior.

## Run

1. Open `index.html` in your browser.
2. Click **Run New Race**.
3. Watch the lanes and stats table update in real time.

## Test

Run payout edge-case tests:

`node tests/payout.test.js`

## Files

- `index.html`: app layout.
- `style.css`: 2D track + UI styling.
- `script.js`: race logic, randomization, animation, persistence, history, and simulation tooling.
- `economy.js`: pure payout math helpers.
- `tests/payout.test.js`: payout unit tests.
