# job-application-tracker

A Chrome extension that adds a tracking button to Gmail. Click it on a job-related email and it uses your own Claude API key to extract the company and status, then saves it to a local dashboard.

## Development

```bash
npm install
npm run test        # unit tests for the core domain module
npm run typecheck
npm run build        # bundles the extension into ./dist
```

## Load in Chrome (dev mode)

1. `npm run build`
2. Open `chrome://extensions`, enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Click the extension icon and paste your Claude API key
5. Open a job-related email in Gmail — a **Track Application** button appears in the toolbar
6. Click the extension icon and press **Open Dashboard** to see tracked applications in a new tab

## Architecture

- `src/core/` — pure domain logic (extraction parsing, company resolution, application construction, the repository interface). No browser APIs; this is what's unit tested.
- `src/shell/` — everything that touches the browser: the Gmail content script, the background service worker (calls the Claude API), the `chrome.storage.local` repository implementation, the popup, and the dashboard.

See the spec and tickets on the [issue tracker](https://github.com/whyDontI/job-application-tracker/issues) for the full design.
