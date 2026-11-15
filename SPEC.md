# holdframe — build spec

A browser-based motion graphics editor. Open-source alternative to After Effects
for the 10% of it people actually use.

Name is free on npm, crates.io, and unused on GitHub. A "hold frame" is a frame
where nothing changes — an animation term.

Audience: anyone who pays Adobe $23/month to animate text and shapes.

## Read this first

Every decision below is already made. Do not re-evaluate the stack, the renderer
or the scope. If something here turns out to be wrong, say so and stop rather
than substituting your own choice.

Non-goals, explicitly. Do not build these even if they seem natural:
3D, expressions or scripting, masks and mattes, an effects library, audio,
nested compositions, video layers, motion blur, mesh warp, plugins,
collaboration, accounts, any backend.

## Stack — fixed

- TypeScript, `strict: true`
- Vite 8, React 19, Zustand 5
- Rendering: **Canvas2D**, behind a `Renderer` interface
- Export: `mediabunny` (MP4/WebM, encode + mux), `gifenc` (GIF), own Lottie JSON writer
- Tests: Vitest, Playwright
- Static site, no backend, deploys to GitHub Pages. Nothing is uploaded anywhere.

Canvas2D is deliberate, not a compromise. v1 has no effects that need a GPU, and
Canvas2D works in every browser. The `Renderer` interface exists so WebGPU can
replace it later without touching anything else. Do not reach for WebGPU now.

## Data model — implement exactly this

```ts
type Time = number;        // seconds
type Vec2 = { x: number; y: number };

interface Project { version: 1; composition: Composition }

interface Composition {
  width: number; height: number;      // px
  fps: number;
  duration: Time;
  background: string | null;          // CSS colour, null = transparent
  layers: Layer[];                    // index 0 renders on top
}

type Easing =
  | { kind: 'hold' }
  | { kind: 'linear' }
  | { kind: 'bezier'; x1: number; y1: number; x2: number; y2: number };

interface Keyframe<T> { t: Time; value: T; easing: Easing }   // easing OUT of this key

type Animatable<T> = { static: T } | { keyframes: Keyframe<T>[] };

interface Transform {
  anchor: Animatable<Vec2>;
  position: Animatable<Vec2>;
  scale: Animatable<Vec2>;       // 1 = 100%
  rotation: Animatable<number>;  // degrees
  opacity: Animatable<number>;   // 0..1
}

interface LayerBase {
  id: string; name: string;
  visible: boolean; locked: boolean;
  inPoint: Time; outPoint: Time;
  transform: Transform;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'add';
}

interface TextLayer extends LayerBase {
  kind: 'text';
  text: string;
  fontFamily: string; fontSize: number; fontWeight: number;
  fill: string;
  align: 'left' | 'center' | 'right';
  lineHeight: number;
  animator: TextAnimator | null;
}

interface ShapeLayer extends LayerBase {
  kind: 'shape';
  shape: 'rect' | 'ellipse';
  size: Animatable<Vec2>;
  fill: string | null;
  stroke: { colour: string; width: number } | null;
  cornerRadius: Animatable<number>;   // rect only
}

interface ImageLayer extends LayerBase {
  kind: 'image';
  assetId: string;                    // key into the asset store
  size: Animatable<Vec2>;
}

type Layer = TextLayer | ShapeLayer | ImageLayer;

// The headline feature. Animates each character/word/line with a delay between
// them, which is what makes motion graphics look like motion graphics.
interface TextAnimator {
  unit: 'character' | 'word' | 'line';
  stagger: Time;                      // delay between consecutive units
  order: 'forward' | 'reverse' | 'random';
  duration: Time;                     // per-unit animation length
  easing: Easing;
  from: Partial<{
    position: Vec2; scale: Vec2; rotation: number; opacity: number; blur: number;
  }>;
}
```

## Architecture

```
src/
  model/      types, project construction, validation, migrations
  eval/       evaluate(project, t) -> RenderTree        PURE, no DOM
  render/     Renderer interface, canvas2d/ implementation
  export/     gif.ts, video.ts (mediabunny), lottie.ts
  store/      zustand store + command stack for undo
  ui/         Timeline, Viewport, LayerList, PropertyPanel, Toolbar
  assets/     IndexedDB asset store for images
```

