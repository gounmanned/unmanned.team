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
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-fonts.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-tokens.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-icons.css">
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-components.css">
  <script src="https://cdn.unmanned.team/pulse/v1/pulse.js" defer></script>
</head>
```

- `pulse-fonts.css`: Inter and JetBrains Mono, hosted with Pulse. Load it first.

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
  <link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-fonts.css">
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

### Color rules

- **Marks and text use different colors.** Icons, dots, borders and chart marks use the indicator colors (3:1, enough for a shape). Text uses the text colors (4.5:1). A warning icon is `--color-indicator-warning`; warning words are `--color-text-warning`.

- **Status icons in lists are filled** (they read at 16px); action icons are regular.

- **Focus is always blue**, never the brand, so it can’t be mistaken for an error or a selection.

- **Text emphasis in apps:** primary for what matters (titles, data, actions); secondary for details such as times and sources; tertiary for descriptions under headings, on white only (on gray, use secondary); disabled for controls that are off. Quiet comes from size, weight and spacing too, not only lighter gray.

- **Numbers** (data, counts, times, chart labels, column heads) use the sans with tabular figures. Mono is for code, IDs, hashes, logs and key hints, plus the eyebrow.

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

## White labeling

How to make VEX look your own, what we support, and what is yours to keep working.

**Coming soon:** the brand builder and brand files described here are on their way. Until then, talk to us before you change how VEX looks, and we’ll set up your brand with you.

### Three levels

VEX’s front end is open source, so you can change anything. We support a smaller, stable set of changes and keep them working for you. Anything past that is up to you to maintain.

| Level | What you can change | Keeps working after our updates | We help you with it |
|---|---|---|---|
| **1. Brand settings** | Brand color, fonts, shape, logo, product name, favicon | Yes, guaranteed | Yes |
| **2. Custom CSS** | Anything else that style rules can change | Not guaranteed | No |
| **3. Changing the source** | Anything at all | No: your copy stops getting our updates | No |

Almost everything you’ll want fits in level 1. Start there, and only go further if you’re ready to look after it yourself.

### Level 1: Brand settings

You make these in the brand builder, which shows your choices on real VEX screens, in light and dark, as you go. When you’re done, it gives you two files:

- `brand.json`: everything you chose, including your logo, product name and favicon.

- `brand.css`: your colors, fonts and shape, ready for VEX to load. Every button, link and field takes them on.

#### What you can change

| Setting | What it does |
|---|---|
| Brand color | Pick one color. The builder turns it into a full set of shades for buttons, links and selected items, in light and dark. Main buttons can use your color or VEX’s black. |
| Fonts | A font for text and one for code. Optional: if you don’t choose, VEX uses Inter and JetBrains Mono. |
| Shape | Choose square corners, or soft corners with round buttons. |
| Logo and favicon | Your logo for light and dark backgrounds, and your browser tab icon. |
| Product name | Your name, shown wherever VEX names itself, such as the header and the sign-in screen. |

#### Checks the builder makes for you

- Text on your brand color is white or black, whichever is easier to read.

- For links and small text, your brand color is darkened just enough to be easy to read (4.5:1, the accessibility standard).

- Focus rings, which show keyboard users where they are, stay blue for every brand, so they are always visible and never look like an error.

#### How your brand loads

For the people setting it up. Pulse keeps everything your brand can change in one small set of settings, with VEX as the default. `brand.css` fills in that set for your brand, and `data-brand` on the page’s `<html>` switches it on. Brands apply to the app only (`data-surface="app"`); the website is never white-labeled. Shape is part of the brand: soft corners are the app’s own, and a square brand sets the corner sizes to 2px in the same file.

```html
<html data-brand="acme" data-surface="app">

<link rel="stylesheet" href="https://cdn.unmanned.team/pulse/v1/pulse-tokens.css">
<link rel="stylesheet" href="/brands/acme/brand.css">   <!-- after Pulse's tokens -->

<style>
  /* brand.css, as the brand builder writes it */
  :root[data-brand="acme"] {
    --color-brand-50: #eff6ff;  --color-brand-100: #dbeafe; --color-brand-200: #bfdbfe;
    --color-brand-300: #93c5fd; --color-brand-400: #60a5fa; --color-brand-500: #2563eb;
    --color-brand-600: #1d4ed8; --color-brand-700: #1e40af; --color-brand-800: #1e3a8a;
    --color-brand-900: #172554; --color-brand-950: #0b1433;
    --color-brand-on: #ffffff;                               /* text on the brand color */
    --color-brand-action: #2563eb;      --color-brand-action-hover: #1e40af;      /* main button; leave out for VEX's black */
    --color-brand-action-pressed: #1e3a8a;  --color-brand-on-action: #ffffff;
    --color-brand-action-dark: #2563eb; --color-brand-action-dark-hover: #1d4ed8;
    --color-brand-action-dark-pressed: #1e40af; --color-brand-on-action-dark: #ffffff;
    /* optional: square corners instead of the app's soft ones */
    /* --radius-button: 2px; --radius-control: 2px; --radius-medium: 2px; --radius-container: 2px; --radius-tag: 2px; --radius-check: 2px; */
    --font-brand-sans: 'Source Sans 3', system-ui, sans-serif;  /* optional */
    --font-brand-mono: 'JetBrains Mono', ui-monospace, monospace;
  }
</style>
```

Your logo for the app header goes in the same file, as `--brand-mark` (and `--brand-mark-dark`, and an optional `--brand-logo-wide`). The main button’s color is its own setting, in light and dark (`--color-brand-action`, `-hover`, `-pressed`, `--color-brand-on-action`, and the same with `-dark`). The builder fills it with your brand color; leave it out for VEX’s black. Secondary and ghost buttons use it as their text and outline, so it must reach 4.5:1 on white (and the dark one on dark). Selected items are a quiet gray with an edge in the action color, for every brand.

A brand can only set these: the eleven brand shades, the text color on them, the action color, the corner sizes, the logos and the two fonts. Everything else in Pulse reads from them, so buttons, links, selected items, checkboxes, toggles, sliders and progress bars all follow, in light and dark.

### What stays the same for every brand

These keep VEX clear and trustworthy for your users, whoever’s name is on it.

- **Status colors:** red for danger, amber for warnings, green for success. A warning should always look like a warning.

- **Text sizes and spacing:** so every screen stays easy to read and nothing overlaps.

- **Readability:** the checks above can’t be switched off.

- **Security information:** severity, containment status and anything that needs your attention is always shown, in full.

### Level 2: Custom CSS

For anything the brand settings don’t cover, you can add one style sheet, `custom.css`. VEX loads it last, so your rules win.

- We can’t help with what’s in it, and an update to VEX may change what your rules apply to. Check your changes after every release.

- Use Pulse tokens (`var(--space-16)`, `var(--color-text-secondary)`) rather than fixed values, so your changes keep matching the rest of VEX.

- Class names are listed in these docs, but how a component is built inside can change without notice.

If you do any of these, they’re yours to look after:

- Hiding or moving parts of a screen.

- Changing the size of buttons, fields or text.

- Changing status colors or anything listed under “What stays the same”.

- Restyling components from scratch.

### Level 3: Changing the source

The license lets you change anything. A changed copy becomes your own version: it no longer gets our updates or security fixes automatically, and we can’t help with it. If you find yourself here, tell us what you needed. It may belong in the brand settings for everyone.

### Getting help

- Open VEX with your custom CSS switched off: add `?custom=off` to the address. Only your brand settings load.

- If the problem goes away, it’s in your custom CSS.

- If it’s still there, it’s ours to fix: send us what you saw and your `brand.json`.

### Our promise on updates

- Within a version of Pulse (v1 today), brand settings only grow. Nothing is renamed or removed, so the brand you make today keeps working.

- Anything that would break your brand waits for the next version (v2). We’ll tell you ahead of time and give you a short guide to move over.

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

### Toasts above panels

The toaster sits in the browser’s top layer, so a toast shows above an open drawer or dialog.

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

## App header

The bar across the top of an app: the brand, navigation and actions. The brand’s logo comes from its tokens, so no script has to patch it.

Figma component: App header.

```html
<header class="pulse-app-header" style="position: static; width: 100%">
  <a class="pulse-app-header__brand" href="/">
    <span class="pulse-brand-dot" aria-hidden="true"></span>
    <span class="pulse-brand-mark" role="img" aria-label="VEX"></span>
    <span class="pulse-app-header__name">VEX</span>
  </a>
  <nav class="pulse-app-header__nav" aria-label="Main">
    <a class="pulse-link pulse-link--quiet pulse-link--sm" href="#" aria-current="page">Signals</a>
    <a class="pulse-link pulse-link--quiet pulse-link--sm" href="#">Coverage</a>
  </nav>
  <div class="pulse-app-header__actions">
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" aria-label="Settings"><i class="pulse-icon pulse-icon--gear" aria-hidden="true"></i></button>
  </div>
