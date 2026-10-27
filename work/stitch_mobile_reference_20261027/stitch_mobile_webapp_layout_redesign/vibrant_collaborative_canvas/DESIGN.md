---
name: Vibrant Collaborative Canvas
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#434655'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#00687a'
  on-secondary: '#ffffff'
  secondary-container: '#57dffe'
  on-secondary-container: '#006172'
  tertiary: '#006242'
  on-tertiary: '#ffffff'
  tertiary-container: '#007d55'
  on-tertiary-container: '#bdffdb'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-bg: '#F8FAFC'
  surface-card: '#FFFFFF'
  primary-dark: '#1D4ED8'
  accent-sky: '#38BDF8'
  border-subtle: '#E2E8F0'
  border-light: '#F1F5F9'
  dot-grid: '#CBD5E1'
  text-muted: '#64748B'
  status-warning: '#F59E0B'
  status-danger: '#EF4444'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 34px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 26px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.03em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 10px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-mobile: 0.75rem
  margin: 1rem
  margin-mobile: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

The design system expresses a forward-looking, approachable, and highly productive SaaS personality tailored for high-tempo digital workspaces and hybrid human-AI teams. It merges technical efficiency with playful approachability. Target users include modern Thai and global distributed product builders, project managers, and digital creators who balance fast execution with clear, joyful collaboration.

The overarching design aesthetic fuses **Corporate / Modern SaaS** with **Soft Glassmorphism** and subtle tactile touches. Key visual signifiers include airy, slate-tinted canvas backdrops punctuated by dot grid patterns, ultra-clean high-contrast typography, crisp layered cards with delicate specular borders, and high-energy electric cobalt and cyan accents. The mobile-first experience prioritizes spacious touch targets, gesture responsiveness, and high glanceability.

## Colors

The palette balances energetic core pigments against crisp neutral structures:

- **Primary (`#2563EB` & `#1D4ED8`)**: Powers high-priority interactive touchpoints, primary buttons, bottom-navigation active pills, and hero emphasis text.
- **Secondary (`#06B6D4` / `#38BDF8`)**: Injects friendly AI-agent vitality into state badges, active indicators, interactive progress bars, and collaborative avatar highlights.
- **Tertiary (`#10B981`)**: Dedicated to positive validation, completed milestones, live agent statuses, and successful task handoffs.
- **Neutral Canvas (`#F8FAFC` to `#0F172A`)**: The backdrop stays crisp at `#F8FAFC`, complemented by pure white (`#FFFFFF`) elevated cards, slate borders (`#E2E8F0`), and ink-black typography (`#0F172A`) for maximum legibility in Thai and Latin characters under varying ambient lighting.

Subtle dot grids (`#CBD5E1` at 25-35% opacity on a 20px step) texture empty canvas voids without competing against primary task cards.

## Typography

The type system utilizes **Plus Jakarta Sans** for Latin characters and seamlessly integrates with contemporary geometric loopless Thai typefaces such as Prompt or Sarabun. The tall x-height, rounded junctions, and open counters guarantee exceptional legibility on compact handheld viewports.

Line heights accommodate Thai tone marks without vertical clipping. Display titles use tighter letter-spacing for punchy delivery, while UI labels and data badges rely on expanded tracking and deliberate medium-to-semibold weights to preserve clarity at smaller scales.

## Layout & Spacing

This mobile web application relies on a touch-optimized 4-column fluid grid on mobile devices (&lt;640px) scaling to an 8-column layout on tablets and a centered 12-column layout on wide screens.

- **Mobile Canvas**: Outer page margins default to `1rem` (16px), ensuring touch comfort and edge clearance.
- **Rhythm**: Spacing follows a rigorous 4px / 8px scale. `space-sm` (8px) separates dense list metadata; `space-md` (16px) defines internal card padding; `space-lg` (24px) segments module sections.
- **Thumb Zone Design**: Primary navigational flows, filters, action triggers, and bottom navigation bars live within the comfortable lower 60% of the screen.

## Elevation & Depth

Visual hierarchy uses ambient layered shadows combined with delicate 1px boundary strokes:

