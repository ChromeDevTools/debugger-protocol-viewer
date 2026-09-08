import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { generateStubs } from '../scripts/generate-stubs.js';

/**
 * Finds the Chrome executable path across macOS and Linux environments.
 * @returns {string|null}
 */
function findChromeBinary() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  const macPath = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(macPath)) {
    return macPath;
  }

  try {
    const whichOutput = execSync('which google-chrome || which chromium || which chrome', {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'ignore'],
    }).trim();
    if (whichOutput && fs.existsSync(whichOutput)) {
      return whichOutput;
    }
  } catch {
    // Binary not in PATH
  }

  return null;
}

/**
 * Creates a native node:http static server serving rootDirectory.
 * @param {string} rootDirectory
 * @returns {http.Server}
 */
function createStaticServer(rootDirectory) {
  const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.webmanifest': 'application/manifest+json',
    '.xml': 'application/xml',
  };

  return http.createServer(async (req, res) => {
    try {
      const parsedUrl = new URL(req.url, 'http://127.0.0.1');
      let relativePath = decodeURIComponent(parsedUrl.pathname);
      if (relativePath.endsWith('/')) {
        relativePath += 'index.html';
      }

      let filePath = path.resolve(rootDirectory, '.' + relativePath);
      if (!filePath.startsWith(rootDirectory)) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
      }

      try {
        const stat = await fs.promises.stat(filePath);
        if (stat.isDirectory()) {
          filePath = path.join(filePath, 'index.html');
        }
      } catch {
        // Not a directory or does not exist
      }

      try {
        const data = await fs.promises.readFile(filePath);
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      } catch {
        // Fallback to 404.html if available
        const fallback404 = path.join(rootDirectory, '404.html');
        try {
          const notFoundData = await fs.promises.readFile(fallback404);
          res.writeHead(404, {
            'Content-Type': 'text/html; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
          });
          res.end(notFoundData);
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      }
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end(`Internal Server Error: ${err.message}`);
    }
  });
}

/**
 * Minimal Chrome DevTools Protocol client over native WebSocket.
 */
