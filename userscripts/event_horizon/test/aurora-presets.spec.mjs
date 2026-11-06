import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

const presets = async state => {
    const source = await functionSource('event_horizon', ['AMBIENT', 'AMBIENT_DEFAULTS', 'fxOf', 'FX_OWN', 'AMBIENT_KEYS', 'fxMigrate', 'FX_KEYS', 'fxNow', 'fxFull']);
    return new Function('S', source + `
        const DEFAULTS = JSON.stringify({ ...AMBIENT_DEFAULTS, bg: 'aura', fx: [], hex: false, effect: 'hexagons', ambientOpacity: 65, ...FX_OWN, hexColours: [] });
        return { now: fxNow, restore: fxFull };
    `)(state);
};

test('Aurora styles and diffusion survive saved-preset JSON round trips', { tag: '@unit' }, async () => {
    for (const style of [0, 1, 2, 3]) {
        const api = await presets({ fx: ['aurora'], hex: true, effect: 'aurora', auroraStyle: style, auroraDiffuse: 80 });
        const saved = JSON.parse(JSON.stringify({ name: 'Soft lights', v: api.now() }));
        const restored = api.restore(saved);
        expect(restored.fx).toEqual(['aurora']);
        expect(restored.auroraStyle).toBe(style);
        expect(restored.auroraDiffuse).toBe(80);
    }
});

test('Older Aurora presets retain Rays without added diffusion', { tag: '@unit' }, async () => {
    const api = await presets({ auroraStyle: 3, auroraDiffuse: 100 });
    const restored = api.restore({ name: 'Old Aurora', v: { fx: ['aurora'], hex: true, effect: 'aurora', auroraRibbons: 3 } });
    expect(restored.auroraStyle).toBe(0);
    expect(restored.auroraDiffuse).toBe(0);
    expect(restored.auroraRibbons).toBe(3);
});

test('Older presets give each effect the Opacity, Glow and Colour they shared', { tag: '@unit' }, async () => {
    const api = await presets({});
    const restored = api.restore({ name: 'Shared', v: { fx: ['aurora', 'tron'], ambientOpacity: 40, hexGlow: 2, hexTwo: 2 } });
    for (const k of ['aurora', 'tron', 'stars', 'rain']) {
        expect(restored[k + 'Opacity']).toBe(40);
        expect(restored[k + 'Glow']).toBe(2);
        expect(restored[k + 'Colour']).toBe(2);
    }
    const fresh = api.restore({ name: 'New', v: { fx: ['aurora'], auroraOpacity: 85, tronOpacity: 25 } });
    expect([fresh.auroraOpacity, fresh.tronOpacity]).toEqual([85, 25]);
});
