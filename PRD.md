# Product Requirements Document (PRD) — PageantTabulator

**Project:** Official Tabulation System — Mr. and Ms. IDSC 2026  
**Event Date (held):** September 10, 2026  
**Location:** Ligao City Gymnasium  
**Status:** Post-Event / Maintenance & Feature Additions

---

## 1. Product Overview

### 1.1 What We Are Building
**PageantTabulator** is a purpose-built, offline-capable, local hub-and-spoke desktop application for the live tabulation of the Mr. and Ms. IDSC 2026 pageant. It provides a secure, digital scoring system that replaces manual paper-and-spreadsheet calculations.

### 1.2 Why We Are Building It
Event tabulations are mission-critical. Errors or delays in calculations affect real students and the institution's integrity. Manual calculations are prone to human error and tampering. This application ensures:
- **Mathematical Accuracy:** 100% adherence to the official IDSC scoring rules.
- **Data Integrity:** A single source of truth (SQLite) on the admin's machine, eliminating reliance on vulnerable browser local storage or cloud connections that fail during venue internet outages.
- **Real-Time Efficiency:** Immediate scoring feedback, live leaderboards for the audience, and instant PDF report generation for the judging committee.

---

## 2. Target Audience & User Personas

1. **The Admin / Tabulator (Primary User)**
   - **Environment:** Tauri desktop app on the host laptop. 
   - **Role:** Responsible for event setup, unlocking/locking scoring segments, monitoring judge progress, resolving ties, and generating official results.

2. **The Judges (Up to 10)**
   - **Environment:** Web browser on their own laptops/tablets connected to the local WiFi. 
   - **Role:** Select their assigned judge slot and submit scores (1-100) for candidates per segment.

3. **The Audience / Host (Viewers)**
   - **Environment:** Web browser projected onto a large screen (`/projection` route). 
   - **Role:** View the live, read-only rankings and candidate progress.

---

## 3. Core Requirements

### 3.1 Architecture & Access Requirements
- **Local Server Hosting:** The admin app runs a local axum HTTP/WebSocket server bound to `0.0.0.0`. Judges and Viewers connect via the venue's local WiFi.
- **No Internet Dependency:** The system must function 100% offline. No cloud APIs, no external CDNs.
- **Strict Role-Based Access:** 
  - Admin access is inherently gated by the Tauri desktop environment (`window.__TAURI__`).
  - Judge access is via browser, identifying via session state.
  - Irreversible admin actions (locking segments, resolving ties, overriding scores) require a 4-6 digit PIN.
- **Idempotency & Crash-Safety:** If a judge re-submits due to a network retry, or the admin restarts the server, no data is lost or duplicated. All authoritative state lives in SQLite.

### 3.2 Scoring System Requirements (Resolved)
- **Scoring Methodology:** The main pageant uses Ranking-Based (Borda Count) scoring. Judges' raw scores (1-100) are used only to rank candidates per judge, per segment. The candidate with the lowest sum of ranks across judges wins the placement. Raw score sums are used as tie-breakers.
- **Phase 1 (Preliminary Round - 50% of Final Score):** 
  - A composite of five equally weighted segments (20% each): 
    1. Production Number
    2. School Uniform
    3. Professional Attire
    4. Modern Barong/Filipiniana
    5. Preliminary Q&A
  - Determines the Top 3 Male and Top 3 Female candidates using the combined preliminary ranks.
- **Phase 2 (Final Round - 50% of Final Score):** 
  - Final Q&A for the Top 3 (also scored via Borda count).
- **Championship Rule:** Final Winners (Top 3) are determined by `(Preliminary Rank * 0.5) + (Final Q&A Rank * 0.5)`.
- **Dynamic Tie-Breaking:** Tie-breaking is handled via two strictly distinct mechanisms:
  - **Preliminary Boundary Ties (Top 3 Selection):** If a mathematical tie occurs at the Top 3 cutoff boundary (any number of tied candidates), the system pauses and forces an offline, PIN-protected manual admin override to select who advances. This decision is saved permanently to the `stage_resolutions` table. No scoring segment is opened.
  - **Championship/Finals Ties:** If the confirmed Top 3 finalists perfectly tie on their 50/50 Championship score, the system automatically flags them and exposes a conditional scoring segment (`TieBreakingQA`) scoped only to the tied finalists.
