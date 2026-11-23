Application Console v0.2.0: PRIVATE download page

This folder is the password-protected page the QR code points to:
  https://jerm747.dev/sites/console-d19f6b53/

  index.php       shows the page (page.html) and logs the visit
  get.php         every download goes through here and is logged
  go.php          "Open the console": logged, then opens console/
  console/        the console itself (WASVC + EMVT), runs on sample data
  downloads/      wasvc-v0.2.0.zip, the PDF guide and the three decks (not reachable directly)

Visits, downloads and console opens show on jerm747.dev/#/admin > Shared, and you get an email on the
first visit and the first download, plus a reminder when the 30 days are up. Visitors never see any of
it. Tracking needs this folder to sit at sites/console-d19f6b53/ on the jerm747.dev site (it uses the site's
api/ folder); anywhere else the page still works, just without tracking.

Upload and lock it down (cPanel):
1. Upload the jerm747.dev build that includes the Shared tab first (api/shares_lib.php).
2. File Manager: upload this folder to  sites/console-d19f6b53/  (replace the files if an older version is there).
3. cPanel > Files > Directory Privacy > sites/console-d19f6b53 > tick "Password protect this directory", Save.
4. Same screen: add a user and a strong password. Tip: one user per person you share with, so the
   Shared tab shows who signed in.
5. On the admin page, tick "Don't count my own visits" (Traffic or Shared tab) before you test it.
6. Open the address above and confirm the browser asks for the password.
Don't add this folder on the public Sites page; "private" there only hides the listing.
