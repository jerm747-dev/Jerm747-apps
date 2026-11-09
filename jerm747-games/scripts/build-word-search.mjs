import { build } from 'esbuild';
await build({
  entryPoints: ['public/projects/word-search/game.js'], outfile: 'public/projects/word-search/word-game-107.js',
  bundle: true, minify: true, format: 'iife', target: 'chrome80'
});
