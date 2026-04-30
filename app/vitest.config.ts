import { defineConfig } from 'vitest/config';

// We only test pure logic — store/reducer, mock pipeline timing, gesture
// thresholds. RN rendering is excluded; that path runs through Expo on
// device.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10000,
  },
});
