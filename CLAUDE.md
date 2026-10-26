# chialing.chen.highlights

Chia-Ling Chen's portfolio site. Static HTML, CSS and vanilla JS. No build step.

## Writing style

These rules apply to every piece of visible copy on the site.

**Punctuation**

- No en dashes (`–`) anywhere in prose.
- No em dashes (`—`) either, with one exception: **a matched pair** may set off an inline list
  in the middle of a sentence, where the list names the thing just mentioned. A single em dash
  used as a pause is still not allowed. The exception reads like this:

  > Once a flow outgrew the viewport, every incremental edit — finding a node, reading a label,
  > rearranging a branch — compounded, and the effort to work around that friction only grew.

  Everywhere else, use a full stop and start a new sentence, or rephrase.
- No semicolons in prose.
- Keep commas to a minimum. No sentence should carry three or more. If a sentence needs that
  many, split it. Two cases do not count against the limit: simple lists ("product, engineering,
  data, research and content") and the commas inside a matched em dash pair above.
- Hyphens inside compound words are fine ("0-to-1", "edit-to-publish", "post-launch").

**Sentences**

- Short and declarative. One idea per sentence.
- Prefer a full stop over a subordinate clause. "The real problem was size." beats "The problem,
  which turned out to be size, ..."
- No contractions. Write "we would", not "we'd".

**Voice**

- First person for what Chia-Ling did ("I designed", "I ran"). "We" for the team.
- Write from inside the project, as the person who owned the work. Not as an analyst describing
  it from outside.
- Lead with the point, then the supporting data. Not "Usage data revealed X" but "X. The data
  showed ..."
- No marketing or strategy jargon where a plain word exists. Say "the other automation tools",
  not "the category".

**Captions**

- A caption says what the image shows that the body text does not. Never restate the paragraph
  it sits next to.

## Content rules

- Figures and stats must match across pages. Partner flows are **two times bigger** than
  single-account flows, not three.
- Legacy and Classic are the two platform names. Define them before first use in body copy.

## Structure

| File | Purpose |
| --- | --- |
| `index.html` | Home. Hero, featured work card, experience timeline |
| `about.html` | Full experience, one media item per role |
| `thryv-automation.html` | The Thryv Automation Builder case study |
| `work.html` | Older project list. Nothing links to it |
| `style.css` | All styling. Theme tokens at the top |
| `motion.js` | Scroll reveal, and clips that load only when near the viewport |
| `nav.js` | Sliding nav highlight and the Connect dropdown |
| `lightbox.js` | Full-screen viewer for images and clips |
| `weather-favicon.js` | Tab icon showing the weather where the visitor is |

Bump the `?v=` number on `style.css` (and on a JS file you change) in all four pages whenever
you edit it, otherwise returning visitors keep the cached copy.

## Media

- Clips: H.264 MP4, 30fps, no audio, `preload="none"` and no `autoplay` unless the clip sits
  above the fold. `motion.js` starts them when they come near the viewport.
- Images: keep full resolution so they stay sharp on retina. Compress with
  `ffmpeg -i in.png -q:v 3 out.jpg` rather than scaling down.
- Keep each page's initial load under about 1 MB. The whole site should load in well under five
  seconds.

## Analytics

Two Google IDs are in play and they are not interchangeable.

| ID | What it is | Where it goes |
| --- | --- | --- |
| `G-07SR0QSF4S` | Google tag ID | The `gtag/js?id=` URL and the `gtag('config', ...)` call |
| `G-9GZDQ40ZDH` | Measurement ID | Nowhere in the markup. It is what GA Admin displays, and what `tid=` shows on the outgoing hit |

The tag container for `G-07SR0QSF4S` already routes to `G-9GZDQ40ZDH` as its destination.
Putting the measurement ID in the script URL returns a 404 from Google, the library never
loads and nothing is collected. The page still looks fine, so this failure is silent.

To check it is working, load a page and watch for a request to
`google-analytics.com/g/collect` carrying `tid=G-9GZDQ40ZDH`.

## Weather favicon

The tab icon shows the current weather at the visitor's location.

`avatar.jpg` is declared as the icon in the markup and stays there until a real reading
arrives. A lookup that fails leaves the avatar in place, because a wrong sky is worse than
no sky. Three outside calls are possible and all of them are keyless.

1. `get.geojs.io` turns the visitor's IP into coordinates
2. If that fails, the browser timezone gives a city name, which
   `geocoding-api.open-meteo.com` turns into coordinates
3. `api.open-meteo.com` returns a WMO weather code and a day or night flag

The result is cached in `localStorage` for 30 minutes, so moving between pages costs nothing.
Everything runs on `load` behind a 3.5 second timeout, so it never delays rendering.

Codes map to `☀️ 🌙 🌤️ ☁️ ☔️ 🌧️ ❄️ ⚡️`. The mapping lives in `emojiFor`.

**Privacy.** The visitor's IP reaches geojs and Open-Meteo. Nothing is stored beyond the
emoji and a timestamp, and no coordinates are written to disk. Removing the script removes
the exposure, and the avatar icon keeps working.

## Publishing

Work happens on the `multi-page` branch. Push it to two remotes:

```bash
git push origin multi-page
git push https://github.com/chialingchen-portfolio/chialingchen-portfolio.github.io.git multi-page:refs/heads/main
```

The second one is what GitHub Pages builds and serves at
https://chialingchen-portfolio.github.io/

**Only push when Chia-Ling asks.** Make changes, verify them in the local preview, and wait.

GitHub Pages allows roughly 10 builds per hour. Batch edits into one push. Going over the limit
makes every later build fail with a bare "Page build failed" and no explanation.
