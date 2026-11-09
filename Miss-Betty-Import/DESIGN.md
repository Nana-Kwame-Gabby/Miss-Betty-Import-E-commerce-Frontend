---
name: Miss Betty Import
description: A warm, photo-first import shop for Ghana — Airbnb's generous marketplace structure on a clean white canvas, carried in the shop's own navy and amber.
colors:
  amber: "#F2AA25"
  amber-press: "#E09612"
  amber-tint: "#FDF3DD"
  amber-band: "#FCE9C4"
  amber-ink: "#9A5B00"
  navy: "#1e2d3d"
  navy-body: "#33475b"
  slate: "#5c6b7a"
  hairline: "#e3e7ec"
  hairline-soft: "#eef1f4"
  border-strong: "#c9d1da"
  canvas: "#ffffff"
  surface-soft: "#f6f7f9"
  surface-strong: "#eceff3"
  logo-brown: "#5c2d0e"
  available: "#067647"
  available-tint: "#e7f6ee"
  preorder-tint: "#e8eef5"
  error: "#b42318"
  error-tint: "#fdecea"
  whatsapp: "#25D366"
  scrim: "#0f1720"
typography:
  display-xl:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.4px
  display-lg:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 22px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: -0.3px
  display-md:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: -0.2px
  title-md:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: 0
  body-md:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: 0
  body-sm:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0
  caption:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: 0
  badge:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.1px
  price-lg:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: -0.3px
  price-md:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0
  button-md:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  button-sm:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 14px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
  nav-link:
    fontFamily: "'Plus Jakarta Sans', -apple-system, system-ui, 'Segoe UI', Roboto, sans-serif"
    fontSize: 15px
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: 0
rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 14px
  lg: 20px
  full: 9999px
spacing:
  xxs: 2px
  xs: 4px
  sm: 8px
  md: 12px
  base: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
components:
  button-primary:
    backgroundColor: "{colors.amber}"
    textColor: "{colors.navy}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 14px 24px
    height: 48px
  button-primary-active:
    backgroundColor: "{colors.amber-press}"
    textColor: "{colors.navy}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 13px 23px
    height: 48px
  button-dark:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-md}"
    rounded: "{rounded.sm}"
    padding: 14px 24px
    height: 48px
  button-whatsapp:
    backgroundColor: "{colors.whatsapp}"
    textColor: "{colors.navy}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
    padding: 10px 18px
    height: 44px
  icon-button-circle:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    rounded: "{rounded.full}"
    size: 28px
  top-nav:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.nav-link}"
    height: 64px
  search-bar-pill:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.body-md}"
    rounded: "{rounded.full}"
    padding: 12px 20px
    height: 52px
  category-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy-body}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px
    height: 40px
  category-chip-active:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.canvas}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.full}"
  product-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
  product-card-photo:
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.md}"
  status-tag-available:
    backgroundColor: "{colors.available-tint}"
    textColor: "{colors.available}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  status-tag-preorder:
    backgroundColor: "{colors.preorder-tint}"
    textColor: "{colors.navy}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  sale-tag:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.amber-ink}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  photo-badge:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.badge}"
    rounded: "{rounded.full}"
    padding: 4px 10px
  variant-chip:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.button-sm}"
    rounded: "{rounded.sm}"
    padding: 10px 14px
    height: 44px
  variant-chip-selected:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.sm}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.body-md}"
    rounded: "{rounded.sm}"
    padding: 14px 12px
    height: 52px
  buy-box:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.navy}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 24px
  notice-band:
    backgroundColor: "{colors.amber-tint}"
    textColor: "{colors.navy}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.md}"
    padding: 12px 16px
  footer:
    backgroundColor: "{colors.navy}"
    textColor: "{colors.canvas}"
    typography: "{typography.body-sm}"
    padding: 48px 24px
---

# Design System: Miss Betty Import

## Overview

**Creative North Star: "The Well-Lit Market Stall"**

Miss Betty Import is a shop people reach from a WhatsApp link on a phone. The design borrows Airbnb's proven consumer-marketplace structure — a clean white canvas, photo-first rounded cards, one accent colour for action, soft friendly shapes, modest type — and carries it in the shop's own identity: **deep navy** for every word and **amber** as the single voltage that marks what to tap next. The products are the colour; the interface stays white, navy and quiet so a blender, a pair of sneakers and a baby carrier can sit side by side and all look trustworthy.

Adopted direction (based on VoltAgent/awesome-design-md "Airbnb", adapted to the brand, combined with the taste-skill and emil-design-eng principles). Existing pages predate it and are migrated to it screen by screen; where code and this file disagree, this file is the target.