The split that matters: `eval/` is a pure function from `(Project, Time)` to a
flat `RenderTree` of positioned, resolved draw commands. It must not touch the
DOM or canvas. Everything hard lives there and everything there is unit
testable. `render/` only walks a RenderTree and draws.

Undo is a command stack, not state snapshots. Every mutation is a command with
`apply` and `revert`.

## Milestones

Each one ends in something runnable. Do not start the next until the acceptance
criteria pass.

**M1 — model and evaluator, no UI.**
`evaluate(project, t)` returns a correct RenderTree.
Accept: unit tests cover linear, bezier and hold easing; `t` before the first
and after the last keyframe clamps to that keyframe's value; a layer outside
`inPoint..outPoint` is absent from the tree; static and keyframed properties
both resolve; transform composition (anchor, scale, rotation together) is
correct. No DOM imports anywhere in `eval/`.

**M2 — Canvas2D renderer, static.**
Render a hand-written project JSON at a given `t`.
Accept: text, rect, ellipse and image all draw; opacity, rotation, scale, anchor
and blend modes visibly correct; golden-frame tests pass for a fixture project
at t = 0, 0.5 and 1.0.

**M3 — timeline and playback.**
Accept: play and pause at the composition fps with no drift over 10s; scrubbing
updates the viewport within one frame; layer rows show keyframes as diamonds;
dragging a diamond moves the keyframe and is undoable.

**M4 — authoring.**
Accept: create, delete, reorder and rename layers; edit every property in the
panel; add and remove keyframes; pick an easing curve from a bezier editor; undo
and redo every one of those operations.

**M5 — text animator. This is the feature the project is about.**
Accept: per-character, per-word and per-line staggering all work; forward,
reverse and random order; built-in presets (fly in up, fade in, scale in,
typewriter, blur in); a 4-second text animation is authorable in under a minute
from a blank project.

**M6 — export.**
Accept: GIF matches composition fps and duration; MP4 via mediabunny plays in
VLC and in Chrome; Lottie JSON loads in lottie-web and visually matches our own
render; exporting a 1080x1080 4s composition finishes in under 30s.

**M7 — persistence.**
Accept: IndexedDB autosave survives reload; a project exports to and imports
from a single `.holdframe` JSON file; images round-trip; an unknown future
`version` fails with a clear message rather than corrupting state.

**M8 — launch assets.**
Accept: the demo GIF below exists; README leads with it; the app is live on
GitHub Pages and usable with no install and no sign-up.

## Testing

- Unit (Vitest) on `eval/`. This is where the bugs are. Cover easing maths,
  keyframe boundaries, in and out clipping, stagger offsets and ordering.
- Golden-frame: render a fixture at fixed times, compare PNG against a committed
  reference with a small per-pixel tolerance. Catches renderer regressions that
  unit tests cannot.
- Export smoke: assert frame count, duration, and that the output decodes.
- E2E (Playwright): blank project, add text layer, apply a preset, scrub, export
  a GIF.

## The demo GIF is a deliverable

It is the single thing that decides whether anyone stars this, so treat it as
part of M8 rather than decoration.

1080x1080, about 4 seconds, loops seamlessly. A headline staggering in
per-character with an overshoot ease, then a shape wiping in behind it. Record
the real UI with the timeline visible, so it is obvious this is an editor and
not just a video. It goes at the top of the README, above all prose.

## README requirements

Open with the GIF, then one sentence: a browser-based motion graphics editor, no
install, no subscription, nothing uploaded. Then the live link, then what it
does, then what it explicitly does not do — the non-goals list, because stating
them prevents the top comment being "this isn't After Effects". Then Lottie
export, then how to run it locally.

## Positioning, for later

Launch title: "Show HN: holdframe – open-source, browser-based alternative to
After Effects".

Do not overclaim parity. The honest framing is stronger: the 10% of After
Effects people actually use, free, in a browser, with Lottie export.