- **Event Day Contingencies:** 
  - **Printable Blank Score Sheets:** The Admin can proactively generate a PDF backup per judge per segment anytime. This PDF contains a blank grid (matching the official design system) for handwritten scores.
  - **Manual Score Entry:** The Admin dashboard features a "Manual Score Entry" screen. The admin selects a judge and segment, then inputs their criterion scores. This action requires the Admin PIN and strictly enforces normal judge validation (1-100 integers). Once saved, the data is indistinguishable from a normal judge submission for computation purposes.

### 3.3 Special Awards Requirements
- System must automatically derive specific awards from segment rankings:
  - *Best in Production Number, School Uniform, Professional Attire, Modern Barong / Filipiniana* (Lowest sum of ranks for the segment).
  - **Minor Award Segments:** *Best in Advocacy* and *Best in Ramp* are scored concurrently with *School Uniform* and *Modern Barong/Filipiniana*, respectively. They are scored by **Ranking-Based (Borda Count)** but are excluded entirely from the preliminary composite.
- System must allow manual entry by the Admin for external awards (e.g., People's Choice, Mr./Ms. Congeniality, Spirit Award).

### 3.4 Export & Reporting
- Generate PDF and CSV exports server-side for official record-keeping.
- Reports must include event name, date, category, candidate number, name, department, all segment ranks, raw scores, preliminary rank, final rank, and placement.

---

## 4. User Flows

### 4.1 Setup & Registration Flow (Admin)
1. Admin launches the Tauri app.
2. Enters event configuration (Event name, Judge count).
3. Registers candidates (Name, Department, Gender).
4. System displays a local IP QR code/URL for Judges to join.

### 4.2 Scoring Flow (Judge)
1. Judge connects to `http://<ADMIN_IP>:3000` on their device.
2. Selects their Judge Number (e.g., Judge 1).
3. Waits for Admin to open a segment.
4. Navigates through candidates, entering 1-100 integer scores for each criterion.
5. Views live cosmetic weighted score, clicks "Submit Final Score" (locks input for that candidate/segment).
6. Repeats until all candidates are scored for the segment.

### 4.3 Segment Progression Flow (Admin)
1. Admin monitors the Judge Progress matrix via WebSocket.
2. Once all judges reach 100% submission, Admin clicks "Lock Segment".
3. Admin enters PIN to confirm.
4. System computes ranks for the segment in Rust and stores in SQLite.
5. Admin opens the next segment.

### 4.4 Top 3 & Final Winner Flow (Admin)
1. After the 5 Preliminary segments conclude, Admin triggers Top 3 calculation.
2. System filters Top 3 Male and Female based on Borda count. If a mathematical tie occurs at the 3rd position boundary, the system pauses and forces a PIN-protected manual admin override to select who advances (persisted to `stage_resolutions`).
3. Top 3 proceed to Final Q&A segment.
4. Judges score Final Q&A.
5. Admin triggers Final Results computation (50/50 rule).
6. Winners are revealed and PDF reports are exported.

---

## 5. Acceptance Criteria

- **AC1:** Server successfully binds to `0.0.0.0` and can serve the React build to external devices on the same WiFi network.
- **AC2:** Scores submitted by judges are successfully written to the SQLite database and survive a hard crash of the admin app.
- **AC3:** A judge cannot submit a score outside the 1-100 range, nor can they submit if a segment is locked.
- **AC4:** The Preliminary rank correctly combines the 5 segments at 20% each to calculate the composite preliminary rank.
- **AC5:** The Top 3 selection strictly isolates Male and Female categories, uses Borda count scoring, and forces a PIN-protected manual admin override (persisted permanently) to resolve Top 3 boundary ties offline without a scoring segment.
- **AC6:** The Final Champion calculation strictly adheres to the `(Prelim Rank * 0.5) + (Final Q&A Rank * 0.5)` formula. Any ties at this championship level trigger a dynamic `TieBreakingQA` segment scoped only to the tied finalists.
- **AC7:** "Best in Advocacy" and "Best in Ramp" are concurrently scored with their parent segments and use Ranking-Based scoring, completely isolated from the preliminary ranking composite.
- **AC8:** The "Manual Score Entry" feature allows the admin to input criteria scores on behalf of a judge, validates input identically to the judge view, requires the Admin PIN to save, and seamlessly feeds into standard computation.
- **AC9:** Admin irreversible actions (locking segments, manual score overrides, tie-breaking) prompt for and successfully validate the Admin PIN.
- **AC10:** The system can generate Printable Blank Score Sheets (PDF) per judge per segment that visually adhere to the established final-results design system.
