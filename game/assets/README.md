# game/assets/ — drop art here

This folder receives the painted sprites from Makko (or any artist).

- **The full commission sheet is [`../ART_SPEC.md`](../ART_SPEC.md)** — filenames,
  sizes, anchors, states, palette, and delivery priority.
- Any correctly named PNG placed here replaces its greybox placeholder on the next
  page load. No code changes needed.
- Missing files are fine — the game silently falls back to greybox per asset.
