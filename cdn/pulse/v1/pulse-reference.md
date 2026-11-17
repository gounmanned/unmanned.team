# Pulse v1: reference for building pages
The Unmanned design system as plain HTML, CSS and one small script. This file is the whole reference in one place, for AI assistants and anyone who prefers text. The same content, with live examples and every state of every component: https://cdn.unmanned.team/pulse/v1/docs/index.html.

## Getting started

How to build a page with Pulse: load four files, copy markup from these pages, and let your own CSS do the layout.

### What Pulse is

Pulse is the Unmanned design system: the same components in Figma (library “Unmanned DS - Core”) and in code. In code it is plain CSS and one small script. There is nothing to install and no build step.

A Pulse component is not a file you import. It is a piece of HTML with the right classes and attributes. Once the Pulse files are on the page, any HTML written that way becomes the component. These pages show that HTML for each component, ready to copy.

### 1. Load Pulse

Put these lines in the `<head>`, in this order. Or start from the starter page (https://cdn.unmanned.team/pulse/v1/docs/starter.html), which has them already.

```html
<html lang="en" data-theme="light" data-surface="web">
<head>
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-tokens.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-icons.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-components.css">
  <script src="https://cdn.unmanned.team/pulse/v1/pulse.js" defer></script>
</head>
```

- `pulse-tokens.css`: the values (colors, type, spacing, radius) as CSS variables.

- `pulse-icons.css`: the icons.

- `pulse-components.css`: the components.

- `pulse.js`: every behavior: popovers, dialogs and drawers, menus and dropdowns, tabs, toasts, copying, sliders, tooltips’ Esc. Nothing happens until the page uses one, and pages never need their own script for these.

### 2. Pick the theme and the surface

| Attribute | Values | What it does |
|---|---|---|
| `data-theme` | `light` (default), `dark` | Color mode. Put it on `<html>` for the page, or on any element to switch just that part (a dark band on a light page). |
| `data-surface` | `web` (default), `app` | Shape. `web` (the website) gives every corner 2px and square-ish buttons. `app` (VEX) uses 4, 8 and 12px corners and pill buttons. |

### 3. Copy components

Open the component’s page from the menu, find the example closest to what you need, press Copy and paste it into your page. Then change the text, the links and any `id` (each `id` must be unique on the page, and the attributes that point to it, like `aria-labelledby` and `data-pulse-open`, must match).

Keep the classes and attributes as they are. If a component doesn’t do what you need, don’t restyle it on your page: ask the design-system side for a new option, so Figma and code stay the same.

### 4. Lay out the page yourself

Pulse styles components, not pages. Grids, columns, section spacing and headings are your page’s own CSS. Use Pulse tokens there too: `var(--space-32)`, `var(--color-text-secondary)`, `var(--type-heading-section-size)`, never a hex value or a stray px. See Foundations (https://cdn.unmanned.team/pulse/v1/docs/foundations.html) for the tokens and Patterns (https://cdn.unmanned.team/pulse/v1/docs/patterns.html) for common page pieces.

### How your CSS and Pulse fit together

Pulse puts its components in a CSS cascade layer, so any rule on your page wins over Pulse when both style the same thing. That is safe for layout, but it also means a broad rule like `a { color: inherit }` or `.card button { … }` will quietly change Pulse components. Put rules for bare elements in the `reset` layer, which sits under Pulse:

`@layer reset { a { color: inherit; } }`

### Rules worth knowing

- **Link or button:** a link goes somewhere, a button does something here. See Patterns (https://cdn.unmanned.team/pulse/v1/docs/patterns.html).

- **Icons need a label:** an icon-only button gets `aria-label`; a decorative icon gets `aria-hidden="true"`.

- **Copy:** sentence case everywhere (CSS makes eyebrows caps), no em dashes, curly quotes.

- **Every width:** check pages at 1440, 1024, 768, 375 and 302px wide, with no sideways scrolling.

### For AI assistants

All of these pages, as one Markdown file: pulse-reference.md (https://cdn.unmanned.team/pulse/v1/docs/../pulse-reference.md). Point an assistant at it before it writes Pulse markup.

## Starter page

A blank page with Pulse already wired up. Copy it, save it as index.html and start from there.

It loads the fonts and the four Pulse files, sets the theme and the surface, and has a small hero to replace. The `<style>` block is where your page’s own layout goes.

Open it as a page  (https://cdn.unmanned.team/pulse/v1/docs/starter-template.html)

### The file

```html
<!doctype html>
<html lang="en" data-theme="light" data-surface="web">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Page title</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-tokens.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-icons.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-components.css">
  <script src="https://cdn.unmanned.team/pulse/v1/pulse.js" defer></script>
  <style>
    /* Your page's own layout. Unlayered, so it always wins over Pulse. Use Pulse tokens, not hex or px. */
    body { margin: 0; background: var(--color-surface-page); color: var(--color-text-primary); font-family: var(--font-sans); }
    main { max-width: 720px; margin: 0 auto; padding: var(--space-64) var(--space-16); }
    h1 { margin: var(--space-12) 0 var(--space-16); font: 600 var(--type-display-size) / var(--type-display-line-height) var(--font-sans); }
    .lede { margin: 0 0 var(--space-32); font-size: var(--type-body-lede-size); line-height: var(--type-body-lede-line-height); color: var(--color-text-secondary); }
  </style>
</head>
<body>
  <main>
    <p class="pulse-eyebrow pulse-eyebrow--dot">Don’t get hacked</p>
    <h1>Your headline.</h1>
    <p class="lede">One or two sentences that say what this page is for.</p>
    <div class="pulse-actions">
      <a class="pulse-btn pulse-btn--primary pulse-btn--lg" href="#">Main action</a>
      <a class="pulse-link" href="#">See how it works <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
    </div>
  </main>
</body>
</html>
```

## Foundations

Tokens are CSS custom properties in pulse-tokens.css: --color-* (by role: surface, text, border, accent, status, indicator, code), --space-4 to --space-128 (4px grid), --type-<role>-size and -line-height, --radius-* roles, --size-icon-*, --shadow-*, --font-sans, --font-mono. Never hard-code a hex or px value that a token covers. Read pulse-tokens.css for the full list.

## Patterns

Common page pieces built from Pulse parts, and the rule for links and buttons.

### Link or button

A **link** goes somewhere: another page (right arrow), further down this page (down arrow, `pulse-link--down`) or another site or a new tab (`arrow-square-out`). A **button** does something here: opens a drawer, dialog or menu, copies, toggles, submits, replays. Buttons have no arrow.

Exceptions:

- The page’s main action may look like a button even when it goes somewhere (Buy a Dot). Write it as an `<a class="pulse-btn …">` so it works without JavaScript.

- A menu trigger may look like a quiet link with a caret (`aria-expanded` on a `<button>`). See Dropdown and nav menu (https://cdn.unmanned.team/pulse/v1/docs/dropdown.html).

- A drawer opener inside a sentence keeps the inline link look, with no arrow.

- A pair of guides on another site may be secondary buttons with `arrow-square-out`.

- A drawer opener among links is a ghost button with no icon.

### Section heading

An eyebrow, a headline and a lede. The headline and lede are your page’s own elements, sized with the type tokens (`--type-heading-section-*`, `--type-body-lede-*`). Statement headlines end with a period.

```html
<section class="section-intro">
  <p class="pulse-eyebrow">Meet a Dot</p>
  <h2>Your Dot. A little offensive.</h2>
  <p>A sentence or two that says what this section shows.</p>
</section>
```

### Dark section on a light page

Put `data-theme="dark"` on the section and give it the page surface as its background. Everything inside follows: text, borders, buttons, links. Never pick dark colors by hand. A dark drawer works the same way: `data-theme="dark"` on the `<dialog>`.

```html
<section data-theme="dark" style="background: var(--color-surface-page); color: var(--color-text-primary); padding: var(--space-32)">
  <p class="pulse-eyebrow">The team</p>
  <p>Text, borders and buttons inside follow the dark colors.</p>
  <a class="pulse-btn pulse-btn--primary" href="#">Buy a Dot</a>
</section>
```

### Back to top

On long pages: a neutral button with the `arrow-up` icon and the word “Top”, with the medium shadow. Neutral keeps it quiet (pink is for actions), `pulse-btn--surface` keeps it solid over the content scrolling behind it, and the word says what it does, so it needs no `aria-label`. Fix it 24px from the bottom right (16px on phones) and show it once the reader has scrolled a screen or two; showing and hiding it is the page’s script.

```html
<button class="pulse-btn pulse-btn--neutral pulse-btn--surface" type="button" style="box-shadow: var(--shadow-elevation-default-md)">
  <i class="pulse-icon pulse-icon--arrow-up" aria-hidden="true"></i> Top
</button>
```

## Alert and toast

Messages about something that happened. An alert sits in the page; a toast floats for a moment after an action.

Figma component: Alert, Toast.

### Alert

Tinted, with a border in its tone. Use it for something the reader should see while they are on this part of the page: a connection that worked, a warning that something will expire. An optional neutral button and a dismiss button.

```html
<div class="pulse-alert pulse-alert--success" role="status">
  <i class="pulse-icon pulse-icon--check-circle pulse-icon--fill" aria-hidden="true"></i>
  <div class="pulse-alert__body">
    <span class="pulse-alert__title">Workspace connected</span>
    <span class="pulse-alert__text">Your 24-hour test is ready to start.</span>
    <button class="pulse-btn pulse-btn--neutral pulse-btn--sm" type="button">View workspace</button>
  </div>
  <button class="pulse-dismiss" type="button" aria-label="Dismiss"><i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button>
</div>
```

Info:

```html
<div class="pulse-alert" role="status">
  <i class="pulse-icon pulse-icon--info pulse-icon--fill" aria-hidden="true"></i>
  <div class="pulse-alert__body"><span class="pulse-alert__title">A new report is available</span></div>
</div>
```

Warning:

```html
<div class="pulse-alert pulse-alert--warning" role="status">
  <i class="pulse-icon pulse-icon--warning pulse-icon--fill" aria-hidden="true"></i>
  <div class="pulse-alert__body"><span class="pulse-alert__title">Access expires in 24 hours</span></div>
</div>
```

Danger:

```html
<div class="pulse-alert pulse-alert--danger" role="alert">
  <i class="pulse-icon pulse-icon--warning-octagon pulse-icon--fill" aria-hidden="true"></i>
  <div class="pulse-alert__body">
    <span class="pulse-alert__title">Connection failed</span>
    <span class="pulse-alert__text">We couldn’t reach your identity provider. Try again.</span>
  </div>
</div>
```

No icon:

```html
<div class="pulse-alert pulse-alert--warning" role="status">
  <div class="pulse-alert__body">
    <span class="pulse-alert__title">Access expires in 24 hours</span>
  </div>
</div>
```

### Toast

Solid color, for confirming an action that just happened (“Report exported”). Its action is a text link. Don’t put toasts in your page’s HTML: pulse.js makes them. A button with `data-pulse-toast` shows one when clicked; from a script, call `Pulse.toast()`.

Success toast:

```html
<button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-toast="Report exported" data-pulse-toast-tone="success">Export report</button>
```

Error toast:

```html
<button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-toast="Export failed" data-pulse-toast-text="Try again in a minute." data-pulse-toast-tone="danger">Show an error</button>
```

```html
<script>
  Pulse.toast({
    title: 'Report exported',
    text: 'Your 24-hour test is ready to start.',  // optional
    tone: 'success',          // neutral (default), info, success, warning, danger
    action: { label: 'View report', href: '/reports/latest' },  // optional; or onClick instead of href
    duration: 5000,           // ms; 0 keeps it until dismissed
    icon: true                // false for no icon
  });
</script>
```

Toasts stack in the bottom right (full width on phones), go away after five seconds, and wait while the pointer or focus is on them. This is what one looks like:

```html
<div class="pulse-toast pulse-toast--neutral" role="status">
  <i class="pulse-icon pulse-icon--info pulse-icon--fill" aria-hidden="true"></i>
  <div class="pulse-toast__body">
    <span class="pulse-toast__title">Report exported</span>
    <a class="pulse-toast__cta" href="#">View report</a>
  </div>
  <button class="pulse-dismiss" type="button" aria-label="Dismiss"><i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button>
</div>
```

### Icons

The icon is optional: leave the `<i>` out and the text starts at the edge (for `Pulse.toast()`, pass `icon: false`). Keep it when the message is a warning or an error, so the tone isn’t carried by color alone. In an alert the icon takes the tone’s text color, which is darker than the border.

Toast with no icon:

```html
<div class="pulse-toast pulse-toast--neutral" role="status">
  <div class="pulse-toast__body"><span class="pulse-toast__title">Saved</span></div>
  <button class="pulse-dismiss" type="button" aria-label="Dismiss"><i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button>
</div>
```

### Options

| Class | What it does |
|---|---|
| `pulse-alert--success`, `--warning`, `--danger` | Tone. No tone class is info (blue). |
| `pulse-toast--neutral`, `--success`, `--warning`, `--danger` | Tone. No tone class is info. |
| `__title`, `__text` | The headline and an optional sentence. |
| `pulse-dismiss` | The × button. pulse.js removes its alert or toast (it fires `pulse:dismiss` first; cancel that event to keep it). |
| `data-pulse-toast` | On a button: shows a toast with that title. `data-pulse-toast-text` and `data-pulse-toast-tone` are optional. |

### Accessibility

- Use the icon that matches the tone, and always say it in words too: color alone never carries the meaning.

- `role="status"` for news, `role="alert"` only for errors that need attention now.

- The dismiss button needs `aria-label="Dismiss"`.

## Badge

A small label for status, severity or metadata. Not clickable; for a tag people can toggle, use a chip.

Figma component: Badge.

### Subtle (default)

A tint and a dot.

Neutral:

```html
<span class="pulse-badge">Neutral</span>
```

Accent:

```html
<span class="pulse-badge pulse-badge--accent">New</span>
```

Success:

```html
<span class="pulse-badge pulse-badge--success">Connected</span>
```

Warning:

```html
<span class="pulse-badge pulse-badge--warning">Expiring</span>
```

Danger:

```html
<span class="pulse-badge pulse-badge--danger">Failed</span>
```

Info:

```html
<span class="pulse-badge pulse-badge--info">Running</span>
```

### Solid and outline

Solid for high-salience labels, such as severity in a table. Outline is the quietest.

Solid:

```html
<span class="pulse-badge pulse-badge--solid pulse-badge--danger">Critical</span>
```

Outline:

```html
<span class="pulse-badge pulse-badge--outline pulse-badge--nodot">Draft</span>
```

### Mono

JetBrains Mono caps with no dot, for codes and methods (R0, GET). Gray on its own; add a tone after it to color it.

Code:

```html
<span class="pulse-badge pulse-badge--mono pulse-badge--outline">R0</span>
```

Get:

```html
<span class="pulse-badge pulse-badge--mono pulse-badge--solid pulse-badge--success">Get</span>
```

Post:

```html
<span class="pulse-badge pulse-badge--mono pulse-badge--solid pulse-badge--accent">Post</span>
```

Delete:

```html
<span class="pulse-badge pulse-badge--mono pulse-badge--solid pulse-badge--danger">Delete</span>
```

### Options

| Class | What it does |
|---|---|
| `pulse-badge--accent`, `--success`, `--warning`, `--danger`, `--info` | Tone. No tone class is neutral gray. Accent is for brand moments only (“New”). |
| `pulse-badge--solid` | Filled with the tone. |
| `pulse-badge--outline` | A border in the tone, no fill. |
| `pulse-badge--nodot` | Hides the dot. |
| `pulse-badge--mono` | Mono caps, no dot, gray unless a tone follows. |

### Accessibility

- Always pair a tone with a word. “Failed” in red, never a red dot alone.

## Button

Does something here: submits, opens, copies, starts. Six variants, three sizes, with an icon or icon only.

Figma component: Button.

### Variants

One primary button per view, for the main action. Destructive only for something that deletes or can’t be undone.

Primary:

```html
<button class="pulse-btn pulse-btn--primary" type="button">Start test</button>
```

Secondary:

```html
<button class="pulse-btn pulse-btn--secondary" type="button">Secondary</button>
```

Neutral:

```html
<button class="pulse-btn pulse-btn--neutral" type="button">Neutral</button>
```

Ghost:

```html
<button class="pulse-btn pulse-btn--ghost" type="button">Ghost</button>
```

Ghost neutral:

```html
<button class="pulse-btn pulse-btn--ghost-neutral" type="button">Ghost neutral</button>
```

Destructive:

```html
<button class="pulse-btn pulse-btn--destructive" type="button">Delete</button>
```

| Class | Use it for |
|---|---|
| `pulse-btn--primary` | The main action. Pink. |
| `pulse-btn--secondary` | The second action beside a primary. Pink outline. |
| `pulse-btn--neutral` | Actions inside panels and alerts. Gray outline. |
| `pulse-btn--ghost` | A light action among links (a drawer opener). Pink text. |
| `pulse-btn--ghost-neutral` | Toolbar and icon buttons (copy, close, settings). |
| `pulse-btn--destructive` | Delete and other actions that can’t be undone. |

### Sizes

Small 32px, medium 40px (default), large 48px. Large for the hero and closing actions on the website.

Small:

```html
<button class="pulse-btn pulse-btn--primary pulse-btn--sm" type="button">Small</button>
```

Medium:

```html
<button class="pulse-btn pulse-btn--primary" type="button">Medium</button>
```

Large:

```html
<button class="pulse-btn pulse-btn--primary pulse-btn--lg" type="button">Large</button>
```

### With an icon, or icon only

An icon-only button has no visible text, so it needs `aria-label`. Add a tooltip for anything that isn’t obvious.

With an icon:

```html
<button class="pulse-btn pulse-btn--secondary" type="button">
  <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i> Copy key
</button>
```

Icon only:

```html
<button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon" type="button" aria-label="Settings">
  <i class="pulse-icon pulse-icon--gear" aria-hidden="true"></i>
</button>
```

### Disabled and loading

Disabled keeps the shape and drains the color. `aria-busy="true"` shows a spinner and stops clicks while something is saving.

Disabled:

```html
<button class="pulse-btn pulse-btn--primary" type="button" disabled>Start test</button>
```

Loading:

```html
<button class="pulse-btn pulse-btn--primary" type="button" aria-busy="true">Saving</button>
```

### A button that goes somewhere

The page’s main action may look like a button even when it navigates. Use an `<a>` with the button classes.

Link that looks like a button:

```html
<a class="pulse-btn pulse-btn--primary pulse-btn--lg" href="/install/">Buy a Dot</a>
```

### Other options

| Class | What it does |
|---|---|
| `pulse-btn--sm`, `--lg` | Size. No class is medium. |
| `pulse-btn--icon` | Square, icon only. |
| `pulse-btn--surface` | Gives an outline button the page color behind it, for buttons floating over content. |

### Accessibility

- Use `<button type="button">` for actions and `<a href>` for navigation, whatever they look like.

- Prefer `disabled` only when the reason is obvious; otherwise keep the button and explain what’s missing.

## Checkbox, radio and toggle

Native inputs, restyled. Checkbox for independent choices, radio for one of a few, toggle for a setting that takes effect at once.

Figma component: Checkbox, Radio, Toggle.

### Checkbox

Checkbox:

```html
<label class="pulse-check"><input type="checkbox" checked> Email me the report</label>
```

### Radio

Group radios in a `<fieldset>` with a `<legend>`, and give them the same `name`.

```html
<fieldset style="border: 0; margin: 0; padding: 0; display: flex; gap: var(--space-24)">
  <legend class="pulse-field__label" style="margin-bottom: var(--space-8)">Plan</legend>
  <label class="pulse-radio"><input type="radio" name="plan" checked> Monthly</label>
  <label class="pulse-radio"><input type="radio" name="plan"> Yearly</label>
</fieldset>
```

### Toggle

A checkbox with `role="switch"`. Use it when the change applies right away, without a Save button.

Toggle:

```html
<label class="pulse-toggle"><input type="checkbox" role="switch" checked> Auto-contain devices</label>
```

### Accessibility

- The `<label>` wraps the input, so clicking the words works and screen readers read them.

- `disabled` on the input grays out the label too.

## Chip

A pill people can toggle: filters and multi-select. Badges are labels; chips are controls.

Figma component: Chip.

### Filter chips

```html
<div role="group" aria-label="Filter by source" style="display: flex; gap: var(--space-8); flex-wrap: wrap">
  <button class="pulse-chip" type="button" aria-pressed="true">All</button>
  <button class="pulse-chip" type="button" aria-pressed="false">Identity</button>
  <button class="pulse-chip" type="button" aria-pressed="false">Email</button>
</div>
```

### Removable

For tags someone added (an email domain), with an × at the end.

```html
<button class="pulse-chip" type="button" aria-label="Remove okta.com">okta.com <i class="pulse-icon pulse-icon--x pulse-chip__x" aria-hidden="true"></i></button>
```

### Accessibility

- A toggling chip is a `<button>` with `aria-pressed`. Updating it on click is the page’s script.

- Group them with `role="group"` and an `aria-label` that says what they filter.

## Code panel

A block of code with a file name, a language tag and a copy button. pulse.js does the copying.

Figma component: Code panel.

```html
<div class="pulse-code">
  <div class="pulse-code__head">
    <span class="pulse-code__file">request</span>
    <span class="pulse-code__lang">Shell</span>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-tooltip-host" type="button" data-pulse-copy aria-label="Copy request">
      <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i>
      <span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Copy to clipboard</span>
    </button>
  </div>
  <pre><code><span class="pulse-code__cmt"># list open signals</span>
<span class="pulse-code__fn">curl</span> <span class="pulse-code__kw">-H</span> <span class="pulse-code__str">"Authorization: Bearer $TOKEN"</span> https://api.example/signals</code></pre>
</div>
```

### Parts

| Class | What it is |
|---|---|
| `pulse-code__head` | The bar on top. |
| `pulse-code__file` | The file or request name. |
| `pulse-code__lang` | Optional language tag (Shell, JSON). |
| `pulse-code__fn`, `__kw`, `__str`, `__num`, `__key`, `__cmt` | Syntax colors: function, keyword, string, number, key, comment. Wrap tokens by hand; there is no automatic highlighting. |

### Copying

Any button with `data-pulse-copy` inside a code panel copies the panel’s code and shows “Copied” in its tooltip. To copy something else, give it the element’s `id`: `data-pulse-copy="install-key"` copies that input’s value. `data-pulse-copied="…"` changes the word.

```html
<div style="display: flex; gap: var(--space-8); align-items: center">
  <input class="pulse-input" id="install-key" value="DOT-7F3K-92QX" readonly aria-label="Install key" style="max-width: 220px">
  <button class="pulse-btn pulse-btn--secondary pulse-btn--icon pulse-tooltip-host" type="button" data-pulse-copy="install-key" aria-label="Copy install key">
    <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i>
    <span class="pulse-tooltip pulse-tooltip--bottom" aria-hidden="true">Copy to clipboard</span>
  </button>
</div>
```

### Accessibility

- The copy button needs an `aria-label` that says what it copies. Screen readers also hear “Copied”.

- Long lines scroll sideways inside the panel, never the page.

## Dialog

A modal that asks for a decision. It stops everything until it’s answered.

Figma component: Dialog.

```html
<button class="pulse-btn pulse-btn--destructive" type="button" data-pulse-open="delete-test">Delete test</button>

<dialog class="pulse-dialog" id="delete-test" aria-labelledby="delete-test-title" aria-describedby="delete-test-body">
  <div class="pulse-dialog__head">
    <div class="pulse-dialog__copy">
      <h2 class="pulse-dialog__title" id="delete-test-title">Delete this test?</h2>
      <p class="pulse-dialog__body" id="delete-test-body">This removes the report and every finding. You can’t undo it.</p>
    </div>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-dialog__close" type="button" aria-label="Close" data-pulse-close>
      <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
    </button>
  </div>
  <div class="pulse-dialog__resource">Acme workspace · 24-hour test</div>
  <div class="pulse-dialog__actions">
    <button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-close autofocus>Cancel</button>
    <button class="pulse-btn pulse-btn--destructive" type="button" data-pulse-close>Delete</button>
  </div>
</dialog>
```

### How it works

It’s a native `<dialog>`. A button with `data-pulse-open="its-id"` opens it; anything inside with `data-pulse-close` closes it, and so does Esc. Focus moves into the dialog and goes back to the button afterwards.

### Parts

| Class | What it is |
|---|---|
| `pulse-dialog__title`, `__body` | The question and one or two sentences. |
| `pulse-dialog__resource` | Optional: the thing that will be affected, for destructive dialogs. |
| `pulse-dialog__actions` | Buttons, Cancel first. On phones they stack, main action on top. |

### Accessibility

- `aria-labelledby` points at the title and `aria-describedby` at the body.

- For destructive dialogs, put `autofocus` on Cancel so Enter doesn’t delete by accident.

- For anything longer than a question, use a drawer (https://cdn.unmanned.team/pulse/v1/docs/drawer.html).

## Drawer

A panel that slides in from the right and runs the full height of the window, for detail, a short form or pricing, without leaving the page.

Figma component: Drawer.

```html
<button class="pulse-btn pulse-btn--primary" type="button" data-pulse-open="pricing">See pricing</button>

<dialog class="pulse-drawer" id="pricing" aria-labelledby="pricing-title">
  <div class="pulse-drawer__head">
    <h2 class="pulse-drawer__title" id="pricing-title">Buy a Dot</h2>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-drawer__close" type="button" aria-label="Close" data-pulse-close>
      <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
    </button>
  </div>
  <div class="pulse-drawer__body">
    <p>Anything goes here: copy, a form, a list. It scrolls when it is taller than the window.</p>
  </div>
  <div class="pulse-drawer__foot">
    <div class="pulse-actions--end">
      <button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-close>Cancel</button>
      <a class="pulse-btn pulse-btn--primary" href="#">Continue</a>
    </div>
  </div>
</dialog>
```

### How it works

It’s a native `<dialog>`. A button with `data-pulse-open="its-id"` opens it; `data-pulse-close`, Esc or a click on the dimmed page closes it, and focus goes back to the opener. The page behind is dimmed and doesn’t scroll.

### Opener that is a link

When the drawer is a step on the way somewhere (pricing before checkout), make the opener a link to that place. Without JavaScript it goes straight there; with it, pulse.js opens the drawer instead.

```html
<a class="pulse-btn pulse-btn--primary" href="https://buy.example.com/checkout" data-pulse-open="pricing">Buy a Dot</a>
```

### Options

| Option | What it does |
|---|---|
| `pulse-drawer--lg` | 640px wide instead of 400. Both go full width on narrower screens. |
| `pulse-drawer__foot` | Optional footer that stays put while the body scrolls. Put `pulse-actions--end` inside: Cancel, then the main action. |
| `data-modal="false"` | Opens it beside the page, which stays usable (no dimming). Only its close button or Esc closes it. |
| `data-theme="dark"` | A dark drawer on a light page. |

### Accessibility

- `aria-labelledby` points at the title. The close button needs `aria-label="Close"`.

## Dropdown and nav menu

Two lists that open from a trigger: a dropdown picks a value, a nav menu goes somewhere.

Figma component: Dropdown, Menu item, Nav menu.

### Dropdown (picking a value)

A select-style button that opens a branded list. Items can have an icon; the chosen one shows its check. For a simple form, the native select (https://cdn.unmanned.team/pulse/v1/docs/fields.html) is usually enough.

```html
<div class="pulse-field" style="width: 100%; max-width: 320px">
  <span class="pulse-field__label" id="idp-label">Identity provider</span>
  <div class="pulse-select-wrap pulse-menu-anchor">
    <button class="pulse-select" type="button" data-pulse-menu aria-controls="idp-list" aria-expanded="false" aria-labelledby="idp-label idp-value">
      <span data-pulse-label id="idp-value">Microsoft Entra ID</span>
    </button>
    <ul class="pulse-dropdown" id="idp-list" role="listbox" aria-labelledby="idp-label" hidden>
      <li class="pulse-menu-item" role="option" aria-selected="true" data-value="entra">
        <span class="pulse-menu-item__label">Microsoft Entra ID</span>
        <i class="pulse-icon pulse-icon--check pulse-menu-item__check" aria-hidden="true"></i>
      </li>
      <li class="pulse-menu-item" role="option" aria-selected="false" data-value="google">
        <span class="pulse-menu-item__label">Google Workspace</span>
        <i class="pulse-icon pulse-icon--check pulse-menu-item__check" aria-hidden="true"></i>
      </li>
      <li class="pulse-menu-item" role="option" aria-selected="false" data-value="okta">
        <span class="pulse-menu-item__label">Okta</span>
        <i class="pulse-icon pulse-icon--check pulse-menu-item__check" aria-hidden="true"></i>
      </li>
      <li class="pulse-menu-item" role="option" aria-disabled="true">
        <span class="pulse-menu-item__label">OneLogin (coming soon)</span>
      </li>
    </ul>
  </div>
</div>
```

pulse.js does the rest: `data-pulse-menu` on the button opens and closes the list it controls. Arrow keys, Home and End move through the options; Enter, Space or a click chooses one, which marks it `aria-selected`, writes its label into the button’s `[data-pulse-label]` and fires `pulse:select`. Esc, a click outside or Tab closes it. `pulse-menu-anchor` places the list under its trigger.

```html
<script>
  document.getElementById('idp-list').addEventListener('pulse:select', function (e) {
    console.log('Chosen:', e.detail.value);   // "entra", "google" or "okta"
  });
</script>
```

### Nav menu (going somewhere)

Links with a title and a line of description, opened by a quiet link that is really a button. It’s a list of links, not a listbox, so it has no `role="menu"`.

```html
<div class="pulse-menu-anchor">
  <button class="pulse-link pulse-link--quiet" type="button" data-pulse-menu aria-expanded="false" aria-controls="soc-menu">
    VEX AI SOC <i class="pulse-icon pulse-icon--caret-down" aria-hidden="true"></i>
  </button>
  <nav class="pulse-dropdown pulse-dropdown--nav" id="soc-menu" aria-label="VEX AI SOC" hidden>
    <a class="pulse-menu-item" href="/how-it-works/" aria-current="page">
      <span class="pulse-menu-item__label">Meet VEX</span>
      <span class="pulse-menu-item__desc">Good prevention starts with great detection.</span>
    </a>
    <a class="pulse-menu-item" href="/detections/">
      <span class="pulse-menu-item__label">What VEX detects</span>
      <span class="pulse-menu-item__desc">Every alert type it can raise.</span>
    </a>
  </nav>
</div>
```

The same `data-pulse-menu` opens and closes it: Esc, a click outside or tabbing past the last link closes it, and only one menu is open at a time. `pulse-menu-anchor` lines it up with the start of its trigger; `pulse-menu-anchor--end` with the end, for a menu near the right edge. Only triggers with `data-pulse-menu` are touched, so a page that runs its own menu script keeps working.

### Options

| Class | What it does |
|---|---|
| `pulse-dropdown--scroll` | Limits the height to 240px and scrolls. |
| `pulse-dropdown__hint` | A line under the list (“6 options · scroll for more”). |
| `pulse-dropdown--nav` | The nav menu: 320px, title and description items. |
| `pulse-dropdown__label` | A small mono group label above the links. |
| `pulse-menu-anchor`, `--end` | Wraps the trigger and the list, and places the list under the trigger. |
| `data-pulse-menu` | On the trigger: pulse.js opens and closes the list named by its `aria-controls`. |

### Accessibility

- Dropdown: `role="listbox"`, `role="option"`, `aria-selected` on the chosen one, `aria-disabled` on unavailable ones. The button is labelled by the field label and its current value; pulse.js adds `aria-haspopup` and moves `aria-activedescendant` with the arrow keys.

- Nav menu: the trigger has `aria-expanded` and `aria-controls`; the current page has `aria-current="page"`.

## Eyebrow

The small mono line above a headline. Write it in sentence case; CSS sets the caps.

Figma component: Eyebrow.

Default:

```html
<p class="pulse-eyebrow">Meet a Dot</p>
```

Accent:

```html
<p class="pulse-eyebrow pulse-eyebrow--accent">The loop: Collect</p>
```

With the dot:

```html
<p class="pulse-eyebrow pulse-eyebrow--dot">Don’t get hacked</p>
```

### Options

| Class | What it does |
|---|---|
| `pulse-eyebrow--accent` | Pink. |
| `pulse-eyebrow--dot` | Adds the pulsing pink status dot. Only in the hero and the closing band. |

On a dark section it follows `data-theme="dark"`; there is no separate dark version.

### Accessibility

- Screen readers read the words as written, not in caps. The dot is decoration and holds still for people who turn off motion.

## Fields

Text inputs, selects and text areas, with a label, help text and an error state.

Figma component: Text field, Select, Textarea.

### Text input

```html
<div class="pulse-field" style="max-width: 320px">
  <label class="pulse-field__label" for="work-email">Work email</label>
  <input class="pulse-input" id="work-email" type="email" placeholder="name@company.com" aria-describedby="work-email-help">
  <span class="pulse-field__help" id="work-email-help">We only use this to send the report.</span>
</div>
```

### Error

Say what to do, not only what went wrong.

```html
<div class="pulse-field pulse-field--error" style="max-width: 320px">
  <label class="pulse-field__label" for="work-email-2">Work email</label>
  <input class="pulse-input" id="work-email-2" type="email" value="name@company" aria-invalid="true" aria-describedby="work-email-2-help">
  <span class="pulse-field__help" id="work-email-2-help">Enter a full email address, like name@company.com.</span>
</div>
```

### Select

A native select, wrapped for the arrow. Its open list is drawn by the operating system. An empty first option reads as a placeholder.

```html
<div class="pulse-field" style="max-width: 320px">
  <label class="pulse-field__label" for="provider">Provider</label>
  <div class="pulse-select-wrap">
    <select class="pulse-select" id="provider">
      <option value="">Choose one</option>
      <option>Microsoft Entra ID</option>
      <option>Google Workspace</option>
    </select>
  </div>
</div>
```

### Text area

```html
<div class="pulse-field" style="max-width: 420px">
  <label class="pulse-field__label" for="notes">Notes</label>
  <textarea class="pulse-textarea" id="notes" placeholder="Tell us about your environment"></textarea>
</div>
```

### Ghost

A field with no border or background, at rest. It shows a light gray fill on hover and the focus ring when it has focus. Use it where the field sits inside something that already draws the edge: a search bar, a toolbar, a table cell.

Ghost field on its own:

```html
<div class="pulse-field" style="max-width: 320px">
  <label class="pulse-field__label" for="invite">Invite by email</label>
  <input class="pulse-input pulse-input--ghost" id="invite" type="email" placeholder="name@company.com">
</div>
```

Inside a search bar: the border here belongs to the bar (your page’s own element), not to the field.

```html
<div class="search-bar">
  <i class="pulse-icon pulse-icon--magnifying-glass" aria-hidden="true"></i>
  <input class="pulse-input pulse-input--ghost" type="search" placeholder="Search signals" aria-label="Search signals">
</div>
<style>
  /* The bar is your page's own piece; it draws the border. The field inside has none. */
  .search-bar { display: flex; align-items: center; gap: var(--space-8); max-width: 320px; padding: 0 var(--space-12);
    border: 1px solid var(--color-border-default); border-radius: var(--radius-control); background: var(--color-surface-raised); }
</style>
```

### Options

| Class | What it does |
|---|---|
| `pulse-field--error` | Red border and red help text. |
| `pulse-input--lg`, `pulse-select--lg`, `pulse-textarea--lg` | 48px tall, 16px text, for marketing forms. |
| `pulse-input--ghost`, `pulse-select--ghost`, `pulse-textarea--ghost` | No border or background. |

### Accessibility

- Every field has a visible `<label for>`, or an `aria-label` when the context is obvious (a search field with an icon).

- Connect help and error text with `aria-describedby`; mark errors with `aria-invalid="true"`.

- Placeholder text is an example, never the label.

## Link

Goes somewhere: another page, further down this page or another site. Pink, with an arrow that nudges on hover.

Figma component: Link.

### Standalone

The arrow says where it goes: right for another page, down for further down this page (`pulse-link--down`), out for another site.

Another page:

```html
<a class="pulse-link" href="/how-it-works/">See how VEX works <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
```

Further down this page:

```html
<a class="pulse-link pulse-link--down" href="#pricing">See pricing <i class="pulse-icon pulse-icon--arrow-down" aria-hidden="true"></i></a>
```

Another site:

```html
<a class="pulse-link" href="https://slack.com/help" target="_blank" rel="noopener">Slack’s guide <i class="pulse-icon pulse-icon--arrow-square-out" aria-hidden="true"></i></a>
```

### Sizes

Extra small:

```html
<a class="pulse-link pulse-link--xs" href="#">Extra small <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
```

Small:

```html
<a class="pulse-link pulse-link--sm" href="#">Small <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
```

Medium:

```html
<a class="pulse-link" href="#">Medium <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
```

Large:

```html
<a class="pulse-link pulse-link--lg" href="#">Large <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
```

### Inline

Inside a sentence: underlined, no arrow, takes the sentence’s size.

```html
<p>VEX investigates every alert and <a class="pulse-link pulse-link--inline" href="/how-it-works/">tells you what it did</a>, in Slack.</p>
```

### Quiet, for navigation

Gray, pink on hover, never underlined: header and footer links. The page or section you are on is marked with `aria-current` (any value) and turns ink and semibold. Keep the regular pink link for the one action in a header.

```html
<nav aria-label="Main" style="display: flex; gap: var(--space-32); align-items: center">
  <a class="pulse-link pulse-link--quiet" href="/detections/" aria-current="page">What VEX detects</a>
  <a class="pulse-link pulse-link--quiet" href="/api/">The API</a>
  <a class="pulse-link" href="/schedule/">Schedule a chat <i class="pulse-icon pulse-icon--arrow-right" aria-hidden="true"></i></a>
</nav>
```

### Options

| Class | What it does |
|---|---|
| `pulse-link--xs`, `--sm`, `--lg` | 12, 14 and 18px. No class is 16px. |
| `pulse-link--down` | The arrow nudges down. Use with `arrow-down`. |
| `pulse-link--inline` | Underlined, inside text. |
| `pulse-link--quiet` | Gray navigation link. |
| `aria-current` | The current page or section. |

### Accessibility

- Link text says where it goes on its own (“See how VEX works”, not “Click here”).

- A link that opens a new tab says so with the `arrow-square-out` icon.

## Popover

A small card that opens on click next to its trigger: an explanation, or a short form. For a hint on hover, use a tooltip.

Figma component: Popover.

### With a title and actions

```html
<button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button"
        popovertarget="codes-help" aria-controls="codes-help" aria-expanded="false" aria-label="About response codes">
  <i class="pulse-icon pulse-icon--info" aria-hidden="true"></i>
</button>

<div class="pulse-popover pulse-popover--bottom pulse-popover--start" id="codes-help" popover role="dialog" aria-labelledby="codes-help-title">
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-popover__close" type="button"
          popovertarget="codes-help" popovertargetaction="hide" aria-label="Close">
    <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
  </button>
  <div class="pulse-popover__content">
    <h3 class="pulse-popover__title" id="codes-help-title">Response codes</h3>
    <p class="pulse-popover__body">R0 logs only. R1 contains the device, R2 releases it, R3 investigates and R4 recommends a fix.</p>
    <div class="pulse-popover__actions">
      <button class="pulse-btn pulse-btn--primary pulse-btn--sm" type="button" popovertarget="codes-help" popovertargetaction="hide">Got it</button>
    </div>
  </div>
</div>
```

### Custom content

Anything inside `pulse-popover__content`: a form, a list. `--no-caret` drops the pointer when it opens right under a button.

```html
<button class="pulse-btn pulse-btn--secondary" type="button" popovertarget="send-feedback" aria-controls="send-feedback" aria-expanded="false">Feedback</button>

<div class="pulse-popover pulse-popover--bottom pulse-popover--start pulse-popover--no-caret" id="send-feedback" popover role="dialog" aria-labelledby="send-feedback-title">
  <div class="pulse-popover__content">
    <h3 class="pulse-popover__title" id="send-feedback-title">Send feedback</h3>
    <div class="pulse-field">
      <label class="pulse-field__label" for="send-feedback-text">What could be better?</label>
      <textarea class="pulse-textarea" id="send-feedback-text"></textarea>
    </div>
    <div class="pulse-popover__actions">
      <button class="pulse-btn pulse-btn--primary pulse-btn--sm" type="button" popovertarget="send-feedback" popovertargetaction="hide">Send</button>
      <button class="pulse-btn pulse-btn--secondary pulse-btn--sm" type="button" popovertarget="send-feedback" popovertargetaction="hide">Cancel</button>
    </div>
  </div>
</div>
```

### How it works

The browser’s popover attribute opens and closes it: the trigger’s `popovertarget` names the popover’s `id`; Esc and a click outside close it and focus goes back. pulse.js places it beside the trigger, points the caret at it, flips it when there’s no room and keeps `aria-expanded` up to date.

### Options

| Class | What it does |
|---|---|
| `pulse-popover--top`, `--right`, `--bottom`, `--left` | The side of the trigger it sits on. |
| `pulse-popover--start`, `--end` | Lines the caret up near a corner instead of the middle. |
| `pulse-popover--no-caret` | No pointer. |
| `popovertargetaction="hide"` | On a button inside, closes it. |

### Accessibility

- `role="dialog"` and `aria-labelledby` on the popover; `aria-controls` and `aria-expanded="false"` on the trigger.

- Inside a shadow root (VEX), call `Pulse.attach(shadowRoot)` once.

## Progress

A bar for something under way: a known amount done, or still working.

Figma component: Progress.

### Known amount

Set the fill with `--p` and keep the text and `aria-valuenow` in step.

```html
<div class="pulse-progress" style="--p: 50%; width: 100%; max-width: 420px">
  <div class="pulse-progress__head"><span id="hunt-label">Hours 2–20 · Hunting</span><span class="pulse-progress__value">50%</span></div>
  <div class="pulse-progress__track" role="progressbar" aria-labelledby="hunt-label" aria-valuenow="50" aria-valuemin="0" aria-valuemax="100"><div class="pulse-progress__fill"></div></div>
</div>
```

### Still working

```html
<div class="pulse-progress pulse-progress--indeterminate" style="width: 100%; max-width: 420px">
  <div class="pulse-progress__head"><span id="connect-label">Connecting workspace</span><span class="pulse-progress__value">Working…</span></div>
  <div class="pulse-progress__track" role="progressbar" aria-labelledby="connect-label"><div class="pulse-progress__fill"></div></div>
</div>
```

### Options

| Option | What it does |
|---|---|
| `style="--p: 50%"` | How full the bar is. |
| `pulse-progress--success`, `--danger` | Tone. No class is pink. |
| `pulse-progress--indeterminate` | A moving bar with no amount. Still for people who turn off motion. |

### Accessibility

- `role="progressbar"` on the track with `aria-labelledby`, and `aria-valuenow`, `-min` and `-max` when the amount is known.

## Segmented control

Switches between two to four views of the same thing (Monthly and Yearly, Mac and Windows) without leaving the page.

Figma component: Segmented control.

Medium:

```html
<div class="pulse-segmented" role="group" aria-label="Billing">
  <button class="pulse-segmented__item" type="button" aria-pressed="false">Monthly</button>
  <button class="pulse-segmented__item" type="button" aria-pressed="true">Yearly</button>
</div>
```

Large:

```html
<div class="pulse-segmented pulse-segmented--lg" role="group" aria-label="Operating system">
  <button class="pulse-segmented__item" type="button" aria-pressed="true">Mac</button>
  <button class="pulse-segmented__item" type="button" aria-pressed="false">Windows</button>
</div>
```

### Options

| Class | What it does |
|---|---|
| `pulse-segmented--lg` | 16px labels at the same 40px height, to sit beside medium buttons. |

Switching what’s shown, and moving `aria-pressed`, is the page’s script.

### Accessibility

- Buttons with `aria-pressed` in a `role="group"` with an `aria-label`. For page sections, use tabs (https://cdn.unmanned.team/pulse/v1/docs/tabs.html).

## Slider

A styled native range input, for picking a number along a scale.

Figma component: Slider.

```html
<div class="pulse-slider" style="width: 100%; max-width: 320px">
  <div class="pulse-slider__head">
    <label class="pulse-slider__label" for="coverage">Coverage</label>
    <output class="pulse-slider__value" for="coverage" data-pulse-mirror="%">40%</output>
  </div>
  <input class="pulse-slider__input" id="coverage" type="range" min="0" max="100" step="5" value="40">
</div>
```

### How it works

pulse.js keeps the fill in step with the thumb, and writes the value into any `<output for="its-id">` (or any element with `data-pulse-value-of="its-id"`) that has a format attribute. The slider’s `aria-valuetext` follows its first output, so screen readers hear the formatted value.

### Formats

```html
<div class="pulse-field" style="width: 100%; max-width: 360px">
  <div class="pulse-slider">
    <div class="pulse-slider__head">
      <label class="pulse-slider__label" for="employees">Employees</label>
      <output class="pulse-slider__value" for="employees" data-pulse-format="number">120</output>
    </div>
    <input class="pulse-slider__input" id="employees" type="range" min="10" max="1000" step="10" value="120">
  </div>
  <span class="pulse-field__help"><output for="employees" data-pulse-format="currency" data-pulse-scale="4" data-pulse-suffix=" / month">$480 / month</output></span>
</div>
```

| Attribute | What it does |
|---|---|
| `data-pulse-format` | `number` (1,200), `currency` ($480; `data-pulse-currency` picks it, USD by default) or `percent` (40%). |
| `data-pulse-scale` | Multiplies the value first: 120 employees at `4` is $480. |
| `data-pulse-prefix`, `data-pulse-suffix` | Text before and after. `data-pulse-mirror="%"` is the short form of a suffix. |
| `data-pulse-formatter` | Your own function, for anything else. |

```html
<output for="seats" data-pulse-formatter="seats"></output>
<script>
  Pulse.formats.seats = function (value) {
    return value === 1 ? '1 seat' : value + ' seats';
  };
</script>
```

### Accessibility

- It’s a real range input: arrow keys step, Page Up and Down jump, and screen readers announce the value. Give it a `<label for>`.

## Step number

A number in a pink ring beside each step of a numbered how-to.

Figma component: Step number.

```html
<ol class="pulse-steps" style="list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: var(--space-16)">
  <li style="display: flex; gap: var(--space-16); align-items: flex-start"><span class="pulse-step-num" aria-hidden="true"></span><span>Download the installer.</span></li>
  <li style="display: flex; gap: var(--space-16); align-items: flex-start"><span class="pulse-step-num" aria-hidden="true"></span><span>Open it and follow the steps.</span></li>
  <li style="display: flex; gap: var(--space-16); align-items: flex-start"><span class="pulse-step-num" aria-hidden="true"></span><span>Your Dot reports in within a minute.</span></li>
</ol>
```

### How it works

Inside a list with `pulse-steps`, an empty `pulse-step-num` counts by itself. Or put the number in yourself: `<span class="pulse-step-num">1</span>`. The layout of each step (number beside the text) is your page’s CSS.

### Accessibility

- Use an `<ol>`, so screen readers announce the steps in order, and mark the drawn number `aria-hidden="true"` so it isn’t read twice.

## Tabs

Switch between views, or jump to sections of a long page.

Figma component: Tabs, Tab item.

### Line

A row of tabs over a baseline. `pulse-tabs--bar` centers them in a full-width bar, for a sticky section nav.

```html
<div style="width: 100%">
  <div class="pulse-tabs pulse-tabs--line" role="tablist" aria-label="Test">
    <button class="pulse-tab" type="button" role="tab" id="tab-overview" aria-controls="panel-overview" aria-selected="true">Overview</button>
    <button class="pulse-tab" type="button" role="tab" id="tab-findings" aria-controls="panel-findings" aria-selected="false">Findings</button>
    <button class="pulse-tab" type="button" role="tab" id="tab-activity" aria-controls="panel-activity" aria-selected="false">Activity</button>
  </div>
  <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" tabindex="0"><p>What the test covers and when it ends.</p></div>
  <div id="panel-findings" role="tabpanel" aria-labelledby="tab-findings" tabindex="0" hidden><p>Everything the test found, worst first.</p></div>
  <div id="panel-activity" role="tabpanel" aria-labelledby="tab-activity" tabindex="0" hidden><p>Every step VEX took, newest first.</p></div>
</div>
```

pulse.js does the switching: a click, or the arrow keys, Home and End once a tab has focus, selects a tab and shows its panel; the other panels get `hidden`. Each tab’s `aria-controls` names its panel. It fires `pulse:tab` on the tablist if the page needs to know. For tabs stacked in a column, add `aria-orientation="vertical"` to the tablist and the up and down arrows move instead.

### Vertical (a jump menu)

A list of links beside a long page. Optional parts: a label above, sub-items and counts. The section being read is `aria-current="location"`.

```html
<div style="width: 240px">
  <p class="pulse-tabs__label" id="on-this-page">On this page</p>
  <ul class="pulse-tabs pulse-tabs--vertical" aria-labelledby="on-this-page">
    <li><a class="pulse-tab" href="#m365">Microsoft 365 <span class="pulse-tab__count">412</span></a>
      <ul class="pulse-tabs__sub">
        <li><a class="pulse-tab" href="#defender">Defender for Office <span class="pulse-tab__count">96</span></a></li>
        <li><a class="pulse-tab" href="#entra" aria-current="location">Entra ID Protection <span class="pulse-tab__count">58</span></a></li>
      </ul></li>
    <li><a class="pulse-tab" href="#google">Google Workspace <span class="pulse-tab__count">187</span></a></li>
  </ul>
</div>
```

Highlighting the section as the reader scrolls, and turning the menu into a dropdown on narrow screens, are the page’s script for now.

### Options

| Class | What it does |
|---|---|
| `pulse-tabs--line`, `--bar`, `--vertical` | The three layouts. |
| `pulse-tabs__label` | The small mono label above a vertical list. |
| `pulse-tabs__sub` | A nested list of sub-items. |
| `pulse-tab__count` | A number at the end of an item. |

### Accessibility

- Tabs that switch views: `role="tablist"` with an `aria-label`, `role="tab"` with `aria-controls`, and `role="tabpanel"` with `aria-labelledby` and `tabindex="0"`. pulse.js keeps `aria-selected` and the tab order right: only the selected tab is in the Tab order, the arrows move between tabs.

- A jump menu is plain links, with `aria-current` on the current one.

## Tooltip

A short hint on hover or keyboard focus, for icon buttons and abbreviations. For anything clicked, use a popover.

Figma component: Tooltip.

Above:

```html
<button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-tooltip-host" type="button" aria-label="Settings">
  <i class="pulse-icon pulse-icon--gear" aria-hidden="true"></i>
  <span class="pulse-tooltip" aria-hidden="true">Settings</span>
</button>
```

Below:

```html
<button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-tooltip-host" type="button" aria-label="Copy">
  <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i>
  <span class="pulse-tooltip pulse-tooltip--bottom" aria-hidden="true">Copy to clipboard</span>
</button>
```

### How it works

Put the tooltip inside the control and add `pulse-tooltip-host` to the control. It shows on hover and on keyboard focus, with no script. Esc hides it (pulse.js). It never shows on a disabled control. `is-open` holds it open, for “Copied”.

### On something that isn’t a button

Make the host focusable and point `aria-describedby` at the tooltip, so its words are read out.

```html
<span class="pulse-tooltip-host" tabindex="0" aria-describedby="t1015" style="font-family: var(--font-mono)">T1015
  <span class="pulse-tooltip" id="t1015" role="tooltip">Query Registry</span>
</span>
```

### Options

| Class | What it does |
|---|---|
| `pulse-tooltip--bottom`, `--left`, `--right` | The side of the control. No class is above. |
| `pulse-tooltip--start`, `--end` | Above or below, lines it up with that edge of the control, for controls near the edge of a box. |

### Accessibility

- A tooltip is extra. The control keeps its own name (`aria-label`) and the tooltip gets `aria-hidden="true"`, unless it adds something, then use `aria-describedby`.

- Keep it to a few words. Nothing clickable inside.
