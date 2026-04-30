/**
 * Smoke test for the mock pipeline. Exercises the same calls HomeScreen makes:
 *   transcribe → finalizeCapture → process → upload → publish
 * and prints stage timings so we can verify behaviour without a UI.
 *
 * Run:  pnpm exec tsx scripts/smoke-mock.ts
 */

import {
  mockFinalizeCapture,
  mockProcess,
  mockPublish,
  mockTranscribe,
  mockUpload,
} from '../src/api/mock';

const t0 = () => Date.now();
const since = (start: number) => `${(Date.now() - start).toString().padStart(4, ' ')}ms`;

async function main() {
  console.log('▶ Expresser mock-pipeline smoke');

  // 1. Streaming ASR — collect chunks for ~1.6s as if the user held the petal.
  console.log('\n── 1. mockTranscribe (1600ms hold) ──');
  let lastChunk = '';
  let chunkCount = 0;
  const t1 = t0();
  const handle = mockTranscribe((chunk) => {
    chunkCount++;
    lastChunk = chunk;
    console.log(`  [${since(t1)}] chunk #${chunkCount}: ${chunk}`);
  });
  await new Promise((r) => setTimeout(r, 1600));
  const final = await handle.finish();
  console.log(`  ✓ final transcript (${chunkCount} chunks): ${final}`);

  // 2. Finalize capture into a Piece.
  console.log('\n── 2. mockFinalizeCapture ──');
  const t2 = t0();
  const piece = await mockFinalizeCapture({ kind: 'voice', durationSec: 1.6, text: final });
  console.log(`  [${since(t2)}] piece: ${JSON.stringify(piece)}`);

  // 3. Local on-device compose — should tick at ~7%/100ms (≈1.4s).
  console.log('\n── 3. mockProcess (target ≈1.4s) ──');
  const t3 = t0();
  await mockProcess({ pieces: [piece], createdAt: Date.now() }, (e) => {
    if (e.progress % 21 === 0 || e.progress === 100) {
      console.log(`  [${since(t3)}] process ${e.progress}%`);
    }
  });
  console.log(`  ✓ done in ${since(t3)}`);

  // 4. NAS upload — ~5%/80ms ≈ 1.6s.
  console.log('\n── 4. mockUpload (target ≈1.6s) ──');
  const t4 = t0();
  await mockUpload({ pieces: [piece], createdAt: Date.now() }, (e) => {
    if (e.progress % 25 === 0 || e.progress === 100) {
      console.log(`  [${since(t4)}] upload ${e.progress}%`);
    }
  });
  console.log(`  ✓ done in ${since(t4)}`);

  // 5. Publish fan-out.
  console.log('\n── 5. mockPublish ──');
  const t5 = t0();
  const targets = await mockPublish({ pieces: [piece], createdAt: Date.now() });
  console.log(`  [${since(t5)}] published to: ${targets.join(', ')}`);

  console.log('\n✅ smoke ok');
}

main().catch((err) => {
  console.error('❌ smoke failed:', err);
  process.exit(1);
});
