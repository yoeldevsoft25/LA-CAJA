# Conflict Resolution UX Decisions

This document outlines the design principles and technical rules for the conflict resolution experience in LA CAJA.

## Design Principles

1. **Clarity over Complexity**: Do not overwhelm the user with raw JSON. Show human-readable labels and clear diffs.
2. **"World-Class" Aesthetics**: Use the Velox design system (vibrant colors, smooth transitions, premium typography).
3. **Safety First**: Clearly indicate which version is "Mine" (Local) and which is "Server" (Truth).
4. **Actionable Guidance**: Suggest an action based on the conflict type (e.g., "The server has a newer price for this product").

## Comparison Rules

### 1. Data Diffing
We compare the `payload` of the local event with the current state in the server (if available via `conflicting_with` metadata).
- **Added fields**: Highlight in green.
- **Removed fields**: Highlight in red strikethrough.
- **Changed values**: Show as `Old Value → New Value`.

### 2. Auto-Resolution (Silent)
- **Non-conflicting Vector Clocks**: If the clocks are concurrent but touch different entities or fields with no overlap, an "Assisted Merge" can be attempted.
- **Server Wins (Default)**: For trivial metadata conflicts or background syncs that don't affect user-facing state directly.

### 3. Manual Resolution (Guided)
- **"Keep Mine"**: Overwrite the server with local changes. This forces a new event with an incremented vector clock.
- **"Take Theirs"**: Discard local changes and adopt the server version.
- **"Merge"**: Apply local changes that don't conflict and keep server changes for the rest.

## UX Telemetry

To measure the effectiveness of the resolution flow, we track:
- `conflict_detected`: Triggered when the server returns a 409/Conflict response.
- `conflict_opened`: User clicks to see conflict details.
- `resolution_selected`: User clicks "Keep Mine", "Take Theirs", or "Merge".
- `resolution_success`: The resolution event was successfully accepted by the server.
- `resolution_failure`: Final error in resolution.
