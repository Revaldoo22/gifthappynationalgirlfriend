<div align="center">

# 🌸 Happy National Girlfriend Day

**A little interactive gift, made from scratch.**

Put a heart back together, and it opens into something.

<br>

[![Made by rvldoputra](https://img.shields.io/badge/made_by-@rvldoputra-ff8fab?style=for-the-badge&logo=tiktok&logoColor=white)](https://www.tiktok.com/@rvldoputra)

<br>

</div>

---

## 🎁 What is this?

A small web page that plays like a short film.

It opens on a heart split into four puzzle pieces, scattered across the screen. Drag them
together. When the last one clicks into place the heart glows, bursts into a few hundred
cherry blossoms, and those blossoms sweep apart like a curtain — revealing a lyric video
that plays out word by word, in time with the music.

At the end, three photos land on the page and the camera walks between them before pulling
back. Then the curtain closes and you can do the whole thing again.

**There is nothing to install and nothing to sign up for.** It is one folder of files that
runs in a browser.

---

## ▶️ How to open it

The page loads a lyric file while it runs, and browsers block that for files opened
directly from your computer. So it needs to be *served* — which sounds technical but is
one command.

<details open>
<summary><b>The simple way</b></summary>

<br>

If you have **Python** (most computers do), open a terminal in this folder and run:

```bash
python -m http.server 8000
```

Then open **<http://localhost:8000>** in your browser.

</details>

<details>
<summary><b>If you have Node instead</b></summary>

<br>

```bash
npx serve .
```

It will print a link — open that.

</details>

<details>
<summary><b>Not sure what a terminal is?</b></summary>

<br>

Easiest route: drag this folder onto [netlify.com/drop](https://app.netlify.com/drop).
It gives you a live link in a few seconds, no account needed.

You can also open `index.html` directly — everything works except the real lyrics, which
are replaced by placeholder text.

</details>

---

## 🎮 What you can do

| | |
|---|---|
| 🖱️ **Drag** | Move a puzzle piece |
| 👆 **Click or tap** | Pause and resume |
| ⌨️ <kbd>Space</kbd> | Pause and resume |
| ⌨️ <kbd>R</kbd> | Start over |
| ⛶ **Top-right button** | Fullscreen (desktop) |

Works on a phone and on a desktop. Turn the sound on.

> **Tip:** it loops forever — the curtain closes and the puzzle comes back, scattered
> differently each time.

---

## 🔍 A few things worth noticing

<table>
<tr><td width="33%" valign="top" align="center">

### 🧩
**The puzzle is real**

The four pieces have interlocking tabs that genuinely fit. Nothing snaps unless it is
close enough, and you cannot get it wrong — a near miss just shivers and waits.

</td><td width="33%" valign="top" align="center">

### 🌸
**~390 flowers**

Every blossom is thrown on its own arc, at its own speed, and drifts on its own slow
loop once it lands. No two runs look the same.

</td><td width="33%" valign="top" align="center">

### 🎵
**Word by word**

Each word appears on the exact beat it is sung, letters cascading in one after another.
The timing comes from the audio itself, so it never drifts.

</td></tr>
</table>

---

## 🛠️ Built with

Plain **HTML**, **CSS** and **JavaScript**. No frameworks, no build step, no libraries.

Three files do everything:

```
index.html    the structure
styles.css    every colour, layout and animation
app.js        the clock, the puzzle, the flowers, the camera
```

The only outside thing it uses is a Google font.

<details>
<summary><b>For the curious — how it holds together</b></summary>

<br>

**One clock.** Every animation reads its position from a single loop driven by the audio's
own playback time. That is why the words never drift out of sync, even if the page stutters.

**No cuts.** From the first frame to the last, nothing is ever swapped out — every change
is something moving in or out on the same canvas.

**Edge to edge.** The composition holds a fixed shape and is scaled to fill whatever
screen it lands on, so it never sits in a letterboxed box.

**Fast on purpose.** Nearly 400 flowers move at once, which normally would not be smooth.
Each one is a single cached image rather than a live drawing, nothing uses an expensive
filter, and all motion runs on the graphics card instead of the main thread.

</details>

---

## 💗 Credits

Photos from [Unsplash](https://unsplash.com). Type is
[Playfair Display](https://fonts.google.com/specimen/Playfair+Display).

The music is not mine — it belongs to its artist, and it is here only so this gift plays
the way it was meant to.

---

<div align="center">

## 📜

**© 2026 Revaldoo22**

The page itself — the design, the animation, the puzzle, the code — is my own work.
Please don't repost it as yours.

<br>

[![TikTok](https://img.shields.io/badge/say_hi-@rvldoputra-000000?style=for-the-badge&logo=tiktok&logoColor=white)](https://www.tiktok.com/@rvldoputra)

<br>

*Made with care, and a great deal of pink.*

</div>
