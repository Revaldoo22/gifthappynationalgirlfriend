"use strict";
/* ══════════════════════════════════════════════════════════════════════════
   Kinetic typography lyric piece — timing engine and renderer
   © 2026 Revaldoo22. All rights reserved.

   Original work: the master-clock architecture, LRC/per-word parser, camera
   system, torn-edge generator and motion design are authored here.
   Reproduction, redistribution or reuse in whole or in part without written
   permission is not permitted.

   NOTE ON MEDIA: song.mp3 and the lyric file contain third-party
   copyrighted material and are NOT covered by the above. Lyrics are read
   from your local file at runtime and are deliberately never embedded in
   this source. For private personal use only.
   ══════════════════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════════════════════════════════════════════
   CONFIG — every tunable value lives here and nowhere else.
   ══════════════════════════════════════════════════════════════════════════ */
const CONFIG = {

  /* ── Media ──────────────────────────────────────────────────────────── */
  AUDIO : 'song.mp3',                              // falls back to a silent clock
  LRC   : 'october.md',                            // lyric source — see LYRICS note
  /* Three photos, one per collage slot. A missing file falls back to a
     neutral grey block with the same torn edge, so the layout never breaks.

     These are portrait phone shots (9:16 and 3:4) going into 4:5 frames, so
     object-fit:cover crops top and bottom. PHOTO_FOCUS shifts what survives
     that crop — see object-position below. */
  PHOTOS: ['p1.jpeg','p2.jpeg','p3.jpeg'],

  /* Vertical focal point per photo, as object-position Y.
     Lower % keeps the TOP of the frame — faces are usually in the upper
     half of a phone photo, so 38% is a safer default than dead centre. */
  PHOTO_FOCUS: ['38%', '38%', '42%'],

  /* ── Timeline (seconds) ─────────────────────────────────────────────── */
  /* END is overwritten by the real audio duration once metadata loads; this
     value is only the fallback for when the mp3 is missing. Measured length
     of the supplied song.mp3 is 28.19s. */
  END        : 28.19,

  /* ── Collage cue ─────────────────────────────────────────────────────────
     The collage arrives WITH the closing phrase, not after it. Photos land
     on that phrase's first stamp, and each paired word then appears beside
     its photo on that word's own stamp — so the arrangement assembles in
     time with the vocal rather than as an epilogue.

     COLLAGE_PHRASE indexes the parsed phrase list (7 = the final block).
     buildTimeline() resolves it to a real timestamp; the value below is only
     a pre-parse placeholder. */
  COLLAGE_PHRASE : 7,
  COLLAGE_IN     : 23.30,  // placeholder; real value set in buildTimeline()

  /* ── LYRICS ─────────────────────────────────────────────────────────────
     Lyric text is NOT stored here. It is parsed from CONFIG.LRC at runtime
     so the song's words stay in your local .lrc file rather than being
     copied into distributable source. Timings below come from that file.

     One .lrc line = one phrase = one full screen. A phrase holds until the
     next one is due, so two lines never share the stage.

     If the .lrc cannot be fetched (file:// in Chrome blocks it), the page
     falls back to PHRASE_FALLBACK and keeps running.
     ────────────────────────────────────────────────────────────────────── */

  /* Neutral stand-ins, used only when the .lrc fails to load. */
  PHRASE_FALLBACK: [
    'PHRASE ONE','PHRASE TWO','PHRASE THREE',
    'PHRASE FOUR','PHRASE FIVE','PHRASE SIX','PHRASE SEVEN',
  ],

  /* ── Forced line breaks, wide screens only ───────────────────────────────
     Maps a phrase index to the WORD index that should start a new line.

     In landscape the stage is sized to cover the width, so a long phrase runs
     much wider than the visible band and its last word crowds the edge.
     Breaking it deliberately reads better than letting the container wrap
     wherever it happens to run out of room.

     Portrait is untouched — there the phrase is narrower than the band and
     already sits comfortably on one line.

     Indices follow the parsed phrase order in the lyric file, so they need
     revisiting if the file's block structure changes. */
  PHRASE_BREAK_WIDE: {
    6: 2,   // third word drops to its own line
  },

  /* Per-phrase look, applied by index to whatever lines the .lrc yields.
     Cycles if the file has more lines than entries here. */
  PHRASE_STYLE: [
    // rot = fixed rotation (deg), dx/dy = off-axis nudge so no two phrases
    // sit dead-centre in a row
    { rot: -2.4, dx:  3.0, dy: -2.0 },
    { rot:  1.8, dx: -5.5, dy:  4.0 },
    { rot: -1.2, dx:  6.5, dy:  2.5 },
    { rot:  2.9, dx: -2.5, dy: -5.0 },
    { rot: -2.9, dx:  7.5, dy:  1.5 },
    { rot:  1.1, dx: -6.5, dy: -3.5 },
    { rot: -1.9, dx:  4.5, dy:  3.0 },
  ],

  /* Phrase hold rules, applied when converting stamps into phrases.
     HOLD_GAP must exceed INK_OUT (0.25) or the outgoing fade is still on
     stage when the next phrase pops in — two lines visible at once, which
     is exactly what the one-line-per-screen rule forbids. */
  HOLD_GAP  : 0.32,   // gap between one phrase leaving and the next arriving
  HOLD_MIN  : 0.90,   // shortest a phrase may stay up, even on tight stamps
  HOLD_LAST : 3.20,   // how long the final phrase holds (no next stamp to use)

  /* ── Per-word reveal ─────────────────────────────────────────────────────
     october.md stamps every word individually, so words arrive one at a time
     on their own cue. Set WORD_REVEAL false to land each phrase as a block.

     The motion is deliberately soft: a long quintic tail (ease.soft) means a
     word is still settling long after it reads as arrived. Combined with a
     blur that resolves as it lands, the effect is a word focusing into place
     rather than snapping. */
  WORD_REVEAL : true,
  WORD_IN     : 0.62,   // full settle time — long tail, most of it invisible
  WORD_FADE   : 0.26,   // opacity ramp; slower than the old 0.11 snap
  WORD_RISE   : 1.5,    // cqh travelled upward as it lands
  WORD_LEAD   : 0.06,   // start each word this early, so it hits ON the beat
  WORD_SCALE  : 0.88,   // starting scale
  WORD_BLUR   : 0.55,   // cqw of blur at the start, resolving to 0
  WORD_SKEW   : 2.2,    // deg of skew that unwinds as it settles

  /* ── Camera ──────────────────────────────────────────────────────────────
     One composited transform on #cam. Three components sum together:

       drift  — continuous slow wander, never stops, keeps the frame alive
       push   — gentle scale-in across each phrase, like a slow dolly
       bloom  — extra push at the two big blooms

     All values are small on purpose. The camera should be felt, not seen. */
  CAM_DRIFT_X    : 0.85,   // % of stage width
  CAM_DRIFT_Y    : 0.65,
  CAM_DRIFT_ROT  : 0.30,   // deg
  CAM_PERIOD_X   : 19.0,   // seconds per cycle — prime-ish so they never sync
  CAM_PERIOD_Y   : 23.0,
  CAM_PERIOD_ROT : 31.0,
  CAM_BASE_SCALE : 1.012,  // slight overscan so drift never shows an edge
  CAM_PUSH       : 0.022,  // scale added across a phrase's life
  CAM_BLOOM_PUSH : 0.030,  // extra scale at a big bloom
  CAM_SETTLE     : 0.06,   // per-frame smoothing factor (lower = heavier)

  /* ── Per-phrase camera moves ─────────────────────────────────────────────
     One entry per phrase, cycled if there are more phrases than moves. Each
     is a HALF-travel: the frame runs from -value to +value across the line,
     so a phrase both enters and leaves in motion and the composition never
     creeps steadily in one direction.

       x, y  translation, in % of the stage
       r     rotation, in degrees
       z     extra scale on top of CAM_PUSH — positive pushes in

     Values are small. The camera should be felt rather than noticed; past
     roughly x:2 / r:0.6 it starts to read as a slideshow pan. */
  /* ── The photo tour ──────────────────────────────────────────────────────
     After the collage lands the camera stops drifting and visits each photo
     in turn, then pulls back to hold the whole arrangement. Hand-offs are
     cued to the sung words, so the frame moves with the line.

     ZOOM is how far in the tour pushes; WIDE is where it settles once it
     pulls back. WIDE sits slightly below 1 so the final shot shows a little
     MORE than the resting frame — the composition opens out at the end. */
  CAM_TOUR_ZOOM : 1.34,   // scale while framing a single photo

  /* Floor for the framing zoom on letterboxed-tall stages. On an ultrawide
     only ~34% of the stage height is on screen, and zooming multiplies every
     offset from centre — at 1.34 the paired word was pushed past the crop
     edge whatever the framing. Below ~35% visible height the zoom eases down
     to this instead. */
  CAM_TOUR_ZOOM_MIN : 1.10,
  CAM_TOUR_WIDE : 0.94,   // scale for the final, everything-visible shot
  CAM_TOUR_LEAD : 0.70,   // seconds easing from the drifting camera into it
  CAM_TOUR_MOVE : 0.85,   // seconds to travel from one photo to the next
  /* 1.90s, not 2.60s. The last photo takes the frame at ~25.4s and the track
     ends at ~28.2s; a 2.6s pull-back left it held for only 0.19s before the
     camera started leaving, which is too brief for the shot to land. At 1.90
     it holds for ~0.9s first. */
  CAM_TOUR_OUT  : 1.90,   // seconds of pull-back at the end
  CAM_TOUR_HOLD : 0.85,   // minimum time the last photo is held before it

  /* MUST match the inset on #cam in the stylesheet (currently -3.5%). It is
     how far the camera may shift before the frame runs out of content. Raise
     both together or the tour will expose a bare edge. */
  CAM_OVERSCAN  : 3.5,

  CAM_MOVES: [
    { x:  1.30, y: -0.55, r:  0.22, z:  0.016 },   // drift right, ease in
    { x: -1.05, y:  0.70, r: -0.28, z:  0.010 },   // back left and down
    { x:  0.60, y:  1.05, r:  0.16, z:  0.022 },   // rise, stronger push
    { x: -1.35, y: -0.45, r:  0.30, z:  0.008 },   // wide left
    { x:  0.95, y:  0.85, r: -0.20, z:  0.026 },   // in close, drift right
    { x: -0.70, y: -0.95, r:  0.24, z:  0.012 },   // lift away left
    { x:  1.15, y:  0.40, r: -0.26, z:  0.018 },   // settle right
    { x: -0.85, y:  0.60, r:  0.18, z:  0.014 },   // final easing left
  ],

  /* Ghost bloom placement within a phrase's own hold window, as a fraction
     of that window. Keeps the bloom cued to the line rather than a fixed
     clock, so it works whatever the .lrc timings are. */
  GHOST_START_FRAC: 0.34,

  /* Which phrase indices get the two big blooms — deeper colour, higher
     opacity, heart pulse. Chosen as the two longest-held lines. */
  BIG_BLOOM_INDICES: [0, 4],

  /* Resolved bloom timestamps. Filled in by buildPhrases(); empty until then
     so the pre-roll frame has something valid to read. */
  BIG_BLOOMS: [],
  BLOOM_WINDOW: 0.55,   // ± seconds either side counted as "at" a bloom

  /* ── Motion constants ───────────────────────────────────────────────── */
  INK_IN     : 0.27,   // ~8 frames @30fps: pop with overshoot
  INK_FADE   : 0.133,  // ~4 frames: opacity ramp inside the pop
  INK_OUT    : 0.25,   // plain fade + 0.98 scale-down, no rotation
  GHOST_DUR  : 1.10,   // scale 1 → 4 over ~1.1s
  GHOST_MAX  : 4.0,
  GHOST_OFF  : { x: -6, y: 6 },   // % offset down-left, so layers aren't concentric

  /* ── Graph paper ──────────────────────────────────────────────────────
     The rules are part of the whole piece, not just the collage. They rise
     to GRID_SOFT as the first phrase lands, then to full once the photos
     arrive and need a surface to sit on. */
  GRID_IN    : 0.90,   // seconds — just under the first lyric cue (0.46s)
  GRID_FADE  : 1.60,   // opacity ramp duration
  GRID_SOFT  : 0.55,   // resting opacity during the typography phase

  /* Ambient decoration recedes once the photos land — they are the subject
     from then on, and hearts drifting over them read as clutter. */
  DECO_FADE     : 0.80,  // seconds to recede, from COLLAGE_IN
  DECO_COLLAGE  : 0.16,  // opacity it settles at, once the photos are up

  /* Ambient motion. Each piece drifts on layered sine waves; these set how
     far it tilts and how much it breathes. Small on purpose — the field
     should feel alive in peripheral vision, never draw the eye off the type. */
  DECO_TILT     : 14,    // degrees of sway at the extremes
  DECO_BREATH   : 0.045, // ±4.5% slow size pulse, out of phase with the drift
  PHOTO_STAGGER: 0.12, // seconds between photo landings
  PHOTO_DUR  : 0.55,

  /* ── Collage layout. Scattered on purpose — not a 2×2. ──────────────── */

  /* Three photos, each PAIRED with one sung word that lands beside it.
     Photo and word are a single unit: same cue, same stagger, arriving
     together. `tag` positions the word RELATIVE TO THAT PHOTO's centre, in
     % of stage, so the pair always reads as belonging to each other.

     Sides alternate so the eye zig-zags down the composition rather than
     tracking a straight edge. */
  /* Spread further apart VERTICALLY (16 / 50 / 84 instead of 25 / 48 / 72)
     so the three photos never crowd each other once squeezeX pulls them
     toward the centre line on a phone.

     Horizontal offsets are kept modest — the visible band is only ~56% of
     the stage on a phone, so a wide dx would push a photo off-frame.

     Each word sits ABOVE or BELOW its photo rather than beside it: at these
     widths a side-placed word overlapped the neighbouring photo once the
     columns compressed. dy is measured past the photo's half-height (its
     4:5 box is ~w*1.25 tall, so half is ~w*0.62 of stage width). */
  PHOTO_LAYOUT: [
    // x/y = centre in % of stage, w = width in % of stage width, rot in deg
    // tag.dx/dy = word offset from the photo centre; tag.s = size in cqw
    { x: 34, y: 14, w: 27, rot: -6.5,
      tag:{ dx:  3, dy:  13, s: 5.0, rot: -7, c: 1 } },   // word below
    { x: 64, y: 50, w: 25, rot:  4.5,
      tag:{ dx: -2, dy: -13, s: 4.4, rot:  5, c: 0 } },   // word above
    { x: 36, y: 86, w: 26, rot:  5.0,
      tag:{ dx:  3, dy: -14, s: 4.8, rot: -4, c: 1 } },   // word above
  ],

  /* ── Landscape layout ────────────────────────────────────────────────────
     A SEPARATE arrangement, not the portrait one squeezed.

     In landscape the stage covers the width, so it is far taller than the
     screen and squeezeY compresses everything into the middle band — as
     little as 34% of the stage height on an ultrawide. Three vertically
     stacked photos collapse into each other there; measured overlaps ran to
     25% before this existed.

     So landscape gets its own layout: spread ACROSS, barely stacked at all.
     A gentle arc keeps it from reading as a rigid row. */
  /* dy is large (≈34) on purpose. It is authored in STAGE-%, and squeezeY
     multiplies it by roughly 0.43 in landscape — so an offset that looks
     generous here lands at only ~15% on screen, which is barely past the
     photo's own half-height. Sized from: (half-height 11% + gap 2.5%) / 0.43.
     Outer photos sit slightly higher so their words have room beneath. */
  PHOTO_LAYOUT_WIDE: [
    { x: 19, y: 38, w: 21, rot: -5.5,
      tag:{ dx: 0, dy: 34, s: 3.4, rot: -6, c: 1 } },     // word below
    { x: 50, y: 60, w: 22, rot:  3.5,
      tag:{ dx: 0, dy:-35, s: 3.2, rot:  4, c: 0 } },     // word above
    { x: 81, y: 38, w: 21, rot:  5.5,
      tag:{ dx: 0, dy: 34, s: 3.4, rot: -3, c: 1 } },     // word below
  ],

  /* In the WIDE layout the photos sit side by side, so a word placed to the
     left or right walks straight into its neighbour. Here the words go
     ABOVE and BELOW instead — TAG_STACK switches tagX off for this layout. */
  TAG_STACK_WIDE: true,

  /* Below this viewport aspect ratio the portrait layout is used. 1.15 sits
     between a tablet in portrait (0.75) and any landscape screen (1.33+). */
  WIDE_ASPECT: 1.15,

  /* ── Paired words ────────────────────────────────────────────────────────
     Each photo carries part of the closing phrase, placed by that photo's
     own `tag` offset above. The photos land as the phrase opens; each word
     then appears beside its photo ON ITS OWN STAMP, so the arrangement fills
     in as the line is sung.

     Words come from the phrase at COLLAGE_PHRASE and are read from your
     local lyric file at runtime — never stored here.
     ────────────────────────────────────────────────────────────────────── */
  TAG_IN   : 0.72,   // longer, so the spring and wobble have room to read
  TAG_FADE : 0.22,   // opacity ramp
  TAG_RISE : 3.2,    // cqh travelled as it drops in

  /* The word as a whole settles gently; the LETTERS carry the character.
     WOBBLE is the peak tilt of the damped swing the word settles through —
     kept small so it does not fight the per-letter cascade below. */
  TAG_WOBBLE: 4.5,   // degrees at first swing, decaying to zero

  /* ── Per-character cascade ───────────────────────────────────────────────
     Each letter runs the same entrance, offset in time, so the word writes
     itself in rather than appearing whole.

     STAGGER is the fraction of the entry window between the first letter
     starting and the last — 0.45 means the final letter begins at 45% and
     still has CHAR_IN of the window left to finish in. Sizes are in `em`,
     so they scale with whatever font size the tag ends up at. */
  TAG_STAGGER   : 0.45,
  TAG_CHAR_IN   : 0.55,   // fraction of the window each letter takes
  TAG_CHAR_RISE : 0.85,   // em dropped from above
  TAG_CHAR_DRIFT: 0.22,   // em of sideways arc, alternating per letter
  TAG_CHAR_SPIN : 26,     // degrees each letter unwinds as it lands

  /* Words sit beside their photo, alternating right / left as the line is
     sung. TAG_GAP is the clearance past the photo's own half-width; TAG_TIER
     steps each successive word down so two on opposite sides of the same
     photo do not share a baseline. Both in % of stage. */
  TAG_GAP  : 4.0,
  TAG_TIER : 9.0,

  /* Vertical clearance for stacked words in the wide layout, in stage-% of
     HEIGHT. Applied AFTER the squeeze by tagY(), so it stays this size on
     screen no matter how hard landscape compresses the composition. */
  TAG_GAP_Y: 3.0,

  /* ── Torn-paper edge generator ──────────────────────────────────────── */
  TORN_POINTS_PER_SIDE: 7,   // → 28 polygon points total
  TORN_JITTER: 2,            // ±% along each side
};

