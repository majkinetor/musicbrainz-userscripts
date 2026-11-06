import { test, expect, loadFunctions } from '../../../dev/test/harness.mjs';

const p = { rainQuantity: 100, rainIntensity: 100, rainSize: 1, rainSpeed: 1, rainFalling: 10, rainTrail: 1 };
const helpers = () => loadFunctions('event_horizon', ['rainBirth', 'rainCreate', 'rainStep']);
const seeded = () => { let n = 42; return () => ((n = (1664525 * n + 1013904223) >>> 0) / 4294967296); };

test('rain forms varied beads on the glass and records only actual travel', { tag: '@unit' }, async () => {
  const { rainCreate, rainBirth, rainStep } = await helpers();
  const s = rainCreate(1600, 1000, p, seeded());
  expect(s.drops.every(d => d.trail.length === 0)).toBe(true);
  expect(Math.max(...s.drops.map(d => d.size)) / Math.min(...s.drops.map(d => d.size))).toBeGreaterThan(5);
  expect(s.drops.some(d => d.falling)).toBe(true);
  expect(s.drops.some(d => !d.falling && d.speed === 0)).toBe(true);
  const bead = rainBirth(s, { ...p, rainFalling: 0 });
  expect(bead.y).toBeGreaterThan(0);
  expect(bead.y).toBeLessThan(1000);
  expect(bead.r).toBeLessThan(bead.size * .2);
  const fall = rainBirth(s, { ...p, rainFalling: 100 });
  expect(fall.y).toBeLessThan(0);
  s.drops = [fall]; s.births = 0;
  const start = { x: fall.x, y: fall.y, speed: fall.speed };
  rainStep(s, .1, { ...p, rainFalling: 100 });
  expect(fall.speed).toBeGreaterThan(start.speed);
  expect(fall.y).toBeGreaterThan(start.y);
  expect(fall.trail[0]).toMatchObject({ x: start.x, y: start.y });
});

test('rain merges beads, applies live size and quantity, and can stop falling', { tag: '@unit' }, async () => {
  const { rainCreate, rainStep } = await helpers();
  const s = rainCreate(1600, 1000, { ...p, rainFalling: 0 }, seeded());
  s.drops = s.drops.slice(0, 2);
  for (const d of s.drops) Object.assign(d, { x: 500, y: 300, r: 4, size: 4, fallChance: .9 });
  rainStep(s, 0, { ...p, rainFalling: 0 });
  expect(s.drops).toHaveLength(1);
  expect(s.drops[0].r).toBeCloseTo(Math.sqrt(32));
  expect(s.drops[0].pause).toBe(0);
  const r = s.drops[0].r;
  rainStep(s, 0, { ...p, rainSize: 1.6, rainFalling: 0 });
  expect(s.drops[0].r).toBeCloseTo(r * 1.6);
  expect(s.drops[0].falling).toBe(false);
  const many = rainCreate(1600, 1000, { ...p, rainQuantity: 175 }, seeded());
  rainStep(many, 0, { ...p, rainQuantity: 25 });
  expect(many.drops.length).toBeLessThanOrEqual(Math.round(1600 * 1000 / 18000 * .25));
});