class CdpClient {
  /**
   * @param {WebSocket} ws
   */
  constructor(ws) {
    this._ws = ws;
    this._id = 1;
    this._pending = new Map();

    this._ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.id && this._pending.has(msg.id)) {
          const { resolve, reject } = this._pending.get(msg.id);
          this._pending.delete(msg.id);
          if (msg.error) {
            reject(new Error(msg.error.message || 'CDP command error'));
          } else {
            resolve(msg.result);
          }
        }
      } catch (err) {
        console.error('[CdpClient] Error handling message:', err);
      }
    };
  }

  /**
   * Sends a CDP command.
   * @param {string} method
   * @param {Object} [params]
   * @param {string} [sessionId]
   * @returns {Promise<any>}
   */
  send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const msgId = this._id++;
      this._pending.set(msgId, { resolve, reject });
      const payload = { id: msgId, method, params };
      if (sessionId) payload.sessionId = sessionId;
      this._ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Evaluates a JavaScript expression in the target page.
   * @param {string} expression
   * @param {string} sessionId
   * @returns {Promise<any>}
   */
  async evaluate(expression, sessionId) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    }, sessionId);

    if (res.exceptionDetails) {
      throw new Error(
        `Evaluation exception: ${res.exceptionDetails.text || res.exceptionDetails.exception?.description}`
      );
    }
    return res.result?.value;
  }

  /**
   * Repeatedly evaluates an expression until predicate returns truthy or times out.
   * @param {string} expression
   * @param {(val: any) => boolean} predicate
   * @param {string} sessionId
   * @param {number} [timeoutMs]
   * @param {number} [intervalMs]
   * @returns {Promise<any>}
   */
  async pollEvaluate(expression, predicate, sessionId, timeoutMs = 15000, intervalMs = 100) {
    const start = Date.now();
    let lastVal;
    while (Date.now() - start < timeoutMs) {
      try {
        lastVal = await this.evaluate(expression, sessionId);
        if (predicate ? predicate(lastVal) : Boolean(lastVal)) {
          return lastVal;
        }
      } catch {
        // Ignored during page navigation / transitions
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error(
      `pollEvaluate timed out after ${timeoutMs}ms for expression: ${expression}. Last value: ${JSON.stringify(lastVal)}`
    );
  }
}

test('Chrome DevTools Protocol Viewer E2E Tests', async (t) => {
  const chromePath = findChromeBinary();
  if (!chromePath) {
    t.skip('Chrome binary not found');
    return;
  }

  const staticDir = path.resolve('devtools-protocol');
  generateStubs({ outputDir: staticDir });

  // 1. Start native static HTTP server on ephemeral port
  const server = createStaticServer(staticDir);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  // 2. Launch headless Chrome
  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-viewer-e2e-'));
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--disable-gpu',
      '--no-first-run',
      `--user-data-dir=${tmpUserDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] }
  );

  let browserWs = null;
  let cdp = null;
  let sessionId = null;

  try {
    // 3. Parse WebSocket URL from Chrome stderr
    const wsUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out waiting for Chrome WebSocket URL')), 10000);
      let stderrBuffer = '';
      chromeProcess.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString();
        const match = stderrBuffer.match(/DevTools listening on (ws:\/\/[^\s]+)/);
        if (match) {
          clearTimeout(timeout);
          resolve(match[1]);
        }
      });
      chromeProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
      chromeProcess.on('exit', (code) => {
        clearTimeout(timeout);
        reject(new Error(`Chrome exited prematurely with code ${code}`));
      });
    });

    browserWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      browserWs.onopen = resolve;
      browserWs.onerror = reject;
    });

    cdp = new CdpClient(browserWs);

    // 4. Create and attach to target page
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const attachResult = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    sessionId = attachResult.sessionId;

    await cdp.send('Page.enable', {}, sessionId);
    await cdp.send('Runtime.enable', {}, sessionId);

    // Dynamic native subtests
    await t.test('1. Direct route navigation (#/Page.navigate)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/Page.navigate` }, sessionId);

      const title = await cdp.pollEvaluate(
        'document.title',
        (val) => typeof val === 'string' && val.includes('Page.navigate'),
        sessionId
      );
      const hasElement = await cdp.pollEvaluate(
        'Boolean(document.getElementById("Page_navigate"))',
        (val) => val === true,
        sessionId
      );

      assert.ok(title.includes('Page.navigate'), `Expected title to contain "Page.navigate", got "${title}"`);
      assert.strictEqual(hasElement, true, 'Expected #Page_navigate element to exist in DOM');
    });

    await t.test('2. Legacy URL redirection (/tot/Page/#method-navigate)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/tot/Page/#method-navigate` }, sessionId);

      const hash = await cdp.pollEvaluate(
        'window.location.hash',
        (val) => val === '#/Page.navigate',
        sessionId
      );

      assert.strictEqual(hash, '#/Page.navigate', `Expected hash to be "#/Page.navigate", got "${hash}"`);
    });

    await t.test('3. Target selector routing (#/v8/Runtime.evaluate)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/v8/Runtime.evaluate` }, sessionId);

      const targetValue = await cdp.pollEvaluate(
        'document.getElementById("target-selector")?.value',
        (val) => val === 'v8',
        sessionId
      );
      const hasRuntimeEvaluate = await cdp.pollEvaluate(
        'Boolean(document.getElementById("Runtime_evaluate"))',
        (val) => val === true,
        sessionId
      );

      assert.strictEqual(targetValue, 'v8', `Expected target selector value to be "v8", got "${targetValue}"`);
      assert.strictEqual(hasRuntimeEvaluate, true, 'Expected #Runtime_evaluate element to exist in DOM');
    });

    await t.test('3b. Target selector user interaction: switching dropdown from tot to v8', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/` }, sessionId);
      await cdp.pollEvaluate('Boolean(window.app)', (v) => v === true, sessionId);

      // Select 'v8' in target-selector and dispatch change event
      await cdp.evaluate(`
        const selector = document.getElementById("target-selector");
        selector.value = "v8";
        selector.dispatchEvent(new Event("change"));
      `, sessionId);

      // Assert that target-selector value is 'v8'
      const finalTarget = await cdp.pollEvaluate(
        'document.getElementById("target-selector")?.value',
        (val) => val === 'v8',
        sessionId
      );
      assert.strictEqual(finalTarget, 'v8', 'Target selector should stay "v8"');

      // Assert that sidebar only contains v8 domains (Runtime exists, Page does not)
      const hasPageDomain = await cdp.evaluate(
        'Boolean(document.querySelector("#domain-list [data-domain=\\"Page\\"]"))',
        sessionId
      );
      assert.strictEqual(hasPageDomain, false, 'Expected Page domain to NOT exist in V8 sidebar');

      const hasRuntimeDomain = await cdp.evaluate(
        'Boolean(document.querySelector("#domain-list [data-domain=\\"Runtime\\"]"))',
        sessionId
      );
      assert.strictEqual(hasRuntimeDomain, true, 'Expected Runtime domain to exist in V8 sidebar');
    });

    await t.test('4. Search keyboard shortcut (/)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/Page` }, sessionId);

      // Wait for app to be ready and unfocus any inputs
      await cdp.pollEvaluate('Boolean(window.app)', (v) => v === true, sessionId);
      await cdp.evaluate('document.getElementById("search")?.blur()', sessionId);

      // Dispatch '/' keypress via CDP Input
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyDown',
        key: '/',
        text: '/',
        unmodifiedText: '/',
        code: 'Slash',
        windowsVirtualKeyCode: 191,
      }, sessionId);
      await cdp.send('Input.dispatchKeyEvent', {
        type: 'keyUp',
        key: '/',
        code: 'Slash',
        windowsVirtualKeyCode: 191,
      }, sessionId);

      const isFocused = await cdp.pollEvaluate(
        'document.activeElement === document.getElementById("search")',
        (val) => val === true,
        sessionId
      );

      assert.strictEqual(isFocused, true, 'Expected document.activeElement to be document.getElementById("search")');
    });

    await t.test('5. Table of contents badges and backtick code rendering (#/Page)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/Page` }, sessionId);

      const tocHeadings = await cdp.pollEvaluate(
        'Array.from(document.querySelectorAll(".toc-section-heading")).map(el => el.textContent.trim())',
        (arr) => Array.isArray(arr) && arr.length >= 3,
        sessionId
      );

      assert.ok(
        tocHeadings.some((text) => text.includes('Methods')),
        `Expected TOC headings to include "Methods", got: ${JSON.stringify(tocHeadings)}`
      );
      assert.ok(
        tocHeadings.some((text) => text.includes('Events')),
        `Expected TOC headings to include "Events", got: ${JSON.stringify(tocHeadings)}`
      );
      assert.ok(
        tocHeadings.some((text) => text.includes('Types')),
        `Expected TOC headings to include "Types", got: ${JSON.stringify(tocHeadings)}`
      );

      const methodBadgeText = await cdp.evaluate(
        'document.querySelector(".toc-section-heading .entity-icon-method")?.textContent?.trim()',
        sessionId
      );
      assert.strictEqual(methodBadgeText, 'method', 'Expected method badge in TOC heading');

      const hasCodeInDescription = await cdp.pollEvaluate(
        'document.querySelectorAll("#content .box-content p code, #content .parameter-description code").length > 0',
        (val) => val === true,
        sessionId
      );
      assert.strictEqual(hasCodeInDescription, true, 'Expected backticks to be rendered as <code> elements');
    });

    await t.test('6. Type cross-references (#/DOM.NodeId)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/DOM.NodeId` }, sessionId);

      const hasReferences = await cdp.pollEvaluate(
        'document.querySelectorAll(".references-list li").length > 0',
        (val) => val === true,
        sessionId
      );

      assert.strictEqual(hasReferences, true, 'Expected DOM.NodeId to render back-reference links in .references-list');
    });

    await t.test('7. Mobile responsive drawer (#drawer-toggle & backdrop)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/Page` }, sessionId);
      await cdp.pollEvaluate('Boolean(window.app)', (v) => v === true, sessionId);

      // Open drawer
      await cdp.evaluate('document.getElementById("drawer-toggle").click()', sessionId);
      const isDrawerOpen = await cdp.pollEvaluate(
        'document.body.classList.contains("drawer-open")',
        (val) => val === true,
        sessionId
      );
      assert.strictEqual(isDrawerOpen, true, 'Expected body to have "drawer-open" class after clicking drawer-toggle');

      // Close drawer via backdrop click
      await cdp.evaluate('document.getElementById("drawer-backdrop").click()', sessionId);
      const isDrawerClosed = await cdp.pollEvaluate(
        '!document.body.classList.contains("drawer-open")',
        (val) => val === true,
        sessionId
      );
      assert.strictEqual(isDrawerClosed, true, 'Expected body not to have "drawer-open" class after clicking backdrop');
    });

    await t.test('8. Wildcard 404 redirection (/1-3/Page/#method-navigate)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/1-3/Page/#method-navigate` }, sessionId);

      const hash = await cdp.pollEvaluate(
        'window.location.hash',
        (val) => val === '#/stable/Page.navigate',
        sessionId
      );
      assert.strictEqual(hash, '#/stable/Page.navigate', `Expected 404 handler to redirect to "#/stable/Page.navigate", got "${hash}"`);
    });

    await t.test('9. Root landing page rendering and rich content (#/)', async () => {
      await cdp.send('Page.navigate', { url: `${baseUrl}/#/` }, sessionId);

      const landingHeading = await cdp.pollEvaluate(
        'document.querySelector("#content .box h1")?.textContent?.trim()',
        (val) => val === 'Chrome DevTools Protocol',
        sessionId
      );
      assert.strictEqual(landingHeading, 'Chrome DevTools Protocol', 'Expected landing page title');

      const monitorImageSrc = await cdp.evaluate(
        'document.querySelector("figure.screenshot img")?.getAttribute("src")',
        sessionId
      );
      assert.strictEqual(monitorImageSrc, 'images/protocol-monitor.png', 'Expected Protocol Monitor image');

      const endpointsHeading = await cdp.evaluate(
        'document.getElementById("endpoints")?.textContent?.trim()',
        sessionId
      );
      assert.strictEqual(endpointsHeading, 'HTTP Endpoints', 'Expected HTTP Endpoints heading');
    });
  } finally {
    // Teardown resources
    if (browserWs) {
      try {
        browserWs.close();
      } catch {
        // ignore
      }
    }

    if (chromeProcess) {
      try {
        chromeProcess.kill('SIGTERM');
      } catch {
        // ignore
      }
      await new Promise((resolve) => {
        chromeProcess.on('exit', resolve);
        setTimeout(resolve, 3000);
      });
    }

    try {
      fs.rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch {
      // ignore
    }

    await new Promise((resolve) => server.close(resolve));
  }
});
