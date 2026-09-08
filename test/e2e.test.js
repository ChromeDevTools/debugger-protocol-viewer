import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import statikk from 'statikk';
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

/** @import { Protocol } from 'devtools-protocol' */
/** @import { ProtocolMapping } from 'devtools-protocol/types/protocol-mapping.js' */

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
            reject(new Error(msg.error.message || JSON.stringify(msg.error)));
          } else {
            resolve(msg.result);
          }
        }
      } catch (err) {
        // Ignore JSON parse errors
      }
    };
  }

  /**
   * Sends a CDP method call.
   * @template {keyof ProtocolMapping.Commands} M
   * @param {M} method
   * @param {ProtocolMapping.Commands[M]['paramsType'][0]} [params]
   * @param {string|null} [sessionId]
   * @returns {Promise<ProtocolMapping.Commands[M]['returnType']>}
   */
  send(method, params = /** @type {any} */ ({}), sessionId = null) {
    return new Promise((resolve, reject) => {
      const msgId = this._id++;
      this._pending.set(msgId, { resolve, reject });
      const payload = /** @type {any} */ ({ id: msgId, method, params });
      if (sessionId) payload.sessionId = sessionId;
      this._ws.send(JSON.stringify(payload));
    });
  }

  /**
   * Returns a typed ProtocolApi interface for a given sessionId (or browser-level if omitted).
   * @param {string|null} [sessionId]
   * @returns {import('devtools-protocol/types/protocol-proxy-api.js').ProtocolProxyApi.ProtocolApi}
   */
  createApi(sessionId = null) {
    return /** @type {any} */ (
      new Proxy(
        {},
        {
          get: (_, domain) =>
            new Proxy(
              {},
              {
                get:
                  (_, method) =>
                  (/** @type {any} */ params = {}) =>
                    this.send(
                      /** @type {any} */ (`${String(domain)}.${String(method)}`),
                      params,
                      sessionId,
                    ),
              },
            ),
        },
      )
    );
  }

  /**
   * Evaluates a JavaScript expression in the target page.
   * @param {string} expression
   * @param {Protocol.Target.SessionID|null} [sessionId]
   * @returns {Promise<any>}
   */
  async evaluate(expression, sessionId = null) {
    const res = await this.send(
      'Runtime.evaluate',
      {
        expression,
        returnByValue: true,
        awaitPromise: true,
      },
      sessionId,
    );

    if (res.exceptionDetails) {
      throw new Error(
        `Evaluation exception: ${res.exceptionDetails.text || res.exceptionDetails.exception?.description}`,
      );
    }
    return res.result?.value;
  }

  /**
   * Repeatedly evaluates an expression until predicate returns truthy or times out.
   * @param {string} expression
   * @param {(val: any) => boolean} predicate
   * @param {Protocol.Target.SessionID|null} [sessionId]
   * @param {number} [timeoutMs]
   * @param {number} [intervalMs]
   * @returns {Promise<any>}
   */
  async pollEvaluate(expression, predicate, sessionId = null, timeoutMs = 15000, intervalMs = 100) {
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
      `pollEvaluate timed out after ${timeoutMs}ms waiting for: ${expression}\nLast value: ${JSON.stringify(lastVal)}`,
    );
  }
}

