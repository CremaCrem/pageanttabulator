# Admin UX/UI Specification (Audit & Action Plan)

This document serves as the definitive source of truth for the UX/UI design system and implementation plan for the Admin interface of the PageantTabulator application.

## 1. Goal and Philosophy
The PageantTabulator Admin interface is a mission-critical tool used by event operators under high pressure. The design must embody a **calm, precise, ceremonial, and trustworthy** aesthetic. It must be highly functional, minimizing cognitive load and interaction costs. 

*   **Consistency Over Cleverness**: Prefer one predictable interaction pattern used everywhere over several individually clever patterns.
*   **Do Not Overdesign**: Avoid unnecessary glassmorphism, excessive gradients, animation, giant typography, or generic SaaS dashboard patterns. The interface must not compete with tabulation data.
*   **Design Rationale**: Every UI decision should answer:
    *   What does this action mean?
    *   What does the user need to know right now?
    *   What could go wrong?
    *   How can we make the correct action obvious?
    *   Can the operator perform this repeatedly without unnecessary friction?
    *   Does this still feel like PageantTabulator?

---

## 2. Quality Bar
Before an Admin UI change is considered complete, it must satisfy the following criteria:

*   **Visual**: Consistent typography, consistent spacing, semantic colors, aligned containers, no overflow, predictable responsive behavior.
*   **Interaction**: Clear action labels, appropriate confirmation, visible loading states, duplicate submission prevention, success/error feedback, recoverable errors.
*   **Accessibility**: Keyboard usable, visible focus rings, logical Tab order, color is not the only source of meaning, sufficient contrast, appropriate labels.
*   **Reliability**: No silent failed mutations, no accidental destructive actions, uploads cannot race with entity creation, user input is not silently discarded.
*   **Product Identity**: The application retains its Forest Green/Gold identity and ceremonial typography remains special.

---

## 3. Typography Strategy

### Inter (Operational)
Inter is the default typeface for the Admin application. It makes the interface feel precise and operational.
Use it for:
*   Navigation and page titles
*   Section headings and labels
*   Buttons, inputs, and tables
*   Status text, dialogs, and administrative data
*   Helper text and error messages

### Playfair Display (Ceremonial)
Playfair Display is a **ceremonial/display typeface**, not the default Admin heading font. It makes selected moments feel special.
Reserve it for:
*   Event branding and ceremonial headings
*   Winner/champion presentations
*   Major pageant moments and selected presentation/projection content
*   *(Do NOT globally apply Playfair Display to every `h1`, `h2`, or `h3`)*

---

## 4. Design Token Strategy & Semantic Colors
A color represents meaning, not visual preference. The application uses a semantic token strategy instead of hardcoded utility classes. (Implementation may use CSS variables or Tailwind tokens).

### 4.1 Semantic Palette Rules
*   **Green (Success/Action)**
    *   *Appropriate*: Save, Apply, Continue, Update, Reinstate, Successful operation.
    *   *Not appropriate*: Delete, Reset, Irreversible actions.
*   **Red (Destructive/Error)**
    *   *Appropriate*: Delete, Reset, Disqualify, Irreversible destructive action, Error.
    *   *Not appropriate*: Normal Save, Normal confirmation, Generic important action.
*   **Gold (Ceremonial/Special)**
    *   *Appropriate*: Ceremonial significance, championship/winner moments, special event status, carefully selected premium/official moments.
    *   *Not appropriate*: Every primary button, every heading, every card.
*   **Amber/Warning**
    *   *Appropriate*: Pending, attention required, potentially risky but not necessarily destructive.
*   **Blue/Info**
    *   *Appropriate*: Informational status, system information, non-error guidance.
*   **Neutral**
    *   *Appropriate*: Cancel, secondary actions, passive controls, supporting UI.

*(Note: Red and Green must never be chosen merely because a button needs to be prominent.)*

---

## 5. Interaction & Feedback Semantics

### 5.1 Action Language & Button Copy
Every action label should describe exactly what will happen. Avoid vague labels (e.g., Submit, Confirm, Proceed, Okay, Done).
*   *Prefer*: Save Changes, Add Candidate, Update Judge, Save Criteria, Disqualify Candidate, Reinstate Candidate, Reset Event, Generate Report.
*   *Consistency*: The same action should keep consistent wording throughout its flow (e.g., Button: "Save Changes" → Toast: "Changes saved").

### 5.2 Mutation & Submission Safety
Operations that change data must follow a standard, safe lifecycle:
`Idle → Submitting / Saving → Success or Error`
*   Disable duplicate submissions.
*   Communicate the busy state (e.g., changing button label).
*   Preserve user input unless the operation succeeds.
*   Restore the appropriate state after success/error.

