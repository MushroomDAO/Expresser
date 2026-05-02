// Metro bundler configuration for Expresser (Expo SDK 54)
//
// whisper.rn stub
// ---------------
// whisper.rn v0.5.4 is incompatible with expo-file-system v19 (required by
// SDK 54). It is NOT installed. The stub below makes Metro resolve any
// `require('whisper.rn')` / `import ... from 'whisper.rn'` to an empty
// module so that dynamic-require patterns in src/api/asr/whisper.ts do not
// cause a bundler error even if someone accidentally re-adds the package.
//
// TODO(unblock): Remove the extraNodeModules entry once whisper.rn publishes
// a version compatible with expo-file-system v19.
// See: docs/decisions/ADR-003-local-asr-blocked.md

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver = config.resolver ?? {};
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  // Stub out whisper.rn — resolves to an empty object so import/require
  // never throws at bundle time. Runtime calls go to the mock adapter in
  // src/api/asr/whisper.ts and never reach this stub.
  'whisper.rn': require.resolve('./src/api/asr/_whisper-stub.js'),
};

module.exports = config;
