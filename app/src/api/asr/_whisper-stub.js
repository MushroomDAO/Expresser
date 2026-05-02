/**
 * Metro stub for whisper.rn
 *
 * whisper.rn is NOT installed because v0.5.4 (latest) calls
 * EXFileSystemInterface.getPathPermissions which was removed in
 * expo-file-system v18 / v19. This stub prevents Metro from throwing
 * "Unable to resolve module 'whisper.rn'" if the package is accidentally
 * referenced at bundle time.
 *
 * The real ASR code in src/api/asr/whisper.ts uses a mock implementation
 * until the upstream incompatibility is fixed.
 *
 * See: docs/decisions/ADR-003-local-asr-blocked.md
 *
 * TODO(unblock): Delete this file and remove the extraNodeModules entry in
 * metro.config.js once whisper.rn is compatible with expo-file-system v19.
 */

module.exports = {};
