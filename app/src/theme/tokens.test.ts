import { describe, expect, it } from 'vitest';

import { gestures, motion, palette, petalGeom } from './tokens';

// Threshold values are part of the design contract — flag any drift here so
// it can't sneak in unnoticed.
describe('design tokens — gesture thresholds', () => {
  it('press-arm is 130ms', () => {
    expect(gestures.pressDelayMs).toBe(130);
  });
  it('up swipe trigger is 80px', () => {
    expect(gestures.swipeUpPx).toBe(80);
  });
  it('record min is 600ms (misfire window)', () => {
    expect(gestures.recordMinMs).toBe(600);
  });
  it('video long-press is 320ms', () => {
    expect(gestures.videoLongPressMs).toBe(320);
  });
});

describe('design tokens — petal geometry', () => {
  it('button is 188px with 6 petals', () => {
    expect(petalGeom.size).toBe(188);
    expect(petalGeom.petalCount).toBe(6);
  });
});

describe('design tokens — motion', () => {
  it('countdown is 5000ms', () => {
    expect(motion.countdownMs).toBe(5000);
  });
  it('pool flash is 1800ms', () => {
    expect(motion.poolFlashMs).toBe(1800);
  });
});

describe('design tokens — brand color', () => {
  it('primary is sakura pink #e87aa3', () => {
    expect(palette.primary).toBe('#e87aa3');
  });
});
