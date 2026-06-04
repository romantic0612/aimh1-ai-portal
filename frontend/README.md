# AIMH1 Vue Frontend Workspace

This directory is the new Vue workspace for the framework migration.

The current production UI is still the existing packaged output in `../dist/`.
Do not replace it until each page has been rebuilt and visually checked against the current portal.

Useful commands:

```bash
npm install
npm run dev
npm run build
```

Build output goes to `../dist-vue` so it cannot overwrite the current `dist/` by accident.
