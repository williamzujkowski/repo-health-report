# Contributing

## Development

```bash
npm install
npx tsc          # Build
npm test         # Run tests (120)
npm run batch    # Run batch analysis
npm run debrief  # Run lessons-learned debrief
npm run export   # Generate dashboard JSON
```

## Commit Convention

We use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` — new feature
- `fix:` — bug fix
- `refactor:` — code restructuring
- `docs:` — documentation
- `test:` — tests
- `chore:` — maintenance

## Adding a New Check

1. Choose the right dimension (Security, Testing, Docs, Architecture, DevOps, Maintenance)
2. Add a detector in `src/detectors.ts` if it's a multi-ecosystem pattern
3. Add the finding in the dimension file with `name`, `passed`, `detail`, `weight`
4. Add tests
5. Run against a known repo to verify

## Adding a New Language

1. Add mapping in `LANGUAGE_MAP` in `src/analyze.ts`
2. Add check function in `src/dimensions/architecture.ts`
3. Add to `LANGUAGE_CHECKS` dispatch table
4. Test against a known repo of that language
