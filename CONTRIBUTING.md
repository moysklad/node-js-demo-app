# Contributing

Thanks for your interest in improving this demo project.

## Scope

This repository is a reference/demo integration for MoySklad Vendor API 1.0.
Changes should stay practical, small, and aligned with the current architecture.

## Development

1. Install dependencies:
   - `npm ci`
2. Run type checks and tests:
   - `npm run check`
3. Build:
   - `npm run build`
4. Run local app:
   - `npm run dev`

## Pull Requests

- Keep PRs focused: one topic per PR.
- Include a short description of behavioral changes.
- Mention any environment variables or deployment-side changes.
- If relevant, include request/response examples for Vendor API routes.

## Code Style

- Follow existing TypeScript/Express patterns in this repository.
- Browser UI is built with `@moysklad/uikit` only (see "UI Kit" in README.md); do not add custom CSS beyond `src/features/entry/ui/theme.css`.
- Prefer explicit, defensive handling of external input.
- Avoid broad refactors not required by the current task.
