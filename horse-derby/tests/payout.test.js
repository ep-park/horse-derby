const assert = require("node:assert/strict");
const {
  getHorsePayoutMultiplier,
  getEffectivePayoutMultiplier,
  calculatePotentialProfit,
  calculatePotentialReturn
} = require("../economy.js");

function testCapAt50x() {
  const payout = getHorsePayoutMultiplier({
    baseOdds: 99,
    isLeastFavorite: true,
    leastFavoriteMultiplier: 1.35,
    maxPayoutMultiplier: 50
  });
  assert.equal(payout, 50, "Payout should be capped at 50x.");
}

function testLiquidityScaling() {
  const theoretical = 16.85;
  const smallBet = getEffectivePayoutMultiplier({
    theoreticalMultiplier: theoretical,
    betAmount: 100,
    horsePool: 140,
    npcPoolTotal: 1747,
    maxPayoutMultiplier: 50
  });
  const bigBet = getEffectivePayoutMultiplier({
    theoreticalMultiplier: theoretical,
    betAmount: 1000,
    horsePool: 140,
    npcPoolTotal: 1747,
    maxPayoutMultiplier: 50
  });
  assert.ok(bigBet < smallBet, "Bigger bets should reduce effective multiplier.");
}

function testZeroPoolFallback() {
  const multiplier = getEffectivePayoutMultiplier({
    theoreticalMultiplier: 20,
    betAmount: 100,
    horsePool: 0,
    npcPoolTotal: 1500,
    maxPayoutMultiplier: 50
  });
  assert.ok(multiplier > 0, "Zero-pool horse should still compute a non-zero multiplier.");
}

function testProfitPoolCap() {
  const profit = calculatePotentialProfit({
    betAmount: 1000,
    effectiveMultiplier: 12,
    npcPoolTotal: 1747
  });
  assert.equal(profit, 1747, "Profit should never exceed NPC pool.");
}

function testReturnMath() {
  const ret = calculatePotentialReturn({ betAmount: 100, profit: 350 });
  assert.equal(ret, 450, "Return should equal stake + profit.");
}

function run() {
  testCapAt50x();
  testLiquidityScaling();
  testZeroPoolFallback();
  testProfitPoolCap();
  testReturnMath();
  console.log("payout.test.js passed");
}

run();
