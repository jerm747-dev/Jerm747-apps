Sites in development live here, one folder per site:

  sites/<address>/index.html   (plus the rest of that site's build)

1. In jerm747.dev/#/admin > Sites, create the site. The "Web address" you pick is the folder name.
2. Build the client's site (npm run build, or whatever it uses) and upload the build's contents
   into this folder: sites/<address>/
3. The preview on the site's page shows it right away. Re-upload over the top for each new round.

Vite sites: build with   npx vite build --base=/sites/<address>/   so its links work from this folder.
Each folder is marked "noindex", so search engines leave work in progress alone.
When a site launches on its own domain, upload the same build there.
