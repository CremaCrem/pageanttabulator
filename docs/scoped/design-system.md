# Design System — PageantTabulator

> **Event:** Mr. and Ms. IDSC 2026 — IDSC 18th Founding Anniversary Celebration  
> This document is the single source of truth for all visual design decisions.  
> Every component, color, spacing, and typography choice must reference this guide.

---

## 1. Design Philosophy

The PageantTabulator UI should feel like a **premium event program that runs as enterprise software**.  
Think: *luxury award ceremony meets professional scoring dashboard.*

### Design Principles

| Principle | Description |
|-----------|-------------|
| **Prestige** | Gold accents, elegant typography, and ceremonial visual language |
| **Clarity** | Information hierarchy is always clear. Scores and ranks are instantly readable |
| **Trust** | The UI must convey accuracy and authority — judges must feel confident in what they see |
| **Efficiency** | Judges should be able to enter scores without unnecessary friction |
| **Elegance** | Subtle animations, smooth transitions, no visual clutter |

---

## 2. Color Palette

### Primary Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `color-primary-900` | `#0D3320` | Darkest green — main sidebar background |
| `color-primary-800` | `#1B5E37` | Forest green — primary buttons, headers, active nav |
| `color-primary-700` | `#236B41` | Hover state for primary elements |
| `color-primary-600` | `#2D7E50` | Table header backgrounds |
| `color-primary-500` | `#3A9162` | Accent borders, progress bars |
| `color-primary-100` | `#E8F5EE` | Light green tint — selected row backgrounds |

### Accent Colors (Gold)

| Token | Hex | Usage |
|-------|-----|-------|
| `color-gold-600` | `#9A7020` | Deep gold — used sparingly for emphasis |
| `color-gold-500` | `#C9A84C` | Metallic gold — champion badges, award accents, borders |
| `color-gold-400` | `#D4B96B` | Light gold — hover states for gold elements |
| `color-gold-100` | `#FBF5E6` | Cream — award card backgrounds |

### Neutral Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `color-neutral-950` | `#0A0A0A` | Near black — reserved for critical errors |
| `color-neutral-900` | `#1A1A1A` | Dark text on light backgrounds |
| `color-neutral-700` | `#4A4A4A` | Secondary text |
| `color-neutral-500` | `#7A7A7A` | Placeholder text, muted labels |
| `color-neutral-300` | `#C5C5C5` | Dividers, borders |
| `color-neutral-100` | `#F2F2F2` | Table zebra rows |
| `color-neutral-50`  | `#F9F6F0` | Main page background (warm off-white) |
| `color-white`       | `#FFFFFF` | Card backgrounds, input fields |

### Semantic Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `color-success` | `#27AE60` | Score submitted, locked, confirmed |
| `color-warning` | `#F39C12` | Partial completion, pending action |
| `color-error`   | `#E74C3C` | Validation errors, disqualification |
| `color-info`    | `#2980B9` | Informational notices |

---

## 3. Typography

### Font Families

```css
/* Display headings — used for event title, winner announcements */
font-family: 'Playfair Display', Georgia, serif;

/* UI font — used for all body text, labels, inputs, tables */
font-family: 'Inter', system-ui, -apple-system, sans-serif;
```

> **Font Delivery (Offline Architecture):**
> Inter and Playfair Display are the project fonts.
> Font delivery must remain compatible with the offline/local-LAN-first architecture.
> Do not introduce external runtime font dependencies or CDN loading (e.g., Google Fonts).
### Type Scale

| Token | Size | Line Height | Weight | Usage |
|-------|------|------------|--------|-------|
| `text-display` | 2.5rem (40px) | 1.2 | 700 | Event title, winners display |
| `text-heading-1` | 2rem (32px) | 1.25 | 700 | Page titles |
| `text-heading-2` | 1.5rem (24px) | 1.3 | 600 | Section headings |
| `text-heading-3` | 1.25rem (20px) | 1.4 | 600 | Card titles, subsections |
| `text-body-lg` | 1.125rem (18px) | 1.6 | 400 | Primary body content |
| `text-body` | 1rem (16px) | 1.6 | 400 | Default body text |
| `text-body-sm` | 0.875rem (14px) | 1.5 | 400 | Labels, captions |
| `text-caption` | 0.75rem (12px) | 1.4 | 400 | Metadata, timestamps |
| `text-score` | 2rem (32px) | 1 | 700 | Score display numbers (mono) |

