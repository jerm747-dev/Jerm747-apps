Application Console: public demo (WASVC + EMVT)

This folder holds a SANITIZED demo build. It runs entirely in the browser on built-in sample data:
no backend, no real servers, no real job paths, roles or app names.

Do not edit index.html by hand. It is generated from the private build with make-console-demo.js,
which swaps out work-specific names and colors and refuses to write the demo if any are left.
Regenerate it after each private update instead:

  node make-console-demo.js <private build>.html jerm747-dev/public/sites/console-demo/index.html

Show it on the site: jerm747.dev/#/admin > Sites > New site, web address "console-demo".