/* ══════════════════════════════════════════════════════════════════════════
   Small helpers
   ══════════════════════════════════════════════════════════════════════════ */
const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
const lerp    = (a,b,t) => a + (b-a)*t;

/** Normalised progress of `now` across [start, start+dur], clamped to 0..1. */
const prog = (now, start, dur) => clamp01((now - start) / dur);

/* Easing curves. `pop` matches cubic-bezier(.34,1.56,.64,1) closely enough
   to be indistinguishable at 30fps, and is cheap to evaluate per frame. */
const ease = {
  out : t => 1 - Math.pow(1 - t, 3),
  in  : t => t*t*t,
  // overshoot to ~1.10 then settle — the lyric entry signature
  pop : t => {
    const c1 = 1.70158 * 1.06, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  /* Quintic ease-out: much longer tail than cubic, so a word keeps drifting
     almost imperceptibly after it looks settled. This is what separates
     "smooth" from "fast then stopped". */
  soft: t => 1 - Math.pow(1 - t, 5),
  /* Gentle S-curve for camera moves — no abrupt start, no abrupt stop. */
  sine: t => 0.5 - Math.cos(Math.PI * clamp01(t)) / 2,
  // cubic-bezier(.22,.61,.36,1) — the ghost expansion
  ghost: t => 1 - Math.pow(1 - t, 2.6),
};

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** 12.4 → "0:12" */
const fmt = s => {
  const w = Math.max(0, Math.floor(s));
  return Math.floor(w / 60) + ':' + String(w % 60).padStart(2, '0');
};

/* ══════════════════════════════════════════════════════════════════════════
   LRC — parse and convert to phrases
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * Parse the timed lyric file into phrase cues.
 *
 * Two layouts are accepted, detected automatically:
 *
 *   A) One stamp per LINE (classic .lrc)   →  [00:07.62]We fell in love
 *      Each stamped line becomes one phrase.
 *
 *   B) One stamp per WORD, phrases separated by BLANK LINES (october.md)
 *      Each blank-line-delimited block becomes one phrase; the words inside
 *      keep their individual stamps so they can be revealed one at a time.
 *
 * Returns [{ t, text, words:[{t, text}] }] sorted by time. For layout A the
 * `words` array holds a single entry covering the whole line.
 */
function parseLRC(src){
  /* Non-global copy for matchAll-style scanning, and a separate global one
     for stripping. Never read .lastIndex to find where the text starts: when
     exec() finally returns null it resets lastIndex to 0, so slice() would
     hand back the whole line WITH its stamps still attached. Strip instead. */
  const STAMP_G = /\[(\d+):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;

  /** Pull every [stamp] time out of one physical line, and the bare words. */
  const readLine = raw => {
    const times = [];
    for (const m of raw.matchAll(STAMP_G)){
      const frac = m[3] ? Number('0.' + m[3]) : 0;
      times.push(Number(m[1]) * 60 + Number(m[2]) + frac);
    }
    if (!times.length) return null;

    // Remove every stamp anywhere in the line; keep only the words.
    const text = raw.replace(STAMP_G, ' ').replace(/\s+/g, ' ').trim();
    return text ? { times, text } : null;
  };

  /* Split into blocks on blank lines. A file with no blank lines is one
     block, which collapses to layout A automatically. */
  const blocks = src.split(/\r?\n\s*\r?\n/);
  const cues   = [];

  for (const block of blocks){
    const parsed = block.split(/\r?\n/).map(readLine).filter(Boolean);
    if (!parsed.length) continue;

    if (parsed.length === 1){
      // Layout A, or a one-word block: the line is the phrase.
      const p = parsed[0];
      for (const t of p.times){
        cues.push({ t, text: p.text, words: [{ t, text: p.text }] });
      }
    } else {
      // Layout B: stitch the block's words into one phrase.
      const words = parsed
        .map(p => ({ t: p.times[0], text: p.text }))
        .sort((a, b) => a.t - b.t);
      cues.push({
        t: words[0].t,
        text: words.map(w => w.text).join(' '),
        words,
      });
    }
  }
  return cues.sort((a, b) => a.t - b.t);
}

/**
 * Turn LRC cues into full phrase objects.
 *
 * One cue = one phrase = one screen. Each phrase's `out` is pinned to the
 * NEXT cue minus HOLD_GAP, so exactly one phrase is ever on stage — the
 * outgoing fade finishes before the next pops in.
 *
 * The ghost bloom is placed as a fraction of each phrase's own hold window
 * rather than at a fixed clock time, so it stays cued to the line no matter
 * what timings the .lrc carries.
 */
function buildPhrases(cues, audioEnd){
  const S = CONFIG.PHRASE_STYLE;
  const list = cues.map((cue, i) => {
    const next = cues[i + 1];
    // Hold until just before the next line, or HOLD_LAST for the final one.
    let out = next ? next.t - CONFIG.HOLD_GAP : cue.t + CONFIG.HOLD_LAST;
    // Never let a tight stamp pair collapse a phrase to nothing.
    out = Math.max(out, cue.t + CONFIG.HOLD_MIN);
    if (audioEnd) out = Math.min(out, audioEnd);

    const win     = out - cue.t;
    const style   = S[i % S.length];

    /* The soft quintic settle is long (WORD_IN). On a tight phrase the last
       word would still be arriving as the line fades, so compress the
       per-word duration to whatever the window can actually hold. */
    const rawLast = (cue.words || []).length
      ? Math.max(0, cue.words[cue.words.length - 1].t - cue.t - CONFIG.WORD_LEAD)
      : 0;
    const wordIn = Math.min(CONFIG.WORD_IN, Math.max(0.18, win - rawLast - 0.05));

    /* Per-word offsets, relative to the phrase start. The ghost waits until
       the last word has landed, so the bloom reads as a response to the
       finished line rather than stepping on it mid-reveal. */
    const words = (cue.words || [{ t: cue.t, text: cue.text }]).map(w => ({
      text : w.text,
      // Lead slightly so the pop peaks on the beat instead of starting there.
      at   : Math.max(0, w.t - cue.t - CONFIG.WORD_LEAD),
    }));

    const lastWordAt = words.length ? words[words.length - 1].at : 0;
    const ghostAt = Math.min(
      cue.t + Math.max(win * CONFIG.GHOST_START_FRAC, lastWordAt + wordIn),
      out - 0.25,   // never start a bloom the phrase has no time to show
    );

    return {
      t: cue.t,
      out,
      text: cue.text,
      words,
      wordIn,          // per-phrase, compressed to fit a tight window
      ghostAt,
      ghostPeak: ghostAt + CONFIG.GHOST_DUR * 0.5,
      ...style,
    };
  });

  // Big blooms follow the configured indices, clamped to what exists.
  CONFIG.BIG_BLOOMS = CONFIG.BIG_BLOOM_INDICES
    .filter(i => i < list.length)
    .map(i => list[i].ghostPeak);

  return list;
}

/* ══════════════════════════════════════════════════════════════════════════
   Timeline — the single master clock.
   Reads audio.currentTime when audio is usable; otherwise performance.now().
   Every animated element derives its state from `Timeline.t` each frame, so
   audio and visuals cannot drift apart.
   ══════════════════════════════════════════════════════════════════════════ */
class Timeline {
  constructor(duration, onFrame){
    this.duration = duration;
    this.onFrame  = onFrame;
    this.t        = 0;        // current time in seconds
    this.playing  = false;

    /* Two separate things, deliberately:
         el    — the <audio> element we should TRY to play
         audio — the element once it is CONFIRMED playing, and therefore
                 authoritative for the clock
       Keeping them apart is what lets play() attempt playback before the
       element has finished buffering, without the clock trusting it early. */
    this.el       = null;
    this.audio    = null;

    this._base    = 0;        // performance.now() origin for the fallback clock
    this._raf     = null;
    this._tick    = this._tick.bind(this);
  }

  /** Register the element to play. Pass null to force the silent clock. */
  useAudio(el){
    this.el = el;
    if (!el) this.audio = null;
  }

  play(){
    if (this.playing) return;
    if (this.t >= this.duration) this.t = 0;   // replay from the top
    this.playing = true;
    this._base = performance.now() - this.t * 1000;

    /* Always try the element, even if `canplaythrough` has not fired yet.
       Waiting for that event before ever calling play() is what silences the
       track when a user gesture arrives first: the element is perfectly
       playable, it just has not finished buffering. play() resolves once it
       can start, and _tick() switches to audio time the moment it is running. */
    if (this.el){
      this.el.currentTime = Math.min(this.t, this.duration);
      this.el.play().then(() => {
        this.audio = this.el;              // confirmed: audio drives the clock
      }).catch(() => {
        this.audio = null;                 // blocked or broken: stay silent
      });
    }
    this._raf = requestAnimationFrame(this._tick);
    this.onState();
  }

  pause(){
    if (!this.playing) return;
    this.playing = false;
    // Pause the element itself — it may be mid-play() before confirmation.
    if (this.el) this.el.pause();
    cancelAnimationFrame(this._raf);
    this.onFrame(this.t);        // repaint once so the held frame is exact
    this.onState();
  }

  toggle(){ this.playing ? this.pause() : this.play(); }

  restart(){
    const wasPlaying = this.playing;
    this.t = 0;
    if (this.el) this.el.currentTime = 0;
    this._base = performance.now();
    this.onFrame(0);
    // Already running? The seek above is enough; play() would early-return.
    if (!wasPlaying) this.play();
  }

  /* Overridden after construction — lets the UI react to play/pause without
     the Timeline needing to know any DOM. */
  onState(){}

  _tick(now){
    // Audio is authoritative whenever it is actually running.
    this.t = (this.audio && !this.audio.paused)
      ? this.audio.currentTime
      : (now - this._base) / 1000;

    if (this.t >= this.duration){
      this.t = this.duration;
      this.onFrame(this.t);
      this.pause();
      this.onEnd();            // hand off to the loop-back sequence
      return;
    }
    this.onFrame(this.t);
    this._raf = requestAnimationFrame(this._tick);
  }

  /* Overridden after construction. Fires once the piece reaches its end. */
  onEnd(){}
}

/* ══════════════════════════════════════════════════════════════════════════
   Build: ghost + ink phrase nodes
   ══════════════════════════════════════════════════════════════════════════ */
const $ = sel => document.querySelector(sel);
const elGhost = $('#ghost'),  elLyric   = $('#lyric'),  elPhotos = $('#photos'),
      elDeco  = $('#deco'),   elDecoFront = $('#deco-front'),
      elGrid  = $('#grid'),   elVeil    = $('#veil'),
      elPlay  = $('#play'),   elAudio   = $('#audio'),  elStatus = $('#status'),
      elStage = $('#stage'),  elToggle  = $('#toggle'), elRestart= $('#restart'),
      elScrub = $('#scrub'),  elTime    = $('#time'),
      elCam   = $('#cam'),    elFs      = $('#fs');

/* Populated by mountPhrases() once the .lrc has loaded (or failed). Empty
   until then, which renders as bare paper — the correct pre-roll state. */
let phrases = [];

/**
 * Create the ink + ghost node pair for each phrase and swap them in.
 * Safe to call more than once; existing nodes are cleared first.
 *
 * The ink layer is split into one <span> per word so each can pop on its own
 * stamp. The ghost stays a single block — it is a shape, not a read, and
 * animating 39 spans through a 4× scale would cost far more than it shows.
 */
function mountPhrases(list){
  for (const p of phrases){ p.inkEl.remove(); p.ghostEl.remove(); }

  phrases = list.map((p, idx) => {
    const g = document.createElement('div');
    g.className = 'phrase';
    g.textContent = p.text;
    elGhost.appendChild(g);

    const i = document.createElement('div');
    i.className = 'phrase';

    /* Per-word spans. Whitespace between them is a real text node so the
       line still wraps and justifies like ordinary prose. */
    const wordEls = [];
    if (CONFIG.WORD_REVEAL && p.words && p.words.length > 1){
      /* Optional forced break for this phrase, on wide screens only.
         CONFIG.PHRASE_BREAK_WIDE maps a phrase index to the word index that
         should START a new line — so a long line can be split deliberately
         rather than relying on where the container happens to wrap. */
      const breakAt = isWide() ? CONFIG.PHRASE_BREAK_WIDE?.[idx] : undefined;

      p.words.forEach((w, wi) => {
        /* Insert the break BEFORE the marked word. <br> rather than a wrapper
           element, so the per-word spans stay direct children and the
           existing cascade animation keeps working untouched. */
        if (breakAt !== undefined && wi === breakAt){
          i.appendChild(document.createElement('br'));
        }
        const s = document.createElement('span');
        s.className = 'word';
        s.textContent = w.text;
        i.appendChild(s);
        if (wi < p.words.length - 1) i.appendChild(document.createTextNode(' '));
        wordEls.push(s);
      });
    } else {
      i.textContent = p.text;
    }

    elLyric.appendChild(i);

    /* The collage phrase supplies the words that sit beside the photos, so
       its centred copy must not also render — otherwise the same words are
       on screen twice. Its ghost bloom stays; only the ink line is muted. */
    const isCollagePhrase = idx === CONFIG.COLLAGE_PHRASE;

    return { ...p, ghostEl: g, inkEl: i, wordEls, muteInk: isCollagePhrase };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Build: torn-paper photos
   ══════════════════════════════════════════════════════════════════════════ */

/** Deterministic PRNG so the torn edges are stable across reloads. */
function rng(seed){
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/**
 * Irregular polygon hugging the element bounds, jittered ±TORN_JITTER%
 * inward along every side. 4 × TORN_POINTS_PER_SIDE points total.
 */
function tornPath(seed){
  const r = rng(seed), n = CONFIG.TORN_POINTS_PER_SIDE, j = CONFIG.TORN_JITTER;
  const pts = [];
  const jit = () => (r() * 2 - 1) * j;
  for (let i = 0; i < n; i++) pts.push([ (i/n)*100,             Math.abs(jit()) ]);   // top
  for (let i = 0; i < n; i++) pts.push([ 100 - Math.abs(jit()), (i/n)*100 ]);         // right
  for (let i = 0; i < n; i++) pts.push([ 100 - (i/n)*100, 100 - Math.abs(jit()) ]);   // bottom
  for (let i = 0; i < n; i++) pts.push([ Math.abs(jit()),  100 - (i/n)*100 ]);        // left
  return 'polygon(' + pts.map(p => p[0].toFixed(2)+'% '+p[1].toFixed(2)+'%').join(',') + ')';
}

/* ── Safe-area compression ────────────────────────────────────────────────
   The stage COVERS the viewport, so in landscape it is far taller than the
   screen and only a horizontal band of it is visible. Collage positions are
   authored in stage-%, which would put the top and bottom photos outside
   that band entirely.

   squeezeY maps an authored y onto the visible band, pulling the whole
   arrangement toward the centre line by however much is actually cropped.
   In portrait nothing is cropped vertically and this is the identity.
   ────────────────────────────────────────────────────────────────────── */
function visibleFracY(){
  const h = elStage.clientHeight;
  if (!h) return 1;
  // How much of the stage's own height is actually inside the viewport.
  return clamp01(innerHeight / h);
}

function squeezeY(y){
  /* 0.86 keeps a margin so nothing sits flush against the crop edge. */
  return 50 + (y - 50) * visibleFracY() * 0.86;
}

/* The horizontal twin. In PORTRAIT the stage covers the viewport, so it is
   far wider than the screen and the outer thirds are off-frame — two of the
   three photos were being cut in half. Same mapping, on x.

   0.80 is tighter than the vertical 0.86 because a photo is 28–33% wide:
   its own bulk has to clear the crop edge, not just its centre point. */
function visibleFracX(){
  const w = elStage.clientWidth;
  if (!w) return 1;
  return clamp01(innerWidth / w);
}

function squeezeX(x){
  return 50 + (x - 50) * visibleFracX() * 0.80;
}

/**
 * Final x for a word sitting `gap`% to one `side` of a photo centred at `cx`.
 *
 * The photo's own centre is squeezed toward the middle of the frame, but the
 * word's clearance must NOT be — squeezing it too shrinks the gap until the
 * word lands on top of its photo. So: squeeze the anchor, then add the gap
 * at full size.
 */
function tagX(cx, side, gap){
  /* In the wide layout the photos sit shoulder to shoulder, so a side-placed
     word lands on its neighbour. There the word stacks above or below its
     photo instead, and takes no horizontal offset at all. */
  if (isWide() && CONFIG.TAG_STACK_WIDE) return squeezeX(cx);
  return squeezeX(cx) + side * gap;
}

/** True when the viewport is wide enough to use the landscape arrangement. */
function isWide(){
  return (innerWidth / innerHeight) >= CONFIG.WIDE_ASPECT;
}

/**
 * Final y for a word stacked above or below its photo.
 *
 * The photo's CENTRE is squeezed toward the middle of the frame, but the
 * clearance must not be — squeezing it too shrinks the gap until the word
 * sits inside its own photo. This is the vertical twin of tagX(): squeeze
 * the anchor, then add the offset at full size.
 *
 * `dir` is -1 for above, +1 for below.
 */
function tagY(cy, dir, photoW){
  if (!isWide() || !CONFIG.TAG_STACK_WIDE) return squeezeY(cy);

  /* Half the photo's height, expressed in stage-% of HEIGHT. The box is 4:5,
     so its height is photoW * 1.25 of stage WIDTH — converted across by the
     stage's own aspect. Plus a fixed gap so the word never kisses the edge. */
  const stageAR = elStage.clientWidth / Math.max(1, elStage.clientHeight);
  const halfH   = photoW * 1.25 / 2 * stageAR;
  return squeezeY(cy) + dir * (halfH + CONFIG.TAG_GAP_Y);
}

/**
 * Re-apply the squeeze to every collage element.
 *
 * The photos are built during initial evaluation, before layout has settled,
 * and the crop changes on every resize and orientation flip — so the
 * positions have to be recomputed rather than baked in once.
 */
function applySqueeze(){
  /* Re-read the layout every time: an orientation flip switches between the
     portrait arrangement and the wide one, and the photos have to move to
     their new authored positions, not just re-squeeze the old ones. */
  const L = currentLayout();

  photos.forEach((ph, i) => {
    const src = L[i] || ph;
    // Adopt the new arrangement's values so later reads stay consistent.
    ph.x = src.x; ph.y = src.y; ph.w = src.w; ph.tag = src.tag;

    ph.el.style.width = src.w + '%';
    ph.el.style.left  = squeezeX(src.x) + '%';
    ph.el.style.top   = squeezeY(src.y) + '%';
    ph.rot = src.rot;
  });

  /* Tags hang off their photo, so their anchors move with it. Recompute from
     the photo's CURRENT position rather than the value captured at build. */
  tags.forEach(tg => {
    const ph = tg.photo;
    if (ph){
      tg.anchorX = ph.x;
      tg.gap     = ph.w / 2 + CONFIG.TAG_GAP;
      tg.baseY   = ph.y + tg.dyOffset;
      tg.el.style.fontSize = (ph.tag?.s || 4.4) + 'cqw';
    }
    tg.el.style.left = tagX(tg.anchorX, tg.side, tg.gap) + '%';
    /* In the wide layout tagY places the word relative to its photo's edge;
       in portrait it falls through to a plain squeeze of the authored y. */
    tg.el.style.top  = tg.photo
      ? tagY(tg.photo.y, tg.dir, tg.photo.w) + '%'
      : squeezeY(tg.baseY) + '%';
  });
}

/** Which collage arrangement suits the current viewport shape. */
function currentLayout(){
  return isWide() ? CONFIG.PHOTO_LAYOUT_WIDE : CONFIG.PHOTO_LAYOUT;
}

const photos = currentLayout().map((L, i) => {
  const wrap = document.createElement('div');
  wrap.className = 'photo';
  // Portrait: 4:5. Height derives from the width so rotation stays even.
  wrap.style.width  = L.w + '%';
  wrap.style.aspectRatio = '4 / 5';
  wrap.style.left = squeezeX(L.x) + '%';
  wrap.style.top  = squeezeY(L.y) + '%';

  const frame = document.createElement('div');
  frame.className = 'frame';
  frame.style.clipPath = tornPath(1000 + i * 7919);

  const img = document.createElement('img');
  img.alt = '';
  img.decoding = 'async';

  /* These are tall phone photos (9:16, 3:4) in 4:5 frames, so object-fit
     cover trims top and bottom. Biasing the focal point upward keeps faces
     — which sit in the upper half of most phone portraits — inside the crop
     instead of slicing them off. Adjust per photo via CONFIG.PHOTO_FOCUS. */
  img.style.objectPosition = `50% ${CONFIG.PHOTO_FOCUS?.[i] || '50%'}`;

  // Missing file → swap to a neutral gray block with the identical torn edge.
  img.addEventListener('error', () => {
    const ph = document.createElement('div');
    ph.className = 'ph';
    img.replaceWith(ph);
  });
  img.src = CONFIG.PHOTOS[i] || '';

  frame.appendChild(img);
  wrap.appendChild(frame);
  elPhotos.appendChild(wrap);
  return { ...L, el: wrap, delay: i * CONFIG.PHOTO_STAGGER };
});

/* ── Tag words ────────────────────────────────────────────────────────────
   Built after the lyric file parses, because the words come from it. Each
   tag is one word of the source phrase and pops on that word's own stamp,
   so the scattered text is sung, not decorative.
   ────────────────────────────────────────────────────────────────────── */
let tags = [];

function mountTags(list){
  for (const t of tags) t.el.remove();
  tags = [];

  const srcPhrase = list[CONFIG.COLLAGE_PHRASE] || list[list.length - 1];
  if (!srcPhrase || !srcPhrase.words || !srcPhrase.words.length) return;

  /* ONE TAG PER SUNG FIGURE, alternating sides.

     The closing phrase repeats a short two-word figure. Those two words are
     one unit — they are sung together and must APPEAR together — so the
     word list is chunked into groups of TAG_GROUP rather than split apart.

     Each group cues on its FIRST word's stamp, so the three repetitions land
     at three distinct moments, alternating right and left down the collage.

     The group size is derived, not hard-coded: however many words the file
     holds, they divide evenly across the photos. */
  const all  = srcPhrase.words;
  const size = Math.max(1, Math.round(all.length / photos.length));

  const groups = [];
  for (let i = 0; i < all.length; i += size){
    const chunk = all.slice(i, i + size);
    if (!chunk.length) continue;
    groups.push({
      // Joined as sung, with any trailing comma trimmed.
      text: chunk.map(w => w.text).join(' ').replace(/[,\s]+$/, ''),
      at  : chunk[0].at,          // cue on the first word of the figure
    });
  }

  tags = groups.map((w, i) => {
    const ph   = photos[i % photos.length];
    const T    = ph.tag || {};
    // Even index → right of the photo, odd → left. Strict alternation.
    const side = (i % 2 === 0) ? 1 : -1;

    // Clearance past the photo's own half-width. Applied in tagX() below,
    // which pre-compensates for the squeeze so the gap survives on screen.
    const gap = ph.w / 2 + CONFIG.TAG_GAP;

    /* Only steps down if a photo ends up carrying more than one group —
       with three groups and three photos it stays flat, which is what we
       want: each figure sits level with its own photo. */
    const tier = Math.floor(i / photos.length);
    const dy   = (T.dy || 0) + tier * CONFIG.TAG_TIER;

    const el = document.createElement('div');
    el.className = 'tag';

    /* Split into per-character spans so the letters can cascade in one after
       another instead of the whole word arriving as a block. Spaces stay as
       plain text nodes so the browser still wraps and kerns normally, and
       the element keeps its readable text for assistive tech. */
    el.setAttribute('aria-label', w.text);
    const chars = [];
    for (const ch of w.text){
      if (ch === ' '){ el.appendChild(document.createTextNode(' ')); continue; }
      const s = document.createElement('span');
      s.className = 'tag-ch';
      s.textContent = ch;
      s.setAttribute('aria-hidden', 'true');
      el.appendChild(s);
      chars.push(s);
    }
    /* Positioned relative to its photo's centre, not the stage. Both
       squeezes are applied so a word tracks its photo into the visible band
       instead of drifting off-frame on its own. */
    el.style.left     = tagX(ph.x, side, gap) + '%';
    el.style.top      = tagY(ph.y, Math.sign(dy) || 1, ph.w) + '%';
    el.style.fontSize = (T.s || 4.4) + 'cqw';
    el.style.color    = T.c ? 'var(--crimson)' : 'var(--ink)';
    elLyric.appendChild(el);

    return {
      el,
      // Tilt leans away from the photo, so the pair reads as one object.
      rot: (T.rot || 0) + side * 3,
      /* Raw inputs, kept so applySqueeze can rebuild the position on resize.
         Storing the already-squeezed value would double-apply the squeeze. */
      anchorX: ph.x,
      side, gap,
      baseY: ph.y + dy,
      /* A live reference to the photo plus the raw offset, so an orientation
         flip — which swaps in a different layout entirely — can recompute
         the anchor instead of stranding the word at its old coordinates. */
      photo: ph,
      dyOffset: dy,
      // Which side of its photo the word stacks on: -1 above, +1 below.
      dir: Math.sign(dy) || 1,
      // Per-character spans, animated individually on entry.
      chars,
      // Absolute cue: this word's own moment in the song.
      at: srcPhrase.t + w.at,
    };
  });
}

/* ══════════════════════════════════════════════════════════════════════════
   Build: decoration — glossy hearts, exclamation marks, four-point sparkles
   ══════════════════════════════════════════════════════════════════════════ */

/* Glossy 3D heart: base fill, --crimson-lo lower-right lobe for volume,
   radial highlight in the upper-left lobe. Not a flat emoji. */
function heartSVG(id){
  return `<svg viewBox="0 0 100 92" aria-hidden="true">
    <defs>
      <radialGradient id="hg${id}" cx="32%" cy="26%" r="46%">
        <stop offset="0%"   stop-color="#ff8f96" stop-opacity=".95"/>
        <stop offset="55%"  stop-color="#ff8f96" stop-opacity=".18"/>
        <stop offset="100%" stop-color="#ff8f96" stop-opacity="0"/>
      </radialGradient>
      <clipPath id="hc${id}">
        <path d="M50 90C22 70 4 52 4 31.5 4 15 16 4 30 4c9 0 16 4.5 20 11 4-6.5 11-11 20-11
                 14 0 26 11 26 27.5C96 52 78 70 50 90Z"/>
      </clipPath>
    </defs>
    <g clip-path="url(#hc${id})">
      <rect width="100" height="92" fill="var(--crimson)"/>
      <!-- lower-right shadow mass -->
      <ellipse cx="82" cy="72" rx="52" ry="46" fill="var(--crimson-lo)"/>
      <rect width="100" height="92" fill="url(#hg${id})"/>
    </g>
  </svg>`;
}

/* Four-point sparkle: concave sides, long vertical axis. */
const SPARKLE = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 0C54 30 62 44 100 50 62 56 54 70 50 100 46 70 38 56 0 50 38 44 46 30 50 0Z"
        fill="var(--crimson)"/>
</svg>`;

/* ── Extra icons ──────────────────────────────────────────────────────────
   Variety for the desktop field, where there is room for more than hearts.
   All share the same crimson palette and hand-drawn weight so the set reads
   as one family rather than assorted clip-art.
   ────────────────────────────────────────────────────────────────────── */

/* Outline heart: the same silhouette as the solid one, drawn as a stroke.
   Reads much lighter, so it can sit closer to the type without crowding. */
const HEART_LINE = `<svg viewBox="0 0 100 92" aria-hidden="true">
  <path d="M50 88C23 69 6 51 6 31.5 6 15 18 4 31 4c8 0 15 4 19 10.5C54 8 61 4 69 4
           82 4 94 15 94 31.5 94 51 77 69 50 88Z"
        fill="none" stroke="var(--crimson)" stroke-width="7"
        stroke-linejoin="round"/>
</svg>`;

/* Five-point star, slightly rounded. A different silhouette from the
   four-point sparkle, so the two do not read as the same mark. */
const STAR = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 4 62 36 96 38 70 60 78 94 50 75 22 94 30 60 4 38 38 36Z"
        fill="var(--crimson)" stroke="var(--crimson)" stroke-width="6"
        stroke-linejoin="round"/>
</svg>`;

/* A tiny plus / cross twinkle — the smallest mark in the set, useful for
   filling gaps without adding visual weight. */
const TWINKLE = `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M50 8C52 34 66 48 92 50 66 52 52 66 50 92 48 66 34 52 8 50 34 48 48 34 50 8Z"
        fill="var(--blush-deep)"/>
</svg>`;

/* 12 ambient elements. Each carries its own drift period/phase so nothing
   syncs up; all stay partly in frame for the whole runtime. */
/* `front: true` lifts an item ABOVE the lyric layer, so a few hearts pass in
   front of the words while the rest stay behind them. That depth is what
   stops the decoration reading as a flat backdrop.

   Items are placed in stage-% but the stage COVERS the viewport, so the
   outer ~22% of each side is off-screen in portrait. Anything meant to be
   seen sits between roughly 24% and 76%; pieces outside that band are the
   ones intended to crop at the edge. */
/* THE LYRIC CORRIDOR
   The lyric sits centred, roughly y 38–62%. Nothing may sit inside that
   band near the centre, or it covers the words — which is exactly what a
   previous, larger arrangement did. Decoration lives ABOVE, BELOW, or hard
   out at the sides where the type never reaches.

   Sizes are much smaller than before: `w` is a % of the STAGE, and the
   stage COVERS the viewport, so on a phone 15% of the stage was 25% of the
   actual screen — enormous. These read as ambient at ~8–12% of screen. */
const DECO = [
  // ── ABOVE the lyric corridor ──────────────────────────────────────────
  { k:'heart',   x: 30, y: 10, w: 7,   rot:-12, per: 7.3, ph: 0.0 },
  { k:'heart',   x: 68, y:  8, w: 5.5, rot: 14, per: 9.1, ph: 1.4 },
  { k:'heart',   x: 48, y: 18, w: 6.5, rot: -5, per: 8.0, ph: 3.6 },
  { k:'heart',   x: 60, y: 26, w: 5,   rot: -9, per:10.5, ph: 2.4 },
  { k:'heart',   x: 36, y: 28, w: 4.5, rot: 22, per:10.8, ph: 3.1 },
  { k:'heart',   x: 72, y: 18, w: 4,   rot: 16, per: 8.1, ph: 4.9 },

  // ── BELOW the lyric corridor ──────────────────────────────────────────
  { k:'heart',   x: 30, y: 78, w: 7,   rot: 18, per:10.2, ph: 0.9 },
  { k:'heart',   x: 70, y: 72, w: 6,   rot: -8, per: 6.4, ph: 2.7 },
  { k:'heart',   x: 50, y: 88, w: 5.5, rot: 12, per: 7.0, ph: 5.8 },
  { k:'heart',   x: 64, y: 86, w: 4.5, rot:-20, per: 7.7, ph: 0.6 },
  { k:'heart',   x: 40, y: 70, w: 4,   rot: 11, per: 9.6, ph: 5.3 },

  /* ── BESIDE the lyric, far enough out that the type never reaches ──────
     The lyric is capped at 91vw, so on a phone it spans roughly 28–72% of
     the stage. These sit outside that, and crop at the frame edge. */
  { k:'heart',   x: 16, y: 48, w: 8,   rot:-14, per: 9.2, ph: 1.7 },
  { k:'heart',   x: 85, y: 52, w: 7,   rot:  7, per:11.4, ph: 4.4 },

  // ── exclamation marks, cropping at the frame edge ─────────────────────
  { k:'bang',    x:  9, y: 30, w: 9,   rot:-16, per: 9.7, ph: 1.1 },
  { k:'bang',    x: 91, y: 80, w: 11,  rot: 19, per: 7.8, ph: 2.2 },

  // ── sparkles: small enough to sit anywhere, including the corridor ────
  { k:'sparkle', x: 26, y: 62, w: 3.4, rot:  0, per: 6.8, ph: 0.4 },
  { k:'sparkle', x: 74, y: 38, w: 3,   rot: 12, per: 8.6, ph: 2.9 },
  { k:'sparkle', x: 42, y:  6, w: 2.8, rot: -9, per: 7.1, ph: 5.0 },
  { k:'sparkle', x: 58, y: 94, w: 3.2, rot:  6, per: 9.9, ph: 1.8 },
  { k:'sparkle', x: 20, y: 22, w: 2.6, rot: 18, per: 8.3, ph: 3.7 },
  { k:'sparkle', x: 80, y: 66, w: 2.8, rot: -4, per:10.1, ph: 0.2 },
];

/* ── Desktop extras ───────────────────────────────────────────────────────
   A wide screen shows the WHOLE stage width, where a phone shows only the
   middle ~56% — so there is real estate out at the sides that is simply
   empty in landscape. These fill it, and add size variety the base set
   deliberately lacks (it has to survive being cropped on a phone).

   Still nothing inside the lyric corridor: y 38–62% on x 26–74% stays clear.
   The largest pieces sit far out where the type never reaches.
   ────────────────────────────────────────────────────────────────────── */
const DECO_WIDE = [
  // ── large, far out at the sides: the anchors of the wider composition ──
  { k:'heart',     x:  8, y: 24, w: 11,  rot:-18, per: 9.4, ph: 0.3 },
  { k:'heart',     x: 93, y: 30, w: 9.5, rot: 15, per:10.7, ph: 2.6 },
  { k:'heart',     x:  6, y: 70, w: 10,  rot: 12, per: 8.2, ph: 4.1 },
  { k:'heart',     x: 95, y: 66, w: 8,   rot:-11, per:11.3, ph: 1.2 },

  // ── outline hearts: lighter weight, so they can sit nearer the type ────
  { k:'heartLine', x: 18, y: 14, w: 8,   rot: 10, per: 8.9, ph: 3.4 },
  { k:'heartLine', x: 84, y: 16, w: 6.5, rot:-14, per: 7.6, ph: 5.5 },
  { k:'heartLine', x: 14, y: 86, w: 7,   rot:-8,  per:10.9, ph: 1.9 },
  { k:'heartLine', x: 88, y: 88, w: 6,   rot: 17, per: 9.1, ph: 4.6 },
  { k:'heartLine', x: 44, y:  4, w: 5,   rot:  6, per: 8.5, ph: 2.2 },

  // ── stars: a different silhouette, medium weight ───────────────────────
  { k:'star',      x: 24, y: 32, w: 4.2, rot:-12, per: 7.9, ph: 0.8 },
  { k:'star',      x: 78, y: 28, w: 3.6, rot: 20, per:10.2, ph: 3.9 },
  { k:'star',      x: 22, y: 76, w: 3.8, rot:  8, per: 9.7, ph: 5.1 },
  { k:'star',      x: 80, y: 74, w: 4.4, rot:-16, per: 8.4, ph: 1.5 },
  { k:'star',      x: 12, y: 48, w: 3.2, rot:  0, per:11.6, ph: 2.8 },
  { k:'star',      x: 89, y: 50, w: 3.4, rot: 13, per: 7.3, ph: 4.3 },

  // ── twinkles: the lightest mark, safe even inside the corridor ─────────
  { k:'twinkle',   x: 34, y: 44, w: 2.4, rot:  0, per: 6.5, ph: 1.1 },
  { k:'twinkle',   x: 66, y: 56, w: 2.6, rot: 15, per: 7.8, ph: 3.3 },
  { k:'twinkle',   x: 30, y: 58, w: 2.0, rot:-10, per: 9.2, ph: 5.7 },
  { k:'twinkle',   x: 70, y: 42, w: 2.2, rot:  8, per: 8.7, ph: 0.5 },
  { k:'twinkle',   x: 52, y: 34, w: 1.8, rot:-6,  per:10.4, ph: 2.0 },
  { k:'twinkle',   x: 48, y: 66, w: 2.1, rot: 12, per: 7.1, ph: 4.8 },
];

/* Landscape gets the base set PLUS the extras; portrait keeps only the base,
   since most of the extras would be cropped off-screen anyway. */
const DECO_ALL = isWide() ? DECO.concat(DECO_WIDE) : DECO;

const deco = DECO_ALL.map((D, i) => {
  const el = document.createElement('div');
  el.className = 'item' + (D.front ? ' front' : '');
  el.style.left  = D.x + '%';
  el.style.top   = D.y + '%';
  el.style.width = D.w + '%';

  if (D.k === 'heart')          el.innerHTML = heartSVG(i);
  else if (D.k === 'heartLine') el.innerHTML = HEART_LINE;
  else if (D.k === 'star')      el.innerHTML = STAR;
  else if (D.k === 'twinkle')   el.innerHTML = TWINKLE;
  else if (D.k === 'sparkle')   el.innerHTML = SPARKLE;
  else {
    el.classList.add('bang');
    el.style.fontSize = (D.w * 2.6) + 'cqw';
    el.textContent = '!';
  }

  /* Items marked `front` go into a separate layer stacked above .lyric, so
     they cross in front of the words. The rest stay behind. */
  (D.front ? elDecoFront : elDeco).appendChild(el);
  return { ...D, el, amp: 3 + (i % 3) };   // ±3–5% drift
});

/* ══════════════════════════════════════════════════════════════════════════
   Bloom intensity — 0..1, peaks at each entry in BIG_BLOOMS.
   Drives ghost colour/opacity and the heart scale pulse.
   ══════════════════════════════════════════════════════════════════════════ */
function bloomAt(t){
  let m = 0;
  for (const b of CONFIG.BIG_BLOOMS){
    const d = Math.abs(t - b);
    if (d < CONFIG.BLOOM_WINDOW) m = Math.max(m, 1 - d / CONFIG.BLOOM_WINDOW);
  }
  return m;
}

/* ══════════════════════════════════════════════════════════════════════════
   CAMERA
   One composited transform on #cam, summing three motions:

     drift  — three sine waves on co-prime periods, so the wander never
              repeats visibly and never stops
     push   — a slow dolly-in across each phrase's life
     bloom  — extra push at the two big blooms

   The result is smoothed toward with a per-frame lerp so cuts in the target
   (a new phrase starting) become eased moves rather than jumps.
   ══════════════════════════════════════════════════════════════════════════ */
const camState = { x:0, y:0, r:0, s:CONFIG.CAM_BASE_SCALE, init:false };

function updateCamera(t, bloom){
  if (REDUCED){                       // hold perfectly still
    elCam.style.transform = 'none';
    return;
  }

  const TAU = Math.PI * 2;
  const dx = Math.sin(t / CONFIG.CAM_PERIOD_X   * TAU) * CONFIG.CAM_DRIFT_X;
  const dy = Math.cos(t / CONFIG.CAM_PERIOD_Y   * TAU) * CONFIG.CAM_DRIFT_Y;
  const dr = Math.sin(t / CONFIG.CAM_PERIOD_ROT * TAU) * CONFIG.CAM_DRIFT_ROT;

  /* ── Per-phrase camera move ──────────────────────────────────────────────
     Every phrase gets its own move, cycling through a small set so no two
     consecutive lines feel the same. Each is a slow travel across the whole
     life of the phrase, which is what makes the frame feel handheld and
     responsive to the words rather than merely drifting.

     `k` runs 0→1 across the phrase, eased so the move accelerates in and
     decelerates out — it is never at constant speed, which would read as a
     mechanical pan. */
  let push = 0, moveX = 0, moveY = 0, moveR = 0;

  for (let i = 0; i < phrases.length; i++){
    const p = phrases[i];
    if (t < p.t || t >= p.out) continue;

    const k  = ease.sine(prog(t, p.t, p.out - p.t));
    const M  = CONFIG.CAM_MOVES[i % CONFIG.CAM_MOVES.length];

    /* A gentle push held across the line, plus this phrase's own travel.
       The travel is signed, so alternating entries pull the frame in
       opposite directions and the piece never creeps one way. */
    push  = CONFIG.CAM_PUSH * k + M.z * k;
    moveX = lerp(-M.x, M.x, k);
    moveY = lerp(-M.y, M.y, k);
    moveR = lerp(-M.r, M.r, k);
    break;
  }

  /* ── The photo tour ──────────────────────────────────────────────────────
     Once the collage lands, the camera stops drifting and starts visiting.
     It pushes in on photo 1, travels to photo 2, then photo 3 — each hand-off
     cued to that photo's own sung word — and finally pulls back to hold the
     whole arrangement for the last of the piece.

     Because the camera scales about the stage CENTRE, framing a photo means
     translating by its offset from centre, multiplied by how far we have
     zoomed in. At scale S a point P% from centre needs a -P*(S-1) shift to
     land back in the middle.

     This REPLACES the drift and per-phrase move rather than adding to them:
     during the tour the frame should be deliberate, not handheld. */
  let tour = null;
  if (tags.length && photos.length){
    const startAt = tags[0].at;

    /* The pull-back normally begins CAM_TOUR_OUT before the end, but never
       so early that the last photo gets no time in frame. If the lyric file
       ever pushes the final cue later, the pull-back yields rather than
       cutting that shot short. */
    const lastCue = tags[tags.length - 1].at;
    const endAt   = Math.max(CONFIG.END - CONFIG.CAM_TOUR_OUT,
                             lastCue + CONFIG.CAM_TOUR_HOLD);

    if (t >= startAt - CONFIG.CAM_TOUR_LEAD){
      /* Which photo we are on, and how far through the hand-off to the next.
         Each tag's cue is the moment its photo takes the frame. */
      let idx = 0;
      for (let i = 0; i < tags.length; i++) if (t >= tags[i].at) idx = i;

      const from = photos[Math.min(idx, photos.length - 1)];
      const next = photos[Math.min(idx + 1, photos.length - 1)];

      /* Progress from this photo toward the next, over CAM_TOUR_MOVE. */
      const holdFrom = tags[idx].at;
      const blend    = ease.sine(clamp01((t - holdFrom) / CONFIG.CAM_TOUR_MOVE));

      /* Frame the photo AND ITS WORD as one subject, not the photo alone.

         The word sits clear of the photo — above or below by its half-height
         plus a gap — so centring on the photo pushed the word to the very
         edge of the visible band. Measured on desktop it landed at 71% with
         the band ending at 72%: clipped.

         Targeting the midpoint of the pair pulls both comfortably inside.
         `tagAnchor` mirrors the geometry tagY() uses to place the word. */
      const pairMid = (ph, dir) => {
        /* Mirrors tagY() exactly: it only offsets the word vertically in the
           wide layout. In portrait the word rides beside the photo, so the
           pair's midpoint is simply the photo's own centre. */
        if (!isWide() || !CONFIG.TAG_STACK_WIDE) return ph.y;
        const stageAR = elStage.clientWidth / Math.max(1, elStage.clientHeight);
        const halfH   = ph.w * 1.25 / 2 * stageAR;
        const wordY   = ph.y + dir * (halfH + CONFIG.TAG_GAP_Y);
        return (ph.y + wordY) / 2;
      };

      /* dir comes from the TAG, not the photo — it is the tag that knows
         which side of its photo it stacks on. */
      const dirFrom = tags[Math.min(idx, tags.length - 1)].dir || 1;
      const dirNext = tags[Math.min(idx + 1, tags.length - 1)].dir || 1;

      // Interpolate the framing between the two subjects.
      const fx = lerp(from.x, next.x, blend);
      const fy = lerp(pairMid(from, dirFrom), pairMid(next, dirNext), blend);

      /* Pull back at the end: zoom eases from CAM_TOUR_ZOOM to the wide
         resting scale, and the framing returns to dead centre.

         The zoom is scaled DOWN on letterboxed-tall stages. Zooming
         multiplies every offset from centre, so on an ultrawide — where only
         ~34% of the stage height is on screen — a 1.34 push threw the word
         past the crop edge no matter how the shot was framed. Trading some
         magnification for a word that stays readable is the right call. */
      const out  = ease.sine(clamp01((t - endAt) / CONFIG.CAM_TOUR_OUT));
      const fit  = lerp(CONFIG.CAM_TOUR_ZOOM_MIN, CONFIG.CAM_TOUR_ZOOM,
                        clamp01((visibleFracY() - 0.35) / 0.30));
      const zoom = lerp(fit, CONFIG.CAM_TOUR_WIDE, out);

      // Ease the tour in so it does not snap on from the drifting camera.
      const enter = ease.sine(clamp01(
        (t - (startAt - CONFIG.CAM_TOUR_LEAD)) / CONFIG.CAM_TOUR_LEAD));

      /* Framing offset, faded out as we pull back so the last shot is
         centred on the whole collage rather than on the final photo.

         The shift is -(P-50)*S, NOT -(P-50)*(S-1). CSS applies
         translate BEFORE scale here, so a point P lands at
         50 + (P-50)*S + X. Solving that for 50 gives the factor S.
         Using (S-1) leaves the photo exactly where it started — the
         camera zooms but never actually frames anything. */
      const frame = (1 - out) * enter;
      const camScale = lerp(CONFIG.CAM_BASE_SCALE, zoom, enter);

      /* CLAMP. Fully centring an outer photo needs a shift far larger than
         the zoom covers — measured at 41% against 20% of overscan, which
         would expose a bare edge at the frame boundary.

         So the camera leans TOWARD each photo rather than centring it: the
         shift is capped at whatever the current scale can hide. The photo
         still becomes the clear subject of the shot, and the frame stays
         full. Raising CAM_TOUR_ZOOM buys more travel if a tighter framing
         is ever wanted. */
      const limit = (camScale - 1) / 2 * 100 + CONFIG.CAM_OVERSCAN;
      const rawX  = -(squeezeX(fx) - 50) * camScale * frame;
      const rawY  = -(squeezeY(fy) - 50) * camScale * frame;

      tour = {
        x: Math.max(-limit, Math.min(limit, rawX)),
        y: Math.max(-limit, Math.min(limit, rawY)),
        r: dr * (1 - enter),          // let the drift rotation fade away
        s: camScale,
      };
    }
  }

  const target = tour || {
    x: dx + moveX,
    y: dy + moveY,
    r: dr + moveR,
    s: CONFIG.CAM_BASE_SCALE + push + bloom * CONFIG.CAM_BLOOM_PUSH,
  };

  /* First frame snaps; afterwards ease toward the target so any change in
     the target itself arrives smoothly. */
  const k = camState.init ? CONFIG.CAM_SETTLE : 1;
  camState.x += (target.x - camState.x) * k;
  camState.y += (target.y - camState.y) * k;
  camState.r += (target.r - camState.r) * k;
  camState.s += (target.s - camState.s) * k;
  camState.init = true;

  elCam.style.transform =
    `translate3d(${camState.x.toFixed(4)}%, ${camState.y.toFixed(4)}%, 0) ` +
    `rotate(${camState.r.toFixed(4)}deg) ` +
    `scale(${camState.s.toFixed(5)})`;
}

/* ══════════════════════════════════════════════════════════════════════════
   RENDER — pure function of time. Transforms + opacity only; nothing in here
   touches a layout-triggering property.
   ══════════════════════════════════════════════════════════════════════════ */
function render(t){
  const bloom = bloomAt(t);
  updateCamera(t, bloom);

  /* ── phrases: ink + ghost ─────────────────────────────────────────── */
  for (const p of phrases){
    /* --- ink ---
       When the words animate themselves, the container must NOT also pop or
       the two scales multiply and the line lurches. In that mode the
       container simply holds at 1 and only handles the exit. */
    const perWord = p.wordEls.length > 0 && !REDUCED;
    let op = 0, sc = 1;
    if (t >= p.t && t < p.out + CONFIG.INK_OUT){
      if (t < p.out){
        if (perWord){
          op = 1; sc = 1;                 // words carry the entry themselves
        } else {
          const a = prog(t, p.t, CONFIG.INK_IN);
          // scale 0 → 1.10 → 1.00 with overshoot; opacity fills in 4 frames
          sc = REDUCED ? 1 : ease.pop(a);
          op = prog(t, p.t, CONFIG.INK_FADE);
        }
      } else {
        /* Exit: ease the opacity out rather than ramping it linearly, so the
           line thins away instead of stepping off. */
        const a = prog(t, p.out, CONFIG.INK_OUT);
        op = 1 - ease.sine(a);
        sc = lerp(1, 0.975, ease.out(a));
      }
    }
    /* The collage phrase's words live beside the photos instead. Muting the
       centred copy here keeps the ghost bloom while preventing the same
       words appearing twice on stage. */
    p.inkEl.style.opacity = p.muteInk ? 0 : op;
    p.inkEl.style.transform =
      `translate(calc(-50% + ${p.dx}cqw), calc(-50% + ${p.dy}cqh)) ` +
      `rotate(${REDUCED ? 0 : p.rot}deg) scale(${sc})`;

    /* --- per-word reveal ---
       Words pop in on their own stamps while the phrase container holds at
       full opacity. On exit the container fades as one, so the words do not
       need to be unwound individually. */
    if (p.wordEls.length && !p.muteInk){
      const local = t - p.t;
      for (let wi = 0; wi < p.wordEls.length; wi++){
        const w  = p.words[wi];
        const el = p.wordEls[wi];

        if (REDUCED){
          // Static fade: the whole line arrives together, no per-word motion.
          el.style.opacity   = 1;
          el.style.transform = 'none';
          continue;
        }
        /* Quintic tail: the word looks arrived early but keeps settling,
           which is what reads as "smooth" rather than "snapped". Blur and
           skew resolve faster than the position, so the glyph sharpens into
           focus just before it finishes moving. */
        const dur = p.wordIn || CONFIG.WORD_IN;    // compressed on tight lines
        const a   = prog(local, w.at, dur);
        const e   = ease.soft(a);
        const q   = ease.soft(clamp01(a / 0.55));  // faster-resolving track

        el.style.opacity =
          ease.out(clamp01((local - w.at) / Math.min(CONFIG.WORD_FADE, dur * 0.5)));
        el.style.transform =
          `translateY(${lerp(CONFIG.WORD_RISE, 0, e).toFixed(3)}cqh) ` +
          `scale(${lerp(CONFIG.WORD_SCALE, 1, e).toFixed(4)}) ` +
          `skewY(${lerp(CONFIG.WORD_SKEW, 0, q).toFixed(3)}deg)`;
        // filter is cheap here: one short-lived blur per word, not per frame
        el.style.filter = q < 1
          ? `blur(${lerp(CONFIG.WORD_BLUR, 0, q).toFixed(3)}cqw)`
          : 'none';
      }
    }

    /* --- ghost: scale 1 → 4, clipped by the stage. Skipped when reduced. --- */
    let gop = 0, gsc = 1;
    if (!REDUCED && t >= p.ghostAt && t < p.ghostAt + CONFIG.GHOST_DUR){
      const a     = prog(t, p.ghostAt, CONFIG.GHOST_DUR);
      const eased = ease.ghost(a);
      gsc = lerp(1, CONFIG.GHOST_MAX, eased);
      // ramp in fast, then fade to 0 as it reaches full scale
      const peakOp = lerp(0.35, 0.45, bloom);
      gop = peakOp * clamp01(a / 0.18) * (1 - eased);
    }
    p.ghostEl.style.opacity = gop;
    p.ghostEl.style.color   = bloom > 0.5 ? 'var(--blush-deep)' : 'var(--blush)';
    p.ghostEl.style.transform =
      `translate(calc(-50% + ${p.dx + CONFIG.GHOST_OFF.x}cqw), ` +
      `calc(-50% + ${p.dy + CONFIG.GHOST_OFF.y}cqh)) ` +
      `rotate(${p.rot * 0.6}deg) scale(${gsc})`;
  }

  /* ── graph paper ──────────────────────────────────────────────────────
     Present from the FIRST lyric, not just under the collage — it reads as
     the paper the whole piece is written on. It rises to a low resting
     opacity for the typography phase, then strengthens once the photos land
     so the collage has a surface to sit on. */
  const gridIn = clamp01((t - CONFIG.GRID_IN) / CONFIG.GRID_FADE);
  const gridUp = clamp01((t - CONFIG.COLLAGE_IN) / CONFIG.GRID_FADE);
  elGrid.style.opacity =
    lerp(0, CONFIG.GRID_SOFT, ease.out(gridIn)) +
    lerp(0, 1 - CONFIG.GRID_SOFT, ease.out(gridUp));

  /* ── phase 2: photos, tags ────────────────────────────────────────── */
  const c = t - CONFIG.COLLAGE_IN;

  /* Photos settle with the same soft quintic as the lyric words, so the
     whole piece shares one motion vocabulary. */
  for (const ph of photos){
    const a = clamp01((c - ph.delay) / CONFIG.PHOTO_DUR);
    const e = REDUCED ? ease.out(a) : ease.soft(a);
    ph.el.style.opacity = ease.out(clamp01(a / 0.4));
    ph.el.style.transform =
      `translate(-50%, calc(-50% + ${lerp(-6, 0, e).toFixed(3)}%)) ` +
      `rotate(${ph.rot}deg) scale(${lerp(0.93, 1, e).toFixed(4)})`;
  }

  /* Each word is bound to ITS photo in space, but cues on its own stamp in
     time — the photos land together, then the words fill in as they are sung. */
  /* ── the collage words ────────────────────────────────────────────────
     A playful arrival: the word springs in past its resting size, then
     wobbles back down like something dropped onto paper. Three curves run
     at once and settle at different rates, which is what makes it read as
     bouncy rather than merely scaled.

       pop     overshoots to ~1.15 then settles          (scale)
       wobble  a damped tilt that decays to the rest rot (rotation)
       rise    the drop from above, on the soft quintic  (position)
     ─────────────────────────────────────────────────────────────────── */
  for (const tg of tags){
    const a = prog(t, tg.at, CONFIG.TAG_IN);

    if (REDUCED){
      // Static: no spring, no cascade — just a fade into the resting pose.
      const e = ease.out(a);
      tg.el.style.opacity = e;
      tg.el.style.transform = `translate(-50%,-50%) rotate(${tg.rot}deg)`;
      for (const s of tg.chars){ s.style.opacity = 1; s.style.transform = 'none'; }
      continue;
    }

    /* ── The word as a whole ──────────────────────────────────────────────
       A gentle settle that the letters land on top of. Kept understated:
       the character cascade below carries the personality, so doing too
       much here would read as two competing animations. */
    const rise = ease.soft(a);
    const sc   = ease.pop(a);

    // Damped tilt: swings out, then decays to the resting angle.
    const decay  = (1 - a) * (1 - a);
    const wobble = Math.sin(a * Math.PI * 2.6) * CONFIG.TAG_WOBBLE * decay;

    tg.el.style.opacity = a > 0 ? 1 : 0;
    tg.el.style.transform =
      `translate(-50%, calc(-50% + ${lerp(CONFIG.TAG_RISE, 0, rise).toFixed(3)}cqh)) ` +
      `rotate(${(tg.rot + wobble).toFixed(2)}deg) ` +
      `scale(${lerp(0.88, 1, sc).toFixed(4)})`;

    /* ── The letters ──────────────────────────────────────────────────────
       Each character runs the SAME entrance, offset in time — so the word
       assembles left to right like handwriting rather than appearing whole.

       Every letter: drops from above, arcs slightly, spins upright, and
       overshoots its size before settling. The stagger is a fraction of the
       total window so the whole cascade always finishes with the word. */
    const n = tg.chars.length;
    for (let ci = 0; ci < n; ci++){
      const s = tg.chars[ci];

      /* Stagger. Later letters start later, but every letter still gets the
         full CHAR_IN slice of the window — so none is cut short. */
      const lead  = n > 1 ? (ci / (n - 1)) * CONFIG.TAG_STAGGER : 0;
      const ca    = clamp01((a - lead) / Math.max(0.05, CONFIG.TAG_CHAR_IN));

      if (ca <= 0){ s.style.opacity = 0; continue; }

      const cs   = ease.pop(ca);        // overshoot then settle
      const soft = ease.soft(ca);

      // Drop in from above, with a small sideways arc that straightens out.
      const dy   = lerp(CONFIG.TAG_CHAR_RISE, 0, soft);
      const dx   = lerp((ci % 2 ? 1 : -1) * CONFIG.TAG_CHAR_DRIFT, 0, soft);
      // Each letter unwinds its own tilt as it lands.
      const spin = lerp((ci % 2 ? -1 : 1) * CONFIG.TAG_CHAR_SPIN, 0, cs);

      s.style.opacity = ease.out(clamp01(ca / 0.35));
      s.style.transform =
        `translate(${dx.toFixed(3)}em, ${dy.toFixed(3)}em) ` +
        `rotate(${spin.toFixed(2)}deg) ` +
        `scale(${lerp(0.55, 1, cs).toFixed(4)})`;
    }
  }

  /* ── ambient decoration: never stops, never fully leaves frame ────── */
  /* Decoration recedes when the collage arrives. The photos are the subject
     from that point on, and hearts drifting across them read as clutter —
     so the ambient layer drops to DECO_COLLAGE opacity and stays there. */
  const decoFade = lerp(1, CONFIG.DECO_COLLAGE,
                        ease.out(clamp01(c / CONFIG.DECO_FADE)));

  for (const d of deco){
    d.el.style.opacity = decoFade;

    if (REDUCED){
      d.el.style.transform = `translate(-50%,-50%) rotate(${d.rot}deg)`;
      continue;
    }
    /* ── Ambient drift ────────────────────────────────────────────────────
       Three sine waves on DIFFERENT periods per axis, so the path never
       retraces itself — a single sine on each axis draws a flat ellipse and
       reads as mechanical. The secondary terms are deliberately faster and
       smaller: they add the small irregularities that make it look alive. */
    const w  = (t / d.per + d.ph) * Math.PI * 2;

    const dx = Math.sin(w)             * d.amp
             + Math.sin(w * 2.3 + 1.1) * d.amp * 0.28;
    const dy = Math.cos(w * 0.7)       * d.amp * 0.8
             + Math.cos(w * 1.9 + 0.6) * d.amp * 0.22;

    /* Rotation runs on its own slower beat, so a heart is rarely at the
       extreme of its tilt and its drift at the same moment. */
    const rz = d.rot
             + Math.sin(w * 0.8)       * CONFIG.DECO_TILT
             + Math.sin(w * 1.7 + 2.2) * CONFIG.DECO_TILT * 0.3;

    /* A slow breath, out of phase with the drift, so each piece swells and
       shrinks gently as it moves rather than holding a fixed size. */
    const breath = 1 + Math.sin(w * 0.6 + d.ph) * CONFIG.DECO_BREATH;

    /* Hearts swell on the two blooms; stars and twinkles get a lighter
       flutter so the whole field responds without moving in lockstep. */
    const pulse =
      (d.k === 'heart' || d.k === 'heartLine') ? 1 + bloom * 0.16 :
      (d.k === 'star'  || d.k === 'twinkle')   ? 1 + bloom * 0.24 : 1;

    d.el.style.transform =
      `translate(calc(-50% + ${dx.toFixed(3)}%), calc(-50% + ${dy.toFixed(3)}%)) ` +
      `rotate(${rz.toFixed(2)}deg) scale(${(pulse * breath).toFixed(4)})`;
  }

  /* ── chrome: progress + elapsed time ──────────────────────────────── */
  updateScrub(t);
}

/* The bar flips to a vertical track in landscape-phone layout, so the fill
   grows along whichever axis is currently the long one. */
/* There is no visible progress bar. The scrub element is an off-screen
   progressbar kept in sync purely so assistive tech can report position. */
function updateScrub(t){
  elTime.textContent = fmt(t);
  elScrub.setAttribute('aria-valuenow', t.toFixed(2));
}

/* ══════════════════════════════════════════════════════════════════════════
   Wiring
   ══════════════════════════════════════════════════════════════════════════ */
const timeline = new Timeline(CONFIG.END, render);

timeline.onState = () => {
  elToggle.setAttribute('aria-pressed', String(timeline.playing));
  elStatus.textContent = timeline.playing ? 'Playing' : 'Paused';
};

/**
 * Recompute every time-dependent value from the current phrase list and the
 * known audio length, then repaint. Called once the .lrc and the audio
 * metadata have both settled.
 */
function buildTimeline(cues, audioEnd){
  const end = audioEnd || CONFIG.END;
  CONFIG.END = end;

  const list = buildPhrases(cues, end);
  mountPhrases(list);

  /* Collage cue: the closing phrase's own start. Photos land as that line
     begins, so the arrangement is part of the vocal moment rather than an
     epilogue after it. Resolve this BEFORE mountTags(), which reads it. */
  const cp = list[CONFIG.COLLAGE_PHRASE] || list[list.length - 1];
  CONFIG.COLLAGE_IN = cp ? cp.t : end * 0.8;

  mountTags(list);      // paired words cue off this phrase's word stamps

  timeline.duration = end;
  elScrub.setAttribute('aria-valuemax', end.toFixed(2));
  render(timeline.t);
}

/* Audio is optional. If it never becomes usable, the performance.now()
   clock carries the visuals and nothing else changes. */
let audioEnd = 0;
elAudio.src = CONFIG.AUDIO;
elAudio.load();

/* Register the element NOW, not on canplaythrough. play() needs something to
   call the moment a user gesture arrives; a partially-buffered element plays
   fine, and the clock only trusts it once play() actually resolves. */
timeline.useAudio(elAudio);

/* Real duration beats the hardcoded fallback — the lyric stamps are keyed to
   the actual file, so the two must agree. */
elAudio.addEventListener('loadedmetadata', () => {
  if (isFinite(elAudio.duration) && elAudio.duration > 0) audioEnd = elAudio.duration;
  audioSettled = true;
  boot();
});
elAudio.addEventListener('error', () => {
  timeline.useAudio(null);      // confirmed unusable: force the silent clock
  audioSettled = true;          // build on the fallback length
  boot();
});

/* ── Lyric load ─────────────────────────────────────────────────────────
   The lyric file is fetched at runtime rather than inlined, so the words
   live only in your local october.md and never in distributable source.

   fetch() on file:// is blocked by Chrome and Edge. When that happens we
   fall back to PHRASE_FALLBACK and the piece still runs, silently and
   correctly — just with placeholder words. Serve the folder over http:// to
   see the real lyrics.
   ────────────────────────────────────────────────────────────────────── */
let lrcCues = null;

async function loadLRC(){
  try {
    const res = await fetch(CONFIG.LRC, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    const cues = parseLRC(await res.text());
    if (!cues.length) throw new Error('no cues');
    return cues;
  } catch {
    // file:// or missing .lrc — keep the timings, swap in neutral text.
    console.info('[lyric] .lrc unavailable, using placeholder text. ' +
                 'Serve over http:// to load ' + CONFIG.LRC + '.');
    return null;
  }
}

/* Boot runs once, when BOTH the lyrics and the audio length have resolved
   (or been given up on). Whichever settles last triggers the build. */
let lrcSettled   = false;   // .lrc fetch finished, success or not
let audioSettled = false;   // duration known, or audio confirmed unusable
let booted       = false;

function boot(){
  if (booted || !lrcSettled || !audioSettled) return;
  booted = true;

  const end = audioEnd || CONFIG.END;

  /* No lyric file → neutral placeholders, evenly spaced across the track so
     the piece still reads as finished. Each carries a `words` array of one
     so the per-word path below behaves identically to a real phrase. */
  const cues = lrcCues || CONFIG.PHRASE_FALLBACK.map((text, i) => {
    const t = 0.5 + i * (end - 4) / CONFIG.PHRASE_FALLBACK.length;
    return { t, text, words: [{ t, text }] };
  });

  buildTimeline(cues, end);
}

loadLRC().then(cues => {
  lrcCues    = cues;
  lrcSettled = true;
  boot();
});

/* Safety net: if the audio never reports a duration (missing file, codec
   refusal, stalled network), build on the fallback length rather than
   leaving the page stuck on blank paper. */
setTimeout(() => {
  lrcSettled = audioSettled = true;
  boot();
}, 2500);

render(0);

/* ══════════════════════════════════════════════════════════════════════════
   THE GATE — drag one half of the heart onto the other.

   Deliberately forgiving: the join snaps from a generous radius, and a near
   miss shivers and returns rather than failing. There is no wrong answer —
   this is a ritual, not a lock. Keyboard users get #play and arrow keys.
   ══════════════════════════════════════════════════════════════════════════ */
const elGate    = $('#gate'),      elField    = $('#gate-field'),
      elPetals  = $('#petals'),    elCurtain  = $('#curtain'),
      elCurtainL = $('#curtain-l'), elCurtainR = $('#curtain-r');

const GATE = {
  /* Board size as a share of the stage. Touch gets a slightly larger board
     because fingers need more room than a cursor — but not so large that
     the assembled heart crowds the frame or leaves no room to scatter the
     loose pieces around it. */
  /* Board size in vmin (share of the screen's SHORT edge), capped at 42vw so
     it never dominates a narrow phone. Deliberately modest: the assembled
     heart should sit inside the frame with room around it, not fill it. */
  /* vmin tracks the SHORT edge, which on a desktop is the height — so a
     modest vmin reads much smaller across a wide screen than the same number
     does on a phone. 40vmin puts the heart at ~40% of screen height, with
     enough room left around it for the loose pieces to scatter. */
  /* 48 is close to the ceiling: at 54 the scatter clearance above and below
     the board drops under half a piece width on a laptop, and loose pieces
     start overlapping the board itself. */
  BOARD_W_DESKTOP : 48,   // vmin
  BOARD_W_TOUCH   : 41,   // vmin
  TAB             : 0.20, // jigsaw tab size, as a fraction of an edge
  SNAP_FRAC       : 0.38, // snap radius, as a fraction of a piece's width
  GLOW_FRAC       : 0.72, // distance at which a slot starts to shine
  SETTLE          : 0.34, // seconds a piece takes to sink into its slot

  /* ── Completion sequence, in seconds ──────────────────────────────────
     Five acts. Each duration must match its CSS animation, or a class will
     be swapped while the previous animation is still running.

       PAUSE   breath after the final piece lands, before anything moves
       MERGE   seams flare then dissolve; four pieces become one heart
       RADIATE the whole heart beats twice and pours light outward
       BURST   the heart bursts into blossoms that fill the screen
       CURTAIN the blossoms gather and part, revealing the piece behind

     The veil lifts partway through CURTAIN (VEIL_AT) so the two overlap —
     the piece is already visible through the parting flowers. */
  PAUSE   : 0.30,
  MERGE   : 0.70,
  RADIATE : 1.40,
  /* Slower and gentler than before. The burst was fast enough to read as a
     pop rather than a bloom; at 2.2s the flowers have time to travel, drift,
     and settle. HOLD then lets the full field simply sit there — the beat of
     stillness is what makes the parting feel like a decision rather than a
     continuation of the same movement. */
  BURST   : 2.20,
  HOLD    : 0.70,   // the field rests, fully formed, before it opens
  CURTAIN : 2.40,
  VEIL_AT : 0.34,   // fraction into CURTAIN at which the veil starts to lift

  /* ── Blossoms ─────────────────────────────────────────────────────────
     Thrown outward from the heart, then swept apart as a curtain.

     Counts and sizes are tuned for COVERAGE: at 46 flowers averaging 10cqw
     the field only filled ~30% of the frame, which read as scattered petals
     rather than a screen full of blossom. Larger flowers and more of them
     push it past the point where the paper behind stops showing through. */
  /* Tripled for a genuinely dense field. All gradients are shared (see
     buildSprites) so paint setup is cheap, but 400 simultaneously animated
     layers is still a real cost — see PETAL_SCALE below, which trims the
     count on low-core devices rather than dropping frames on them. */
  /* Fewer elements, LARGER each — same visual density at roughly half the
     compositor cost. 400 small flowers and 200 big ones cover the same area,
     but the second is far cheaper: cost scales with layer COUNT, not area. */
  /* Lightened again. Coverage was ~600% — so densely overlapped that most
     of the field was hidden behind itself, paying full compositor cost for
     flowers nobody sees. Trimming the count while keeping them large holds
     the field solid at a fraction of the layers. */
  PETAL_COUNT   : 88,   // whole flowers in the burst
  PETAL_LOOSE   : 46,   // small single petals filling the gaps between them
  PETAL_MIN     : 15.0, // cqw
  PETAL_MAX     : 40.0, // cqw

  /* ── Desktop override ────────────────────────────────────────────────────
     A wide screen shows the whole stage, so the field needs more elements to
     read as dense — but the cost of this burst is dominated by PAINTED AREA,
     not element count. At 40cqw a single flower is 768px across on a 1920
     stage, and 134 of them ran at ~12.7x overdraw.

     Roughly doubling the count while halving the size gives a denser-looking
     field at HALF the paint cost: 265 elements, ~6.5x overdraw. More flowers,
     lighter frame — the two goals are not in tension once size is the lever. */
  /* Raised now that a flower is ONE node with no filter (see buildSprites).
     At 250/140 the desktop field is ~390 elements — still under 20% of the
     old node count, with no filter passes at all. Sizes nudged up slightly
     so the denser field keeps its body rather than reading as confetti. */
  PETAL_COUNT_WIDE : 250,
  PETAL_LOOSE_WIDE : 140,
  PETAL_MIN_WIDE   : 9.0,   // cqw
  PETAL_MAX_WIDE   : 23.0,  // cqw

  /* Throw distance as a fraction of the stage's long edge. Kept under 1.0
     so the bulk of the field stays IN frame — flung too far and the screen
     empties out again at the moment it should be fullest. */
  THROW_MIN     : 0.08,
  THROW_MAX     : 0.68,
};

const TOUCH = matchMedia('(pointer: coarse)').matches;

let gateDone = false;
let pieces   = [];        // { el, col, row, slot:{x,y}, home:{x,y}, placed }
let drag     = null;      // { p, grabX, grabY } while a piece is held

/* ── Jigsaw geometry ──────────────────────────────────────────────────────
   The heart is cut on a 2×2 grid. Adjoining pieces must interlock, so each
   internal edge is generated ONCE and reused: piece A gets the tab, piece B
   gets the matching blank. EDGES holds the sign for each internal cut.
   ────────────────────────────────────────────────────────────────────── */

/* +1 = tab bulges outward, -1 = socket cuts inward. The vertical cut and the
   horizontal cut each alternate, which is what makes the four pieces lock. */
const CUT_V = [ 1, -1 ];   // [top row, bottom row] — vertical centre cut
const CUT_H = [ -1, 1 ];   // [left col, right col] — horizontal centre cut

/* ── The heart artwork ────────────────────────────────────────────────────
   Drawn once, shared by all four pieces. Its true bounding box is
   x: 8→192, y: 8→184 — NOT the full 0→200 of the coordinate space.

   The artwork must fill the 2×2 cut grid exactly. Scaling by a round 0.01
   would leave it inset (0.08→1.92 wide, 0.08→1.84 tall), so the centre of
   the heart would not sit on the centre of the grid and the four quarters
   would not line up when reassembled. HEART_FIT normalises the real bounds
   onto 0→2 on both axes instead.
   ────────────────────────────────────────────────────────────────────── */
const HEART_D =
  'M100 184C44 142 8 106 8 63 8 30 32 8 60 8c18 0 32 9 40 22 ' +
  '8-13 22-22 40-22 28 0 60 22 60 55 0 43-36 79-92 121Z';

/* Bounding box of HEART_D, computed by flattening its beziers — NOT eyeballed
   from the path's control points. The width was previously assumed to be 184
   (from the visible `8` and `192` in the data), but the right lobe's curve
   bulges out to x=200. That 8-unit error mapped the right edge to 2.087 on a
   0..2 grid, pushing 4.35% of the heart outside piece (1,*) where it was
   clipped. Re-measure with the same method if HEART_D ever changes. */
const HEART_BOX = { x: 8, y: 8, w: 192, h: 176 };
const HEART_FIT =
  `scale(${(2 / HEART_BOX.w).toFixed(6)} ${(2 / HEART_BOX.h).toFixed(6)}) ` +
  `translate(${-HEART_BOX.x} ${-HEART_BOX.y})`;

/* Padded viewBox extent for every piece and slot: the 1-unit artwork square
   plus room on all sides for tabs to bulge into. Shared so the SVG markup,
   the element sizing and the slot spacing can never disagree. */
const PAD  = 1 + GATE.TAB * 3;      // total viewBox extent
const POFF = GATE.TAB * 1.5;        // offset of the artwork square within it

/* ══════════════════════════════════════════════════════════════════════════
   BLOSSOMS
   Five-petal cherry blossoms, built as SVG so they scale cleanly and can be
   tinted per-instance. Petals overlap slightly and carry a soft inner wash,
   which is what keeps them reading as soft rather than as flat clip-art.
   ══════════════════════════════════════════════════════════════════════════ */

/* Pink range, light to deep. Each flower picks a pair so the field has
   depth instead of one flat tone. */
const PETAL_TINTS = [
  ['#ffe3ee', '#ffb6d0'],
  ['#ffd0e2', '#ff9dc0'],
  ['#ffc2da', '#f985b3'],
  ['#fbb8d4', '#ef6ea6'],
  ['#f7a8c8', '#e4589a'],
  ['#fdd8e8', '#f7a3c6'],
];

/* ══════════════════════════════════════════════════════════════════════════
   PRE-RENDERED FLOWER SPRITES

   Two optimisations, applied together:

   1. ONE PATH, not five ellipses. The five-lobe outline is generated as a
      single closed bezier, so the shape is one node instead of five.

   2. BACKGROUND-IMAGE, not inline SVG. Each tint is built once as a data URI.
      Every blossom is then a bare <div> carrying `background-image` — the
      browser rasterises each sprite once, caches it, and reuses it for every
      element. A flower costs ONE node instead of eight.

   For 400 flowers that is ~400 nodes rather than ~3,200, with no per-element
   SVG tree to lay out or paint. Motion is untouched: still transform and
   opacity only, still composited.

   The trade is that colour can no longer vary per element — hence one sprite
   per tint, chosen at random when the flower is created.
   ══════════════════════════════════════════════════════════════════════════ */

/* THE ORIGINAL PETAL ARRANGEMENT — five overlapping ellipses.

   An earlier revision replaced these with a single closed path, on the theory
   that fewer shapes meant fewer nodes. That was wrong: the sprite is
   rasterised once and reused, so the shape count inside it costs nothing at
   runtime. All it changed was the look — the path had hard notches between
   petals and no overlap, which read as a stiff star rather than a blossom.

   Keeping the ellipses: they overlap near the middle and have soft round
   tips, which is what made the flower look right. */
function flowerPetals(fill){
  return [0, 1, 2, 3, 4].map(n =>
    `<ellipse cx="50" cy="27" rx="17.5" ry="23" ` +
    `transform="rotate(${n * 72} 50 50)" fill="${fill}"/>`
  ).join('');
}

/* Sprite tables, filled once by buildSprites(). */
const FLOWER_SPRITES = [];
const PETAL_SPRITES  = [];

/* Raster size for every sprite.

   A data-URI SVG with no width/height rasterises at its viewBox size — 100px
   — and is then scaled up to whatever the element is. At 9–23cqw a desktop
   flower displays at 170–440px, so it was being upscaled 1.7–4.4x, and 3–9x
   again on a 2x-DPR screen. That is why the petals looked soft.

   1024 covers the largest desktop flower (≈440 CSS px) on a 2x-DPR screen —
   883 device px — with headroom. 512 still left it 1.7x upscaled there.

   The cost is paid once per tint at build time: six rasters, never per
   element and never per frame. */
const SPRITE_PX = 1024;

/** Wrap SVG markup as a background-image URL. */
function spriteURL(svg){
  /* The explicit width/height give the SVG an intrinsic size, so the browser
     rasterises it at SPRITE_PX instead of at the viewBox. */
  const sized = svg.replace(
    '<svg xmlns="http://www.w3.org/2000/svg"',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${SPRITE_PX}" height="${SPRITE_PX}"`
  );
  return `url("data:image/svg+xml;utf8,${
    sized.replace(/#/g, '%23').replace(/"/g, "'").replace(/\s+/g, ' ')
  }")`;
}

function buildSprites(){
  PETAL_TINTS.forEach(([light, deep], t) => {
    /* Gradient geometry restored to the original: cy 88%, r 72%. Each petal
       is filled from this ONE gradient, so the deep tone pools where the
       petals overlap near the centre and lightens toward the tips — that is
       what gave the flower its depth. My earlier cx/cy 52%/r 54% flattened
       it into a uniform disc.

       Baked into the sprite, so it costs nothing per frame. */
    FLOWER_SPRITES[t] = spriteURL(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<defs>` +
        `<radialGradient id="g" cx="50%" cy="88%" r="72%">` +
          `<stop offset="0%" stop-color="${deep}"/>` +
          `<stop offset="42%" stop-color="${light}"/>` +
          `<stop offset="100%" stop-color="${light}"/>` +
        `</radialGradient>` +
        `<radialGradient id="c" cx="50%" cy="50%" r="50%">` +
          `<stop offset="0%" stop-color="#fff3b0"/>` +
          `<stop offset="60%" stop-color="${deep}" stop-opacity=".55"/>` +
          `<stop offset="100%" stop-color="${deep}" stop-opacity="0"/>` +
        `</radialGradient>` +
      `</defs>` +
      flowerPetals('url(%23g)') +
      `<circle cx="50" cy="50" r="11" fill="url(%23c)"/>` +
      `</svg>`
    );

    /* Loose petal, back to its original rx/ry with no added rim — the stroke
       I put here read as an outline at small sizes rather than as depth. */
    PETAL_SPRITES[t] = spriteURL(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
      `<defs><linearGradient id="l" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0%" stop-color="${light}"/>` +
        `<stop offset="100%" stop-color="${deep}"/>` +
      `</linearGradient></defs>` +
      `<ellipse cx="50" cy="50" rx="20" ry="30" fill="url(%23l)"/>` +
      `</svg>`
    );
  });
}

/**
 * Build the full outline for the piece at (col,row) as one closed path in a
 * 0..1 unit square, expanded by TAB on every side so tabs are not clipped.
 */
function piecePath(col, row){
  const P = PAD;                     // padded viewBox extent (shared)
  const o = POFF;                    // offset of the square inside the pad

  // Edge directions. 0 on the outer border, signed on internal cuts.
  const top    = row === 0 ?  0 : -CUT_H[col];
  const right  = col === 1 ?  0 :  CUT_V[row];
  const bottom = row === 1 ?  0 :  CUT_H[col];
  const left   = col === 0 ?  0 : -CUT_V[row];

  /* Walk the square clockwise. Each edge is emitted in its own local frame
     then mapped into place — done inline here so the path stays one string. */
  const t = GATE.TAB;
  const seg = (dir, x0, y0, x1, y1) => {
    if (!dir) return `L ${x1} ${y1}`;
    const dx = x1 - x0, dy = y1 - y0;
    // Perpendicular, pointing outward from the piece.
    const px = dy, py = -dx;
    const at = (f, h) => [
      (x0 + dx * f + px * t * h).toFixed(4),
      (y0 + dy * f + py * t * h).toFixed(4),
    ];
    const h = dir;
    const [ax, ay] = at(0.38, 0);
    const [c1x, c1y] = at(0.30, h * 0.6);
    const [c2x, c2y] = at(0.28, h * 1.5);
    const [mx, my]   = at(0.50, h * 1.5);
    const [c3x, c3y] = at(0.72, h * 1.5);
    const [c4x, c4y] = at(0.70, h * 0.6);
    const [bx, by]   = at(0.62, 0);
    return `L ${ax} ${ay} C ${c1x} ${c1y} ${c2x} ${c2y} ${mx} ${my} ` +
           `C ${c3x} ${c3y} ${c4x} ${c4y} ${bx} ${by} L ${x1} ${y1}`;
  };

  const x0 = o, y0 = o, x1 = o + 1, y1 = o + 1;
  return [
    `M ${x0} ${y0}`,
    seg(top,    x0, y0, x1, y0),
    seg(right,  x1, y0, x1, y1),
    seg(bottom, x1, y1, x0, y1),
    seg(left,   x0, y1, x0, y0),
    'Z',
  ].join(' ') + `|${P}|${o}`;        // pack the viewBox extent alongside
}

/** cqw/cqh → px for the current stage size. */
const cqw = () => elStage.clientWidth / 100;
const cqh = () => elStage.clientHeight / 100;

/* ── Build the board and the pieces ───────────────────────────────────── */
const elBoard  = $('#board'),
      elPieces = $('#pieces');

function buildPuzzle(){
  /* Sized against the SCREEN, not the stage. The stage covers the viewport,
     so in portrait it is ~1.8x wider than the phone — a board in cqw came
     out far too big and crowded the frame. vmin tracks what is actually
     visible and behaves the same in both orientations. */
  const boardW = TOUCH ? GATE.BOARD_W_TOUCH : GATE.BOARD_W_DESKTOP;
  /* The vw cap only bites in landscape, where vmin tracks the short (height)
     edge and a vmin-sized board could otherwise grow wider than the screen.
     In portrait vmin == vw, so it must sit above BOARD_W_TOUCH or it would
     silently clamp the touch size back down. */
  const cap = Math.max(boardW + 4, 46);
  elBoard.style.width = `min(${boardW}vmin, ${cap}vw)`;
  elField.style.setProperty('--board-w', `min(${boardW}vmin, ${cap}vw)`);

  /* Hand the padding geometry to CSS so slot sizing derives from the same
     numbers as the piece paths. Hard-coding these in the stylesheet is how
     the bottom row ended up overflowing and clipping the heart's tip. */
  elBoard.style.setProperty('--pad',  String(PAD));
  elBoard.style.setProperty('--poff', String(POFF));

  elBoard.innerHTML = '';
  elPieces.innerHTML = '';
  pieces = [];

  for (let row = 0; row < 2; row++){
    for (let col = 0; col < 2; col++){
      const packed = piecePath(col, row);
      const [d, P, o] = packed.split('|');
      const pad = Number(P), off = Number(o);

      /* Each piece shows the quarter of the heart that belongs to it. The
         heart is drawn at full size inside a clip of this piece's outline,
         then shifted so the correct quarter shows through. */
      const uid = `p${col}${row}`;
      /* Flat crimson fill, matching the reference: no gradient, no shading.
         The heart is drawn once at full size and clipped to this piece's
         outline, so the four quarters reassemble into one continuous shape. */
      const svg = `
        <svg viewBox="0 0 ${pad} ${pad}" aria-hidden="true">
          <defs>
            <clipPath id="clip-${uid}" clipPathUnits="userSpaceOnUse">
              <path d="${d}"/>
            </clipPath>
          </defs>
          <g clip-path="url(#clip-${uid})">
            <!-- The heart is drawn ONCE at full size across the whole 2x2
                 grid, then shifted so this piece's clip exposes its own
                 quarter. Because every piece shares one identical drawing,
                 the four quarters reassemble into a seamless whole.

                 HEART_FIT maps the path's true bounding box onto exactly
                 2x2 units. Using a raw scale here would leave the artwork
                 inset from the grid and the cuts would land in the wrong
                 places — which is what broke the reassembly before. -->
            <g transform="translate(${(off - col).toFixed(4)} ${(off - row).toFixed(4)}) ${HEART_FIT}">
              <path d="${HEART_D}" fill="var(--crimson)"/>
            </g>
          </g>
          <!-- Seam: white edge on the internal cuts, as in the reference. -->
          <path class="rim" d="${d}" fill="none"
                stroke="var(--paper)" stroke-width="0.026"
                stroke-linejoin="round"/>
        </svg>`;

      // Slot: the same outline, drawn as a dashed guide on the board.
      const slot = document.createElement('div');
      slot.className = 'slot';
      slot.style.left = (col * 50) + '%';
      slot.style.top  = (row * 50) + '%';
      slot.innerHTML = `
        <svg viewBox="0 0 ${pad} ${pad}" aria-hidden="true">
          <path d="${d}" fill="rgba(23,22,26,.035)"
                stroke="rgba(23,22,26,.28)" stroke-width="0.014"
                stroke-dasharray="0.05 0.035" stroke-linecap="round"/>
        </svg>`;
      elBoard.appendChild(slot);

      const el = document.createElement('div');
      el.className = 'piece';
      el.tabIndex = 0;
      el.setAttribute('role', 'button');
      el.setAttribute('aria-label',
        `Puzzle piece ${col + 1 + row * 2} of 4. Drag into place, or press Enter to place it.`);
      el.innerHTML = svg;
      elPieces.appendChild(el);

      pieces.push({ el, slot, col, row, placed:false, x:0, y:0 });
    }
  }

  layoutPuzzle();
}

/* ── Scatter ──────────────────────────────────────────────────────────────
   Pieces start OUTSIDE the board, in a shuffled ring around it, so the
   arrangement differs every load and never looks pre-solved.
   ────────────────────────────────────────────────────────────────────── */
function layoutPuzzle(){
  const boardBox = elBoard.getBoundingClientRect();
  const fieldBox = elField.getBoundingClientRect();

  /* CRITICAL: a piece's <svg> is `pad` units wide but only the middle 1 unit
     is the artwork square — the rest is overhang that holds the tabs. So to
     make the artwork square exactly a quarter of the board, the ELEMENT must
     be scaled up by `pad`. Sizing the element to the quarter directly (the
     old bug) shrank each quarter by 1/pad and left the assembled heart
     visibly gapped. */
  const quarter = boardBox.width / 2;          // target artwork size
  const pw = quarter * PAD;                    // element size, incl. overhang

  for (const p of pieces){
    p.el.style.width = pw + 'px';

    /* Slot centre in field-local px. The slot <svg> has the same padded
       viewBox, so its artwork centre is the centre of its 50% cell. */
    const sx = (boardBox.left - fieldBox.left) + boardBox.width  * (p.col * 0.5 + 0.25);
    const sy = (boardBox.top  - fieldBox.top ) + boardBox.height * (p.row * 0.5 + 0.25);
    p.slotX = sx; p.slotY = sy;

    if (p.placed) setPiece(p, sx, sy, 0);
  }

  scatter();
}

/** Fisher–Yates over the resting spots, so no piece keeps the same seat. */
function scatter(){
  const fieldW = elField.clientWidth, fieldH = elField.clientHeight;
  const boardBox = elBoard.getBoundingClientRect();
  const fieldBox = elField.getBoundingClientRect();
  const pw = boardBox.width / 2;

  const bx0 = boardBox.left - fieldBox.left;
  const bx1 = bx0 + boardBox.width;
  const by0 = boardBox.top  - fieldBox.top;
  const by1 = by0 + boardBox.height;

  /* Keep pieces on screen. The field spans the whole stage, but the stage
     covers the viewport — so its left and right thirds are off-screen in
     portrait. Scatter only within the band that is genuinely visible. */
  const visW = Math.min(fieldW, innerWidth);
  const visH = Math.min(fieldH, innerHeight);
  const padX = (fieldW - visW) / 2;
  const padY = (fieldH - visH) / 2;

  const m    = pw * 0.58;                     // keep a piece fully in frame
  const minX = padX + m, maxX = padX + visW - m;
  const minY = padY + m, maxY = padY + visH - m;

  /* One piece per quadrant of the visible area, then shuffled — that
     guarantees they end up genuinely spread out rather than clustering,
     which random placement alone does not. Each is jittered hard inside its
     quadrant so the arrangement still looks thrown, not gridded. */
  const quads = [[0, 0], [1, 0], [0, 1], [1, 1]];
  for (let i = quads.length - 1; i > 0; i--){
    const j = Math.floor(Math.random() * (i + 1));
    [quads[i], quads[j]] = [quads[j], quads[i]];
  }

  const clampX = v => Math.max(minX, Math.min(maxX, v));
  const clampY = v => Math.max(minY, Math.min(maxY, v));

  pieces.forEach((p, i) => {
    if (p.placed) return;
    const [qx, qy] = quads[i % quads.length];

    // Span of this quadrant, biased outward so pieces sit away from centre.
    const halfW = (maxX - minX) / 2, halfH = (maxY - minY) / 2;
    const baseX = minX + qx * halfW;
    const baseY = minY + qy * halfH;

    // Push toward the outer corner of the quadrant, then jitter freely.
    const biasX = qx === 0 ? 0.16 : 0.50;
    const biasY = qy === 0 ? 0.16 : 0.50;
    let x = baseX + halfW * (biasX + Math.random() * 0.36);
    let y = baseY + halfH * (biasY + Math.random() * 0.36);

    /* Never let a loose piece sit on the board — it would look pre-placed
       and would be hard to tell apart from a seated one. Push it clear. */
    const overBoard = x > bx0 - pw * 0.4 && x < bx1 + pw * 0.4 &&
                      y > by0 - pw * 0.4 && y < by1 + pw * 0.4;
    if (overBoard){
      x += (x < (bx0 + bx1) / 2 ? -1 : 1) * pw * 1.15;
      y += (y < (by0 + by1) / 2 ? -1 : 1) * pw * 0.55;
    }

    p.rot = (Math.random() - 0.5) * 40;        // wider tilt: more scattered
    setPiece(p, clampX(x), clampY(y), p.rot);
  });
}

/** Position a piece by its CENTRE, in field-local px. */
function setPiece(p, x, y, rot){
  p.x = x; p.y = y;
  p.el.style.transform =
    `translate(${(x).toFixed(1)}px, ${(y).toFixed(1)}px) ` +
    `translate(-50%, -50%) rotate(${(rot || 0).toFixed(2)}deg)`;
}

/* ── Dragging ─────────────────────────────────────────────────────────────
   Absolute pointer position, NOT e.movementX/Y: movement deltas are
   unreliable on touch (many engines report 0), which made pieces jump or
   vanish mid-drag. Tracking the pointer against the field rect is exact on
   every input type.
   ────────────────────────────────────────────────────────────────────── */
function pointerInField(e){
  const b = elField.getBoundingClientRect();
  return { x: e.clientX - b.left, y: e.clientY - b.top };
}

function onDragStart(e){
  if (gateDone) return;
  const el = e.target.closest?.('.piece');
  if (!el) return;
  const p = pieces.find(q => q.el === el);
  if (!p || p.placed) return;

  const pt = pointerInField(e);
  drag = { p, grabX: pt.x - p.x, grabY: pt.y - p.y };

  el.classList.add('dragging');
  el.setPointerCapture?.(e.pointerId);
  elPieces.appendChild(el);          // raise above its siblings
  e.preventDefault();
  e.stopPropagation();
}

function onDragMove(e){
  if (!drag || gateDone) return;
  e.preventDefault();

  const pt = pointerInField(e);
  const { p } = drag;
  const w = elField.clientWidth, h = elField.clientHeight;

  // Clamp to the field so a piece can never be dragged out of reach.
  const x = Math.max(0, Math.min(w, pt.x - drag.grabX));
  const y = Math.max(0, Math.min(h, pt.y - drag.grabY));

  const d = Math.hypot(x - p.slotX, y - p.slotY);
  const pw = elBoard.getBoundingClientRect().width / 2;

  // Straighten as it nears home — the piece squares up to its slot.
  const near = clamp01(1 - d / (pw * GATE.GLOW_FRAC));
  setPiece(p, x, y, lerp(p.rot || 0, 0, near));

  // The slot shines when the piece is close enough to take.
  p.slot.classList.toggle('lit', d < pw * GATE.GLOW_FRAC);
  p.el.classList.toggle('close', d < pw * GATE.SNAP_FRAC);
}

function onDragEnd(){
  if (!drag || gateDone) return;
  const { p } = drag;
  drag = null;

  p.el.classList.remove('dragging', 'close');
  const d = Math.hypot(p.x - p.slotX, p.y - p.slotY);
  const pw = elBoard.getBoundingClientRect().width / 2;

  if (d < pw * GATE.SNAP_FRAC) placePiece(p);
  else {
    p.slot.classList.remove('lit');
    p.el.classList.add('miss');
    setTimeout(() => p.el.classList.remove('miss'), 420);
  }
}

/** A piece finds its slot: it sinks in, the rim flares, the edge glints. */
function placePiece(p){
  if (p.placed) return;
  p.placed = true;
  p.rot = 0;

  p.el.classList.add('placed');
  p.el.classList.remove('close');
  p.el.setAttribute('aria-disabled', 'true');
  p.el.tabIndex = -1;
  p.slot.classList.remove('lit');
  p.slot.classList.add('filled');

  setPiece(p, p.slotX, p.slotY, 0);

  // Flare on the slot rim, then settle.
  p.el.classList.add('flare');
  setTimeout(() => p.el.classList.remove('flare'), 620);

  const done = pieces.filter(q => q.placed).length;
  elStatus.textContent = `${done} of 4 placed`;

  if (done === pieces.length) join();
}

/**
 * All four pieces are home. Run the completion sequence.
 *
 * Each act is a class on #gate, added in order and never removed, so the
 * CSS for a later act can override an earlier one without the animations
 * fighting. Timings come from CONFIG and must match the stylesheet.
 */
function join(){
  if (gateDone) return;
  gateDone = true;
  drag = null;

  // Seat anything still loose (keyboard shortcut, or a race on the last drop).
  for (const p of pieces){
    if (!p.placed){
      p.placed = true;
      setPiece(p, p.slotX, p.slotY, 0);
      p.el.classList.add('placed');
      p.slot.classList.add('filled');
    }
  }

  elGate.classList.add('joined');
  elStatus.textContent = 'Complete';

  const ms = s => s * 1000;
  let t = ms(GATE.PAUSE);

  // Act 1 — the seams close and the four pieces become one heart.
  setTimeout(() => {
    elGate.classList.add('merging');
    elStatus.textContent = 'The heart is whole';
  }, t);
  t += ms(GATE.MERGE);

  // Act 2 — the whole heart beats and radiates.
  setTimeout(() => elGate.classList.add('radiating'), t);
  t += ms(GATE.RADIATE);

  // Act 3 — the heart bursts into blossoms that fill the screen.
  setTimeout(() => {
    elGate.classList.add('departing');
    burstBlossoms();
    elStatus.textContent = 'Blossoms';
  }, t);
  /* Burst, then a beat of stillness with the field fully formed. Parting
     immediately made the two moves read as one continuous sweep. */
  t += ms(GATE.BURST) + ms(GATE.HOLD);

  // Act 4 — those same blossoms part like a curtain.
  setTimeout(() => document.body.classList.add('parting'), t);

  /* The veil lifts early into the parting, so the composition is already
     visible through the opening flowers rather than appearing after them. */
  setTimeout(start, t + ms(GATE.CURTAIN * GATE.VEIL_AT));

  // Once the curtain has fully swept off, drop the blossoms from the DOM.
  setTimeout(() => {
    clearTimeout(settleTimer);
    elPetals.innerHTML = '';
    elPetals.classList.remove('bursting', 'settled');
    elCurtainL.innerHTML = '';
    elCurtainR.innerHTML = '';
  }, t + ms(GATE.CURTAIN) + 400);
}

/* ══════════════════════════════════════════════════════════════════════════
   THE BURST
   Flowers are thrown outward from the heart on individual vectors, then
   settle into one of two curtain panels. Each element gets its own CSS
   custom properties and a single keyframe animation, so all of it runs on
   the compositor rather than through per-frame JS.
   ══════════════════════════════════════════════════════════════════════════ */
/* ── Device budget ────────────────────────────────────────────────────────
   400+ simultaneously animated layers is ~17x overdraw. That is fine on a
   desktop or a recent phone and janky on a cheap one, so the count is
   scaled by what the device reports. Better a slightly thinner field than
   a burst that stutters at the emotional peak of the piece. */
const PETAL_SCALE = (() => {
  const cores = navigator.hardwareConcurrency || 4;
  const mem   = navigator.deviceMemory || 4;      // GB, Chromium only
  if (cores <= 4 || mem <= 2) return 0.45;        // budget phone
  if (cores <= 6 || mem <= 4) return 0.70;        // mid-range
  return 1;                                       // desktop / flagship
})();

/* Handle for the timer that swaps the field from "arriving" to "breathing".
   Declared here so burstBlossoms can clear a pending one on the loop-back. */
let settleTimer = 0;

function burstBlossoms(opts = {}){
  const w = elStage.clientWidth, h = elStage.clientHeight;
  const box = elField.getBoundingClientRect();
  const stageBox = elStage.getBoundingClientRect();

  /* Origin. Normally the heart's centre, because the flowers are what the
     heart becomes. On the loop-back there is no heart on screen any more,
     so the field is thrown from the middle of the VISIBLE area instead —
     the stage covers the viewport, so its own centre is what shows. */
  const ox = opts.fromCentre
    ? w / 2
    : (box.left - stageBox.left) + box.width / 2;
  const oy = opts.fromCentre
    ? h / 2
    : (box.top - stageBox.top) + box.height / 2;

  const frag = document.createDocumentFragment();
  const cqwPx = w / 100;

  /* Counts and sizes resolve TOGETHER from one branch, so a wide screen can
     never end up with the desktop count at the portrait size — which would
     be the worst of both: more elements AND more paint. */
  const wide = isWide();
  const P = {
    count: wide ? GATE.PETAL_COUNT_WIDE : GATE.PETAL_COUNT,
    loose: wide ? GATE.PETAL_LOOSE_WIDE : GATE.PETAL_LOOSE,
    min:   wide ? GATE.PETAL_MIN_WIDE   : GATE.PETAL_MIN,
    max:   wide ? GATE.PETAL_MAX_WIDE   : GATE.PETAL_MAX,
  };

  // Trimmed on weaker devices; see PETAL_SCALE.
  const nFlower = Math.round(P.count * PETAL_SCALE);
  const nLoose  = Math.round(P.loose * PETAL_SCALE);
  const total   = nFlower + nLoose;

  for (let i = 0; i < total; i++){
    const isFlower = i < nFlower;
    const tint = Math.floor(Math.random() * PETAL_TINTS.length);
    const spin = Math.random() * 360;

    const el = document.createElement('div');
    el.className = 'blossom' + (isFlower ? '' : ' loose');
    /* One node, no child SVG. The sprite is a cached raster the browser
       reuses across every element that references it. `spin` is applied via
       the transform in the animation rather than baked into the shape, so all
       flowers of a tint share exactly one image. */
    el.style.backgroundImage = isFlower ? FLOWER_SPRITES[tint] : PETAL_SPRITES[tint];

    /* Size: flowers span the configured range, loose petals are smaller.
       Larger ones read as nearer, which gives the field its depth. */
    const size = isFlower
      ? lerp(P.min, P.max, Math.random()) * cqwPx
      : lerp(P.min * 0.45, P.min * 0.95, Math.random()) * cqwPx;
    el.style.width = size + 'px';

    /* Throw vector. Angle is uniform around the circle. Distance uses a
       sqrt distribution so flowers spread EVENLY over the disc rather than
       clustering at the centre — a linear random radius packs most of them
       near the origin and leaves the edges bare. */
    const ang  = Math.random() * Math.PI * 2;
    const r    = Math.sqrt(Math.random());
    const dist = lerp(GATE.THROW_MIN, GATE.THROW_MAX, r) * Math.max(w, h);
    const tx   = Math.cos(ang) * dist;
    const ty   = Math.sin(ang) * dist * 0.92;   // slightly flattened arc

    /* Side is decided by where the flower LANDS, so the curtain splits along
       the true centre line of the screen and nothing has to travel across
       the opening to join its half. Flowers sitting almost exactly on the
       centre are pushed to whichever side they lean, keeping the seam clean. */
    const landX = ox + tx;
    const side  = landX < w / 2 ? -1 : 1;

    /* How far from the centre seam this flower sits, 0..1. The parting is
       driven from this: flowers ON the seam move first and furthest, the
       ones already at the edges barely move. That is what makes the field
       read as a curtain opening from the middle rather than everything
       sliding sideways at once. */
    const seamDist = Math.abs(landX - w / 2) / (w / 2);
    const lead     = clamp01(1 - seamDist);      // 1 at the seam, 0 at the edge

    el.style.setProperty('--ox',   ox + 'px');
    el.style.setProperty('--oy',   oy + 'px');
    el.style.setProperty('--tx',   tx.toFixed(1) + 'px');
    el.style.setProperty('--ty',   ty.toFixed(1) + 'px');
    el.style.setProperty('--spin', (Math.random() * 720 - 360).toFixed(0) + 'deg');
    el.style.setProperty('--side', String(side));
    el.style.setProperty('--sway', (Math.random() * 2 - 1).toFixed(2));

    /* Curtain mechanics, both derived from `lead`. Flowers near the seam
       travel further and start sooner; edge flowers lag and barely shift,
       so the eye reads the opening as spreading outward from the centre. */
    el.style.setProperty('--part-dist', (60 + lead * 55).toFixed(1) + 'cqw');
    el.style.setProperty('--part-delay', ((1 - lead) * 0.34).toFixed(3) + 's');
    /* Launch stagger, FRONT-LOADED. A uniform random delay spread the flowers
       evenly across the window, which reads as a steady stream rather than a
       detonation. Cubing the random pulls most values toward zero: the bulk of
       the field leaves in the first instant and a few stragglers trail after,
       which is how real debris behaves.

       Larger flowers are also released first — heavier fragments carry more
       momentum off the blast, so they lead. */
    const lag = Math.random();
    // Normalised against the ACTIVE max, not the portrait one, or the lead
    // would be miscalculated on desktop where the max is much smaller.
    const sizeLead = isFlower ? (1 - (size / (P.max * cqwPx))) * 0.10 : 0.06;
    el.style.setProperty('--delay',
      (lag * lag * lag * 0.42 + sizeLead).toFixed(3) + 's');

    /* Bigger fragments also travel longer, so the field keeps expanding after
       the initial burst instead of stopping all at once. */
    el.style.setProperty('--dur',
      (GATE.BURST * lerp(0.58, 1.0, Math.random())).toFixed(3) + 's');

    /* Each flower breathes on its own period once it lands, so the held
       field keeps moving instead of freezing. Deliberately long and all
       different, so nothing ever pulses in unison. */
    el.style.setProperty('--breathe', (3.2 + Math.random() * 3.4).toFixed(2) + 's');

    frag.appendChild(el);
  }

  elPetals.appendChild(frag);
  // Force a reflow so the parked transform is committed before the animation
  // class lands — otherwise the first frame can start mid-flight.
  void elPetals.offsetWidth;
  elPetals.classList.add('bursting');

  /* Hand over to the breathing loop once every flower has landed. The class
     swap keeps blossom-out in the animation list, so the flower holds its
     thrown position rather than snapping back to the origin. */
  clearTimeout(settleTimer);
  settleTimer = setTimeout(() => {
    elPetals.classList.add('settled');
  }, (GATE.BURST + 0.55) * 1000);
}

elPieces.addEventListener('pointerdown', onDragStart);
addEventListener('pointermove', onDragMove, { passive:false });
addEventListener('pointerup', onDragEnd);
addEventListener('pointercancel', onDragEnd);

/* Keyboard: Enter or Space on a focused piece sends it home. */
elPieces.addEventListener('keydown', e => {
  if (gateDone) return;
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const el = e.target.closest?.('.piece');
  const p  = pieces.find(q => q.el === el);
  if (!p || p.placed) return;
  e.preventDefault();
  placePiece(p);
});

buildSprites();  // sprite data URIs must exist before any flower references them
buildPuzzle();

/* The collage was positioned during initial evaluation, before layout had
   settled, so run the squeeze once the real dimensions are known. */
requestAnimationFrame(applySqueeze);

/* Re-lay on resize. The puzzle board only matters while the gate stands, but
   the collage squeeze has to track every orientation flip for the whole
   runtime — landscape crops half the composition's height, portrait none. */
let relayTimer = 0;
addEventListener('resize', () => {
  clearTimeout(relayTimer);
  relayTimer = setTimeout(() => {
    applySqueeze();
    if (!gateDone) layoutPuzzle();
  }, 140);
}, { passive:true });

/* Mark the gate ready so the hint begins its slow breathing. */
setTimeout(() => elGate.classList.add('ready'), 2200);

function start(){
  /* Two stages. `.hidden` clears only the veil's paper background, so the
     composition shows through the parting flowers while they are still on
     screen. `.gone` retires the veil entirely once they have swept off —
     doing both at once would fade the curtain mid-parting. */
  elVeil.classList.add('hidden');
  setTimeout(() => elVeil.classList.add('gone'), GATE.CURTAIN * 1000);

  // Fade the composition up to meet the opening.
  elStage.classList.add('opening');
  setTimeout(() => elStage.classList.remove('opening'), 1300);

  /* The blossoms are not cleared here — they are still mid-parting, and
     their own animation fades them out. loopBack() removes the spent
     elements once that sweep has finished. */
  timeline.play();
}

/* ══════════════════════════════════════════════════════════════════════════
   LOOP BACK
   When the piece finishes, the flower curtain sweeps back IN to cover the
   screen, the puzzle is rebuilt behind it, then it parts again — returning
   to the gate so the whole thing can be solved and watched once more.

   Reuses the same blossom field and the same parting animation, run in
   reverse order: close → reset → open.
   ══════════════════════════════════════════════════════════════════════════ */
function loopBack(){
  const ms = s => s * 1000;

  /* 1 — the curtain closes. A fresh burst is thrown from the centre of the
     screen (not the heart, which is long gone) and left standing. */
  elVeil.classList.remove('gone', 'hidden');
  document.body.classList.remove('parting');
  burstBlossoms({ fromCentre: true });

  /* 2 — behind that cover, put the gate back exactly as it was on load. */
  setTimeout(resetGate, ms(GATE.BURST) + 120);

  /* 3 — the curtain parts again onto the rebuilt puzzle. Same HOLD beat as
     the opening sequence, so the loop feels like the same choreography
     rather than a faster reprise of it. */
  const partAt = ms(GATE.BURST) + ms(GATE.HOLD);
  setTimeout(() => {
    document.body.classList.add('parting');
  }, partAt);

  /* 4 — clear the spent flowers once they have swept off.

     This is the LOOP cleanup only: the flowers are still the curtain here,
     so they cannot go any earlier. The restarted piece is safe because it
     stays behind the veil until the gate is solved again — see the note in
     clearBlossoms() about why start() must also clear them. */
  setTimeout(clearBlossoms, partAt + ms(GATE.CURTAIN) + 300);
}

/** Remove every blossom and reset the petal layer's animation state. */
function clearBlossoms(){
  clearTimeout(settleTimer);
  elPetals.innerHTML = '';
  elPetals.classList.remove('bursting', 'settled');
  document.body.classList.remove('parting');
}

/** Return the gate to its untouched state, ready to be solved again. */
function resetGate(){
  // Rewind the piece itself.
  timeline.pause();
  timeline.t = 0;
  if (timeline.el) timeline.el.currentTime = 0;
  render(0);

  /* Clear every completion class so the acts can run again from the top.

     `departing` MUST go here. It is what makes the curtain haze visible via
     `#gate.departing ~ #curtain`, and curtain-in ends at opacity 1 with a
     forwards fill — so leaving the class on kept a pink wash over the whole
     restarted lyric phase. Removing it stops the selector matching, which
     drops the fill with it. */
  elGate.classList.remove('joined', 'merging', 'radiating', 'departing', 'ready');
  elStage.classList.remove('opening');

  // Rebuild the puzzle: fresh scatter, nothing seated.
  gateDone = false;
  drag = null;
  buildPuzzle();
  applySqueeze();

  elStatus.textContent = 'Ready';
  setTimeout(() => elGate.classList.add('ready'), 1800);
}

timeline.onEnd = loopBack;

elPlay.addEventListener('click', e => { e.stopPropagation(); join(); });

elStage.addEventListener('click', () => {
  // While the gate stands, clicking the stage does nothing: the only way
  // through is the halves. Once open, the stage is the play/pause target.
  if (!elVeil.classList.contains('hidden')) return;
  timeline.toggle();
});

elToggle.addEventListener('click', () => {
  gateDone ? timeline.toggle() : join();
});

elRestart.addEventListener('click', () => {
  elVeil.classList.add('hidden');
  gateDone = true;
  timeline.restart();
});

addEventListener('keydown', e => {
  // Let buttons and the slider handle their own keys natively.
  const onControl = e.target instanceof HTMLButtonElement
                 || !!e.target.closest?.('.piece');
  if (onControl && (e.key === ' ' || e.key === 'Enter')) return;

  if (e.key === ' '){
    e.preventDefault();
    // Before the gate opens, Space performs the join rather than playing.
    gateDone ? timeline.toggle() : join();
  } else if (e.key === 'r' || e.key === 'R'){
    e.preventDefault();
    elVeil.classList.add('hidden');
    gateDone = true;
    timeline.restart();
  }
});

/* ══════════════════════════════════════════════════════════════════════════
   Fullscreen
   The stage is edge-to-edge on every device by default (the .immersive class
   is unconditional in CSS). This button requests TRUE browser fullscreen on
   top of that, which additionally hides the URL bar and system chrome.
   ══════════════════════════════════════════════════════════════════════════ */
document.body.classList.add('immersive');

const isFull = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

elFs.addEventListener('click', async e => {
  e.stopPropagation();               // do not also toggle playback
  const el = document.documentElement;
  try {
    if (!isFull()){
      // webkitRequestFullscreen covers iPad Safari and older WebKit.
      await (el.requestFullscreen?.() ?? el.webkitRequestFullscreen?.());
      /* The composition is 288:361 portrait, so portrait fills the most
         screen. Lock where supported; ignore refusal (desktop, iOS). */
      screen.orientation?.lock?.('portrait')?.catch?.(() => {});
    } else {
      await (document.exitFullscreen?.() ?? document.webkitExitFullscreen?.());
      screen.orientation?.unlock?.();
    }
  } catch {
    /* Refused — file://, or iPhone Safari, which has no element fullscreen
       at all. The layout is already edge-to-edge, so nothing is lost. */
  }
  elFs.setAttribute('aria-pressed', String(isFull()));
});

document.addEventListener('fullscreenchange', () => {
  elFs.setAttribute('aria-pressed', String(!!document.fullscreenElement));
});

/* ── Idle UI ──────────────────────────────────────────────────────────────
   Chrome fades out while the piece plays and returns on any input, so the
   composition is unobstructed without hiding the controls entirely.
   ────────────────────────────────────────────────────────────────────── */
let idleTimer = 0;
function wakeUI(){
  document.body.classList.add('ui-active');
  clearTimeout(idleTimer);
  // Only auto-hide while actually playing; a paused frame keeps its controls.
  if (timeline.playing){
    idleTimer = setTimeout(() => document.body.classList.remove('ui-active'), 2400);
  }
}
for (const ev of ['pointermove','pointerdown','keydown','focusin']){
  addEventListener(ev, wakeUI, { passive:true });
}
wakeUI();

/* ── Audio warm-up ──────────────────────────────────────────────────────
   The gate now owns the entrance, so there is NO autoplay: the piece must
   never begin before the halves are joined.

   This only warms the decoder with a muted, immediately-cancelled play() so
   the real playback after the join starts instantly instead of stalling. It
   must leave the element unmuted, or the whole piece would run silent.
   ────────────────────────────────────────────────────────────────────── */
(async () => {
  try {
    elAudio.muted = true;
    await elAudio.play();
    elAudio.pause();
    elAudio.currentTime = 0;
  } catch {
    /* Blocked — fine. The join is a real user gesture, so the play() inside
       start() will be permitted and will carry sound. */
  } finally {
    elAudio.muted = false;
  }
})();
