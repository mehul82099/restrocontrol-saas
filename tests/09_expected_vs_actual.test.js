const test = require('node:test');
const assert = require('node:assert');
const { getDemoContext, prisma, OrderService, AnalyticsService } = require('./test-helper');

test('9. Expected vs Actual Calculation: calculates variance and provides operational explanations', async () => {
  const { restaurant, outlet } = await getDemoContext();

  // Fetch variance report over the last 2 hours
  const now = new Date();
  const startTime = new Date(now.getTime() - 2 * 3600 * 1000);
  const endTime = new Date(now.getTime() + 10 * 60 * 1000);

  const report = await AnalyticsService.getExpectedVsActualConsumption(restaurant.id, outlet.id, {
    startDate: startTime,
    endDate: endTime,
  });

  assert.ok(report.items, 'Variance report must have items list');
  assert.ok(report.summary, 'Variance report must have summary stats');

  // Verify fields on each item
  for (const item of report.items) {
    assert.ok(item.ingredientId, 'Item must have ingredientId');
    assert.ok(item.ingredientName, 'Item must have ingredientName');
    assert.ok(typeof item.expected === 'number', 'Expected must be number');
    assert.ok(typeof item.actual === 'number', 'Actual must be number');
    assert.ok(typeof item.variance === 'number', 'Variance must be number');
    assert.ok(typeof item.variancePercent === 'number', 'Variance % must be number');
    assert.ok(Array.isArray(item.possibleReasons), 'Possible operational reasons must be an array');

    // Expected variance formula: variance = actual - expected
    const calcVar = Math.round((item.actual - item.expected) * 1000) / 1000;
    assert.strictEqual(
      item.variance,
      calcVar,
      `Variance (${item.variance}) must equal actual (${item.actual}) - expected (${item.expected})`
    );
  }
});