### Font for Scores

Score numbers use `font-variant-numeric: tabular-nums` so columns align perfectly.

---

## 4. Spacing System

Uses an 8px base grid (Tailwind default):

| Token | Value | Usage |
|-------|-------|-------|
| `space-1` | 4px | Micro gap (icon to text) |
| `space-2` | 8px | Tight padding |
| `space-3` | 12px | Form element internal padding |
| `space-4` | 16px | Default component padding |
| `space-6` | 24px | Card padding, section margins |
| `space-8` | 32px | Large section gaps |
| `space-12` | 48px | Page-level section separation |
| `space-16` | 64px | Major page divisions |

---

## 5. Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Input fields, small badges |
| `rounded-md` | 8px | Buttons, form controls |
| `rounded-lg` | 12px | Cards, panels |
| `rounded-xl` | 16px | Modal dialogs |
| `rounded-full` | 9999px | Avatar circles, pill badges |

---

## 6. Shadow System

```css
/* Subtle card shadow */
shadow-card: 0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06);

/* Elevated panel shadow */
shadow-panel: 0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.08);

/* Modal shadow */
shadow-modal: 0 20px 60px rgba(0,0,0,0.20);

/* Gold glow — for champion/winner elements */
shadow-gold: 0 0 20px rgba(201,168,76,0.30), 0 4px 12px rgba(0,0,0,0.10);

/* Green glow — for active/confirmed elements */
shadow-green: 0 0 12px rgba(27,94,55,0.25);
```

---

## 7. Layout System

### App Shell Layout

```
┌──────────────────────────────────────────────────────┐
│  Header (64px tall): Event title + current mode      │
├────────────┬─────────────────────────────────────────┤
│  Sidebar   │  Main Content Area                      │
│  (240px)   │  (flex-1, scrollable)                   │
│            │                                          │
│  Nav items │  Page content renders here               │
│            │                                          │
└────────────┴─────────────────────────────────────────┘
```

### Content Grid & Full Canvas Space Utilization

- Main content uses a **12-column grid** with 24px gutters.
- Dashboard cards use a **responsive 2-col to 4-col** auto-fit grid.
- **Admin Configuration Pages (e.g., Event Setup, Criteria Setup):**
  - **No Narrow Isolated Cards:** Avoid constraining main forms to `max-w-2xl` on widescreen desktop monitors, which leaves awkward empty dead space.
  - **2-Column Bento Standard:**
    - **Primary Panel (Left ~65%):** Master form controls, organized fieldsets, and primary submit action.
    - **Live Hub / Summary Panel (Right ~35%):** Live event preview card, quick connection hub with dynamic QR code & copyable judge link, and system readiness metrics.
- Scoring sheet uses a **split layout**: Candidate info (left 40%) + Criteria form (right 60%).

---

## 8. Component Specifications

### 8.1 App Shell Header & Dynamic Branding

```
Height: 64px, fixed, border-bottom 1px solid color-neutral-200, background #FFFFFF
Layout: flex, justify-between, items-center, px-8

Left — Dynamic Event Brand:
  - Text: Dynamic value from AppContext (state.eventConfig.name)
  - Fallback: "PageantTabulator" if uninitialized
  - Font: Inter 600, 16px, color-neutral-900
  - Subtitle Badge (optional): Inter 400, 13px, color-neutral-400 (e.g. "Coronation Night")

Right — Interactive LAN Status Pill:
  - Background: color-primary-100 (#E8F5EE) or neutral-100
  - Text: color-primary-900 / color-neutral-700, 13px, font-medium
  - Indicator: 6px circular green dot (status-live)
  - Value: Active host LAN IP & Port (e.g. "LAN: 192.168.1.45:3000")
  - Actions: 1-click URL copy button + QR Code modal launcher
```

