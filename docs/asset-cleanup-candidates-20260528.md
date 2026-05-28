# Asset Cleanup Candidates - 2026-05-28

This is a review list only. No asset file has been deleted or moved.

Rules:

- Do not delete files directly referenced by `dist/index.html`.
- Do not bulk-delete files.
- If deletion is approved, delete one explicit file at a time.
- After each deletion batch, verify `/mobile`, `/chat`, and `/mobile/rank`.

## Active Files Referenced By dist/index.html

These files are currently loaded by the app entrypoint. Do not delete.

### Base / Desktop

```text
index-productized-20260525a.css
index-productized-overrides-20260525a.css
markdown-render-dify-lite-20260513d.js
```

### Current Main App Bundle

```text
index-mobile-home-frame-20260528i.js
index-mobile-home-frame-20260528i.css
```

### Mobile Home

```text
mobile-home-frame-final-20260528h.css
```

### Mobile Rank

```text
mobile-rank-display-20260528a.js
mobile-rank-display-20260528a.css
mobile-rank-scroll-safe-20260528i.css
```

### Mobile Shell / Navigation

```text
mobile-shell-polish-20260528a.js
mobile-shell-polish-20260528a.css
```

### Mobile Chat

```text
mobile-chat-polish-20260528b.css
mobile-chat-history-20260528c.js
mobile-chat-history-20260528c.css
mobile-chat-history-narrow-20260528d.css
mobile-chat-history-compact-20260528e.css
mobile-viewport-fit-20260528f.js
mobile-viewport-fit-20260528f.css
mobile-chat-rescue-20260528g.js
mobile-realphone-polish-20260528g.css
mobile-chat-rescue-20260528h.js
mobile-chat-polish-final-20260528h.css
mobile-realphone-final-20260528j.css
```

## Candidate Unused Files

These files are not directly referenced by `dist/index.html` and no external reference was found in the quick scan.

Do not delete automatically. Review and confirm first.

### Original Early Build

```text
index-CGe8foPe.js
index-DZQUo-zV.css
```

### Old Chat History / Chat Markdown Iterations

```text
index-chat-compact-history-20260527a.css
index-chat-compact-history-20260527a.js
index-chat-compact-history-20260527b.css
index-chat-compact-history-20260527b.js
index-chat-compact-history-20260527c.css
index-chat-compact-history-20260527c.js
index-chat-compact-history-20260527d.css
index-chat-compact-history-20260527d.js
index-chat-compact-history-20260527e.css
index-chat-compact-history-20260527e.js
index-chat-compact-history-20260527f.css
index-chat-compact-history-20260527f.js
index-chat-compact-history-20260527g.css
index-chat-compact-history-20260527g.js
index-chat-markdown-unified-20260527a.css
index-chat-markdown-unified-20260527a.js
```

### Old Feedback / Desktop Layout Iterations

```text
index-feedback-wide-20260506c.css
index-feedback-wide-20260512a.css
index-feedback-wide-20260512b.css
index-feedback-wide-20260512c.css
index-feedback-wide-20260513a.css
index-feedback-wide-20260513b.css
index-feedback-wide-20260513c.css
index-feedback-wide-20260513d.css
index-feedback-wide-20260513e.css
index-feedback-wide-20260513f.css
```

### Old Home Agent Picker Iterations

```text
index-home-agent-picker-20260527a.css
index-home-agent-picker-20260527a.js
index-home-agent-picker-20260527b.css
index-home-agent-picker-20260527b.js
index-home-agent-picker-20260527c.css
index-home-agent-picker-20260527c.js
```

### Old Ranking / Mobile Preview Iterations

```text
index-home-ranking-desktop-20260528a.css
index-home-ranking-desktop-20260528a.js
index-mobile-deepseek-20260528a.css
index-mobile-deepseek-20260528a.js
index-mobile-deepseek-20260528b.css
index-mobile-deepseek-20260528b.js
index-mobile-preview-20260527a.css
index-mobile-preview-20260527a.js
index-mobile-preview-20260527b.css
index-mobile-preview-20260527b.js
index-responsive-mobile-20260527a.css
index-responsive-mobile-20260527a.js
```

### Old Rank Role Fix Iterations

```text
index-rank-role-fix-20260506a.js
index-rank-role-fix-20260513a.js
index-rank-role-fix-20260513b.js
index-rank-role-fix-20260513c.js
index-rank-role-fix-20260513d.js
```

### Old Markdown Renderer Iterations

```text
markdown-render-dify-lite-20260513a.js
markdown-render-dify-lite-20260513b.js
markdown-render-dify-lite-20260513c.js
```

## Referenced But Not Active

These are not currently loaded by `dist/index.html`, but they appear in documentation examples or notes. They are still cleanup candidates, but update docs if they are deleted.

```text
index-chat-agent-switch-20260527a.css
index-chat-agent-switch-20260527a.js
```

## Suggested First Deletion Review Group

Safest first review group, because these are older renderer iterations and the current active renderer is `markdown-render-dify-lite-20260513d.js`:

```text
markdown-render-dify-lite-20260513a.js
markdown-render-dify-lite-20260513b.js
markdown-render-dify-lite-20260513c.js
```

Suggested second review group:

```text
index-feedback-wide-20260506c.css
index-feedback-wide-20260512a.css
index-feedback-wide-20260512b.css
index-feedback-wide-20260512c.css
index-feedback-wide-20260513a.css
index-feedback-wide-20260513b.css
index-feedback-wide-20260513c.css
index-feedback-wide-20260513d.css
index-feedback-wide-20260513e.css
index-feedback-wide-20260513f.css
```

## Verification Checklist After Approved Deletions

Run:

```bash
node --check server/src/server.js
cd server && npm run test:router
```

Open and verify:

```text
/mobile
/chat
/mobile/rank
```
