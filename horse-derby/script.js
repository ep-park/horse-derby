const HORSE_COUNT = 6;
const RACE_DISTANCE = 1000;
const UPDATE_MS = 1000 / 60;
const STORAGE_KEY = "horseDerbyStateV1";
const HISTORY_LIMIT = 10;

const MOODS = [
  { label: "bad", value: 0.75 },
  { label: "normal", value: 1.0 },
  { label: "good", value: 1.2 },
  { label: "great", value: 1.4 }
];

const TRACK_TYPES = [
  { id: "dirt", name: "Dirt Track" },
  { id: "grass", name: "Grass Track" },
  { id: "mud", name: "Muddy Track" },
  { id: "sand", name: "Sandy Track" }
];

const WEATHER_TYPES = [
  { id: "sunny", name: "Sunny" },
  { id: "cloudy", name: "Cloudy" },
  { id: "rainy", name: "Rainy" }
];

const HORSE_NAME_PARTS_A = ["Thunder", "Silver", "Dust", "Iron", "Storm", "Blaze", "Shadow", "River", "Golden", "Night"];
const HORSE_NAME_PARTS_B = ["Comet", "Stride", "Arrow", "Whisper", "Runner", "Flare", "Drift", "Echo", "Dash", "Spirit"];

const LEAST_FAVORITE_MULTIPLIER = 1.35;
const MAX_PAYOUT_MULTIPLIER = 50;
const UNDERDOG_SURGE_ACTIVATION_CHANCE = 0.08;
const UNDERDOG_SURGE_MAX_MULTIPLIER = 1.22;
const UNDERDOG_SURGE_START_PROGRESS = 0.78;

const trackEl = document.getElementById("track");
const raceStatusEl = document.getElementById("raceStatus");
const weatherTextEl = document.getElementById("weatherText");
const startRaceBtn = document.getElementById("startRaceBtn");
const nextRaceBtnEl = document.getElementById("nextRaceBtn");
const trackTypeSelectEl = document.getElementById("trackTypeSelect");
const statsTableWrapEl = document.getElementById("statsTableWrap");
const betHorseSelectEl = document.getElementById("betHorseSelect");
const betAmountInputEl = document.getElementById("betAmountInput");
const playerBalanceTextEl = document.getElementById("playerBalanceText");
const npcPoolTextEl = document.getElementById("npcPoolText");
const resetMoneyBtnEl = document.getElementById("resetMoneyBtn");
const betSummaryEl = document.getElementById("betSummary");
const npcPoolBreakdownEl = document.getElementById("npcPoolBreakdown");
const potentialEarningsWrapEl = document.getElementById("potentialEarningsWrap");
const historyListWrapEl = document.getElementById("historyListWrap");
const bankrollChartEl = document.getElementById("bankrollChart");
const runSimBtnEl = document.getElementById("runSimBtn");
const simRunsInputEl = document.getElementById("simRunsInput");
const simResultsTextEl = document.getElementById("simResultsText");

let horses = [];
let animationTimer = null;
let raceFinished = false;
let selectedTrackType = TRACK_TYPES[0].id;
let currentWeather = WEATHER_TYPES[0].id;
let playerBalance = 1000;
let npcPoolByHorse = {};
let npcPoolTotal = 0;
let zeroPoolPayoutByHorse = {};
let activeBet = null;
let raceReady = false;
let underdogSurge = { horseId: null, activated: false };
let raceHistory = [];

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomMood() {
  return MOODS[randomInt(0, MOODS.length - 1)];
}

function randomTrackSkill() {
  return Number((Math.random() * 0.6 + 0.7).toFixed(2));
}

function randomWeatherAffinity() {
  return Number((Math.random() * 0.5 + 0.75).toFixed(2));
}

function randomWeather() {
  return WEATHER_TYPES[randomInt(0, WEATHER_TYPES.length - 1)].id;
}

function formatCurrency(value) {
  return `$${Math.max(0, Math.round(value)).toLocaleString()}`;
}

function getTrackName(trackId) {
  const track = TRACK_TYPES.find((item) => item.id === trackId);
  return track ? track.name : trackId;
}

