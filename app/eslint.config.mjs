// https://docs.expo.dev/guides/using-eslint/
import expoConfig from 'eslint-config-expo/flat.js';

export default [
  ...expoConfig,
  {
    ignores: ['dist/*', '.expo/*', 'node_modules/*', 'web-build/*'],
  },
  {
    rules: {
      'react-hooks/exhaustive-deps': 'warn',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    // smoke + dev scripts log freely — they only run from `pnpm dlx tsx`
    files: ['scripts/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
];