</header>
```

### VEX’s lockup and a client’s

Put both the dot (`pulse-brand-dot`) and the mark in the brand link. VEX’s own look shows the website’s lockup, toned down to sit beside the app: a pink dot that pulses twice and “VEX” in 18px semibold. With `data-brand` on `<html>` (a client), the mark and the name in 16px semibold show instead. Brand tokens pick which, so it works inside a shadow root too.

### The brand in the header

The mark, its dark-theme version and an optional wide logo are brand tokens. A client brand sets them in its `brand.css`; VEX’s mark is the default. With a wide logo, show `<span class="pulse-brand-wide" role="img" aria-label="…">` instead of the mark and name.

```html
:root[data-brand="acme"] {
  --brand-mark: url("https://acme.example/mark.svg");
  --brand-mark-dark: url("https://acme.example/mark-white.svg");
  --brand-logo-wide: url("https://acme.example/logo.svg");   /* optional: replaces mark + name */
  --brand-logo-wide-width: 140px;
}
```

On phones (under 768px) the wide logo shows the brand’s square mark instead, so it fits beside the actions. Every brand has a mark; nothing to add.

### Parts

| Class | What it is |
|---|---|
| `__brand` | A link home holding the mark (`pulse-brand-mark`) and `__name`, or the wide logo. |
| `__nav` | Quiet links, the current one with `aria-current`. |
| `__actions` | Buttons at the end (settings, account). |

### Accessibility

- The mark has `role="img"` and the product name as its `aria-label`.

## Avatar

A mark for an account (letters or an image in a rounded square) or a person (initials in a circle), and groups of them.

Figma component: Avatar.

Account (letters):

```html
<span class="pulse-avatar" aria-hidden="true">AC</span>
```

Account (image):

```html
<span class="pulse-avatar"><img src="https://cdn.unmanned.team/img/logo.png" alt="Acme Corp"></span>
```

Source logo (outline):

```html
<span class="pulse-avatar pulse-avatar--outline"><img src="https://cdn.unmanned.team/img/logo.png" alt="" style="width: 20px; height: 20px"></span>
```

Person (24px circle):

```html
<span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle" aria-hidden="true">KM</span>
```

Group with more:

```html
<span class="pulse-avatar-group" role="img" aria-label="6 sources">
  <span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle">M</span>
  <span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle">G</span>
  <span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle pulse-avatar--more">+4</span>
</span>
```

### Options

| Class | What it does |
|---|---|
| `pulse-avatar` | 32px rounded square. Letters are set in caps by CSS. |
| `pulse-avatar--sm` | 24px. |
| `pulse-avatar--circle` | Round, for people. |
| `pulse-avatar--outline` | No fill and a subtle line, for a logo that brings its own color (a source’s favicon). |
| `pulse-avatar-group`, `pulse-avatar--more` | Overlapping avatars with a “+4” for the rest. |

### Accessibility

- Next to a visible name, the avatar is decoration (`aria-hidden` or `alt=""`). On its own, give it a name.

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

### Small

`pulse-badge--sm` is 20px tall, to sit in a 20px line (a log row, a dense table cell) without making it taller.

```html
<span class="pulse-badge pulse-badge--sm pulse-badge--success">Live</span>
```

### Options

| Class | What it does |
|---|---|
| `pulse-badge--accent`, `--success`, `--warning`, `--danger`, `--info` | Tone. No tone class is neutral gray. Accent is for brand moments only (“New”). |
| `pulse-badge--solid` | Filled with the tone. |
| `pulse-badge--outline` | A border in the tone, no fill. |
| `pulse-badge--nodot` | Hides the dot. |
| `pulse-badge--sm` | 20px tall instead of 24. |
| `pulse-badge--mono` | Mono caps, no dot, gray unless a tone follows. |

### Accessibility

- Always pair a tone with a word. “Failed” in red, never a red dot alone.

## Breadcrumb

Where you are inside a nested structure, such as folders of backups.

Figma component: Breadcrumb.

```html
<nav class="pulse-breadcrumb" aria-label="Breadcrumb">
  <ol>
    <li><a class="pulse-link pulse-link--quiet pulse-link--sm" href="#">Backups</a></li>
    <li><a class="pulse-link pulse-link--quiet pulse-link--sm" href="#">acme.com</a></li>
    <li><span aria-current="page">2026-11-18</span></li>
  </ol>
</nav>
```

### Accessibility

- A `<nav aria-label="Breadcrumb">` with an ordered list; the last item is the current one (`aria-current="page"`) and isn’t a link.

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
| `pulse-btn--primary` | The main action, in the action color. |
| `pulse-btn--secondary` | The second action beside a primary. An outline in the action color. |
| `pulse-btn--neutral` | Actions inside panels and alerts. Gray outline. |
| `pulse-btn--ghost` | A light action among links (a drawer opener). Text in the action color. |
| `pulse-btn--ghost-neutral` | Toolbar and icon buttons (copy, close, settings). |
| `pulse-btn--destructive` | Delete and other actions that can’t be undone. |

### The action color

The primary button uses the action color, not the brand color directly. On the website and for client brands it is the brand. In VEX’s own app look (app surface, no client brand) it is ink, so color is kept for meaning: status, risk and alerts. Secondary and ghost buttons and selected items (chips, checkboxes, toggles, tabs, rows) follow the same choice; links keep the accent. A dark button lightens on hover and, pressed, sits between rest and hover. Nothing changes in the markup.

```html
<!-- The same markup everywhere; the color comes from the action tokens. -->
<button class="pulse-btn pulse-btn--primary" type="button">Add signal</button>
```

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

Disabled keeps the shape and drains the color. `aria-busy="true"` shows the small spinner (https://cdn.unmanned.team/pulse/v1/docs/loading.html) in the button’s text color and stops clicks while something is saving.

Disabled:

```html
<button class="pulse-btn pulse-btn--primary" type="button" disabled>Start test</button>
```

Loading:

```html
<button class="pulse-btn pulse-btn--primary" type="button" aria-busy="true">Saving</button>
```

### Reply

Buttons that answer inside a conversation (Contain, It was me) add `pulse-btn--reply`: the control radius instead of the pill, so they read as replies, not page actions. On the web surface every button is square anyway. The same goes for every button inside a contained area: in an input group and in row actions (`pulse-list-row__trail`, `pulse-table__reveal`, `pulse-row-actions`) buttons take the control radius automatically.

```html
<div class="pulse-actions">
  <button class="pulse-btn pulse-btn--primary pulse-btn--sm pulse-btn--reply" type="button">Contain asset</button>
  <button class="pulse-btn pulse-btn--neutral pulse-btn--sm pulse-btn--reply" type="button">It was me</button>
