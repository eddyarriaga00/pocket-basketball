/* Build models/player.glb: the one body every player on the floor wears, with the movements the game uses.
   Source: Quaternius's Universal Animation Library (CC0 1.0), its mannequin and 46 animations, downloaded from
   https://opengameart.org/content/universal-animation-library into .models/ual1.glb (not in the repository).
   What this keeps: the mesh, the skeleton, and the clips in KEEP; finger, scale and (but for the hips) position tracks
   are dropped (the hands hold a pose the game sets, bones only turn), keyframes thinned to within 0.004 of the curve, and the vertex data quantized (KHR_mesh_quantization, which three.js reads).
   Run: node tools/model.mjs   (needs @gltf-transform/core, functions and extensions in reach of node) */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { resample, prune, dedup, quantize, weld } from '@gltf-transform/functions';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEEP = ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Jump_Start', 'Jump_Loop', 'Jump_Land',
  'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Dance_Loop', 'Spell_Simple_Shoot', 'Punch_Jab', 'Hit_Chest', 'Idle_Talking_Loop'];

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(path.join(ROOT, '.models', 'ual1.glb'));
const root = doc.getRoot();
for (const a of root.listAnimations()) {
  if (!KEEP.includes(a.getName())) { a.dispose(); continue; }
  for (const ch of a.listChannels()) {
    const n = ch.getTargetNode() && ch.getTargetNode().getName();
    const path = ch.getTargetPath();
    /* fingers hold a pose the game sets; bones only rotate, except the hips, which also carry the body up and down */
    const drop = (n && /f_|thumb|toe|root$/.test(n) && !/foot/.test(n)) || path === 'scale' || (path === 'translation' && n !== 'DEF-hips');
    if (drop) { ch.getSampler() && ch.getSampler().dispose(); ch.dispose(); }
  }
}
await doc.transform(resample({ tolerance: 0.004 }), weld(), dedup(), prune(), quantize({ quantizePosition: 14, quantizeNormal: 10, quantizeTexcoord: 12, quantizeWeight: 8 }), prune());
fs.mkdirSync(path.join(ROOT, 'models'), { recursive: true });
const OUT = path.join(ROOT, 'models', 'player.glb');
await io.write(OUT, doc);
/* the steps above leave data with no user behind (quantize writes new vertex data and keeps the old); read the file
   back, where those show up with nothing but the root holding them, drop them and write it again */
const clean = await io.read(OUT);
for (const a of clean.getRoot().listAccessors()) if (a.listParents().every(p => p.propertyType === 'Root')) a.dispose();
await io.write(OUT, clean);
const kb = Math.round(fs.statSync(path.join(ROOT, 'models', 'player.glb')).size / 1024);
console.log(`${root.listAnimations().length} clips, ${kb} kB -> models/player.glb`);