### 8.2 Sidebar Navigation

```
Background: color-primary-900 (#0D3320)
Width: 240px, fixed, not collapsible in v1

Nav Item (default):
  - Text: color-neutral-300 (14px, Inter 400)
  - Icon: color-primary-500
  - Padding: 12px 20px
  - Border-radius: 8px (inner)

Nav Item (active):
  - Background: color-primary-800 (#1B5E37)
  - Text: #FFFFFF
  - Icon: color-gold-500
  - Left border: 3px solid color-gold-500

Nav Item (hover):
  - Background: rgba(255,255,255,0.06)
  - Transition: 150ms ease
```

### 8.2 Primary Button

```
Background: color-primary-800 (#1B5E37)
Text: #FFFFFF, 14px, Inter 600
Padding: 10px 20px
Border-radius: 8px
Border: none

Hover:
  - Background: color-primary-700 (#236B41)
  - Transform: translateY(-1px)
  - Box-shadow: shadow-green
  - Transition: 200ms ease

Active:
  - Transform: translateY(0)
  - Background: color-primary-900

Disabled:
  - Background: color-neutral-300
  - Text: color-neutral-500
  - Cursor: not-allowed

Loading/Pending:
  - Background: color-primary-800 (opacity 80%)
  - Text: #FFFFFF, 14px, Inter 600
  - Content: Replaced by or preceded by a spinning inline SVG indicator
  - Cursor: wait or not-allowed
```

### 8.3 Gold Accent Button

```
Background: color-gold-500 (#C9A84C)
Text: color-neutral-900, 14px, Inter 700
Padding: 10px 20px
Border-radius: 8px
Box-shadow: shadow-gold

Hover:
  - Background: color-gold-400
  - Box-shadow: 0 0 24px rgba(201,168,76,0.50)
```

### 8.4 Card

```
Background: #FFFFFF
Border: 1px solid color-neutral-300
Border-radius: 12px
Padding: 24px
Box-shadow: shadow-card

Card Header:
  - Background: color-primary-800
  - Text: #FFFFFF, 16px, Inter 600
  - Padding: 16px 24px
  - Border-radius: 12px 12px 0 0
```

### 8.5 Score Input Field

```
Width: 80px (fixed, for score number)
Height: 44px
Background: #FFFFFF
Border: 2px solid color-neutral-300
Border-radius: 6px
Text: 20px, Inter 700, text-center, tabular-nums
Color: color-neutral-900

Focus:
  - Border: 2px solid color-primary-800
  - Box-shadow: 0 0 0 3px rgba(27,94,55,0.15)

Valid (score entered, passes validation):
  - Border: 2px solid color-success

Error (out of range, non-numeric):
  - Border: 2px solid color-error
  - Background: #FFF5F5
```

### 8.6 Ranking Table

```
Table Layout: fixed
Header Row:
  - Background: color-primary-800
  - Text: #FFFFFF, 12px, Inter 700, uppercase, tracking-wide
  - Padding: 12px 16px

Body Row (default):
  - Background: #FFFFFF
  - Border-bottom: 1px solid color-neutral-100

Body Row (zebra):
  - Background: color-neutral-100

Body Row (Rank 1 — Champion):
  - Background: color-gold-100 (#FBF5E6)
  - Left border: 4px solid color-gold-500
  - Score text: color-gold-600, font-weight 700

Body Row (Top 5):
  - Left border: 3px solid color-primary-500

Rank Badge:
  - #1 → Gold circle bg: color-gold-500
  - #2 → Silver circle bg: #A8A9AD
  - #3 → Bronze circle bg: #CD7F32
  - #4–#5 → color-primary-100
```

### 8.7 Status Badge

```
Submitted:  bg-green-100, text-green-700, border-green-300
Pending:    bg-yellow-100, text-yellow-700, border-yellow-300
Locked:     bg-gray-100, text-gray-600, border-gray-300
Error:      bg-red-100, text-red-700, border-red-300
```

