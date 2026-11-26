/* PocketBasketball: start-up. three.js and its glTF loader come in as modules; the game's own files are classic
   scripts that read window.THREE, so they are added here, in order, once the library is in. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
window.THREE = THREE;
window.THREE_ADDONS = { GLTFLoader, SkeletonUtils };
const files = ['js/data.js', 'js/court.js', 'js/sfxpack.js', 'js/vo.js', 'js/audio.js', 'js/booth.js', 'js/game.js', 'js/career.js', 'js/season.js', 'js/online.js', 'js/net.js', 'js/account.js'];
for (const f of files) await new Promise((ok, no) => { const s = document.createElement('script'); s.src = f; s.async = false; s.onload = ok; s.onerror = no; document.body.appendChild(s); });
PB.boot();
/* offline play: only on the real site, never on a local test server */
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
