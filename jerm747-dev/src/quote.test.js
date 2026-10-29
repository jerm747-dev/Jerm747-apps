import assert from 'node:assert/strict';
import { estimate, nearestFraction, makeProjectKey, normalizeKey, KEY_PATTERN, YEAR_VALUE, RATE, YEAR_HOURS } from './quote.js';

// Rate sanity: contract rate sits above salary-equivalent hourly
assert.ok(RATE > YEAR_VALUE / YEAR_HOURS);

// Small website, steady pace
const site = estimate({ typeId: 'site' });
assert.deepEqual(site.hours, [40, 80]);
assert.equal(site.price[0], 4500); // 60h * 95 = 5700 * 0.8 = 4560 -> 4500
assert.equal(site.price[1], 7000); // 5700 * 1.2 = 6840 -> 7000
assert.equal(site.fraction.label, '1/24');

// Full-stack with features at priority pace costs more and finishes faster per hour
const big = estimate({ typeId: 'fullstack', featureIds: ['accounts', 'database', 'admin'], paceId: 'priority' });
const bigSteady = estimate({ typeId: 'fullstack', featureIds: ['accounts', 'database', 'admin'], paceId: 'steady' });
assert.ok(big.price[0] > bigSteady.price[0]);
assert.ok(big.weeks[1] < bigSteady.weeks[1]);
assert.ok(['1/4', '1/2'].includes(big.fraction.label), big.fraction.label);

// Unknown type
assert.equal(estimate({ typeId: 'nope' }), null);

// Fractions
assert.equal(nearestFraction(1).label, '1');
assert.equal(nearestFraction(0.09).label, '1/12');

// Keys
for (let i = 0; i < 500; i++) assert.match(makeProjectKey(), KEY_PATTERN);
assert.equal(normalizeKey(' j747 7kq4 m2xd '), 'J747-7KQ4-M2XD');
assert.equal(normalizeKey('7KQ4M2XD'), 'J747-7KQ4-M2XD');
assert.ok(KEY_PATTERN.test(normalizeKey('j747-7kq4-m2xd')));

console.log('quote tests passed', { site: site.price, big: big.price, bigFraction: big.fraction.label });