### 5.3 Confirmation Modals
The visual treatment of a modal must communicate the semantic risk of the action.
*   **Normal**: e.g., "Save Changes" → Normal primary treatment.
*   **Warning**: e.g., "Close Event" → Warning/contextual treatment.
*   **Destructive**: e.g., "Reset Event", "Disqualify Candidate" → Red/destructive treatment.
*   **Positive/Reversible**: e.g., "Reinstate Candidate" → Normal primary/success-oriented treatment.
*(Action importance ≠ Action danger ≠ Action success).*

### 5.4 Toast vs. Inline Feedback
The existing `ToastContext` infrastructure should be extended, not replaced.
*   **Success Toast**: Successful background mutation, candidate created/updated, judge/criteria updated, event settings updated, candidate reinstated.
*   **Info/Warning Toast**: Informational events, pending status.
*   **Inline/Field-level Error**: Validation problems (e.g., "Candidate number already exists" should appear near the field, not as a disappearing toast).
*   **Modal**: Confirmation before destructive operations.
*   *(Toasts should NOT replace validation feedback.)*

### 5.5 Dirty/Unsaved State Handling
Never silently discard meaningful user input. When navigating away from forms with unsaved changes (e.g., Setup, Candidate editing, Criteria), prompt the user:
`Unsaved Changes: You have changes that haven't been saved. [Keep Editing] [Discard Changes]`

---

## 6. Workflows & Ergonomics

### 6.1 Candidate Workflow
Optimize for repetitive entry without making assumptions that candidate numbers are always sequential.
*   **Primary Action**: Save Candidate
*   **Secondary Action**: Save & Add Another
*   *Save & Add Another Flow*:
    1. Save current candidate and show success toast.
    2. Keep creation interface open and clear candidate-specific fields.
    3. Suggest next candidate number (must remain editable) and preserve useful repeated fields.
    4. Clear the photo field (never carry previous photo).
    5. Focus the next logical field (e.g., Candidate Name).

### 6.2 Image Upload State Machine & Layout
The photo field must behave like a normal form field, not an independent floating object (contained, predictable aspect ratio, consistent border radius, no overflow).
**State Machine:**
`Empty → Selecting → Uploading → Uploaded` (with a recoverable `Failed` state).
*   **Uploading**: Show visible progress. Prevent form submission if the image is required.
*   **Uploaded**: Clearly show the image is ready. Candidate submission becomes valid.
*   **Failed**: Explain failure, provide a Retry option, prevent form submission if required.

### 6.3 Desktop Interaction & Keyboard Behavior
Keyboard shortcuts should make the interface faster without increasing accidental destructive operations.
*   **Escape**: `Esc` should dismiss/cancel a modal where dismissal is safe.
*   **Enter**: `Enter` should activate the currently focused/default action. For forms, `Enter` submits the form. For destructive confirmations, `Enter` activates the *currently focused action* (do not globally force Enter to execute destructive actions).
*   **Focus**: Visible `:focus-visible` states, logical Tab order, focus enters a modal upon opening and returns to the triggering element upon closing.

### 6.4 Loading & Empty States
*   **Loading**: 
    *   *Initial page load*: Consistent page-level loading treatment.
    *   *Mutation*: Button-level loading (`Save Changes → Saving...`).
    *   *Long-running*: Determinate progress where available (no fake progress).
    *   *Note*: Loading feedback should appear immediately and not block unrelated work.
*   **Empty States**: Intentional messaging communicating *what* is empty, *why*, and *what to do next*. Avoid generic text like "No candidates found." (e.g., "No candidates yet. Add the first candidate to begin building the roster.")

### 6.5 Form Design Rules
*   Use clear label hierarchy, helper text, and identify required fields.
*   Errors must explain the problem in operational language (e.g., "Candidate number 12 is already in use" instead of "SQLITE_CONSTRAINT_UNIQUE").
*   Ensure consistent field heights, spacing, and logical grouping of related fields.

---

## 7. Implementation Phasing

### Phase 1 — Foundation
*Focus on reusable design/interaction primitives without redesigning every page.*
*   Define semantic design tokens.
*   Standardize Button variants, form-control states, and Alert components.
*   Standardize the Toast system (using existing infrastructure).
*   Standardize Modal/ConfirmModal behavior (footers, danger levels).
*   Implement PageLoader, EmptyState, and shared status semantics.
*   Audit focus behavior and accessibility basics.

### Phase 2 — Admin Consistency
*Apply the foundation consistently across all views.*
*   Setup, Candidates, Judge Status, Criteria, Dashboard, Reports, Results, History, Diagnostics.

### Phase 3 — Workflow Optimization
*Focus on operational ergonomics.*
*   Implement "Save & Add Another" and candidate number suggestions.
*   Enforce the image upload state machine (upload failure/retry, submission locking).
*   Implement dirty-state handling where justified.
*   Optimize Manual Score Entry for keyboard and rapid data-entry.

---
*Note: Confirmed (observed in repo), Inferred (suggested by code but needs verification), Recommendation (proposed future improvement).*