function getWeatherName(weatherId) {
  const weather = WEATHER_TYPES.find((item) => item.id === weatherId);
  return weather ? weather.name : weatherId;
}

function logTelemetry() {}

function saveState() {
  const state = {
    playerBalance,
    raceHistory
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed.playerBalance === "number") {
      playerBalance = parsed.playerBalance;
    }
    if (Array.isArray(parsed.raceHistory)) {
      raceHistory = parsed.raceHistory.slice(0, HISTORY_LIMIT);
    }
  } catch {
    // Ignore broken persisted data.
  }
}

function buildTrackTypeSelect() {
  trackTypeSelectEl.innerHTML = TRACK_TYPES.map(
    (track) => `<option value="${track.id}">${track.name}</option>`
  ).join("");
}

function buildBetHorseSelect() {
  betHorseSelectEl.innerHTML = horses
    .map((horse) => `<option value="${horse.id}">${horse.name} (#${horse.id})</option>`)
    .join("");
}

function buildTrack() {
  trackEl.innerHTML = "";
  for (let i = 0; i < HORSE_COUNT; i += 1) {
    const lane = document.createElement("div");
    lane.className = "lane";
    const finishLine = document.createElement("div");
    finishLine.className = "finish-line";
    lane.appendChild(finishLine);
    const horseEl = document.createElement("div");
    horseEl.className = "horse";
    horseEl.textContent = String(i + 1);
    lane.appendChild(horseEl);
    trackEl.appendChild(lane);
  }
}

function createHorseData() {
  const usedNames = new Set();
  function buildUniqueHorseName() {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const partA = HORSE_NAME_PARTS_A[randomInt(0, HORSE_NAME_PARTS_A.length - 1)];
      const partB = HORSE_NAME_PARTS_B[randomInt(0, HORSE_NAME_PARTS_B.length - 1)];
      const candidate = `${partA} ${partB}`;
      if (!usedNames.has(candidate)) {
        usedNames.add(candidate);
        return candidate;
      }
    }
    const fallback = `Wild Card ${usedNames.size + 1}`;
    usedNames.add(fallback);
    return fallback;
  }

  return Array.from({ length: HORSE_COUNT }, (_, i) => {
    const mood = randomMood();
    const trackSkills = TRACK_TYPES.reduce((skills, track) => {
      skills[track.id] = randomTrackSkill();
      return skills;
    }, {});
    return {
      id: i + 1,
      name: buildUniqueHorseName(),
      strength: randomInt(40, 100),
      winRate: Math.random() * 0.85 + 0.15,
      moodLabel: mood.label,
      moodValue: mood.value,
      trackSkills,
      weatherSkills: {
        sunny: randomWeatherAffinity(),
        cloudy: randomWeatherAffinity(),
        rainy: randomWeatherAffinity()
      },
      distance: 0,
      finishedAt: null
    };
  });
}

function getHorseById(horseId) {
  return horses.find((horse) => horse.id === horseId) || null;
}

function getHorseLabel(horseId) {
  const horse = getHorseById(horseId);
  return horse ? `${horse.name} (#${horse.id})` : `Horse #${horseId}`;
}

function getHorseRacePowerScore(horse) {
  return (
    (horse.strength / 100) *
    horse.winRate *
    horse.moodValue *
    horse.trackSkills[selectedTrackType] *
    horse.weatherSkills[currentWeather]
  );
}

function rollUnderdogSurge() {
  const underdogHorse = horses.reduce((lowest, horse) => {
    if (!lowest) {
      return horse;
    }
    return getHorseRacePowerScore(horse) < getHorseRacePowerScore(lowest) ? horse : lowest;
  }, null);

  underdogSurge = {
    horseId: underdogHorse ? underdogHorse.id : null,
    activated: Math.random() < UNDERDOG_SURGE_ACTIVATION_CHANCE
  };
}

function generateNpcPool() {
  npcPoolByHorse = {};
  horses.forEach((horse) => {
    const confidence = (horse.strength / 100 + horse.winRate + horse.trackSkills[selectedTrackType]) / 3;
    const baseStake = randomInt(90, 280);
    npcPoolByHorse[horse.id] = Math.round(baseStake * (0.8 + confidence * 0.7));
  });
  syncNpcPoolTotalFromBreakdown();
}

