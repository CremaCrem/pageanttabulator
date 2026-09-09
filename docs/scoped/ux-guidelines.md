# UX Guidelines — PageantTabulator

> **Event:** Mr. and Ms. IDSC 2026 — IDSC 18th Founding Anniversary Celebration  
> This document defines the interaction rules, feedback loops, and user experience (UX) laws governing the PageantTabulator system.

---

## 1. UX Laws & Principles

### 1.1 Visibility of System Status (Doherty Threshold)
**Rule:** The system must always keep users informed about what is going on, through appropriate feedback within reasonable time (< 400ms).
- **Asynchronous Operations:** Any action that touches the Rust backend or network (e.g., Score Submit, PDF Export, Lock Segment) MUST trigger an immediate local loading state.
- **Button Micro-States:** 
  - **Idle:** Normal interactive state.
  - **Loading/Pending:** Button text changes to a gerund (e.g., "Exporting...", "Submitting..."), an inline spinner appears, and the button becomes visually disabled but maintains its physical dimensions to prevent layout shift.
  - **Success:** Brief (1.5s) inline confirmation state (e.g., "Exported!" with a Check icon) before returning to Idle or disabling permanently.
  - **Disabled:** Visually grayed out (`bg-neutral-300`, `text-neutral-500`) with `cursor-not-allowed` to indicate the action is currently unavailable.

### 1.2 Familiarity and Expectations (Jakob’s Law)
**Rule:** Users expect systems to work the way other standard enterprise applications do.
- **Feedback:** "Black hole" interactions (clicking a button and seeing nothing happen) are strictly prohibited.
- **Global Toasts:** System-wide events, errors, and successes must be communicated via a standardized Toast Notification System.

---

## 2. Global Toast Notification System

Toasts are transient, non-modal alerts used to confirm asynchronous operations or notify the user of background system events.

### 2.1 Toast Specifications
- **Placement:** Bottom-Right corner of the screen (`bottom-6 right-6`), stacked vertically with the newest on top.
- **Entry Animation:** Slide in from the right (`slide-in-right`) over 300ms.
- **Exit Animation:** Fade out and slide down over 250ms.
- **Duration:** 
  - Success/Info: 4000ms
  - Warning/Error: 7000ms (to ensure readability of technical errors)
- **Dismissibility:** All toasts must have a manual `X` close button. Hovering over a toast pauses the auto-dismiss timer.

### 2.2 Toast Variants
| Variant | Icon (Lucide) | Colors | Usage |
|---------|---------------|--------|-------|
| **Success** | `CheckCircle` | Green border, green icon | Score submitted, Export successful |
| **Error** | `AlertOctagon` | Red border, red icon | Validation failure, Network error |
| **Warning** | `AlertTriangle`| Yellow border, yellow icon | Admin warning, connectivity drop |
| **Info** | `Info` | Blue border, blue icon | System events, segment opened |

---

## 3. System Message Handling (WebSocket)

The system relies on real-time WebSocket events to keep all devices synchronized without manual refreshes.

### 3.1 Unhandled `SYSTEM_MESSAGE` Events
Currently, `SYSTEM_MESSAGE` broadcasts from the backend (e.g., "Round Locked", "Export Ready", "Judge Reconnected") are dropped by the frontend. 
**Specification:**
- `AppContext.tsx` MUST subscribe to the `SYSTEM_MESSAGE` action type.
- Upon receiving a `SYSTEM_MESSAGE`, the context must immediately dispatch a Global Info or Warning Toast displaying the payload message.
- **Example Flow:**
  1. Admin locks the preliminary round via Tauri.
  2. Server broadcasts `{"type": "SYSTEM_MESSAGE", "message": "Preliminary Round Locked by Admin"}`.
  3. Judge browsers receive WS event, `useWebSocket` hook dispatches to `AppContext`.
  4. AppContext triggers a toast: *"Preliminary Round Locked by Admin"* on all connected clients instantly.

---

*UX Guidelines Version: 1.0 — August 2026*
