import {build} from 'esbuild';
await build({entryPoints:['journey.jsx'],bundle:true,jsx:'automatic',loader:{'.js':'jsx'},minify:true,define:{'process.env.NODE_ENV':'"production"'},external:['/images/*'],outfile:'../app/src/main/assets/journey/journey.js'});