- **Level 0 (Canvas)**: Base background `#F8FAFC` overlaid with a radial CSS dot matrix pattern (`radial-gradient(#CBD5E1 1px, transparent 1px)` with a 20px grid size).
- **Level 1 (Resting Cards & Containers)**: Pure white background `#FFFFFF`, surrounded by a 1px border of `#E2E8F0` and an extra-soft ambient shadow: `0 2px 8px -2px rgba(15, 23, 42, 0.04), 0 1px 3px 0 rgba(15, 23, 42, 0.02)`.
- **Level 2 (Interactive Cards, Search Bar, Floating Menus)**: `0 10px 25px -5px rgba(37, 99, 235, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`, bordered with `#CBD5E1`.
- **Level 3 (Modal Sheets, Bottom Nav Bar, Action Popovers)**: Translucent white `#FFFFFF/90` with `backdrop-filter: blur(12px)`, upper border `#E2E8F0`, and lift shadow: `0 -4px 20px rgba(15, 23, 42, 0.06)`.
- **Button Glows**: Primary actions feature a tinted halo: `0 8px 16px -4px rgba(37, 99, 235, 0.35)`.

## Shapes

The interface embraces a modern, friendly rounded vocabulary (Level 2). Standard touch inputs and task cards feature `0.75rem` (12px) to `1rem` (16px) corner radii (`rounded-lg`), creating friendly contours. 

Smaller elements such as chips, status indicators, and icon wrappers apply full pill geometry (`rounded-full` or 9999px), providing clear differentiation between actionable tag selectors and structural containers.

## Components

### Buttons
- **Primary**: Solid `#2563EB` fill, `#FFFFFF` text, `48px` minimum touch height, `rounded-xl` (12px) or pill radius, accompanied by `0 8px 16px -4px rgba(37, 99, 235, 0.35)` glow. Active state presses down with a subtle scale transform (`scale(0.98)`).
- **Secondary / Soft**: High-contrast dark button using `#0F172A` with crisp white text, or pale tint `#EFF6FF` with `#2563EB` text.
- **Icon Actions**: 40x40px or 44x44px circular or rounded-xl containers with neutral borders `#E2E8F0` and smooth hover/tap feedback.

### Search Bar
- **Touch-Friendly Shell**: Height 44px–48px, rounded-2xl or pill-shaped, `#FFFFFF` background, inset border `#E2E8F0`, leading search magnifying glass in `#64748B`, with trailing voice/filter buttons. Focus triggers a 2px `#2563EB/30` outer ring.

### Cards (Tasks, Projects, Team, Calendar)
- **Task Cards**: `#FFFFFF` surface, `16px` padding, 1px border `#E2E8F0`, rounded-xl. Features a vertical priority pip or category chip, bold task title, avatar stack with agent badges, and checklist progress bar in `#06B6D4`.
- **Project Cards**: Dual-layer header with status pills, numeric metric counts, and team member bubbles with teal AI-agent co-pilot icons.
- **Calendar Event Cards**: Bordered left accent bar colored by department, soft tinted container fill (`#F8FAFC`), and clean time badge (`10:00 - 11:30`).

### Chips & Filters
- **Interactive Filter Chips**: Pill-shaped, height 32px, `padding: 0 12px`. Unselected: `#FFFFFF` with `#E2E8F0` border and `#64748B` text. Selected: `#2563EB` text, `#EFF6FF` background, and `#2563EB` border.

### Form Inputs & Checkboxes
- **Input Fields**: Rounded-xl (12px), 48px height for touch ergonomics, light `#FFFFFF` surface with `#E2E8F0` border, focusing into `#2563EB` outline.
- **Checkboxes**: 20x20px rounded-md (6px) box with animated checkmark in `#2563EB` fill.

### Mobile Navigation
- **Fixed Bottom App Bar**: Height 64px, anchored above the safe-area inset, frosted `#FFFFFF/90` surface with `backdrop-filter: blur(16px)` and top border `#E2E8F0`. Tab items feature icon + caption text with `#2563EB` active color wash.