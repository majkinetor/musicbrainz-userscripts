import { test, expect, functionSource } from '../../../dev/test/harness.mjs';

const presets = async state => {
    const source = await functionSource('event_horizon', ['AMBIENT', 'AMBIENT_DEFAULTS', 'AMBIENT_KEYS', 'fxOf', 'FX_KEYS', 'fxNow', 'fxFull']);
    return new Function('S', source + `
        const DEFAULTS = JSON.stringify({ ...AMBIENT_DEFAULTS, bg: 'aura', fx: [], hex: false, effect: 'hexagons', ambientOpacity: 65 });
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
