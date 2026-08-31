---
name: release-checklist
description: Use when preparing a build for judge/admin devices before an event.
---

# Release Checklist (PageantTabulator)

Follow these steps precisely before deploying the build to live event devices. This checklist is designed for high-pressure, day-of-event deployment.

## 1. Code Verification
Run the following checks to ensure a clean build:
- `cargo check --manifest-path src-tauri/Cargo.toml`
- `cargo test --manifest-path src-tauri/Cargo.toml`
- `npm run build`

## 2. Network Configuration
- **Check Server Binding:** Ensure the axum server is bound to `0.0.0.0` (not `127.0.0.1`), allowing external devices to connect.
- **Verify Venue Setup:** Cross-check the network and firewall configurations documented in `docs/scoped/network-server.md`.

## 3. Fallback System Testing
- **Manual Score Entry:** Open the Admin Dashboard and verify that the "Manual Score Entry" feature works. This is the critical fallback if a judge's device permanently disconnects during a segment.

## 4. Live Device Testing
Connect at least one actual external judge device to the host network and verify:
- **Connectivity:** Can the device successfully load the app?
- **WebSocket Reconnection:** Does the judge's session and UI state restore automatically if the device drops and reconnects to WiFi?
- **Layout:** Does the scoring form fit properly on the device screen without awkward scrolling?
