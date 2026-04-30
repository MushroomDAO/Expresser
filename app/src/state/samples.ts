import type { Piece, Target } from '../types';

// Same fixture as design_handoff_expresser/source/phone-app.jsx — used to
// seed the pool view + compose view in mock mode.
export const SAMPLE_POOL: Piece[] = [
  { id: 'p1', kind: 'voice', t: '08:42', dur: '00:14', text: '今天早上的可颂层次分明,黄油香气浓郁。', tag: '美食' },
  { id: 'p2', kind: 'photo', t: '08:43', tag: '美食', cover: 'warm' },
  { id: 'p3', kind: 'photo', t: '08:51', tag: '街景', cover: 'cool' },
  { id: 'p4', kind: 'voice', t: '09:04', dur: '00:22', text: '河边的风很舒服,芦苇荡得很有节奏。', tag: '心情' },
  { id: 'p5', kind: 'video', t: '09:08', dur: '00:38', tag: '日常', cover: 'warm' },
  { id: 'p6', kind: 'photo', t: '09:14', tag: '日常', cover: 'mint' },
  { id: 'p7', kind: 'voice', t: '09:19', dur: '00:08', text: '想顺路买一束含羞草。', tag: '心情' },
];

export const TARGETS: Target[] = [
  { id: 'blog',  label: 'Personal blog',   sub: 'RSS' },
  { id: 'feed',  label: 'Photo feed',      sub: 'Image + caption' },
  { id: 'reels', label: 'Short video',     sub: 'Reel' },
  { id: 'nas',   label: 'Private archive', sub: 'NAS backup' },
];

// Streamed transcript fixture — emits a chunk every motion.transcriptChunkMs.
export const TRANSCRIPT_CHUNKS = [
  '今天',
  '今天早上',
  '今天早上去了',
  '今天早上去了城东的',
  '今天早上去了城东的那家烘焙店',
  '今天早上去了城东的那家烘焙店,',
  '今天早上去了城东的那家烘焙店,可颂',
  '今天早上去了城东的那家烘焙店,可颂层次分明',
  '今天早上去了城东的那家烘焙店,可颂层次分明,黄油香气浓郁。',
];