### 8.8 Modal Dialog

```
Backdrop: rgba(0,0,0,0.60), backdrop-filter: blur(4px)
Container:
  - Background: #FFFFFF
  - Border-radius: 16px
  - Padding: 32px
  - Max-width: 480px
  - Box-shadow: shadow-modal
  - Animation: scale-in 200ms ease

Header:
  - Font: Inter 20px, color-neutral-900, font-weight 600
```

### 8.9 Toast Notification (Global System Feedback)

```
Position: Bottom-Right (bottom-6 right-6)
Container:
  - Background: #FFFFFF
  - Border-left: 4px solid [semantic color]
  - Border-radius: 8px
  - Box-shadow: shadow-panel
  - Padding: 16px
  - Width: 320px
  - Animation: slide-in-right 300ms ease-out

Semantic Variants:
  - Success: border-l-success, icon color-success
  - Error: border-l-error, icon color-error
  - Warning: border-l-warning, icon color-warning
  - Info: border-l-info, icon color-info
```

---

## 9. Animation & Transitions

| Use Case | Duration | Easing |
|----------|----------|--------|
| Button hover | 150ms | ease |
| Nav item hover | 150ms | ease |
| Modal open | 200ms | ease-out |
| Card hover lift | 200ms | ease |
| Score submission | 300ms | ease-in-out |
| Rank change animation | 500ms | ease-in-out |
| Page transition (fade) | 250ms | ease |
| Confetti on winner (CSS) | 1500ms | ease-out |

All transitions use `will-change: transform` or `will-change: opacity` to hint GPU acceleration.

---

## 10. Iconography

Use **Lucide React** (`lucide-react`) for all icons.  
Icon size: 16px (small), 20px (default), 24px (large).  
Icon color inherits from parent text color unless overridden.

Key icon mappings:

| Context | Lucide Icon |
|---------|------------|
| Dashboard | `LayoutDashboard` |
| Candidates | `Users` |
| Criteria | `ClipboardList` |
| Judge Status | `UserCheck` |
| Scoring Input | `PenLine` |
| Final Reports | `FileText` |
| Export PDF | `Download` |
| Lock Round | `Lock` |
| Champion | `Trophy` |
| Star Rating | `Star` |
| Recalculate | `RefreshCw` |
| Warning | `AlertTriangle` |
| Check | `CheckCircle2` |

---

## 11. TailwindCSS Configuration Extensions

```javascript
// tailwind.config.js extensions
theme: {
  extend: {
    colors: {
      primary: {
        900: '#0D3320',
        800: '#1B5E37',
        700: '#236B41',
        600: '#2D7E50',
        500: '#3A9162',
        100: '#E8F5EE',
      },
      gold: {
        600: '#9A7020',
        500: '#C9A84C',
        400: '#D4B96B',
        100: '#FBF5E6',
      },
      parchment: '#F9F6F0',
    },
    fontFamily: {
      sans: ['Inter', 'system-ui', 'sans-serif'],
      display: ['Playfair Display', 'Georgia', 'serif'],
    },
    boxShadow: {
      card: '0 1px 3px rgba(0,0,0,0.08), 0 4px 12px rgba(0,0,0,0.06)',
      panel: '0 4px 16px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.08)',
      modal: '0 20px 60px rgba(0,0,0,0.20)',
      gold: '0 0 20px rgba(201,168,76,0.30), 0 4px 12px rgba(0,0,0,0.10)',
      green: '0 0 12px rgba(27,94,55,0.25)',
    },
  },
},
```

---

## 12. Responsive Breakpoints

The app is designed primarily for **desktop (laptop) use** for the Admin panel, and tablet/mobile for the Judge Web View. There is no mobile admin view.

| Breakpoint | Width | Use Case |
|-----------|-------|----------|
| `lg` | 1024px | Minimum supported width |
| `xl` | 1280px | Default laptop target |
| `2xl` | 1536px | Large monitors |
| `4xl` (custom) | 1920px | Extra large screens |

---

*Design System Version: 1.0 — August 20, 2026*
