import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

const engine = async () => new Function(await functionSource('event_horizon', ['tronHit', 'tronSpawn', 'tronCreate', 'tronStep']) + '; return { tronHit, tronCreate, tronStep };')();
const params = { tronGrid: 40, tronRiders: 0, tronSpeed: 2, tronTrail: 3 };
const rider = (id, x, y, dir, trail = []) => ({ id, x, y, dir, trail, alive: true, distance: 0, remaining: 40, respawn: 0, died: -1 });

test('Tron detects crossings, endpoints and collinear trails between frames', { tag: '@unit' }, async () => {
    const { tronHit } = await engine();
    expect(tronHit(0, 20, 10, 20, { a: [5, 0], b: [5, 40] })).toBe(5);
    expect(tronHit(10, 20, 0, 20, { a: [5, 20], b: [8, 20] })).toBe(2);
    expect(tronHit(20, 0, 20, 10, { a: [0, 5], b: [20, 5] })).toBe(5);
    expect(tronHit(0, 20, 4, 20, { a: [5, 0], b: [5, 40] })).toBe(Infinity);
});

test('Tron kills the driver at the nearest foreign trail and emits one crash', { tag: '@unit' }, async () => {
    const { tronCreate, tronStep } = await engine();
    const state = tronCreate(200, 200, params, () => .5);
    const driver = rider(0, 0, 20, 0);
    const owner = rider(1, 5, 40, 1, [{ a: [5, 0], b: [5, 40], start: -40, end: 0, dir: 1 }]);
    owner.trail.unshift({ a: [6, 0], b: [6, 40], start: -80, end: -40, dir: 1 });
    state.riders = [driver, owner];
    tronStep(state, .1, params);
    expect(driver.alive).toBe(false);
    expect([driver.x, driver.y]).toEqual([5, 20]);
    expect(owner.alive).toBe(true);
    expect(state.effects).toHaveLength(1);
    expect(state.effects[0]).toMatchObject({ id: 0, x: 5, y: 20 });
    const crashPosition = [driver.x, driver.y];
    tronStep(state, .1, params);
    expect([driver.x, driver.y]).toEqual(crashPosition);
    expect(state.effects).toHaveLength(1);
    for (let i = 0; i < 6; i++) tronStep(state, .1, params);
    expect(driver.trail).toHaveLength(0);
    expect(state.effects).toHaveLength(0);
    for (let i = 0; i < 10; i++) tronStep(state, .1, params);
    expect(driver.alive).toBe(true);
});

test('Tron ignores its own trail', { tag: '@unit' }, async () => {
    const { tronCreate, tronStep } = await engine();
    const state = tronCreate(200, 200, params, () => .5);
    const driver = rider(0, 0, 20, 0, [{ a: [5, 0], b: [5, 40], start: -40, end: 0, dir: 1 }]);
    state.riders = [driver]; tronStep(state, .1, params);
    expect(driver.alive).toBe(true); expect(driver.x).toBe(7); expect(state.effects).toHaveLength(0);
});

test('Tron paths turn independently, stay in bounds and keep bounded trails', { tag: '@unit' }, async () => {
    const { tronCreate, tronStep } = await engine();
    let seed = 123;
    const random = () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296);
    const p = { ...params, tronRiders: 8, tronTrail: 6 };
    const state = tronCreate(800, 600, p, random);
    const directions = new Set(); let crashes = 0;
    for (let i = 0; i < 2400; i++) {
        tronStep(state, 1 / 30, p);
        for (const r of state.riders) {
            if (!r.alive) continue;
            directions.add(r.dir);
            if (r.x < -1e-6 || r.x > state.maxX + 1e-6 || r.y < -1e-6 || r.y > state.maxY + 1e-6) throw new Error('Rider left the grid');
            const length = r.trail.reduce((sum, edge) => sum + edge.end - edge.start, 0);
            if (length > p.tronGrid * p.tronTrail + 1e-6) throw new Error('Trail exceeded its length limit');
        }
        crashes += state.effects.length;
    }
    expect(directions.size).toBe(4); expect(crashes).toBeGreaterThan(0);
    expect(new Set(state.riders.map(r => r.trail.map(e => e.dir).join(','))).size).toBeGreaterThan(1);
});
