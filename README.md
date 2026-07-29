<div align="center">

# 🌸 Happy National Girlfriend Day

**An interactive kinetic-typography lyric piece — built with nothing but HTML, CSS and vanilla JavaScript.**

Solve a heart-shaped jigsaw to begin. The heart detonates into a field of cherry
blossoms, the blossoms part like a curtain, and a synchronised lyric video plays
out on a single continuous canvas — before looping back to the puzzle.

[![No dependencies](https://img.shields.io/badge/dependencies-none-ff8fab?style=flat-square)](#)
[![No build step](https://img.shields.io/badge/build_step-none-ffb3c6?style=flat-square)](#)
[![Vanilla JS](https://img.shields.io/badge/vanilla-JS-c4141f?style=flat-square)](#)
[![Responsive](https://img.shields.io/badge/mobile_%2B_desktop-fullscreen-ff8fab?style=flat-square)](#)

</div>

---

## ⚠️ Keep this repository private

`song.mp3` and `october.md` are committed here, so a clone runs complete. They hold a
**copyrighted recording and its lyrics** — safe in a private repository, because nothing
is being distributed.

**Before ever making this public,** untrack them first:

```bash
git rm --cached song.mp3 october.md
# then restore the two ignore lines in .gitignore
```

Publishing them would mean redistributing someone else's work under this repository's
name, and a DMCA takedown removes the whole repo — not just the offending files.

The engine is built to survive without them, so removing them breaks nothing:

- No lyric file → falls back to neutral placeholder phrases
- No audio → the master clock falls back to `performance.now()` and plays silently

---

## ✨ What it does

<table>
<tr><td width="50%" valign="top">

### 🧩 The gate
A heart cut into four interlocking jigsaw pieces, scattered at random. Drag each into
its slot. Slots glow as a piece approaches; the rim flares white when it seats. Nothing
can fail — a near miss shivers and waits.

</td><td width="50%" valign="top">

### 💥 The detonation
The seams dissolve, the heart compresses, then bursts into ~390 cherry blossoms on
individual ballistic trajectories. The field breathes, then parts from the centre
outward like a curtain.

</td></tr>
<tr><td width="50%" valign="top">

### 🎵 The lyric phase
Each line is cued to a per-word timestamp. Words arrive one at a time, blurring into
focus. An oversized "ghost" duplicate blooms behind the type and is clipped by the
frame. A camera drifts and pushes with every phrase.

</td><td width="50%" valign="top">

### 📸 The collage
Three torn-paper photos land in sequence, each paired with a sung phrase that appears
beside it on its own beat. The camera then visits each photo in turn before pulling
back to reveal the whole arrangement.

</td></tr>
</table>

---

## 🎮 Controls

| Input | Action |
|-------|--------|
| **Drag** | Move a puzzle piece |
| **Click / tap** | Play or pause (once the gate is open) |
| <kbd>Space</kbd> | Play or pause |
| <kbd>R</kbd> | Restart |
| <kbd>Enter</kbd> | Place the focused piece (keyboard path) |
| <kbd>Tab</kbd> | Cycle pieces and controls |

Fully keyboard navigable, with a screen-reader path through the whole sequence.
Honours `prefers-reduced-motion`: the burst is skipped and every phrase becomes a
static fade.

---

## 🚀 Running it

`fetch()` is blocked on `file://` in Chrome and Edge, so the lyric file will not load
by double-clicking. Serve the folder:

```bash
# Python
python -m http.server 8000

# Node
npx serve .
```

Then open <http://localhost:8000>.

---

## 🎨 Adding your own song

**1. Drop in your audio** as `song.mp3`. The engine reads its real duration and
retimes the whole piece automatically.

**2. Write a lyric file** as `october.md`. One timestamp per word, blank lines
separating phrases:

```
[00:00.46] Your
[00:00.70] first
[00:01.10] line

[00:07.62] Your
[00:08.02] second
[00:08.82] line
```

Each blank-line block becomes one phrase — one full screen — and holds until the next
is due. Classic single-stamp-per-line `.lrc` files work too; the parser detects which
format you gave it.

**3. Replace the photos** — `p1.jpeg`, `p2.jpeg`, `p3.jpeg`. Aim for **4:5 portrait**;
anything else is centre-cropped. Adjust `CONFIG.PHOTO_FOCUS` to bias what survives
the crop.

---

## ⚙️ Configuration

Every tunable value lives in one `CONFIG` object at the top of `app.js`.

<details>
<summary><b>Timing</b></summary>

| Key | Purpose |
|-----|---------|
| `PAUSE` `MERGE` `RADIATE` | Completion-sequence act durations |
| `BURST` `HOLD` `CURTAIN` | Blossom explosion and curtain sweep |
| `HOLD_GAP` | Gap between one phrase leaving and the next arriving |
| `WORD_IN` `WORD_LEAD` | Per-word reveal timing |

⚠️ These are mirrored in `styles.css` animation durations. Change both together.

</details>

<details>
<summary><b>Blossoms</b></summary>

| Key | Purpose |
|-----|---------|
| `PETAL_COUNT` / `_WIDE` | Whole flowers — portrait / landscape |
| `PETAL_LOOSE` / `_WIDE` | Single drifting petals |
| `PETAL_MIN` `PETAL_MAX` | Size range, in `cqw` |
| `THROW_MIN` `THROW_MAX` | Launch distance, as a fraction of the long edge |

Count is trimmed automatically on low-core devices via `PETAL_SCALE`.

</details>

<details>
<summary><b>Camera</b></summary>

| Key | Purpose |
|-----|---------|
| `CAM_MOVES` | Per-phrase travel: `x`, `y`, `r`, `z` |
| `CAM_TOUR_ZOOM` | Framing zoom during the photo tour |
| `CAM_TOUR_OUT` | Pull-back duration at the end |
| `CAM_OVERSCAN` | **Must match** the `inset` on `#cam` in the stylesheet |

</details>

<details>
<summary><b>Layout</b></summary>

| Key | Purpose |
|-----|---------|
| `BOARD_W_DESKTOP` / `_TOUCH` | Puzzle size, in `vmin` |
| `PHOTO_LAYOUT` / `_WIDE` | Collage arrangement — portrait / landscape |
| `PHRASE_BREAK_WIDE` | Forced line breaks on wide screens |

</details>

---

## 🏗️ How it works

### One master clock
Every animation reads its progress from a single `requestAnimationFrame` loop driven by
`audio.currentTime`, falling back to `performance.now()`. There are no scattered CSS
`animation-delay`s in the lyric phase, so audio and visuals cannot drift apart.

### One continuous canvas
There are no cuts. Every change is an element animating in or out on the same
background — the composition never resets.

### Cover, not contain
The stage holds an exact 288:361 ratio and is scaled to **cover** the viewport, so it is
edge-to-edge on every device. Portrait crops the sides; landscape crops top and bottom.
Because the stage is larger than the screen, anything that must stay readable is capped
against `--safe-w` rather than a stage percentage.

### Performance
The burst runs ~390 animated elements and holds a smooth frame:

- **One node per flower.** Blossoms are pre-rendered background sprites, not live SVG
  trees — six cached rasters at 1024px serve every element.
- **Zero animated filters.** `drop-shadow` forces an offscreen pass per element per
  frame; all depth is painted into the sprite instead.
- **GPU compositing.** Every moving transform is 3D, so interpolation happens on the
  compositor rather than the main thread.
- **No `will-change`.** Promoting 390 permanent layers exhausts VRAM; a 3D transform
  promotes only while animating.

---

## 📁 Structure

```
publish/
├── index.html      structure only
├── styles.css      design tokens, layout, all keyframes
├── app.js          CONFIG, Timeline, parser, renderer
├── p1–p3.jpeg      collage photos (Unsplash placeholders)
├── song.mp3        audio — untrack before going public
└── october.md      per-word lyric timings — same
```

---

## 🖼️ Credits

Placeholder photos from [Unsplash](https://unsplash.com) — free for commercial and
non-commercial use, no attribution required.

Typeface: [Playfair Display](https://fonts.google.com/specimen/Playfair+Display)
(SIL Open Font License), the only external dependency.

---

## 📜 Copyright

```
Copyright © 2026 Revaldoo22. All rights reserved.
```

The **engine** — this layout, its motion design, the timing architecture, the LRC and
per-word parser, the jigsaw generator, the torn-edge algorithm, the camera system and
the blossom sprite pipeline — is original work.

Reproduction, redistribution or reuse in whole or in part, without written permission,
is not permitted.

**Not covered by the above:** any audio or lyric file you add locally. Those remain the
property of their respective rights holders and must not be published or redistributed.

<div align="center">

---

*Made with care, and a great deal of pink.*

</div>