</div>
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
| `pulse-btn--reply` | Control radius instead of the pill, for answers inside a conversation. |
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

### Toggle row

For settings: the name and a line of description, with the switch at the end. The whole row is the label.

```html
<label class="pulse-toggle pulse-toggle--row" style="max-width: 420px">
  <span class="pulse-toggle__text"><span>Auto-contain devices</span><span class="pulse-toggle__desc">Cut a device off the network when VEX is sure it’s compromised.</span></span>
  <input type="checkbox" role="switch" checked>
</label>
```

### Small toggle

`pulse-toggle--sm` is 32 × 18, for dense settings. In a toggle row it is small at every width (the whole row is the tap target) and the description is 12px. On its own it is small from tablet up and the default size on phones, where it is tapped directly.

```html
<label class="pulse-toggle pulse-toggle--row pulse-toggle--sm" style="max-width: 360px">
  <span class="pulse-toggle__text"><span>Email me a weekly report</span><span class="pulse-toggle__desc">Every Monday at 8 a.m.</span></span>
  <input type="checkbox" role="switch">
</label>
```

```html
<label class="pulse-toggle pulse-toggle--sm"><input type="checkbox" role="switch" checked> Live</label>
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

### With a count

Chip with a count:

```html
<button class="pulse-chip" type="button" aria-pressed="true">Autoclosed <span class="pulse-chip__count">3</span></button>
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

A block of code with an optional head (file name, language tag, copy button), in two sizes. pulse.js does the copying.

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

### Background

Code sits on `--color-surface-code`, its head on `--color-surface-code-head`. On the web the head is a step darker; in apps both are one light gray and the head is set off by its line.

### Small, without a head

`pulse-code--sm` with no head: JSON or a command inside a thread or a panel. It scrolls after 320px.

```html
<div class="pulse-code pulse-code--sm" style="width: 100%; max-width: 520px">
  <pre><code>{
  <span class="pulse-code__key">"user"</span>: <span class="pulse-code__str">"kim@acme.com"</span>,
  <span class="pulse-code__key">"country"</span>: <span class="pulse-code__str">"PT"</span>,
  <span class="pulse-code__key">"risk"</span>: <span class="pulse-code__num">0.62</span>
}</code></pre>
</div>
```

### Copying

Any button with `data-pulse-copy` inside a code panel copies the panel’s code and shows “Copied” in its tooltip. To copy something else, give it the element’s `id`: `data-pulse-copy="install-key"` copies that input’s value. `data-pulse-copied="…"` changes the word.

```html
<div class="pulse-input-group pulse-input-group--readonly" style="width: 100%; max-width: 360px">
  <input class="pulse-input" id="soc-mailbox" value="soc-acme@vex.unmanned.team" readonly aria-label="Mailbox address">
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-tooltip-host" type="button" data-pulse-copy="soc-mailbox" aria-label="Copy the mailbox address">
    <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Copy</span>
  </button>
</div>
```

### Accessibility

- The copy button needs an `aria-label` that says what it copies. Screen readers also hear “Copied”.

- Long lines scroll sideways inside the panel, never the page.

## Data table

A table for comparing rows: sortable columns, a selected row, and the same row heights as lists.

Figma component: Data table.

```html
<table class="pulse-table pulse-table--compact pulse-table--interactive">
  <thead><tr>
    <th scope="col" aria-sort="descending"><button class="pulse-table__sort" type="button">Account <i class="pulse-icon pulse-icon--arrow-down" aria-hidden="true"></i></button></th>
    <th scope="col" data-optional>Owner</th>
    <th scope="col" class="pulse-table__num"><button class="pulse-table__sort" type="button">Assets <i class="pulse-icon pulse-icon--arrow-down" aria-hidden="true"></i></button></th>
  </tr></thead>
  <tbody>
    <tr aria-selected="true"><td>Acme Corp</td><td data-optional>Kim Moore</td><td class="pulse-table__num">42</td></tr>
    <tr><td>Northwind</td><td data-optional>Ana Ruiz</td><td class="pulse-table__num">18</td></tr>
    <tr><td>Contoso</td><td data-optional>Sam Lee</td><td class="pulse-table__num">7</td></tr>
  </tbody>
</table>
```

### Sorting

A sortable head cell holds a `<button class="pulse-table__sort">` with an `arrow-down` icon, and the cell carries `aria-sort="ascending"` or `"descending"` (the icon turns for ascending and shows on hover otherwise). Sorting the rows is the page’s script.

### Options

| Option | What it does |
|---|---|
| `pulse-table--compact`, `--spacious` | Row heights 40 and 56 (48 by default). The header row matches. |
| `pulse-table--interactive` | Rows highlight on hover, for tables where a row opens something. |
| `aria-selected="true"` on a row | The selected row: quiet fill and an edge in the selection color. |
| `pulse-table__num` | Right-aligns a number column (head and cells). |
| `pulse-table--headless` | Hides the header row from sight, not from screen readers. |
| `pulse-table__reveal` | Wraps row actions that show on hover and focus. |
| `data-optional` on cells, `is-condensed` on the table | Hides those columns, for when a drawer takes half the width. |

### Without a header row

