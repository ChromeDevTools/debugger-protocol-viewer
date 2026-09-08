# Plan: Adopt Vanilla Protocol Viewer & Modernize CDP Viewer

## 1. Executive Summary & Goals

This project transitions the Chrome DevTools Protocol Viewer ([`chromedevtools.github.io/devtools-protocol`](https://chromedevtools.github.io/devtools-protocol/)) from its legacy static site generator (11ty + Handlebars + Rollup + Lit-HTML) to a zero-dependency, ultra-fast client-side viewer based on Andrey Lushnikov's [vanilla-protocol-viewer](https://github.com/aslushnikov/vanilla-protocol-viewer) ([`vanilla.aslushnikov.com`](https://vanilla.aslushnikov.com/)).

### Core Objectives
1. **Eliminate Maintenance Overhead**: Protocol domains, methods, events, and types are rendered dynamically from protocol JSON at runtime. No manual edits to navigation templates (e.g. [`shell.hbs`](./pages/_includes/shell.hbs)) required when new domains land in Chromium.
2. **Native Type Cross-References**: Resolve [#183](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/183) by generating dynamic reverse-dependency listings ("Used by: ...") for all protocol types.
3. **Instant Search & High Information Density**: Instant client-side fuzzy searching on keypress or `/`, paired with DevTools-inspired UI ergonomics.
4. **Preserve External Permalinks (Zero Broken Links)**: Ensure 100% backward compatibility for millions of existing links across StackOverflow, Chromium bugs, and developer docs using a dual-layer strategy:
   - **Static Stubs (`/tot/<Domain>/index.html`)**: Return HTTP 200 OK for crawlers and preserve legacy hash fragments (`#method-foo`, `#type-bar`).
   - **Wildcard Fallback (`/404.html`)**: Catches older version paths (`/1-3/*`, `/1-2/*`, `/v8/*`) and unexpected deep links.
5. **Preserve `stable` & `v8` Targets ("Buried but Accessible")**: Keep `stable` (1.3 release) and `v8` (Node inspector domains) functional via a clean header dropdown without cluttering the primary tip-of-tree workflow.
6. **Responsive Mobile Navigation**: Implement an off-canvas slide-out domain drawer on mobile (`< 800px`) rather than hiding the sidebar entirely.
7. **Isomorphic Core & Autonomous Validation**: Isolate protocol indexing and routing into an isomorphic module (`protocol-model.js`) unit-tested in `node:test` in **<50ms**, complemented by automated headless browser end-to-end tests.

---

## 2. Information Architecture & Routing

### URL Scheme Specification

| Target View | Canonical Route | Legacy Input URL | Mapping Mechanism |
| :--- | :--- | :--- | :--- |
| **Domain View** | `#/Page` | `/tot/Page/` | `tot/Page/index.html` stub ➔ `location.replace('#/Page')` |
| **Command / Method** | `#/Page.navigate` | `/tot/Page/#method-navigate` | `tot/Page/index.html` stub reads `#method-navigate` ➔ `location.replace('#/Page.navigate')` |
| **Event** | `#/Network.requestWillBeSent` | `/tot/Network/#event-requestWillBeSent` | `tot/Network/index.html` stub reads hash ➔ `location.replace('#/Network.requestWillBeSent')` |
| **Type** | `#/DOM.Node` | `/tot/DOM/#type-Node` | `tot/DOM/index.html` stub reads hash ➔ `location.replace('#/DOM.Node')` |
| **V8 Inspector** | `#/v8/Runtime.evaluate` | `/v8/Runtime/` | `404.html` catch-all ➔ `location.replace('#/v8/Runtime')` |
| **Stable Protocol** | `#/stable/Page.navigate` | `/1-3/Page/#method-navigate` | `404.html` catch-all ➔ `location.replace('#/stable/Page.navigate')` |

---

## 3. UI & UX Design Specifications

### 3.1 Header (44px DevTools Utility Bar)
```text
+---------------------------------------------------------------------------------------------------------+
| [⚙] DevTools Protocol  [⚡Exp]        |       [ 🔍 Search protocol...                 / ]       | [📖] [🐙] |
+---------------------------------------------------------------------------------------------------------+
```
- **Brand**: Logo + title (`#/` home).
- **Experimental Toggle (`[⚡Exp]`)**: Checkbox pill to toggle experimental APIs on/off.
- **Global Search**:
  - Auto-focused by typing *any* character anywhere on the page, or pressing `/` or `Cmd+K`.
  - Trailing `<kbd>/</kbd>` shortcut indicator.
  - Interactive fuzzy search dropdown with keyboard navigation (`↑`/`↓`/`Enter`/`Esc`).
- **External Links**: Crisp icon links for CDP Overview Docs and GitHub repository.

### 3.2 Leftnav Sidebar & Mobile Drawer
- **In-Sidebar Domain Filter**: Sticky 24px filter input (`Filter domains...`) at the top of the sidebar for quickly narrowing down the ~50 domains.
- **Visual Badges**: Muted amber `[EXP]` badge for experimental domains.
- **Target / Version Switcher (Bottom Pinned Footer)**:
  - Positioned discretely at the bottom of the leftnav domain list:
    `[ Protocol: Tip-of-Tree ▾ ]`
  - Opens select/menu for:
    - `● Tip-of-Tree (latest)` *(Default)*
    - `○ Stable (1.3)`
    - `○ V8 Inspector (Node.js)`
  - Keeps legacy/specialized versions available without cluttering the top header.
- **Mobile Responsive Drawer (`< 800px`)**:
  - Hamburger icon `[☰]` in the header.
  - Smooth off-canvas slide-out drawer (`transform: translateX(-100%)`) with backdrop overlay.
  - Selecting any domain automatically closes the drawer and navigates to the target.

### 3.3 Domain View & Sticky Sub-Navigation
- **Sticky Domain Sub-Header**:
  - Pinned directly below the main header during scroll:
    `[ Methods (34) ]  [ Events (18) ]  [ Types (12) ]`
  - Instant one-click smooth scrolling to section anchors.
- **Cross-References ("Used by")**:
  - Rendered beneath protocol types, listing every command, event, and type that references it (resolves #183).

---

## 4. Autonomous Validation Strategy

### Tier 1: Isomorphic Core & Build Invariant Tests (`node:test`)
- **Protocol Model Tests (`test/protocol-model.test.js`)**:
  - Normalization of protocol JSON.
  - Back-reference index generation ("Used by" correctness).
  - Stabilization filter (stripping experimental items when toggled off).
  - Route parser: parsing `#/Page.navigate`, `#/v8/Runtime`, and legacy hash strings into target actions.
- **Stub Generator Tests (`test/stubs.test.js`)**:
  - Verify every active protocol domain generates a `tot/<Domain>/index.html` stub.
  - Verify stub redirect logic and hash parameter extraction.
  - Verify `404.html` catch-all script syntax and routing rules.

### Tier 2: Headless Browser E2E Tests (Playwright / Puppeteer)
- **Legacy URL Redirection**:
  - Request `/tot/Page/#method-navigate` ➔ assert HTTP 200, URL becomes `#/Page.navigate`, `#Page-navigate` section visible.
  - Request `/tot/DOM/#type-Node` ➔ assert HTTP 200, URL becomes `#/DOM.Node`, type definition rendered.
  - Request `/1-3/Network/` ➔ assert 404 handler routes to `#/stable/Network`.
- **Search Interactions**:
  - Typing `captureScreenshot` from anywhere opens search overlay.
  - Pressing `Enter` navigates to `#/Page.captureScreenshot`.
- **Type Back-References**:
  - Navigate to `#/Debugger.CallFrame` ➔ assert "Used by" section exists with clickable links.
- **Experimental Toggle**:
  - Toggling `[⚡Exp]` updates domain list and method visibility.
- **Console & Network Health**:
  - Zero uncaught page exceptions or console errors.

### Tier 3: Upstream CI Pipeline Verification
- Simulate [`ChromeDevTools/devtools-protocol/.github/workflows/update.yml`](https://github.com/ChromeDevTools/devtools-protocol/blob/master/.github/workflows/update.yml):
  `npm install && npm run prep && npm run build && npm test`
- Validate that `devtools-protocol/` contains the complete deployable bundle with `.nojekyll`.

---

## 5. Phased Implementation Checklist

### Phase 1: Isomorphic Core & Base Viewer Adaptation
- [x] Create `src/protocol-model.js` isolating data normalization, back-reference computation, stabilization, and route parsing.
- [x] Add `test/protocol-model.test.js` using `node:test` to validate core logic in Node (<50ms).
- [x] Vendor and adapt core UI files from `vanilla-protocol-viewer`:
  - `src/index.html`
  - `src/main.js`
  - `src/protocol_renderer.js`
  - `src/search.js`
  - `src/utilities.js`
  - `src/style.css`
  - SVG icons
- [x] Update `main.js` to use `#/Domain.member` hash routing and connect `protocol-model.js`.
- [x] Implement DevTools toolbar header with centered search, `<kbd>/</kbd>` shortcut, and external links.

### Phase 2: Multi-Target (tot, stable, v8) & UX Enhancements
- [x] Add version selector dropdown (`tot`, `stable`, `v8`).
- [x] Implement V8 Inspector view (loading `js_protocol.json` only).
- [x] Implement stable protocol view (stabilized `tot`).
- [x] Add in-sidebar domain filter (`Filter domains...`).
- [x] Add sticky in-domain sub-header (`Methods (N)`, `Events (N)`, `Types (N)`).
- [x] Implement responsive mobile drawer with hamburger button and overlay for `< 800px`.

### Phase 3: Legacy URL Preservation & Build Pipeline
- [x] Create `scripts/generate-stubs.js` to output `tot/<Domain>/index.html` stubs.
- [x] Create `src/404.html` wildcard redirect handler.
- [x] Configure `npm run build` to assemble the full site into `devtools-protocol/`.
- [x] Update `npm run prep` to remain compatible with upstream CI.
- [x] Ensure `.nojekyll` is copied to `devtools-protocol/`.

### Phase 4: Autonomous Testing Suite
- [x] Add `test/stubs.test.js` to assert build output and stub integrity.
- [x] Add `test/e2e.test.js` (headless browser) covering legacy redirect, search, cross-references, and mobile drawer.
- [x] Wire test scripts into `npm test` (`node --test test/*.test.js`).

### Phase 5: Cleanup & Deprecation
- [x] Remove obsolete SSG dependencies (`@11ty/eleventy`, `marked`, `rollup`, `liquidjs`, etc.).
- [x] Deprecate dead manual scripts (`generate-sidenav-html.cjs`) and retain protocol prep files for CI.
- [x] Maintain protocol data input files for offline/stub generation compatibility.
- [x] Update `readme.md` with modern setup instructions and local development guide.
