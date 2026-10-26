# Stats Tools

A free, stapplet-style statistics app for on-level stats students. It's plain HTML, CSS and JavaScript, with no installs, accounts or build step. Its wording follows Math Medic.

## What's inside

| Tab | What students can do |
|---|---|
| **One Variable** | Summary stats (n, x̄, sₓ, σₓ, s², 5-number summary, range, IQR) · outliers (1.5 × IQR fences) · shape guess with a SOCV sentence frame · dotplot, histogram, boxplot, stemplot · z-scores and percentiles · "what if one value changed?" resistance demo · compare up to 3 groups |
| **Two Variables** | Scatterplot · r, LSRL, r², s · residual plot with curved-pattern check · predictions with an extrapolation warning · residual for any point |
| **Categorical** | Frequency / relative-frequency tables · bar and pie charts · two-way tables with marginal and conditional distributions · segmented and side-by-side bar charts |
| **Normal** | Area left / right / between / outside · inverse (value from an area) · 68–95–99.7 overlay · TI-84 `normalcdf` / `invNorm` equivalents |
| **Simulation** | One proportion, difference in means, and difference in proportions · students choose how many simulations to run (1, 10, 100, 1000, or any number up to 10,000 at a time) · approximate p-value and conclusion sentence frames |

Every result has a **Show work** section (the formula with the student's numbers plugged in) and a **What does this mean?** box (a sentence frame written in context). Every graph has a **Download graph** button that saves a PNG students can paste into Google Docs.

## Put it on GitHub Pages

1. On GitHub, create a new **public** repository named `stats-tools`.
2. Upload everything in this folder: `index.html`, `css/`, `js/`, `data/` and this README. Use **Add file → Upload files** and drag the folders in. You can leave out the `.claude` and `tests` folders.
3. Go to **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then pick **main** and **/ (root)**, and click **Save**.
4. After a minute or two the site will be live at `https://hosuejernandez.github.io/stats-tools/`.

## Embed it on the class website

```html
<iframe src="https://hosuejernandez.github.io/stats-tools/" width="100%" height="900" style="border:0"></iframe>
```

To open a specific tab, add it to the end of the link: `#one-var`, `#two-var`, `#categorical`, `#normal` or `#simulation`. For example, `https://hosuejernandez.github.io/stats-tools/#simulation`.

## Make changes

- **Sample datasets** are in `data/samples.js`. To add one, copy an entry and change the numbers. It shows up in that tab's "Try a sample dataset" menu.
- **Colors** are at the top of `css/styles.css`.
- **Sentence frames** are written inside each tab's file in `js/modules/`.

After you upload a change, GitHub Pages can take a few minutes to update, and browsers may show the old version until the page is refreshed.

## Run it on your computer

Browsers don't run JavaScript modules from a double-clicked file, so start a small local server from inside this folder:

```bash
python3 -m http.server 8765
```

Then open <http://localhost:8765>.

To check the math after editing `js/stats.js`, run:

```bash
node tests/stats.test.mjs
```
