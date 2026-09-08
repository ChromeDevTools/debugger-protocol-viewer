# Chrome DevTools Protocol Viewer

The official web viewer for the [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) (CDP).

The protocol source of truth is defined in the Chromium codebase:
https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/devtools_protocol/

- **Published Website**: [chromedevtools.github.io/devtools-protocol](https://chromedevtools.github.io/devtools-protocol/)
- **Protocol Definitions**: [ChromeDevTools/devtools-protocol](https://github.com/ChromeDevTools/devtools-protocol)

---

## Overview & Architecture

This viewer is a **zero-dependency vanilla client-side application** built with modern web standards:

- **Dynamic Runtime Rendering**: Protocol domains, methods, events, and types are rendered dynamically from protocol JSON at runtime. No template regeneration or manual navigation edits are needed when new domains or members land in Chromium.
- **Isomorphic Protocol Core**: Data normalization, member sorting, stabilization, and route parsing live in [`src/protocol-model.js`](./src/protocol-model.js), fully testable in Node.js without DOM dependencies.
- **Type Cross-References**: Native reverse-dependency analysis ("Used by") dynamically links every protocol type to the commands, events, and types referencing it.
- **Multi-Target Support**: Instant switching between **Tip-of-Tree (latest)**, **Stable (1.3)**, and **V8 Inspector (Node.js)** via the left navigation target switcher.
- **Instant Global Search**: Keyboard shortcut (`/` or `Cmd+K`) provides instant fuzzy search across domains, methods, events, and types.
- **Legacy URL Preservation**: Static HTML stubs (`/tot/<Domain>/index.html`) and wildcard fallback (`/404.html`) ensure 100% backward compatibility for existing permalinks across the web.

---

## Quickstart & Local Development

### 1. Install Dependencies

```sh
npm install
```

### 2. Build the Site

Builds the production distribution in `devtools-protocol/` and generates backward-compatible static redirect stubs:

```sh
npm run build
```

### 3. Serve Locally

Start a local HTTP server to view the built site:

```sh
npm run serve
```

Open [http://localhost:8696/devtools-protocol/](http://localhost:8696/devtools-protocol/) in your browser.

---

## Testing

The project uses Node's native test runner (`node:test`) for unit, stub integrity, and end-to-end testing:

```sh
# Run the entire test suite (unit + stubs + autonomous headless Chrome CDP E2E)
npm test

# Run isomorphic core unit tests (<50ms)
npm run test:unit

# Run stub generator integrity tests
npm run test:stubs

# Run headless Chrome E2E browser tests via CDP
npm run test:e2e
```

The E2E tests launch headless Chrome with `--remote-debugging-port=0` and communicate directly over native WebSockets via Chrome DevTools Protocol to validate route navigation, legacy hash redirects, target switching, search shortcuts, and in-domain quick jump pills.

---

## Deployment

Deployments to [https://chromedevtools.github.io/devtools-protocol/](https://chromedevtools.github.io/devtools-protocol/) happen automatically via GitHub Actions in the [devtools-protocol repository](https://github.com/ChromeDevTools/devtools-protocol) on updates.

The built distribution is pushed to the `devtools-protocol#gh-pages` branch.

---

## Contributing & Issues

- **Viewer Issues & Feature Requests**: Report in [this repository's issue tracker](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues).
- **Protocol Bugs / Chromium Issues**: Report directly at [crbug.com/new](https://crbug.com/new).

## License

[Apache 2.0](./LICENSE)