test('Chrome DevTools Protocol Viewer E2E Tests', async (t) => {
  const chromePath = findChromeBinary();
  if (!chromePath) {
    t.skip('Chrome binary not found; skipping E2E tests in this environment.');
    return;
  }

  const staticDir = path.resolve('devtools-protocol');
  generateStubs({ outputDir: staticDir });

  // 1. Start static HTTP server with statikk on an ephemeral port
  const { app, server, url: baseUrl } = await statikk({ root: staticDir, port: 0, cors: true });
  // Fallback to 404.html to mirror GitHub Pages behavior for unmatched routes
  app.use(
    /**
     * @param {import('node:http').IncomingMessage} _req
     * @param {import('node:http').ServerResponse} res
     */
    async (_req, res) => {
      try {
        const notFoundData = await fs.promises.readFile(path.join(staticDir, '404.html'));
        res.writeHead(404, {
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        });
        res.end(notFoundData);
      } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Not Found');
      }
    },
  );

  // 2. Launch headless Chrome
  const tmpUserDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-viewer-e2e-'));
  const chromeProcess = spawn(
    chromePath,
    [
      '--headless=new',
      '--remote-debugging-port=0',
      '--disable-gpu',
      '--no-first-run',
      '--no-sandbox',
      '--disable-dev-shm-usage',
      `--user-data-dir=${tmpUserDataDir}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'pipe', 'pipe'] },
  );

  /** @type {WebSocket|null} */
  let browserWs = null;
  /** @type {CdpClient|null} */
  let cdp = null;
  /** @type {Protocol.Target.TargetID|null} */
  let targetId = null;
  /** @type {Protocol.Target.SessionID|null} */
  let sessionId = null;
  /** @type {import('devtools-protocol/types/protocol-proxy-api.js').ProtocolProxyApi.ProtocolApi|null} */
  let browserApi = null;
  /** @type {import('devtools-protocol/types/protocol-proxy-api.js').ProtocolProxyApi.ProtocolApi|null} */
  let pageApi = null;

  try {
    // 3. Parse WebSocket URL from Chrome stderr
    const wsUrl = await new Promise((resolve, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('Timed out waiting for Chrome WebSocket URL')),
        10000,
      );
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
      if (!browserWs) return reject(new Error('No WebSocket'));
      browserWs.onopen = () => resolve(undefined);
      browserWs.onerror = reject;
    });

    cdp = new CdpClient(browserWs);
    browserApi = cdp.createApi();

    // 4. Create and attach to target page
    const createTargetResult = await browserApi.Target.createTarget({ url: 'about:blank' });
    targetId = createTargetResult.targetId;
    const attachResult = await browserApi.Target.attachToTarget({ targetId, flatten: true });
    sessionId = attachResult.sessionId;
    pageApi = cdp.createApi(sessionId);

    assert.ok(cdp);
    assert.ok(browserApi);
    assert.ok(pageApi);

    await pageApi.Page.enable({});
    await pageApi.Runtime.enable();

    const client = cdp;
    const page = pageApi;

    // Dynamic native subtests
    await t.test('1. Direct route navigation (#/Page.navigate)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/Page.navigate` });

      const title = await client.pollEvaluate(
        'document.title',
        (/** @type {any} */ val) => typeof val === 'string' && val.includes('Page.navigate'),
        sessionId,
      );
      const hasElement = await client.pollEvaluate(
        'Boolean(document.getElementById("Page_navigate"))',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );

      assert.ok(
        title.includes('Page.navigate'),
        `Expected title to contain "Page.navigate", got "${title}"`,
      );
      assert.strictEqual(hasElement, true, 'Expected #Page_navigate element to exist in DOM');
    });

    await t.test('2. Legacy URL redirection (/tot/Page/#method-navigate)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/tot/Page/#method-navigate` });

      const hash = await client.pollEvaluate(
        'window.location.hash',
        (/** @type {any} */ val) => val === '#/Page.navigate',
        sessionId,
      );

      assert.strictEqual(
        hash,
        '#/Page.navigate',
        `Expected hash to be "#/Page.navigate", got "${hash}"`,
      );
    });

    await t.test('3. Target selector routing (#/v8/Runtime.evaluate)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/v8/Runtime.evaluate` });

      const targetValue = await client.pollEvaluate(
        'document.getElementById("target-selector") ? document.getElementById("target-selector").value : null',
        (/** @type {any} */ val) => val === 'v8',
        sessionId,
      );
      const hasRuntimeEvaluate = await client.pollEvaluate(
        'Boolean(document.getElementById("Runtime_evaluate"))',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );

      assert.strictEqual(
        targetValue,
        'v8',
        `Expected target dropdown value to be "v8", got "${targetValue}"`,
      );
      assert.strictEqual(
        hasRuntimeEvaluate,
        true,
        'Expected #Runtime_evaluate element to exist in DOM for v8',
      );
    });

    await t.test(
      '3b. Target selector user interaction: switching dropdown from tot to v8',
      async () => {
        await page.Page.navigate({ url: `${baseUrl}/#/Page.navigate` });

        // Wait for page ready
        await client.pollEvaluate(
          'Boolean(document.getElementById("target-selector"))',
          (/** @type {any} */ v) => Boolean(v),
          sessionId,
        );

        // Change select element value and dispatch change event
        await client.evaluate(
          `
        (function() {
          const select = document.getElementById('target-selector');
          select.value = 'v8';
          select.dispatchEvent(new Event('change', { bubbles: true }));
        })()
      `,
          sessionId,
        );

        // Assert hash changed to v8
        const newHash = await client.pollEvaluate(
          'window.location.hash',
          (/** @type {any} */ val) => val.startsWith('#/v8'),
          sessionId,
        );

        assert.ok(
          newHash.startsWith('#/v8'),
          `Expected hash to start with "#/v8", got "${newHash}"`,
        );
      },
    );

    await t.test('4. Search keyboard shortcut (/)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/Page` });

      // Ensure page is ready
      await client.pollEvaluate(
        'Boolean(document.getElementById("search"))',
        (/** @type {any} */ v) => Boolean(v),
        sessionId,
      );
      await client.pollEvaluate(
        'window.app && window.app._search && window.app._search._items.length > 0',
        (/** @type {any} */ v) => Boolean(v),
        sessionId,
      );

      // Press '/' via Input.dispatchKeyEvent
      await page.Input.dispatchKeyEvent({
        type: 'rawKeyDown',
        key: '/',
        code: 'Slash',
        windowsVirtualKeyCode: 191,
      });
      await page.Input.dispatchKeyEvent({
        type: 'keyUp',
        key: '/',
        code: 'Slash',
        windowsVirtualKeyCode: 191,
      });

      const isFocused = await client.pollEvaluate(
        'document.activeElement === document.getElementById("search")',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );

      assert.strictEqual(isFocused, true, 'Expected search input to be focused after pressing "/"');
    });

    await t.test('5. Table of contents badges and backtick code rendering (#/Page)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/Page` });

      // Wait for domain content to render
      await client.pollEvaluate(
        'Boolean(document.querySelector(".domain-toc"))',
        (/** @type {any} */ arr) => Boolean(arr),
        sessionId,
      );

      // Verify TOC items contain badges
      const methodBadgeText = await client.evaluate(
        'document.querySelector(".entity-icon-method") ? document.querySelector(".entity-icon-method").textContent : null',
        sessionId,
      );
      const eventBadgeText = await client.evaluate(
        'document.querySelector(".entity-icon-event") ? document.querySelector(".entity-icon-event").textContent : null',
        sessionId,
      );
      const typeBadgeText = await client.evaluate(
        'document.querySelector(".entity-icon-type") ? document.querySelector(".entity-icon-type").textContent : null',
        sessionId,
      );

      assert.strictEqual(methodBadgeText, 'Methods');
      assert.strictEqual(eventBadgeText, 'Events');
      assert.strictEqual(typeBadgeText, 'Types');

      // Verify inline code tags were parsed and rendered from backticks in descriptions
      const hasCodeTags = await client.pollEvaluate(
        'document.querySelectorAll(".parameter-description code").length > 0',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );
      assert.strictEqual(
        hasCodeTags,
        true,
        'Expected markdown backticks to be rendered as <code> tags',
      );
    });

    await t.test('6. Type cross-references (#/DOM.NodeId)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/DOM.NodeId` });

      // Wait for references list to render
      const refCount = await client.pollEvaluate(
        'document.querySelectorAll(".references-list li").length',
        (/** @type {any} */ val) => typeof val === 'number' && val > 0,
        sessionId,
      );

      assert.ok(
        refCount > 0,
        `Expected DOM.NodeId to have back-references, got count: ${refCount}`,
      );
    });

    await t.test('7. Mobile responsive drawer (#drawer-toggle & backdrop)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/Page` });

      await client.pollEvaluate(
        'Boolean(document.getElementById("drawer-toggle"))',
        (/** @type {any} */ v) => Boolean(v),
        sessionId,
      );

      // Click drawer toggle
      await client.evaluate('document.getElementById("drawer-toggle").click()', sessionId);
      const drawerOpen = await client.pollEvaluate(
        'document.body.classList.contains("drawer-open")',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );
      assert.strictEqual(
        drawerOpen,
        true,
        'Expected body to have "drawer-open" class after toggle click',
      );

      // Click backdrop to close
      await client.evaluate('document.getElementById("drawer-backdrop").click()', sessionId);
      const drawerClosed = await client.pollEvaluate(
        '!document.body.classList.contains("drawer-open")',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );
      assert.strictEqual(
        drawerClosed,
        true,
        'Expected body to not have "drawer-open" class after backdrop click',
      );
    });

    await t.test('8. Wildcard 404 redirection (/1-3/Page/#method-navigate)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/1-3/Page/#method-navigate` });

      const hash = await client.pollEvaluate(
        'window.location.hash',
        (/** @type {any} */ val) => val.includes('Page.navigate'),
        sessionId,
      );

      assert.ok(
        hash.includes('Page.navigate'),
        `Expected hash after 404 fallback to contain Page.navigate, got "${hash}"`,
      );
    });

    await t.test('9. Root landing page rendering and rich content (#/)', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/` });

      const hasLandingContent = await client.pollEvaluate(
        'Boolean(document.querySelector(".landing-hero") || document.querySelector(".box-content"))',
        (/** @type {any} */ val) => val === true,
        sessionId,
      );
      const title = await client.evaluate('document.title', sessionId);

      assert.strictEqual(
        hasLandingContent,
        true,
        'Expected landing content to be rendered at root hash route',
      );
      assert.strictEqual(
        title,
        'DevTools Protocol Viewer',
        `Expected root page title, got "${title}"`,
      );
    });

    await t.test('10. Headings have scroll-margin-top clearance from fixed header', async () => {
      await page.Page.navigate({ url: `${baseUrl}/#/Page` });

      const h4ScrollMarginTop = await client.pollEvaluate(
        'window.getComputedStyle(document.querySelector("h4")).scrollMarginTop',
        (/** @type {any} */ val) => Boolean(val && val !== '0px'),
        sessionId,
      );

      // calc(var(--header-height) + 16px) -> 50px + 16px = 66px
      assert.strictEqual(
        h4ScrollMarginTop,
        '66px',
        `Expected h4 scroll-margin-top to be 66px, got "${h4ScrollMarginTop}"`,
      );
    });
  } finally {
    if (targetId && browserApi) {
      try {
        await browserApi.Target.closeTarget({ targetId });
      } catch {}
    }
    if (browserWs) {
      try {
        browserWs.close();
      } catch {}
    }
    chromeProcess.kill('SIGKILL');
    server.close();
    try {
      fs.rmSync(tmpUserDataDir, { recursive: true, force: true });
    } catch {}
  }
});
