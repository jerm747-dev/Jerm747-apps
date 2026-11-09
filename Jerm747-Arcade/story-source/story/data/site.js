/**
 * Your details for the About and Contact pages and the slide-out menu.
 * Edit anything here — leave a value as "" to hide it on the site.
 */
export const site = {
  name: "Jerm747",
  realName: "Jeremy Currence",
  location: "Charlotte, NC",
  careerStart: 2003, // used for "20+ years" on the About page

  // Tempo display: false = whole numbers ("96 BPM"); true = the exact tempo from the filename
  // when it has a decimal ("96.41 BPM"). Filters and /bpm/… links always use whole numbers,
  // so a 96.41 BPM song is still found under 96 and in the 90–100 range.
  exactTempo: false,

  // Album artwork by project: songs whose file names start with that project (e.g. "LIP 03 …")
  // show this cover everywhere — lists, song pages, the player, the lock screen and link previews.
  projectCovers: {
    LIP: "/covers/letters-in-purple.jpg", // Letters In Purple
  },

  // Song types for the Type filter (see src/categories.js): songs up to stemMaxSec seconds are Stems,
  // songs extendedMinSec seconds or longer are also Extended. Hand-pick types in src/data/categories.json.
  categories: { stemMaxSec: 90, extendedMinSec: 300 },

  // Auto gain (Preferences): evens out the volume between songs, using public/loudness.json
  // (made by `npm run loudness`). target: the level to match in LUFS (null = automatic, based on
  // your library); maxCut: the most a song is ever turned down, in dB. See src/loudness.js.
  autoGain: { target: null, maxCut: 12 },

  // "Let It Ride" (/ride): the one-big-button shuffle page, second in the menu. Rename it here.
  ride: {
    title: "Let It Ride",
    menuSub: "One tap · nonstop music",
    eyebrow: "Hit the road",
    lead: "No need to pick. One tap and the music keeps rolling.",
  },

  // Albums: each gets its own page (/album/<id>) and a spot in the menu, in its own color.
  // `project` matches the file-name prefix (LIP 01 …); songs are listed by their track number.
  albums: [
    {
      id: "letters-in-purple",
      title: "Letters In Purple",
      project: "LIP",
      artist: "Jerm747",
      cover: "/covers/letters-in-purple.jpg",
      color: "#9b6bea", // the purple used for its menu label, page glow and buttons
    },
  ],

  // Intro splash (the artwork, then a fade into the player):
  //   "visit"  = once each time someone comes to the site (not again on refresh or between pages)
  //   "first"  = only the very first time on a device
  //   "always" = every page load      "off" = never
  // Preview it anytime by adding ?intro=1 to the address.
  intro: "visit",
  // Seconds before the intro fades into the player on its own; 0 = wait for a tap on "Tap to listen".
  // Phones wait (with a gentle breathing glow); desktop moves on after 4 seconds.
  introAutoFade: { desktop: 4, phone: 0 },

  // How many of the newest songs (by created date) the built-in "Recently added" playlist shows
  recentlyAdded: 50,

  // The small PHP scripts in public/api/ (they run on your GoDaddy hosting) keep the shared
  // Like/Dislike totals and send Report emails. Set to "" to turn both off: likes then stay on
  // each device only, and Report opens the visitor's email app instead.
  api: "/api",

  contact: {
    name: "Jeremy Currence",
    email: "jerm@jerm747.com",
    phone: "", // e.g. "(704) 555-0100"
    mailingAddress: "", // e.g. "PO Box 1234\nCharlotte, NC 28201" (use \n for a new line)
    workingOn: "Collaborations, production, licensing and custom instrumentals",
    responseNote: "I read everything and usually reply within a few days.",
  },

  // Shown on the Contact page and at the bottom of the menu. Remove a line or leave url "" to hide it.
  social: [
    { label: "Instagram", handle: "@jerm747", url: "https://www.instagram.com/jerm747/" },
    { label: "Apple Music", handle: "Jeremy Currence", url: "https://music.apple.com/us/artist/jeremy-currence/1255502542" },
    { label: "Spotify", handle: "Jerm747", url: "" }, // paste your Spotify artist link
    { label: "YouTube", handle: "", url: "" },
  ],
};

export const socialLinks = site.social.filter((s) => s.url);