function getLeastFavoriteHorseIds() {
  const stakes = Object.values(npcPoolByHorse);
  if (!stakes.length) {
    return [];
  }
  const minStake = Math.min(...stakes);
  return Object.keys(npcPoolByHorse)
    .filter((horseId) => npcPoolByHorse[horseId] === minStake)
    .map((horseId) => Number(horseId));
}

function isLeastFavoriteHorse(horseId) {
  return getLeastFavoriteHorseIds().includes(horseId);
}

function getZeroPoolHorseIds() {
  return Object.keys(npcPoolByHorse)
    .filter((horseId) => (npcPoolByHorse[horseId] || 0) === 0)
    .map((horseId) => Number(horseId));
}

function buildZeroPoolRandomMultiplier(horseId) {
  const horse = getHorseById(horseId);
  if (!horse) {
    return 2;
  }
  const winFactor = horse.winRate * 20;
  const moodFactor = horse.moodValue * 12;
  const randomFactor = Math.random() * 10;
  return Math.max(2, Math.min(MAX_PAYOUT_MULTIPLIER - 1, Number((winFactor + moodFactor + randomFactor).toFixed(2))));
}

function refreshZeroPoolPayouts() {
  zeroPoolPayoutByHorse = {};
  const zeroPoolHorseIds = getZeroPoolHorseIds();
  if (zeroPoolHorseIds.length <= 1) {
    return;
  }
  zeroPoolHorseIds.forEach((horseId) => {
    zeroPoolPayoutByHorse[horseId] = buildZeroPoolRandomMultiplier(horseId);
  });
}

function syncNpcPoolTotalFromBreakdown() {
  npcPoolTotal = Object.values(npcPoolByHorse).reduce((sum, stake) => sum + stake, 0);
  refreshZeroPoolPayouts();
}

function getHorseBaseOddsMultiplier(horseId) {
  const horsePool = npcPoolByHorse[horseId] || 0;
  const zeroPoolHorseIds = getZeroPoolHorseIds();
  if (horsePool === 0 && zeroPoolHorseIds.length > 1) {
    return zeroPoolPayoutByHorse[horseId] || 2;
  }
  return npcPoolTotal / Math.max(1, horsePool);
}

function getHorsePayoutMultiplier(horseId) {
  const baseOdds = getHorseBaseOddsMultiplier(horseId);
  const leastFavoriteBonus = isLeastFavoriteHorse(horseId) ? LEAST_FAVORITE_MULTIPLIER : 1;
  return Math.min(MAX_PAYOUT_MULTIPLIER, baseOdds * leastFavoriteBonus);
}

function getEffectivePayoutMultiplier(horseId, betAmount) {
  if (betAmount <= 0) {
    return 0;
  }
  const theoreticalMultiplier = getHorsePayoutMultiplier(horseId);
  const horsePool = npcPoolByHorse[horseId] || 0;
  const virtualPoolForZeroShare = Math.max(20, Math.round(npcPoolTotal * 0.03));
  const effectiveHorsePool = horsePool > 0 ? horsePool : virtualPoolForZeroShare;
  const liquidityFactor = effectiveHorsePool / (effectiveHorsePool + betAmount);
  return Math.min(MAX_PAYOUT_MULTIPLIER, theoreticalMultiplier * liquidityFactor);
}

function calculatePotentialProfit(horseId, betAmount) {
  if (betAmount <= 0) {
    return 0;
  }
  const payoutMultiplier = getEffectivePayoutMultiplier(horseId, betAmount);
  return Math.min(Math.round(betAmount * payoutMultiplier), npcPoolTotal);
}

function calculatePotentialReturn(horseId, betAmount) {
  return betAmount + calculatePotentialProfit(horseId, betAmount);
}

