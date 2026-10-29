import {build} from 'esbuild';
await build({entryPoints:['src/album-match/entry.jsx'],bundle:true,loader:{'.svg':'dataurl'},format:'iife',minify:true,outfile:'public/projects/album-match/game.js',define:{'process.env.NODE_ENV':JSON.stringify('production')}});
