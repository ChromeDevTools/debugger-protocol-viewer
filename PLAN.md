# Plan: Adopt Vanilla Protocol Viewer & Retire Legacy SSG Stack

## 1. Executive Summary & Goals

This project transitions the Chrome DevTools Protocol Viewer ([`chromedevtools.github.io/devtools-protocol`](https://chromedevtools.github.io/devtools-protocol/)) from its legacy static site generator (11ty + Handlebars + Rollup + Lit-HTML) to a zero-dependency client-side viewer based on Andrey Lushnikov's [vanilla-protocol-viewer](https://github.com/aslushnikov/vanilla-protocol-viewer) ([`vanilla.aslushnikov.com`](https://vanilla.aslushnikov.com/)).

### Core Objectives
1. **Eliminate Domain Maintenance**: Protocol domains, methods, events, and types are rendered dynamically from protocol JSON at runtime. No manual updates to navigation templates (e.g. [`shell.hbs`](./pages/_includes/shell.hbs)) required when new domains land in Chromium.
2. **Native Type Cross-References**: Resolve [#183](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/183) by providing dynamic reverse-dependency listings ("Used by: ...") for all protocol types.
3. **Instant Search**: Replace precomputed index lookups with instant client-side fuzzy searching on keypress.
4. **Preserve External Permalinks (Zero Broken Links)**: Ensure 100% backward compatibility for millions of existing links across StackOverflow, Chromium bugs, and developer docs using a dual-layer strategy:
   - **Static Stubs (`/tot/<Domain>/index.html`)**: Return HTTP 200 OK for search engine crawlers and preserve legacy hash fragments (`#method-foo`, `#type-bar`).
   - **Wildcard Fallback (`/404.html`)**: Catches older version paths (`/1-3/*`, `/1-2/*`, `/v8/*`) and unexpected deep links.
5. **Protocol Fetching**: Per decision, protocol JSON fetching will continue to use jsdelivr (`https://cdn.jsdelivr.net/gh/ChromeDevTools/devtools-protocol@master/json/...`) for now.
6. **Continuous Autonomous Verification**: Implement automated test suites (build invariant checks + headless browser end-to-end tests) to validate routing, rendering, search, and URL compatibility autonomously.

---

## 2. Architecture & Legacy URL Compatibility Strategy

### URL Mapping Specification

| Source Legacy URL Pattern | Target Destination | Handling Mechanism | HTTP Status |
| :--- | :--- | :--- | :--- |
| `.../tot/Page/#method-navigate` | `.../?Page.navigate` | Pre-generated `tot/Page/index.html` stub | **200 OK** |
| `.../tot/Page/` | `.../?Page` | Pre-generated `tot/Page/index.html` stub | **200 OK** |
| `.../tot/DOM/#type-Node` | `.../?DOM.Node` | Pre-generated `tot/DOM/index.html` stub | **200 OK** |
| `.../tot/Network/#event-requestWillBeSent` | `.../?Network.requestWillBeSent` | Pre-generated `tot/Network/index.html` stub | **200 OK** |
| `.../1-3/Page/#method-navigate` | `.../?Page.navigate` | Catch-all `404.html` | **404 -> Client Redirect** |
| `.../?Page.navigate` | Native SPA route | Client-side Router in `main.js` | **200 OK** |

### Stub Generation Mechanism
During the build step (`npm run build`), a lightweight Node script reads the protocol domains and generates static directory stubs under `devtools-protocol/tot/<Domain>/index.html`. 

Each stub runs an inline client script that reads `window.location.hash`, parses target elements (`#method-xyz`, `#type-abc`, `#event-def`), and redirects seamlessly via `location.replace(...)` to the canonical query format, preserving browser history semantics.

---

## 3. Autonomous Validation Techniques

To validate the viewer autonomously without manual browser verification, we define three complementary testing tiers:

### Tier 1: Build Output & Contract Invariant Tests (Fast Node.js Native Runner)
Executed via `node --test`:
- **Directory Structure Verification**: Ensures `devtools-protocol/` contains `index.html`, `404.html`, and `tot/<Domain>/index.html` stubs for every active protocol domain.
- **Stub Integrity**: Confirms each stub contains valid redirect logic and does not leak undefined hashes.
- **Asset Integrity**: Confirms critical client assets (`main.js`, `search.js`, `protocol_renderer.js`, `style.css`) exist, are non-empty, and contain no broken import references.

### Tier 2: Headless Browser E2E Tests (Playwright / Puppeteer)
Runs against a local static web server serving `devtools-protocol/`:
- **Test Case 1: Legacy Hash Navigation**:
  - Load `http://localhost:PORT/devtools-protocol/tot/Page/#method-navigate`
  - Assert URL updates or resolves to `Page.navigate`.
  - Assert the DOM contains the `#Page-navigate` section and that it is visible/focused in viewport.
- **Test Case 2: Legacy Type Deep Link**:
  - Load `http://localhost:PORT/devtools-protocol/tot/DOM/#type-Node`
  - Assert DOM contains `DOM.Node` definition.
- **Test Case 3: 404 Fallback for Historical Versions**:
  - Load `http://localhost:PORT/devtools-protocol/1-3/Network/`
  - Assert navigation resolves to the `Network` domain view via `404.html`.
- **Test Case 4: Back-References / Cross-References ([#183](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/183))**:
  - Navigate to `http://localhost:PORT/devtools-protocol/?Debugger.CallFrame`
  - Assert presence of the `.references` or "Used by" list.
  - Verify links within "Used by" point to dependent protocol types or methods.
- **Test Case 5: Instant Search**:
  - Load base viewer `http://localhost:PORT/devtools-protocol/`.
  - Type `captureScreenshot` on the page.
  - Assert search dropdown/overlay opens with `Page.captureScreenshot`.
  - Trigger selection (click or Enter); assert route changes to `?Page.captureScreenshot`.
- **Test Case 6: Experimental Domain Toggle**:
  - Verify domains marked `experimental: true` toggle display when toggling the experimental setting.
- **Test Case 7: Zero Uncaught Exceptions**:
  - Monitor `page.on('pageerror')` and `page.on('console', msg => msg.type() === 'error')` across all test runs.

### Tier 3: Upstream CI Contract Compatibility Check
Simulate the deployment step executed by [`ChromeDevTools/devtools-protocol/.github/workflows/update.yml`](https://github.com/ChromeDevTools/devtools-protocol/blob/master/.github/workflows/update.yml):
- Run `npm install && npm run prep && npm run build`
- Validate that `devtools-protocol/` contains a valid deployable bundle matching GitHub Pages publishing requirements.

---

## 4. Phased Implementation Checklist

### Phase 1: Core Vanilla Viewer Integration
- [ ] Initialize clean directory structure for the new client code (`src/` or top-level web assets).
- [ ] Vendor core viewer assets from [`aslushnikov/vanilla-protocol-viewer`](https://github.com/aslushnikov/vanilla-protocol-viewer):
  - `index.html`
  - `main.js`
  - `protocol_renderer.js`
  - `search.js`
  - `utilities.js`
  - `style.css`
  - SVG icons (`home.svg`, checkbox icons)
- [ ] Configure protocol endpoints in `main.js` to load from jsdelivr (`ChromeDevTools/devtools-protocol@master`).
- [ ] Test base viewer rendering locally with static file server.

### Phase 2: URL Routing & Legacy Compatibility
- [ ] Extend `Router` in `main.js` to handle:
  - Query format: `?Domain` and `?Domain.member`
  - Path format: `/tot/:domain`
  - Anchor format: `#method-member`, `#type-member`, `#event-member`
- [ ] Implement `scripts/generate-stubs.js`:
  - Fetch or read protocol domains.
  - Generate `tot/<Domain>/index.html` stubs with client redirect and hash retention.
- [ ] Create `404.html` catch-all script:
  - Parse `window.location.pathname` and `window.location.hash`.
  - Extract domain and target; redirect via `location.replace(...)`.
- [ ] Verify local redirect behavior across all legacy URL formats.

### Phase 3: Autonomous Testing Suite
- [ ] Install test dependencies (e.g. lightweight headless browser runner).
- [ ] Add `test/invariants.test.js`:
  - Validate stub generation completeness.
  - Validate HTML and redirect syntax.
- [ ] Add `test/e2e.test.js`:
  - Implement Headless Browser test cases (Legacy URLs, Search, Cross-references, Experimental toggle, Console errors).
- [ ] Wire test suite into `npm test` script in [`package.json`](./package.json).

### Phase 4: Build & Deployment Workflow Integration
- [ ] Update `npm run build` script in [`package.json`](./package.json) to output to `devtools-protocol/`.
- [ ] Update or simplify `npm run prep` if needed while maintaining CLI signature expected by [devtools-protocol update.yml](https://github.com/ChromeDevTools/devtools-protocol/blob/master/.github/workflows/update.yml).
- [ ] Test the exact CI build sequence locally: `npm install && npm run prep && npm run build && npm test`.
- [ ] Ensure `.nojekyll` is preserved in `devtools-protocol/` output to prevent GitHub Pages from ignoring files.

### Phase 5: Cleanup & Deprecation
- [ ] Remove obsolete SSG dependencies from [`package.json`](./package.json):
  - `@11ty/eleventy`
  - `@11ty/eleventy-plugin-handlebars`
  - `marked`
  - `liquidjs`
  - `rollup` and plugins (if bundling is unnecessary for vanilla JS)
- [ ] Remove deprecated scripts and templates:
  - [`generate-sidenav-html.cjs`](./generate-sidenav-html.cjs)
  - [`make-stable-protocol.cjs`](./make-stable-protocol.cjs)
  - [`create-search-index.cjs`](./create-search-index.cjs)
  - [`pages/`](./pages/) directory (once legacy SSG is fully decommissioned)
- [ ] Update [`readme.md`](./readme.md) documentation to reflect the modern vanilla viewer architecture and local dev workflow.