`pulse-table--headless` keeps aligned columns with no visible head, like a mail inbox: for a list of accounts where each value says what it is (“43 assets”, “21% covered”). Keep the `<thead>`; screen readers still read it, and removing the class shows it again. Give the name column a fixed width with `<col>` so values line up across tables. Row actions go in their own last cell inside `pulse-table__reveal`: shown on hover and focus, always on touch screens. Their tooltips close as soon as the pointer leaves the icon (see Tooltip (https://cdn.unmanned.team/pulse/v1/docs/tooltip.html)).

```html
<table class="pulse-table pulse-table--compact pulse-table--interactive pulse-table--headless" style="max-width: 640px">
  <colgroup><col style="width: 45%"><col><col></colgroup>
  <thead><tr><th scope="col">Account</th><th scope="col">Coverage</th><th scope="col"><span class="pulse-visually-hidden">Actions</span></th></tr></thead>
  <tbody>
    <tr><td>Acme Corp <span class="pulse-badge pulse-badge--danger">High</span></td><td>21% covered</td>
      <td class="pulse-table__num"><span class="pulse-table__reveal"><a class="pulse-btn pulse-btn--ghost-neutral pulse-btn--sm" href="#">Enter</a></span></td></tr>
    <tr><td>Northwind</td><td>88% covered</td>
      <td class="pulse-table__num"><span class="pulse-table__reveal"><a class="pulse-btn pulse-btn--ghost-neutral pulse-btn--sm" href="#">Enter</a></span></td></tr>
  </tbody>
</table>
```

### Accessibility

- Use real `<th scope="col">` heads. Clickable rows also need a link or button inside for keyboard users.

- Numbers use tabular figures in the sans, so columns line up.

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

### Confirm from a script

`Pulse.confirm()` builds this same destructive dialog, opens it and waits: it resolves `true` on the destructive button, `false` on Cancel, Esc, the X or a click on the dimmed page. Cancel has focus when it opens, and focus goes back to whatever opened it. Text goes in as text, never HTML. Use it for every destructive action, so nothing deletes in one click.

```html
<script>
  // No markup needed: Pulse builds the destructive dialog, opens it and removes it after.
  deleteButton.addEventListener('click', async () => {
    const ok = await Pulse.confirm({
      title: 'Delete this device?',
      body: 'VEX stops watching it. You can’t undo it.',
      resource: 'HR-laptop-428936',      // optional: the thing being deleted
      action: 'Delete device'            // the destructive button's label ('Delete' by default)
    });
    if (ok) removeDevice();
  });
</script>
```

### Parts

| Class | What it is |
|---|---|
| `pulse-dialog__title`, `__body` | The question and one or two sentences. |
| `pulse-dialog__resource` | Optional: the thing that will be affected, for destructive dialogs. |
| `pulse-dialog__actions` | Buttons, Cancel first. On phones they stack, main action on top. |

### Accessibility

- `aria-labelledby` points at the title and `aria-describedby` at the body.

- When it opens, pulse.js focuses the title (no ring), unless something inside has `autofocus`.

- For destructive dialogs, put `autofocus` on Cancel so Enter doesn’t delete by accident.

- For anything longer than a question, use a drawer (https://cdn.unmanned.team/pulse/v1/docs/drawer.html).

## Disclosure and accordion

A fold that hides detail until it’s wanted, built on the native details element. A stack of them is an accordion.

Figma component: Disclosure.

```html
<details class="pulse-disclosure" open>
  <summary class="pulse-disclosure__summary">Recommendations</summary>
  <div class="pulse-disclosure__body">Turn on multi-factor sign-in for the two admins who don’t have it.</div>
</details>
```

### Two placements

The caret goes where the role puts it.

- **Before the title** (the default): a fold inside content or a hierarchy, such as an FAQ, a tree or “Show details”. The caret points right and turns down when open; the content is indented.

- **After the title** (`pulse-disclosure--section`): a whole section or panel head that folds, such as Recommendations or Resolved. The caret points down and turns up when open; the content is full width, lined up with the title.

```html
<details class="pulse-disclosure pulse-disclosure--section" open style="width: 100%; max-width: 480px">
  <summary class="pulse-disclosure__summary">Resolved</summary>
  <div class="pulse-disclosure__body">Three signals closed this week. The list lines up with the title, full width.</div>
</details>
```

### Accordion

Stack disclosures in a `pulse-accordion` for an FAQ or a settings list. Add `pulse-disclosure--section` to each for section heads. Give them the same `name` and the browser keeps only one open at a time; leave it out to let several stay open.

```html
<div class="pulse-accordion" style="width: 100%; max-width: 520px">
  <details class="pulse-disclosure" name="faq" open>
    <summary class="pulse-disclosure__summary">What does a Dot do?</summary>
    <div class="pulse-disclosure__body">It protects one thing and tells you plainly what’s going on.</div>
  </details>
  <details class="pulse-disclosure" name="faq">
    <summary class="pulse-disclosure__summary">Can I cancel any time?</summary>
    <div class="pulse-disclosure__body">Yes. The Dot removes itself when you cancel.</div>
  </details>
  <details class="pulse-disclosure" name="faq">
    <summary class="pulse-disclosure__summary">Does it run alongside antivirus?</summary>
    <div class="pulse-disclosure__body">Yes.</div>
  </details>
</div>
```

### Accessibility

- It’s a native `<details>`: the keyboard, screen readers and Find in page all work. Remembering whether it was open is the page’s script.

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

It’s a native `<dialog>`. A button with `data-pulse-open="its-id"` opens it; `data-pulse-close`, Esc or a click on the dimmed page closes it, and focus goes back to the opener. When it opens, focus goes to its title (pulse.js gives it `tabindex="-1"`; no ring), so the close X never looks selected; Tab goes to the X next. However the page opens it, in a shadow root too. The page behind is dimmed and doesn’t scroll.

### Opener that is a link

When the drawer is a step on the way somewhere (pricing before checkout), make the opener a link to that place. Without JavaScript it goes straight there; with it, pulse.js opens the drawer instead.

```html
<a class="pulse-btn pulse-btn--primary" href="https://buy.example.com/checkout" data-pulse-open="pricing">Buy a Dot</a>
```

### Options

| Option | What it does |
|---|---|
| `pulse-drawer--lg` | 640px wide instead of 400. Both go full width on narrower screens. |
| `pulse-drawer--xl` | Half the window, 640 to 800px (720 at 1440), for wide content such as a thread with code. |
| `pulse-drawer--screen` | Rises from the bottom, full width, and stops just short of the top, so it reads as a screen. Square corners. |
| `pulse-drawer--inset` | A drawer inside a panel (on a plain `<div>`, inside a positioned parent), next to a list that stays usable. |
| `pulse-drawer--push` | With `--inset`: the panel makes room instead of being covered (give what it pushes a margin the drawer’s width), so the drawer is flat: a border, no shadow. Phones keep the full-width drawer. |
| `pulse-drawer__foot` | Optional footer that stays put while the body scrolls. Put `pulse-actions--end` inside: Cancel, then the main action. |
| `data-modal="false"` | Opens it beside the page, which stays usable (no dimming). Only its close button or Esc closes it. pulse.js gives it Esc (the browser only does for modals), also when your own script opens it with `dialog.show()`, and returns focus to the opener; not while a modal or a menu inside has the key. |
| `data-theme="dark"` | A dark drawer on a light page. |

### A head with more

The head can carry an icon before the title (`pulse-drawer__icon`, optional, centered on the title’s first line), a description under the title and an end area before the close X, for stats, a badge or a button. The close X and the end area’s buttons sit on the title’s first line too. In apps the title is 18px (working panels); on the website it is 24px. Wrap the title and `pulse-drawer__desc` in `pulse-drawer__heading`; put the rest in `pulse-drawer__end`. Under 600px the end area moves to its own line.

```html
<div class="pulse-drawer" style="position: static; width: 100%; max-width: 640px; height: auto; box-shadow: none; border: var(--border-width-1) solid var(--color-border-default)">
  <div class="pulse-drawer__head">
    <span class="pulse-drawer__icon"><i class="pulse-icon pulse-icon--graph" aria-hidden="true"></i></span>
    <div class="pulse-drawer__heading">
      <h2 class="pulse-drawer__title">Coverage</h2>
      <p class="pulse-drawer__desc">Acme Corp, updated 3 minutes ago</p>
    </div>
    <div class="pulse-drawer__end">
      <ul class="pulse-stat-line"><li><strong>6</strong> assets</li><li><strong>4</strong> Dots</li></ul>
      <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" aria-label="More actions"><i class="pulse-icon pulse-icon--dots-three" aria-hidden="true"></i></button>
    </div>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-drawer__close" type="button" aria-label="Close">
      <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
    </button>
  </div>
  <div class="pulse-drawer__body"><p>The body scrolls under the head.</p></div>
</div>
```

### Wider and taller

```html
<button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-open="thread">Open the thread</button>
<dialog class="pulse-drawer pulse-drawer--xl" id="thread" aria-labelledby="thread-title">
  <div class="pulse-drawer__head"><h2 class="pulse-drawer__title" id="thread-title">Unusual sign-in</h2>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-drawer__close" type="button" aria-label="Close" data-pulse-close><i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button></div>
  <div class="pulse-drawer__body"><p>Half the window, 640 to 800px wide.</p></div>
</dialog>
```

```html
<button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-open="accounts">Open accounts</button>
<dialog class="pulse-drawer pulse-drawer--screen" id="accounts" aria-labelledby="accounts-title">
  <div class="pulse-drawer__head"><h2 class="pulse-drawer__title" id="accounts-title">Managed accounts</h2>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-drawer__close" type="button" aria-label="Close" data-pulse-close><i class="pulse-icon pulse-icon--x" aria-hidden="true"></i></button></div>
  <div class="pulse-drawer__body"><p>Rises from the bottom, full width, and stops just short of the top.</p></div>
</dialog>
```

### Rules for every panel

- It opens with an ease-out and leaves with an ease-in, so you see it go. Start heavy work (rebuilding a list) a couple of frames after `close()`, or a busy page skips the exit.

- Every drawer, sheet and full-screen panel closes the same way: an X at the far right of its head. Nothing destructive sits there.

- A panel that reaches nearly to the top is square; rounded top corners are only for a sheet that stops well short of it.

- The page behind is dimmed flat: no blur and no colored glow.

### Accessibility

- `aria-labelledby` points at the title. The close button needs `aria-label="Close"`.

## Menu and dropdown

One list surface that opens from a button: a dropdown picks a value, an action menu does something, a nav menu goes somewhere.

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

### Action menu (doing something)

Actions that don’t need a button of their own, behind a button. A ⋯ icon button makes it the overflow menu. Clicking an action closes the menu and puts focus back on its button. A destructive action sits last, after a divider, in red, and opens a destructive dialog (https://cdn.unmanned.team/pulse/v1/docs/dialog.html) to confirm (“This can’t be undone.”); it never acts in one click.

```html
<div class="pulse-menu-anchor pulse-menu-anchor--end">
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" data-pulse-menu aria-haspopup="menu" aria-controls="signal-more" aria-label="More actions">
    <i class="pulse-icon pulse-icon--dots-three pulse-icon--bold" aria-hidden="true"></i>
  </button>
  <div class="pulse-dropdown pulse-dropdown--menu" id="signal-more" hidden>
    <div role="menu" aria-label="Signal actions">
      <button class="pulse-menu-item" type="button" role="menuitem"><i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i><span class="pulse-menu-item__label">Copy link</span></button>
      <button class="pulse-menu-item" type="button" role="menuitem"><i class="pulse-icon pulse-icon--file-csv" aria-hidden="true"></i><span class="pulse-menu-item__label">Export as CSV</span></button>
      <hr class="pulse-dropdown__divider">
      <button class="pulse-menu-item pulse-menu-item--danger" type="button" role="menuitem" data-pulse-open="delete-signal"><i class="pulse-icon pulse-icon--trash" aria-hidden="true"></i><span class="pulse-menu-item__label">Delete signal</span></button>
    </div>
  </div>
</div>

<dialog class="pulse-dialog" id="delete-signal" aria-labelledby="delete-signal-title" aria-describedby="delete-signal-body">
  <div class="pulse-dialog__head">
    <div class="pulse-dialog__copy">
      <h2 class="pulse-dialog__title" id="delete-signal-title">Delete this signal?</h2>
      <p class="pulse-dialog__body" id="delete-signal-body">This removes the signal and its thread. You can’t undo it.</p>
    </div>
    <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-dialog__close" type="button" aria-label="Close" data-pulse-close>
      <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
    </button>
  </div>
  <div class="pulse-dialog__actions">
    <button class="pulse-btn pulse-btn--secondary" type="button" data-pulse-close autofocus>Cancel</button>
    <button class="pulse-btn pulse-btn--destructive" type="button" data-pulse-close>Delete</button>
  </div>
</dialog>
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
| `pulse-dropdown--menu` | The action menu: fits its items (200 to 320px). |
| `pulse-menu-item--danger` | A destructive action, in red. |
| `pulse-dropdown--nav` | The nav menu: 320px, title and description items. |
| `pulse-dropdown__label` | A small mono group label above the links. |
| `pulse-menu-anchor`, `--end` | Wraps the trigger and the list, and places the list under the trigger. |
| `data-pulse-menu` | On the trigger: pulse.js opens and closes the list named by its `aria-controls`. |

### Accessibility

- Dropdown: `role="listbox"`, `role="option"`, `aria-selected` on the chosen one, `aria-disabled` on unavailable ones. The button is labelled by the field label and its current value; pulse.js adds `aria-haspopup` and moves `aria-activedescendant` with the arrow keys.

- Action menu: the button has an `aria-label` when it is icon only (“More actions”) and `aria-haspopup="menu"`; items are `role="menuitem"` inside `role="menu"`. Arrow keys, Home and End move between them; Esc closes.

- Nav menu: the trigger has `aria-expanded` and `aria-controls`; the current page has `aria-current="page"`.

## Empty state

What a list or panel shows when there is nothing in it: an icon, a title, a line and maybe an action.

Figma component: Empty state.

### All clear

When nothing is wrong, say so with confidence: the shield with a check, in the success color (`pulse-empty--clear`).

```html
<div class="pulse-empty pulse-empty--clear">
  <i class="pulse-icon pulse-icon--shield-check pulse-icon--fill pulse-empty__icon" aria-hidden="true"></i>
  <p class="pulse-empty__title">All clear</p>
  <p class="pulse-empty__text">No open signals. VEX keeps watching and messages you if anything changes.</p>
</div>
```

### With an action

```html
<div class="pulse-empty">
  <i class="pulse-icon pulse-icon--folder pulse-empty__icon" aria-hidden="true"></i>
  <p class="pulse-empty__title">No backups yet</p>
  <p class="pulse-empty__text">The first backup runs tonight.</p>
  <div class="pulse-empty__actions"><button class="pulse-btn pulse-btn--secondary pulse-btn--sm" type="button">Back up now</button></div>
</div>
```

### Accessibility

- The icon is decoration (`aria-hidden="true"`); the title says it.

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

Text inputs, selects and text areas, with a label, help text and an error state, and input groups for search, copy and reply boxes.

Figma component: Text field, Select, Textarea, Input group.

### Text input

```html
<div class="pulse-field" style="max-width: 320px">
  <label class="pulse-field__label" for="work-email">Work email</label>
  <input class="pulse-input" id="work-email" type="email" placeholder="name@company.com" aria-describedby="work-email-help">
  <span class="pulse-field__help" id="work-email-help">We only use this to send the report.</span>
</div>
```

### Small

`pulse-input--sm` and `pulse-select--sm` are 32px, for dense app screens and toolbars. Text is 14px from tablet up; phones keep 16px, because iOS Safari zooms into a field with smaller text.

```html
<div class="pulse-field" style="max-width: 280px">
  <label class="pulse-field__label" for="f-sm">Asset name</label>
  <input class="pulse-input pulse-input--sm" id="f-sm" type="text" placeholder="HR-laptop-428936">
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

### Input group: search, copy and reply

A field box that holds a field with icons or buttons inside it. The box shows hover and focus; the field inside has no box of its own. Buttons inside take the control radius, not the pill: an inner shape follows its container. Search: a magnifying-glass icon, `type="search"`, an optional key hint and an optional clear X. Type in it: the X takes the key hint’s place while the field has text (give the field a placeholder; CSS reads it). Clicking the X, or Esc, empties the field, keeps focus there and fires an `input` event so your list refilters (pulse.js). No tooltip: the X is a convention.

```html
<div class="pulse-input-group" style="width: 100%; max-width: 360px">
  <i class="pulse-icon pulse-icon--magnifying-glass" aria-hidden="true"></i>
  <input class="pulse-input" type="search" placeholder="Search accounts" aria-label="Search accounts">
  <kbd class="pulse-input-group__key">/</kbd>
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-input-group__clear" type="button" data-pulse-clear aria-label="Clear search">
    <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
  </button>
</div>
```

With a button at the end, for a box that also acts, such as inviting someone by email.

```html
<div class="pulse-input-group" style="width: 100%; max-width: 420px">
  <i class="pulse-icon pulse-icon--magnifying-glass" aria-hidden="true"></i>
  <input class="pulse-input" type="search" placeholder="Invite by email" aria-label="Invite by email">
  <button class="pulse-btn pulse-btn--primary pulse-btn--sm" type="button">Invite</button>
</div>
```

Ghost: `pulse-input-group--ghost` drops the box, for a quiet search that fills its band (a toolbar, a list head). Hover tints the band and focus draws the ring inside it.

```html
<div class="pulse-input-group pulse-input-group--ghost" style="max-width: 480px; border-bottom: var(--border-width-1) solid var(--color-border-default)">
  <i class="pulse-icon pulse-icon--magnifying-glass" aria-hidden="true"></i>
  <input class="pulse-input" type="search" placeholder="Search events" aria-label="Search events">
  <kbd class="pulse-input-group__key">/</kbd>
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-input-group__clear" type="button" data-pulse-clear aria-label="Clear search">
    <i class="pulse-icon pulse-icon--x" aria-hidden="true"></i>
  </button>
</div>
```

Copy: a read-only value with a copy button. The button’s `data-pulse-copy` names the input’s `id`; pulse.js copies it and shows “Copied”.

```html
<div class="pulse-input-group pulse-input-group--readonly" style="width: 100%; max-width: 360px">
  <input class="pulse-input" id="soc-mailbox" value="soc-acme@vex.unmanned.team" readonly aria-label="Mailbox address">
  <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm pulse-tooltip-host" type="button" data-pulse-copy="soc-mailbox" aria-label="Copy the mailbox address">
    <i class="pulse-icon pulse-icon--copy" aria-hidden="true"></i><span class="pulse-tooltip pulse-tooltip--bottom pulse-tooltip--end" aria-hidden="true">Copy</span>
  </button>
</div>
```

Reply box: a text area that grows with its text, with the send button inside the box. Enter sends and Shift+Enter adds a line (the page’s script). For a conversation add `--composer`: it starts two lines tall, like a chat box, so it doesn’t read as a search field, with medium corners. At rest and empty it reads as inactive (a subtle fill, no line); clicked into, or holding text, it is an ordinary field.

```html
<div class="pulse-input-group pulse-input-group--multiline pulse-input-group--composer" style="width: 100%; max-width: 520px">
  <textarea class="pulse-textarea" rows="1" placeholder="Add context for VEX" aria-label="Message"></textarea>
  <button class="pulse-btn pulse-btn--primary pulse-btn--icon pulse-btn--sm" type="button" aria-label="Send"><i class="pulse-icon pulse-icon--paper-plane-right pulse-icon--fill" aria-hidden="true"></i></button>
</div>
```

### Options

| Class | What it does |
|---|---|
| `pulse-field--error` | Red border and red help text. |
| `pulse-input--lg`, `pulse-select--lg`, `pulse-textarea--lg` | 48px tall, 16px text, for marketing forms. |
| `pulse-input--ghost`, `pulse-select--ghost`, `pulse-textarea--ghost` | No border or background. |
| `pulse-input-group` | The box around a field with icons or buttons inside. Put a plain `pulse-input` or `pulse-textarea` in it. |
| `pulse-input-group__key` | A `<kbd>` hint for the shortcut that focuses it (“/”). It hides while you type; wiring the shortcut is the page’s script. |
| `pulse-input--sm`, `pulse-select--sm` | 32px tall; 14px text from tablet up, 16px on phones. |
| `pulse-input-group__clear` | A clear X, with `data-pulse-clear` and `aria-label="Clear search"`. Shows only while the field has text. |
| `pulse-input-group--sm` | 32px tall, for toolbars. Same text sizes as small fields. |
| `pulse-input-group--ghost` | No box: the band shows hover and focus. |
| `pulse-input-group--readonly` | A gray box with a mono value, for copying. |
| `pulse-input-group--multiline` | Holds a growing text area; the buttons sit at the bottom. |
| `pulse-input-group--composer` | With `--multiline`: a chat reply box that starts two lines tall (66px) and grows to 200px, with medium corners (8px in apps) and the send button 8px in. Quiet (subtle fill, no line) until clicked or filled. |

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

## List

Rows with a mark, a title and a line of detail, and actions at the end. A row can be the control itself.

Figma component: List row.

### Rows you can open

When the whole row opens something, make the row an `<a>` or `<button class="pulse-list-row">`. The current one has `aria-current`; it gets the quiet selected fill and an edge in the selection color.

```html
<ul class="pulse-list" style="width: 100%; max-width: 480px">
  <li><a class="pulse-list-row" href="#" aria-current="true">
    <span class="pulse-list-row__lead"><span class="pulse-avatar" aria-hidden="true">AC</span></span>
    <span class="pulse-list-row__main"><span class="pulse-list-row__title">Acme Corp</span><span class="pulse-list-row__meta">42 assets · 3h ago</span></span>
    <span class="pulse-list-row__trail"><span class="pulse-badge pulse-badge--danger">2 open</span></span>
  </a></li>
  <li><a class="pulse-list-row" href="#">
    <span class="pulse-list-row__lead"><span class="pulse-avatar" aria-hidden="true">NW</span></span>
    <span class="pulse-list-row__main"><span class="pulse-list-row__title">Northwind</span><span class="pulse-list-row__meta">18 assets · yesterday</span></span>
    <span class="pulse-list-row__trail"><span class="pulse-badge pulse-badge--success">Clear</span></span>
  </a></li>
</ul>
```

### Rows with actions

When a row holds its own buttons, the row is a plain `<li class="pulse-list-row">`. `__trail--reveal` shows the actions on hover and focus only (always on touch screens). Tooltips on trailing icons close as soon as the pointer leaves the icon (see Tooltip (https://cdn.unmanned.team/pulse/v1/docs/tooltip.html)).

```html
<ul class="pulse-list" style="width: 100%; max-width: 480px">
  <li class="pulse-list-row">
    <span class="pulse-list-row__lead"><span class="pulse-avatar pulse-avatar--sm pulse-avatar--circle" aria-hidden="true">KM</span></span>
    <span class="pulse-list-row__main"><span class="pulse-list-row__title">Kim Moore</span><span class="pulse-list-row__meta">kim@acme.com</span></span>
    <span class="pulse-list-row__trail pulse-list-row__trail--reveal">
      <button class="pulse-btn pulse-btn--ghost-neutral pulse-btn--icon pulse-btn--sm" type="button" aria-label="Remove Kim Moore"><i class="pulse-icon pulse-icon--trash" aria-hidden="true"></i></button>
    </span>
  </li>
</ul>
```

### Compact rows are one line

In `pulse-list--compact` the meta sits after the title on the same line, in tertiary. The meta cuts off first, then the title. On phones the meta may wrap under the title and the row grows. Rows that need two lines use the default size.

```html
<ul class="pulse-list pulse-list--compact" style="width: 100%; max-width: 480px">
  <li><a class="pulse-list-row" href="#">
    <span class="pulse-list-row__lead"><i class="pulse-icon pulse-icon--shield-warning pulse-icon--fill" aria-hidden="true" style="color: var(--color-indicator-danger)"></i></span>
    <span class="pulse-list-row__main"><span class="pulse-list-row__title">Suspicious script on HR-laptop-428936</span><span class="pulse-list-row__meta">Acme Corp · 3h ago</span></span>
  </a></li>
  <li><a class="pulse-list-row" href="#">
    <span class="pulse-list-row__lead"><i class="pulse-icon pulse-icon--shield-warning pulse-icon--fill" aria-hidden="true" style="color: var(--color-indicator-warning)"></i></span>
    <span class="pulse-list-row__main"><span class="pulse-list-row__title">Missing DMARC record</span><span class="pulse-list-row__meta">Northwind · yesterday</span></span>
  </a></li>
</ul>
```

### Without lines

`pulse-list--plain` drops the lines between rows, for a short list inside a panel. Hover and selection still show the row.

```html
<ul class="pulse-list pulse-list--compact pulse-list--plain" style="width: 100%; max-width: 420px">
  <li><a class="pulse-list-row" href="#"><span class="pulse-list-row__main"><span class="pulse-list-row__title">Microsoft 365</span><span class="pulse-list-row__meta">Connected</span></span></a></li>
  <li><a class="pulse-list-row" href="#"><span class="pulse-list-row__main"><span class="pulse-list-row__title">Google Workspace</span><span class="pulse-list-row__meta">Connected</span></span></a></li>
  <li><a class="pulse-list-row" href="#"><span class="pulse-list-row__main"><span class="pulse-list-row__title">GitHub</span><span class="pulse-list-row__meta">Not connected</span></span></a></li>
</ul>
```

### Density

| Class | Row height |
|---|---|
| `pulse-list--compact` | 40px, one line. For dense app lists (signals). |
| (none) | 48px. Title and meta on two lines. |
| `pulse-list--spacious` | 56px. |

Density comes from the row height, not smaller text: titles stay 14px and details 12px.

### Parts

| Class | What it is |
|---|---|
| `__lead` | An avatar, an icon or a status dot. |
| `__title`, `__meta` | The name, and one line of detail (tertiary, tabular numbers). Both cut off with an ellipsis. |
| `__trail` | Badges, numbers or buttons at the end. |

### Accessibility

- Don’t put buttons inside a row that is itself a link or button; use a plain row instead.

- Icon buttons in a row name their target: “Remove Kim Moore”, not “Remove”.

## Log list

Raw events in mono rows, each opening to its full text, with new rows flashing as they arrive.

Figma component: Log list.

```html
<ul class="pulse-log" style="width: 100%; max-width: 560px">
  <li><details class="pulse-log__row is-new"><summary><time class="pulse-log__time">09:12:04</time><span class="pulse-log__text">signin.success user=kim@acme.com ip=203.0.113.7 country=PT</span></summary>
    <pre class="pulse-log__full">signin.success user=kim@acme.com ip=203.0.113.7 country=PT agent="Safari 18" mfa=true</pre></details></li>
  <li><details class="pulse-log__row"><summary><time class="pulse-log__time">09:11:58</time><span class="pulse-log__text">token.issue scope=mail.read client=outlook</span></summary>
    <pre class="pulse-log__full">token.issue scope=mail.read client=outlook expires=3600</pre></details></li>
</ul>
```

### Options

| Option | What it does |
|---|---|
| (every row) | A caret before the time shows the row opens: right when closed, down when open. The whole row is the control. |
| `is-new` on a row | A short highlight flash when a row arrives (none for people who turn off motion). |
| `pulse-log__col` | An extra column, sized to its content; `--pulse-log-col-max` caps it. |

### Columns

Up to three `pulse-log__col` cells between the time and the text, for key fields (session, group, source), as in Datadog or CloudWatch. They line up across rows: each column is as wide as its longest value, so full IDs and emails show (from tablet up the log is one grid and each row a subgrid). `--pulse-log-col-max` on the log caps every column (40ch by default) and cuts longer values with an ellipsis. A badge in a column uses `pulse-badge--sm` (20px), so the row stays one line tall. On phones the time and the columns share a line and the text goes under.

```html
<ul class="pulse-log" style="width: 100%; max-width: 900px">
  <li><details class="pulse-log__row"><summary><time class="pulse-log__time">09:12:04</time><span class="pulse-log__col">01JD8F2K7QW4XN9V3B6T5R0MZC</span><span class="pulse-log__col">kim@acme.com</span><span class="pulse-log__text">signin.success ip=203.0.113.7 country=PT</span></summary>
    <pre class="pulse-log__full">signin.success user=kim@acme.com ip=203.0.113.7 country=PT agent="Safari 18" mfa=true</pre></details></li>
  <li><details class="pulse-log__row"><summary><time class="pulse-log__time">09:11:58</time><span class="pulse-log__col">01JD8F2K7QW4XN9V3B6T5R0MZC</span><span class="pulse-log__col"><span class="pulse-badge pulse-badge--sm pulse-badge--nodot">outlook</span></span><span class="pulse-log__text">token.issue scope=mail.read</span></summary>
    <pre class="pulse-log__full">token.issue scope=mail.read client=outlook expires=3600</pre></details></li>
</ul>
```

Mono is right here: logs, IDs and raw text. Elsewhere numbers use the sans.

## Message

A message in a thread: avatar, sender, time and body. A thread is messages, reply buttons and a reply box.

Figma component: Message.

```html
<ol class="pulse-timeline" style="width: 100%; max-width: 520px">
  <li class="pulse-message">
    <span class="pulse-avatar pulse-avatar--circle" aria-hidden="true">V</span>
    <div class="pulse-message__head"><span class="pulse-message__sender">VEX</span><span class="pulse-badge pulse-badge--accent pulse-badge--nodot">AI analyst</span><time class="pulse-message__time" datetime="2026-11-18T09:12">9:12</time></div>
    <div class="pulse-message__body"><p>Unusual sign-in for kim@acme.com from a new country. I contained the session.</p></div>
  </li>
  <li class="pulse-message">
    <span class="pulse-avatar pulse-avatar--circle" aria-hidden="true">KM</span>
    <div class="pulse-message__head"><span class="pulse-message__sender">Kim Moore</span><time class="pulse-message__time" datetime="2026-11-18T09:20">9:20</time></div>
    <div class="pulse-message__body"><p>That was me, I’m traveling.</p></div>
  </li>
</ol>
```

Inside `.pulse-timeline` a line joins the messages.

The message text is 14px on 22px lines (`--type-body-sm-relaxed-line-height`), a little more air than lists and controls (20px), because it is read, not scanned.

### A whole thread

Built from pieces that live elsewhere: reply buttons are buttons (https://cdn.unmanned.team/pulse/v1/docs/button.html) with `pulse-btn--reply`, the reply box is an input group (https://cdn.unmanned.team/pulse/v1/docs/fields.html), and JSON goes in a small code panel (https://cdn.unmanned.team/pulse/v1/docs/code-panel.html).

```html
<div class="pulse-actions">
  <button class="pulse-btn pulse-btn--primary pulse-btn--sm pulse-btn--reply" type="button">Contain asset</button>
  <button class="pulse-btn pulse-btn--neutral pulse-btn--sm pulse-btn--reply" type="button">It was me</button>
</div>
```

```html
<div class="pulse-input-group pulse-input-group--multiline pulse-input-group--composer" style="width: 100%; max-width: 520px">
  <textarea class="pulse-textarea" rows="1" placeholder="Add context for VEX" aria-label="Message"></textarea>
  <button class="pulse-btn pulse-btn--primary pulse-btn--icon pulse-btn--sm" type="button" aria-label="Send"><i class="pulse-icon pulse-icon--paper-plane-right pulse-icon--fill" aria-hidden="true"></i></button>
</div>
```

### Accessibility

- Use an ordered list for the thread and a `<time datetime>` for each time.

- The send button is an icon button with `aria-label="Send"`.

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

### Small, in a table

`pulse-progress--sm` is a 4px bar for a table cell or a list row, here under a label of the cell’s own (the head is optional). Use `--neutral` for an amount with no good or bad meaning, and a tone only when the amount means something (`--success` for full coverage).

```html
<div class="pulse-progress pulse-progress--sm pulse-progress--neutral" style="width: 160px">
  <span id="cov-acme">83% covered</span>
  <div class="pulse-progress__track" role="progressbar" aria-labelledby="cov-acme" aria-valuenow="83" aria-valuemin="0" aria-valuemax="100"><div class="pulse-progress__fill" style="--p: 83%"></div></div>
</div>
```

### Options

| Option | What it does |
|---|---|
| `style="--p: 50%"` | How full the bar is. |
| `pulse-progress--success`, `--danger`, `--neutral` | Tone. No class is the accent; neutral is gray, for an amount with no good or bad meaning. |
| `pulse-progress--sm` | A 4px bar, 4px under its label, for tables and lists. |
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

It takes the button shape: square-ish on the web, a pill in apps.

### Small

32px tall, to sit beside small buttons in a toolbar.

```html
<div class="pulse-segmented pulse-segmented--sm" role="group" aria-label="Period">
  <button class="pulse-segmented__item" type="button" aria-pressed="true">Month</button>
  <button class="pulse-segmented__item" type="button" aria-pressed="false">Year</button>
</div>
```

### Options

| Class | What it does |
|---|---|
| `pulse-segmented--sm` | 14px labels at 32px tall, beside small buttons. |
| `pulse-segmented--lg` | 16px labels at the same 40px height, to sit beside medium buttons. |

Switching what’s shown, and moving `aria-pressed`, is the page’s script.

### Accessibility

- Buttons with `aria-pressed` in a `role="group"` with an `aria-label`. For page sections, use tabs (https://cdn.unmanned.team/pulse/v1/docs/tabs.html).

## Skeleton and spinner

Show that something is loading: gray rows in the shape of the content, or a ring for work in progress.

Figma component: Skeleton, Spinner.

### Skeleton rows

Use while a list or table loads, so the page doesn’t jump when it arrives. Mark the region `aria-busy="true"` and include a hidden “Loading” for screen readers.

```html
<div aria-busy="true" style="width: 100%; max-width: 420px">
  <span class="pulse-visually-hidden">Loading</span>
  <div class="pulse-skeleton-row"><span class="pulse-skeleton pulse-skeleton--mark"></span><span class="pulse-skeleton"></span></div>
  <div class="pulse-skeleton-row"><span class="pulse-skeleton pulse-skeleton--mark"></span><span class="pulse-skeleton"></span></div>
  <div class="pulse-skeleton-row"><span class="pulse-skeleton pulse-skeleton--mark"></span><span class="pulse-skeleton"></span></div>
</div>
```

### Spinner

A ring for an action in progress: small inline, medium, large for a page or a covered area.

Small (16):

```html
<span class="pulse-spinner pulse-spinner--sm" role="status" aria-label="Loading"></span>
```

Medium (20):

```html
<span class="pulse-spinner" role="status" aria-label="Loading"></span>
```

Large (32):

```html
<span class="pulse-spinner pulse-spinner--lg" role="status" aria-label="Loading"></span>
```

### Covering an area

`pulse-spinner-cover` dims and covers its positioned parent. For the whole page, use `Pulse.loading()` (below): it keeps the cover above open panels for you.

```html
<div style="position: relative; width: 100%; max-width: 360px; height: 120px; border: 1px solid var(--color-border-default)">
  <p style="margin: 16px">Content being refreshed</p>
  <div class="pulse-spinner-cover"><span class="pulse-spinner pulse-spinner--lg" role="status" aria-label="Refreshing"></span></div>
</div>
```

### From a script

`Pulse.loading(task, { delay })` shows the page-wide cover while a task runs and returns its result. It stays at least `delay` ms (200 by default) so it doesn’t flash, overlapping tasks share one cover that goes when the last one ends, and it stays above dialogs and drawers opened meanwhile. `Pulse.cover(box)` covers one box and returns the cover to remove. The small inline spinner is just markup. There is no “done” check: a page cover just goes away (the content is the confirmation), and confirmations go in a toast.

```html
<script>
  // The page-wide cover while a task runs. Shows for at least 200ms, shares one cover with overlapping tasks,
  // stays above open dialogs and drawers, and returns (or throws) what the task does.
  const accounts = await Pulse.loading(() => api.accounts(), { delay: 200 });

  // A cover over one box (it is made relative if it isn't positioned). Remove it when the box is ready.
  const cover = Pulse.cover(document.querySelector('#coverage'));
  await refreshCoverage();
  cover.remove();
</script>
```

### Accessibility

- A spinner has `role="status"` and an `aria-label` that says what is happening.

- Both hold still or slow down for people who turn off motion.

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

## Stat and status dot

A number over its label, and a small dot that marks a status.

Figma component: Stat, Status dot.

Stat:

```html
<div class="pulse-stat"><span class="pulse-stat__value">1,204</span><span class="pulse-stat__label">Assets monitored</span></div>
```

Stat with a status dot:

```html
<div class="pulse-stat"><span class="pulse-stat__value"><span class="pulse-status-dot pulse-status-dot--success" aria-hidden="true"></span>92%</span><span class="pulse-stat__label">Dot coverage</span></div>
```

### A stat that opens something

When a stat opens its own detail (“1m events” opens the audit log), make it a `<button>` or `<a class="pulse-stat">`. It gets a hover fill, the focus ring and a caret after the number. Only for that: a stat that just reports stays plain.

```html
<button class="pulse-stat" type="button"><span class="pulse-stat__value">1m</span><span class="pulse-stat__label">Events this week</span></button>
```

### Inline stats

For a panel or drawer head: `pulse-stat-line` puts stats on one line with a dot between them, the number in `<strong>`. Number over label stays for rows of KPIs.

```html
<ul class="pulse-stat-line">
  <li><strong>6</strong> assets</li>
  <li><strong>4</strong> Dots</li>
  <li><strong>92%</strong> covered</li>
</ul>
```

### Status dot

Tones: `--success`, `--warning`, `--danger`, `--info`, `--accent` (none is neutral). `--live` adds a ping, `--idle` is a hollow ring and `--none` an empty one.

```html
<span class="pulse-status-dot pulse-status-dot--success pulse-status-dot--live" role="img" aria-label="Live"></span>
<span class="pulse-status-dot pulse-status-dot--warning pulse-status-dot--idle" role="img" aria-label="Idle"></span>
<span class="pulse-status-dot pulse-status-dot--none" role="img" aria-label="Not connected"></span>
```

### Rules

- Numbers use the sans with tabular figures; mono is only for code, IDs, hashes and logs.

- A dot is a mark: pair it with a word, or give it `role="img"` and an `aria-label`.

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

Put the tooltip inside the control and add `pulse-tooltip-host` to the control. It shows on hover and on keyboard focus, with no script. With pulse.js it shows in the top layer, placed from the control, so a scrolling list or a clipped box never cuts it off, and it flips above or below when there’s no room on its side (in shadow roots too, after `Pulse.attach`). Esc hides it. It never shows on a disabled control. `is-open` holds it open, for “Copied”.

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

### In table and list rows

Tooltips on row actions (icons in `pulse-list-row__trail`, `pulse-table__reveal`, or any row’s action area marked `pulse-row-actions`) close the moment the pointer leaves the icon, and the pointer passes through them, so moving up, down or along a row of icons is never blocked. They still point at their icon. Keep them to a few words that repeat the icon’s `aria-label`; anything longer belongs in a popover.

This is a deliberate exception to WCAG 1.4.13 (content on hover must stay while the pointer moves onto it), made for dense rows of repeated icons, where a tooltip that stays covers the next row. Everywhere else tooltips stay hoverable. In an accessibility report, 1.4.13 reads “Partially supports” with this explanation.

### When to add one

Only where an icon isn’t a convention. No tooltip on close (X), settings (gear), more (⋯) or send; their `aria-label` is enough. Add one where the icon alone could mislead or is specific to the product: copy a key, accept a risk, close a signal (a check alone reads “done”), manage admins, remove access, disconnect, run again.

### Accessibility

- A tooltip is extra. The control keeps its own name (`aria-label`) and the tooltip gets `aria-hidden="true"`, unless it adds something, then use `aria-describedby`.

- Keep it to a few words. Nothing clickable inside.
