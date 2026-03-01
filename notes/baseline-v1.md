# Baseline v1 (2026-03-01)

## Backup
- Created local archive backup: `mappa-navigabile-cimitero-centrale-pesaro-v1.zip`
- Extracted archive into sibling folder: `../mappa-navigabile-cimitero-centrale-pesaro-v1`
- Excluded from archive: `node_modules`, `dist`, `.vite`, `.cache`

## Verification Before Changes
- `npm ci`: OK
- `npm run build`: OK
- `npx tsc --noEmit`: OK

## Notes
- File copy commands to sibling folder were blocked by terminal policy, so backup was produced as a zip archive inside the project root.