function deductFromNpcPool(amount, winningHorseId) {
  let remaining = amount;
  const winnerStake = npcPoolByHorse[winningHorseId] || 0;
  const winnerDeduction = Math.min(winnerStake, remaining);
  npcPoolByHorse[winningHorseId] = winnerStake - winnerDeduction;
  remaining -= winnerDeduction;

  if (remaining > 0) {
    horses.forEach((horse) => {
      if (horse.id === winningHorseId || remaining <= 0) {
        return;
      }
      const stake = npcPoolByHorse[horse.id] || 0;
      const deduction = Math.min(stake, remaining);
      npcPoolByHorse[horse.id] = stake - deduction;
      remaining -= deduction;
    });
  }
  syncNpcPoolTotalFromBreakdown();
}

function addToNpcPool(amount, horseId) {
  npcPoolByHorse[horseId] = (npcPoolByHorse[horseId] || 0) + amount;
  syncNpcPoolTotalFromBreakdown();
}

function setBettingControlsDisabled(disabled) {
  betHorseSelectEl.disabled = disabled;
  betAmountInputEl.disabled = disabled;
}

function setNextRaceButtonVisible(isVisible) {
  nextRaceBtnEl.classList.toggle("hidden", !isVisible);
}

function renderBettingPanel() {
  const chosenHorseId = Number(betHorseSelectEl.value || 1);
  const betAmount = Math.max(0, Math.floor(Number(betAmountInputEl.value) || 0));
  playerBalanceTextEl.textContent = `Player Balance: ${formatCurrency(playerBalance)}`;
  npcPoolTextEl.textContent = `NPC Pool: ${formatCurrency(npcPoolTotal)}`;

  if (!activeBet) {
    const profit = calculatePotentialProfit(chosenHorseId, betAmount);
    const ret = calculatePotentialReturn(chosenHorseId, betAmount);
    const bonusActive = isLeastFavoriteHorse(chosenHorseId) ? "Underdog bonus active. " : "";
    betSummaryEl.textContent =
      betAmount > 0
        ? `Bet preview: ${formatCurrency(betAmount)} on ${getHorseLabel(chosenHorseId)}. ${bonusActive}Profit: ${formatCurrency(profit)} | Return: ${formatCurrency(ret)}`
        : `Choose a horse and amount, then run a race.`;
  }

  npcPoolBreakdownEl.innerHTML = `
    <div class="pool-grid">
      ${horses
        .map((horse) => {
          const stake = npcPoolByHorse[horse.id] || 0;
          const poolShare = npcPoolTotal > 0 ? ((stake / npcPoolTotal) * 100).toFixed(1) : "0.0";
          return `
            <div class="pool-card">
              <strong>${horse.name} (#${horse.id})</strong>
              <span>${formatCurrency(stake)}</span>
              <small>${poolShare}% pool</small>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  const leastFavorites = getLeastFavoriteHorseIds();
  potentialEarningsWrapEl.innerHTML = `
    <table class="compact-table">
      <thead>
        <tr>
          <th>Horse</th>
          <th>Payout</th>
          <th>Potential Profit</th>
          <th>Total Return</th>
        </tr>
      </thead>
      <tbody>
        ${horses
          .map((horse) => {
            const payoutMultiplier = betAmount > 0 ? getEffectivePayoutMultiplier(horse.id, betAmount) : 0;
            const tagText = leastFavorites.includes(horse.id) ? "Underdog" : "";
            return `
              <tr>
                <td>${horse.name} (#${horse.id})</td>
                <td>${payoutMultiplier.toFixed(2)}x ${tagText}</td>
                <td>${formatCurrency(calculatePotentialProfit(horse.id, betAmount))}</td>
                <td>${formatCurrency(calculatePotentialReturn(horse.id, betAmount))}</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderStats(winnerId = null) {
  statsTableWrapEl.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Horse</th>
          <th>Strength</th>
          <th>Win Rate</th>
          <th>Mood</th>
          <th>${getTrackName(selectedTrackType)} Skill</th>
          <th>Progress</th>
        </tr>
      </thead>
      <tbody>
        ${[...horses]
          .sort((a, b) => b.distance - a.distance)
          .map((horse) => {
            const isWinner = winnerId === horse.id ? "winner" : "";
            return `
              <tr class="${isWinner}">
                <td>${horse.name} (#${horse.id})</td>
                <td>${horse.strength}%</td>
                <td>${Math.round(horse.winRate * 100)}%</td>
                <td>${horse.moodLabel} (${horse.moodValue.toFixed(2)}x)</td>
                <td>${horse.trackSkills[selectedTrackType].toFixed(2)}x</td>
                <td>${Math.min(100, Math.round((horse.distance / RACE_DISTANCE) * 100))}%</td>
              </tr>
            `;
          })
          .join("")}
      </tbody>
    </table>
  `;
}

function renderHistory() {
  historyListWrapEl.innerHTML =
    raceHistory.length === 0
      ? `<div class="log-line">No races yet.</div>`
      : raceHistory
          .map(
            (item) =>
              `<div class="log-line">${item.atLocal} | ${item.winner} | ${item.resultText} | Balance: ${formatCurrency(item.balanceAfter)}</div>`
          )
          .join("");
  drawBankrollChart();
}

function drawBankrollChart() {
  const ctx = bankrollChartEl.getContext("2d");
  if (!ctx) {
    return;
  }
  const points = [1000, ...raceHistory.map((entry) => entry.balanceAfter)].slice(-30);
  const width = bankrollChartEl.width;
  const height = bankrollChartEl.height;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, width, height);

  const minValue = Math.min(...points);
  const maxValue = Math.max(...points);
  const range = Math.max(1, maxValue - minValue);

  ctx.strokeStyle = "#d9d9d9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height - 20);
  ctx.lineTo(width, height - 20);
  ctx.stroke();

  ctx.strokeStyle = "#d36f00";
  ctx.lineWidth = 2;
  ctx.beginPath();
  points.forEach((value, index) => {
    const x = (index / Math.max(1, points.length - 1)) * (width - 20) + 10;
    const y = height - 24 - ((value - minValue) / range) * (height - 38);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();
}

async function resolveWinnerByAuthority(localWinnerId) {
  return { winnerId: localWinnerId, authority: "local" };
}

function moveHorseElement(horse, laneIndex) {
  const laneEl = trackEl.children[laneIndex];
  const horseEl = laneEl.querySelector(".horse");
  const laneWidth = laneEl.clientWidth;
  const horseMaxLeft = laneWidth - horseEl.clientWidth - 44;
  const left = Math.min(horseMaxLeft, (horse.distance / RACE_DISTANCE) * horseMaxLeft);
  horseEl.style.left = `${left}px`;
}

function getStepForHorse(horse) {
  const trackSkill = horse.trackSkills[selectedTrackType];
  const weatherSkill = horse.weatherSkills[currentWeather];
  const baseSpeed = (1.4 + horse.strength / 50) * horse.moodValue * trackSkill * weatherSkill;
  const weightedLuck = Math.random() * (horse.winRate * 7) * horse.moodValue * trackSkill * weatherSkill;
  const noise = Math.random() * 1.6;
  let step = baseSpeed + weightedLuck + noise;

  if (underdogSurge.activated && underdogSurge.horseId === horse.id) {
    const progress = horse.distance / RACE_DISTANCE;
    if (progress >= UNDERDOG_SURGE_START_PROGRESS) {
      const surgeProgress = Math.min(1, (progress - UNDERDOG_SURGE_START_PROGRESS) / (1 - UNDERDOG_SURGE_START_PROGRESS));
      step *= 1 + (UNDERDOG_SURGE_MAX_MULTIPLIER - 1) * surgeProgress;
    }
  }

  return step;
}

function recordRaceHistory(winner, resultText) {
  raceHistory.unshift({
    atISO: new Date().toISOString(),
    atLocal: new Date().toLocaleString(),
    winner: `${winner.name} (#${winner.id})`,
    resultText,
    balanceAfter: playerBalance
  });
  raceHistory = raceHistory.slice(0, HISTORY_LIMIT);
  renderHistory();
}

async function finalizeRace(localWinner) {
  const resolved = await resolveWinnerByAuthority(localWinner.id);
  const winner = getHorseById(resolved.winnerId) || localWinner;
  let resultText = "No bet placed";

  if (activeBet && activeBet.horseId === winner.id) {
    const profit = calculatePotentialProfit(activeBet.horseId, activeBet.amount);
    deductFromNpcPool(profit, activeBet.horseId);
    playerBalance += activeBet.amount + profit;
    resultText = `Won ${formatCurrency(profit)} profit`;
    betSummaryEl.textContent = `You won! ${winner.name} (#${winner.id}) hit. Stake returned + ${formatCurrency(profit)} profit.`;
    raceStatusEl.textContent = `${winner.name} (#${winner.id}) wins on the ${getTrackName(selectedTrackType)}. You cashed out ${formatCurrency(profit)} profit!`;
  } else if (activeBet) {
    addToNpcPool(activeBet.amount, activeBet.horseId);
    resultText = `Lost ${formatCurrency(activeBet.amount)}`;
    betSummaryEl.textContent = `You lost ${formatCurrency(activeBet.amount)}. ${winner.name} (#${winner.id}) won this race.`;
    raceStatusEl.textContent = `${winner.name} (#${winner.id}) wins on the ${getTrackName(selectedTrackType)}. Your bet missed.`;
  } else {
    raceStatusEl.textContent = `${winner.name} (#${winner.id}) wins on the ${getTrackName(selectedTrackType)}!`;
  }

  activeBet = null;
  raceReady = false;
  renderStats(winner.id);
  renderBettingPanel();
  startRaceBtn.disabled = true;
  trackTypeSelectEl.disabled = true;
  setBettingControlsDisabled(true);
  setNextRaceButtonVisible(true);

  recordRaceHistory(winner, resultText);
  logTelemetry("race", `Race settled. Winner: ${winner.name} (#${winner.id}). ${resultText}`);
  saveState();
}

function tickRace() {
  if (raceFinished) {
    return;
  }
  let winner = null;
  horses.forEach((horse, index) => {
    horse.distance += getStepForHorse(horse);
    if (horse.distance >= RACE_DISTANCE && horse.finishedAt === null) {
      horse.finishedAt = performance.now();
      if (!winner || horse.finishedAt < winner.finishedAt) {
        winner = horse;
      }
    }
    moveHorseElement(horse, index);
  });

  if (!winner) {
    raceStatusEl.textContent = "Race in progress...";
    renderStats();
    return;
  }

  raceFinished = true;
  clearInterval(animationTimer);
  animationTimer = null;
  finalizeRace(winner);
}

function prepareNextRace() {
  if (animationTimer) {
    clearInterval(animationTimer);
    animationTimer = null;
  }
  raceFinished = false;
  activeBet = null;
  horses = createHorseData();
  currentWeather = randomWeather();
  rollUnderdogSurge();
  generateNpcPool();
  buildBetHorseSelect();
  horses.forEach((horse, index) => moveHorseElement(horse, index));
  raceReady = true;

  renderStats();
  renderBettingPanel();
  weatherTextEl.textContent = `Weather: ${getWeatherName(currentWeather)}`;
  startRaceBtn.disabled = false;
  trackTypeSelectEl.disabled = false;
  setBettingControlsDisabled(false);
  setNextRaceButtonVisible(false);
  raceStatusEl.textContent = `Next race is ready on the ${getTrackName(selectedTrackType)} (${getWeatherName(currentWeather)}). Place your bet, then run the race.`;

  logTelemetry("setup", "Prepared a new race.");
  saveState();
}

function startRace() {
  if (!raceReady) {
    raceStatusEl.textContent = `Click "Next Race" to prepare fresh values first.`;
    return;
  }

  raceFinished = false;
  startRaceBtn.disabled = true;
  trackTypeSelectEl.disabled = true;
  setBettingControlsDisabled(true);
  setNextRaceButtonVisible(false);
  raceStatusEl.textContent = `Gates open on the ${getTrackName(selectedTrackType)}...`;

  const horseId = Number(betHorseSelectEl.value);
  const amount = Math.floor(Number(betAmountInputEl.value));
  const hasValidAmount = Number.isFinite(amount) && amount > 0;
  const hasBalance = hasValidAmount && amount <= playerBalance;
  if (!hasValidAmount || !hasBalance) {
    raceStatusEl.textContent = hasValidAmount
      ? `Insufficient balance. You have ${formatCurrency(playerBalance)}.`
      : `Enter a valid bet amount above $0 before racing.`;
    startRaceBtn.disabled = false;
    trackTypeSelectEl.disabled = false;
    setBettingControlsDisabled(false);
    renderStats();
    renderBettingPanel();
    return;
  }

  playerBalance -= amount;
  activeBet = { horseId, amount };
  raceReady = false;
  betSummaryEl.textContent = `Bet locked: ${formatCurrency(amount)} on ${getHorseLabel(horseId)}.`;
  logTelemetry("bet", `Bet locked ${formatCurrency(amount)} on ${getHorseLabel(horseId)}.`);

  renderStats();
  renderBettingPanel();
  saveState();

  setTimeout(() => {
    animationTimer = setInterval(tickRace, UPDATE_MS);
  }, 550);
}

function resetMoney() {
  playerBalance = 1000;
  renderBettingPanel();
  saveState();
}

function runSimulation() {
  const runs = Math.max(10, Math.min(10000, Math.floor(Number(simRunsInputEl.value) || 500)));
  let bustCount = 0;
  let totalFinalBalance = 0;

  for (let run = 0; run < runs; run += 1) {
    let simBalance = 1000;
    for (let race = 0; race < 30; race += 1) {
      const simHorses = createHorseData();
      const simPool = {};
      let simPoolTotal = 0;
      simHorses.forEach((horse) => {
        const stake = randomInt(100, 350);
        simPool[horse.id] = stake;
        simPoolTotal += stake;
      });

      const betHorseId = simHorses[randomInt(0, simHorses.length - 1)].id;
      const betAmount = Math.max(10, Math.min(simBalance, Math.round(simBalance * 0.12)));
      if (simBalance <= 0) {
        break;
      }

      const winner = simHorses.reduce((lead, horse) => {
        const score = horse.strength * horse.winRate * horse.moodValue;
        const leadScore = lead.strength * lead.winRate * lead.moodValue;
        return score > leadScore ? horse : lead;
      }, simHorses[0]);

      simBalance -= betAmount;
      if (winner.id === betHorseId) {
        const horsePool = simPool[winner.id];
        const payout = Math.min(MAX_PAYOUT_MULTIPLIER, (simPoolTotal / horsePool) * LEAST_FAVORITE_MULTIPLIER);
        const profit = Math.min(simPoolTotal, Math.round(betAmount * payout * (horsePool / (horsePool + betAmount))));
        simBalance += betAmount + profit;
      }
    }
    if (simBalance <= 0) {
      bustCount += 1;
    }
    totalFinalBalance += Math.max(0, simBalance);
  }

  const avgFinalBalance = totalFinalBalance / runs;
  const bustRate = (bustCount / runs) * 100;
  simResultsTextEl.textContent = `Simulation ${runs.toLocaleString()} runs: avg final balance ${formatCurrency(avgFinalBalance)} | bust rate ${bustRate.toFixed(1)}%.`;
  logTelemetry("simulation", `Ran ${runs} simulations. Avg: ${formatCurrency(avgFinalBalance)}, bust: ${bustRate.toFixed(1)}%.`);
}

function wireEvents() {
  startRaceBtn.addEventListener("click", startRace);
  nextRaceBtnEl.addEventListener("click", prepareNextRace);
  trackTypeSelectEl.addEventListener("change", (event) => {
    selectedTrackType = event.target.value;
    prepareNextRace();
  });
  betHorseSelectEl.addEventListener("change", renderBettingPanel);
  betAmountInputEl.addEventListener("input", renderBettingPanel);
  resetMoneyBtnEl.addEventListener("click", resetMoney);
  runSimBtnEl.addEventListener("click", runSimulation);
}

function init() {
  loadState();
  buildTrack();
  buildTrackTypeSelect();
  trackTypeSelectEl.value = selectedTrackType;
  renderHistory();
  prepareNextRace();
  wireEvents();
}

init();