**Key Characteristics:**
- White canvas, navy ink (never pure black), and one amber accent used scarcely — most screens are 90% white and navy with one or two amber moments.
- Photography carries the visual weight: square product photos with 14px corners, swipeable, a status tag on the photo and the save/share control on the opposite corner.
- Modest type: headlines at 20–28px in weight 600–700; product names at 14–16px; prices bold and tabular.
- Soft shapes everywhere a finger lands: 8px buttons, 14px cards, pill search, pill chips and tags.
- One shadow tier, used only when something floats (sticky buy bar, open menus, a hovered card on desktop).
- Phone first: two-up product cards at 390px, growing to three on tablets and four on desktop (never more, so photos stay large).

## Colors

The palette is white and navy with one warm accent. Colour never decorates; it states status or the next action.

### Primary
- **Market Amber** (#F2AA25): the single accent. Fills primary buttons (Add to cart, Buy now, Pay), the active step in checkout, and the cart-count dot — always with navy text on it (7.0:1). It is never a text colour on white.
- **Amber Press** (#E09612): the pressed/active fill of primary buttons.
- **Amber Tint** (#FDF3DD): soft amber ground for sale tags and notice bands (orders closed, shipping-fee due).
- **Amber Ink** (#9A5B00): the amber that may be read — sale text, "Save GHS 40" lines, inline brand links on white (5.4:1).

### Secondary
- **Harbour Navy** (#1e2d3d): the ink of the shop. Headlines, body text, prices, icons, selected chips, the dark button and the footer ground. White on navy is 14:1.
- **Logo Brown** (#5c2d0e): belongs to the MB mark only. Never used for UI.

### Tertiary
- **Available Green** (#067647) on **Available Tint** (#e7f6ee): the Available (in stock in Ghana) status and positive confirmations.
- **Pre-order Tint** (#e8eef5) with navy text: the Pre-order status — calm, not alarming.
- **Error Red** (#b42318) on **Error Tint** (#fdecea): validation errors, failed payments, cancelled lines.
- **WhatsApp Green** (#25D366): only on the WhatsApp contact button, with its real icon and navy text.

### Neutral
- **Canvas** (#ffffff): every customer page.
- **Navy Body** (#33475b): long running text (descriptions, reviews) where full navy feels heavy.
- **Slate** (#5c6b7a): secondary text — meta lines, labels, helper text (5.5:1). Replaces the old light grey small text, which failed contrast.
- **Hairline** (#e3e7ec) and **Hairline Soft** (#eef1f4): 1px borders and dividers.
- **Border Strong** (#c9d1da): scrollbar thumbs and the fallback swatch for a colour name the shop has no value for. Never text.
- **Surface Soft** (#f6f7f9): photo placeholders, input wells, quiet bands. **Surface Strong** (#eceff3): pressed states of neutral controls.
- **Scrim** (#0f1720 at 50%): modal and drawer backdrop.

**The One Voltage Rule.** Amber appears at most once or twice per screen, and always means "the next step". If two amber buttons are visible together, one of them is wrong. One owner-approved exception: on phones (under 640px) the product card's short "Add" button is full amber so it reads at a glance; from tablet width it is the soft Amber Tint "Add to cart" (full amber on hover). Buy now is white on every screen size.

**The Navy-on-Amber Rule.** Text and icons on amber are always navy. White on amber (1.99:1) is banned.

**The Products Are the Colour Rule.** No gradients, textures, coloured backgrounds or decorative blobs on customer pages; flat white grounds and one navy band (the footer) at most.

## Typography

**Display and body font:** Plus Jakarta Sans (variable, 400–700), with `-apple-system, system-ui, 'Segoe UI', Roboto, sans-serif` behind it. One family carries the whole scale, like Airbnb Cereal does for Airbnb. Load it with `font-display: swap` and only the weights in use.

### Hierarchy
- **Display XL** (700, 28px, 1.25): one per page at most — the shop page heading or the home welcome line.
- **Display LG** (600, 22px, 1.25): product name on the product page; section heads.
- **Display MD** (700, 20px, 1.3): sub-section heads ("Description", "Customer reviews", "Delivery").
- **Title MD** (600, 16px, 1.3): card titles on desktop, list item titles, modal titles.
- **Body MD** (400, 16px, 1.5): default running text and every list; never smaller for lists or descriptions.
- **Body SM** (400, 14px, 1.45): product names on phone cards, meta lines.
- **Caption** (500, 13px): helper text and timestamps. **Badge** (700, 12px): tags on photos and status pills.
- **Price LG** (700, 24px) on the product page and **Price MD** (700, 16px) on cards, both with `font-variant-numeric: tabular-nums`; the old price sits beside it struck through in Slate at body-sm.

**The Modest Weight Rule.** The photos give the page its weight; headings stay at 600–700 and never exceed 28px on a shop surface.

**The Cedi First Rule.** Every price reads "GHS 1,200" with a thin non-breaking space, grouped thousands, and no decimals unless the price has pesewas.

## Layout

- **Phone (≤ 639px):** 16px side gutters; two product cards per row with a 12px gap; sticky bottom buy bar on the product page; the search pill shares the logo row.
- **Tablet (640–1023px):** three cards per row, 24px gutters.
- **Desktop (≥ 1024px):** four cards per row at every desktop width, content max width 1280px, 32px gutters; the product page splits into gallery (left, ~58%) and a sticky buy box (right).
- Spacing runs on an 8px base (2, 4, 8, 12, 16, 24, 32, 48, 64). Sections are separated by 48px on phones and 64px on desktop.
- One main action per screen; secondary actions are secondary buttons or text links.

**The Thumb Rule.** Every tappable thing is at least 44px tall, and the primary action on a phone sits within thumb reach (sticky bottom bar on product and cart pages).

## Elevation & Depth

Depth is flat by default. Cards sit on the white canvas with a 1px Hairline or nothing at all; the photo's rounded edge defines them.

### Shadow Vocabulary
- **Float** (`0 0 0 1px rgba(15,23,32,0.04), 0 2px 6px rgba(15,23,32,0.06), 0 6px 16px rgba(15,23,32,0.10)`): the only shadow. Used on the sticky buy bar, open dropdowns and menus, the search pill on scroll, and a hovered product card on desktop.

**The One Shadow Rule.** There is exactly one elevation tier. If something needs more emphasis, give it space, not a heavier shadow.

## Shapes

- **Gently rounded buttons and inputs** (8px): primary, secondary and dark buttons, text inputs, variant chips.
- **Soft photo cards** (14px): product cards, their photos, the product gallery, the buy box, notice bands.
- **Pills** (fully round): search bar, category chips, status and sale tags, the WhatsApp button, icon buttons.
- **Square-cornered** only at the page edge: full-width bands and the footer.

## Components

### Buttons
- **Primary** (Market Amber, navy text, 8px, 48px tall, button-md): the next step — Add to cart, Buy now, Continue to payment, Pay. One per screen.
- **Secondary** (white with a 1px navy-tinted border, navy text): the alternative action — Add another variant, View cart.
- **Dark** (navy, white text): strong neutral actions that are not the shopper's next step, e.g. Download Excel or Save in the admin dashboard.
- **Press feedback:** every button scales to 0.97 on press (160ms, strong ease-out) and returns on release; hover darkens by one step on pointer devices only.
- **Disabled:** 40% opacity with the cursor `not-allowed`; never a different hue.

### Chips
- **Category chips** (pills, 40px): white with Hairline border and Navy Body text; the active chip is navy with white text. Horizontally scrollable on phones with no visible scrollbar.
- **Variant chips** (8px, 44px): size and colour choices on the product page; selected is navy with white text; an out-of-stock variant is struck through in Slate and not tappable.

### Cards / Containers
- **Product card:** a 4:5 portrait photo (14px corners, Surface Soft while loading, cover-fit and centred so the product never distorts), a status tag (Available or Pre-order) top-left on the photo, and below the photo: the product name (body-sm, two lines max), the price (price-md, navy) with the old price struck through, and an optional quiet meta line in Slate (e.g. the number of colours available), only from real product data. The whole card is the link; no card background or shadow on phones. Beneath the price sit two 44px card buttons (owner's decision): **Add to cart** as a soft Amber Tint button with navy text (full amber on hover), shortened to a cart icon and "Add" on phones, and **Buy now** as a white button with a navy-tinted border. Full amber stays reserved for the next step inside the product view, so a grid of cards never becomes a wall of amber. The photo carries a white status pill (coloured dot + label) top-left, share top-right, and full-screen and download bottom-right. There is no Sale tag on the photo (owner's decision): a discount shows only as the struck-through old price. The photo controls are small and light so the product stays in view: 28px circles on phones and 32px from tablet width, white at 85% with a blur and a hairline ring rather than a shadow, 13–14px icons, and an invisible extension that keeps each tap area at 40px (lib/photoButton.js). The product-page gallery uses the same controls.
- **Buy box** (product page): status tag, name, price-lg with the struck-through regular price and a "Save GHS x" sale tag, the estimated shipping fee, variant chips and colour swatches, a quantity stepper with "Add to selection", the "Your selection" list, then the two actions: **Add to cart** (primary) and **Proceed to checkout** / **Buy now** (secondary). Sticky beside the gallery on desktop. On phones the two actions pin to a bottom bar with short labels ("Add to cart", "Checkout"), sitting above the bottom tab bar for logged-in shoppers; the chat launcher lifts above it.
- **Promoted shelf** (Shop and Home): a full-width Amber Band (#FCE9C4) inside the product grid, warmer than the page so it reads as its own section (edge to edge on phones, 14px corners from tablet width), with a small amber-ink icon, a title and a one-line Navy Body subtitle, then a swipeable row of up to 8 normal product cards (about 2.2 visible on phones, 4 aligned to the grid on desktop, with prev/next arrows from desktop width). Two kinds: **Ready to deliver** (in-stock Available products) and **Most ordered** (ranked by real sales value — quantity × price paid — across website and offline sales, cancelled ones excluded, so well-selling higher-priced products lead). One shelf follows every 6 products on phones and tablets (6, 12, 18…) and every 8 on desktop (8, 16, 24…, so it always follows a full row of 4), alternating kinds; shelf products don't count towards those positions. They respect the shopper's search and filters (with the "Available" filter on there are no Ready to deliver shelves, since the whole list already is), leave out a kind with fewer than 4 matching products, never appear on a list of fewer than 12 products (they would only repeat it), show every product of a kind once before starting over, and put products already shown this visit last. Never a pop-up.
- **Product sheet** (Shop and Home pop-up): a bottom sheet on phones (20px top corners, grab handle), a 576px dialog on desktop; category and close in the top row, the gallery, the buy-box content, and one main action pinned to the sheet's bottom edge. It enters once with a 280ms drawer ease and closes on Escape or the scrim; the chat launcher hides while it is open.
- **Notice band:** Amber Tint ground, navy text, 14px corners — for orders closed, shipping fee due, coupon available. One at a time.

### Reviews
- Star ratings are navy (filled) and Border Strong (empty), as in the Airbnb source: amber stars on white fall below the 3:1 contrast a meaningful graphic needs. The average sits beside them in navy.

### Inputs / Fields
- **Text input** (52px, 8px corners, 1px Hairline; focus: 2px navy ring with 2px white offset): labels sit above in caption weight; errors appear below in Error Red with an icon, never only by colour.
- **Search pill** (52px, fully round, white with Hairline and the Float shadow once the page scrolls): a leading search icon, placeholder "Search products".

### Navigation
- **Top bar** (64px, white, 1px Hairline bottom): MB logo left (static), search pill in the middle, cart (with the amber count dot, navy numeral) and account or Log in / Sign up on the right. On phones the search pill stays in the same row to keep the sticky header short. A second 56px row holds the Categories menu chip and the All products / Available / Pre-order chips (scrolls sideways on phones); on desktop the countdown pill sits at its right end.
- **Footer** (navy ground, white text, Slate-tinted secondary links): shop links, WhatsApp contact, policies.

### Product Gallery (signature component)
Swipeable square photos with 14px corners and a dot indicator; a product video plays muted and inline, first in the gallery when it exists, with a visible pause control. Thumbnails sit below on desktop. Tapping a photo opens it full screen on a scrim.

### Motion
- Easing: strong ease-out `cubic-bezier(0.23, 1, 0.32, 1)` for everything the user triggers; `cubic-bezier(0.32, 0.72, 0, 1)` for drawers and the bottom sheet.
- Durations: press 160ms, hover/colour 150ms, menus and selects 180ms, modals and drawers 280ms; nothing in the UI over 300ms.
- Entrances start from `scale(0.96)` and `opacity: 0`, never from `scale(0)`; menus scale from their trigger.
- Animate only `transform` and `opacity`; never `transition: all`.
- Under `prefers-reduced-motion: reduce`, transitions become instant fades and the gallery video waits for a tap.

**The Quiet Hands Rule.** Things the shopper does many times a session (hover, chip changes, add to cart) respond instantly and subtly; only rare moments (order placed) may celebrate.

## Do's and Don'ts

### Do:
- **Do** use amber only for the single next step, with navy text on it.
- **Do** let real product photos carry every page; show the product's own video first when it has one.
- **Do** label every product Available or Pre-order, on the card and on the product page.
- **Do** show prices as "GHS 1,200", bold and tabular, with the old price struck through beside a sale price.
- **Do** keep text at 16px for lists and descriptions, and every tap target at 44px or more.
- **Do** give every button a 0.97 press response and every link a visible hover/focus state.
- **Do** keep help one tap away with the WhatsApp button using WhatsApp's real icon.

### Don't:
- **Don't** put white text on amber, or use amber as text on white.
- **Don't** use gradients, glassmorphism, textures, emoji as icons, or decorative illustrations on customer pages.
- **Don't** add a second shadow level, heavy borders around photos, or coloured card backgrounds.
- **Don't** use more than one primary (amber) button in view at once.
- **Don't** animate from `scale(0)`, use `ease-in` for UI motion, or exceed 300ms for interface feedback.
- **Don't** invent ratings, review counts, "bestseller" badges, delivery promises or stock urgency the data doesn't support.
- **Don't** use light grey (#9ca3af) for any text.
