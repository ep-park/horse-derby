function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function getHorsePayoutMultiplier({ baseOdds, isLeastFavorite, leastFavoriteMultiplier, maxPayoutMultiplier }) {
  const bonus = isLeastFavorite ? leastFavoriteMultiplier : 1;
  return clamp(baseOdds * bonus, 0, maxPayoutMultiplier);
}

function getEffectivePayoutMultiplier({
  theoreticalMultiplier,
  betAmount,
  horsePool,
  npcPoolTotal,
  maxPayoutMultiplier
}) {
  if (betAmount <= 0) {
    return 0;
  }
  const virtualPoolForZeroShare = Math.max(20, Math.round(npcPoolTotal * 0.03));
  const effectiveHorsePool = horsePool > 0 ? horsePool : virtualPoolForZeroShare;
  const liquidityFactor = effectiveHorsePool / (effectiveHorsePool + betAmount);
  return clamp(theoreticalMultiplier * liquidityFactor, 0, maxPayoutMultiplier);
}

function calculatePotentialProfit({ betAmount, effectiveMultiplier, npcPoolTotal }) {
  if (betAmount <= 0) {
    return 0;
  }
  return clamp(Math.round(betAmount * effectiveMultiplier), 0, npcPoolTotal);
}

function calculatePotentialReturn({ betAmount, profit }) {
  return betAmount + profit;
}

const api = {
  getHorsePayoutMultiplier,
  getEffectivePayoutMultiplier,
  calculatePotentialProfit,
  calculatePotentialReturn
};

if (typeof module !== "undefined" && module.exports) {
  module.exports = api;
}

if (typeof window !== "undefined") {
  window.HorseDerbyEconomy = api;
}
