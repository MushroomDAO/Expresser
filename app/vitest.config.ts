import { defineConfig } from 'vitest/config';
import path from 'path';

// We only test pure logic — store/reducer, mock pipeline timing, gesture
// thresholds. RN rendering is excluded; that path runs through Expo on
// device.
export default defineConfig({
  resolve: {
    alias: {
      // expo-file-system uses native modules that Rollup cannot parse.
      // Redirect to the package's own stub so unit tests run in Node.
      'expo-file-system': path.resolve(
        __dirname,
        'node_modules/expo-file-system/mocks/FileSystem.ts',
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    testTimeout: 10000,
  },
});
