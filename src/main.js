/**
 * @fileoverview Main Application Controller for Chrome DevTools Protocol Viewer.
 */

/** @import { ProtocolDomain, NormalizedProtocolDomain, ProtocolRoot, TargetKind, RouteInfo } from '../types/types.d.ts' */
import {
  normalizeProtocol,
  stabilize,
  computeBackReferences,
  parseRoute,
  formatRoute,
  normalizeTarget,
} from './protocol-model.js';
import { $ } from './bling.js';
import { ProtocolRenderer } from './protocol_renderer.js';
import { Search } from './search.js';

const PROTOCOL_URLS = {
  browser:
    'https://cdn.jsdelivr.net/gh/ChromeDevTools/devtools-protocol@master/json/browser_protocol.json',
  js: 'https://cdn.jsdelivr.net/gh/ChromeDevTools/devtools-protocol@master/json/js_protocol.json',
};

document.addEventListener('DOMContentLoaded', () => {
  const sidebarElement = $('#sidebar');
  const domainListElement = $('#domain-list');
  const contentElement = $('#content');
  const searchElement = $('#search');
  const searchResultsElement = $('#sresults');
  const targetSelector = /** @type {HTMLSelectElement} */ ($('#target-selector'));
  const drawerToggle = $('#drawer-toggle');
  const drawerBackdrop = $('#drawer-backdrop');

  window.app = new App({
    sidebarElement,
    domainListElement,
    contentElement,
    searchElement,
    searchResultsElement,
    targetSelector,
    drawerToggle,
    drawerBackdrop,
  });
});

/**
 * @typedef {Object} AppElements
 * @property {HTMLElement} sidebarElement
 * @property {HTMLElement} domainListElement
 * @property {HTMLElement} contentElement
 * @property {HTMLElement} searchElement
 * @property {HTMLElement} searchResultsElement
 * @property {HTMLSelectElement} targetSelector
 * @property {HTMLElement} drawerToggle
 * @property {HTMLElement} drawerBackdrop
 */

class App {
  /**
   * @param {AppElements} elements
   */
  constructor({
    sidebarElement,
    domainListElement,
    contentElement,
    searchElement,
    searchResultsElement,
    targetSelector,
    drawerToggle,
    drawerBackdrop,
  }) {
    this._sidebarElement = sidebarElement;
    this._domainListElement = domainListElement;
    this._contentElement = contentElement;
    this._targetSelector = targetSelector;
    this._drawerToggle = drawerToggle;
    this._drawerBackdrop = drawerBackdrop;

    /** @type {TargetKind} */
    this._currentTarget = 'tot';
    /** @type {string|null} */
    this._currentDomain = null;

    /** @type {Map<string, NormalizedProtocolDomain>} */
    this._activeDomains = new Map();

    /** @type {Record<TargetKind, { all: Map<string, NormalizedProtocolDomain>, stable: Map<string, NormalizedProtocolDomain> }>} */
    this._targetStore = {
      tot: { all: new Map(), stable: new Map() },
      stable: { all: new Map(), stable: new Map() },
      v8: { all: new Map(), stable: new Map() },
    };

    this.formatRef = this.formatRef.bind(this);
    this._search = new Search(searchElement, searchResultsElement, this);

    this._setupDrawerEvents();
    this._setupSidebarEvents();
    this._setupLinkInterception();
    this._setupRoutingEvents();

    this.init();
  }

  /**
   * @param {string} ref
   * @returns {string}
   */
  formatRef(ref) {
    if (this._currentTarget === 'tot') {
      return `#/${ref}`;
    }
    return `#/${this._currentTarget}/${ref}`;
  }

  focusContent() {
    this._contentElement.focus();
  }

  /**
   * @param {string} route
   */
  navigate(route) {
    let cleanRoute = route;
    if (cleanRoute.startsWith('/tot/')) {
      cleanRoute = cleanRoute.replace('/tot/', '#/');
    } else if (cleanRoute.startsWith('/v8/')) {
      cleanRoute = cleanRoute.replace('/v8/', '#/v8/');
    } else if (cleanRoute.startsWith('/1-3/') || cleanRoute.startsWith('/1-2/')) {
      cleanRoute = cleanRoute.replace(/^\/(?:1-3|1-2)\//, '#/stable/');
    }

    if (window.location.hash !== cleanRoute) {
      window.location.hash = cleanRoute.startsWith('#') ? cleanRoute : '#' + cleanRoute;
    } else {
      this._onRoute();
    }
  }

  /**
   * Fetches JSON protocol specification with fallback.
   * @param {string} url
   * @returns {Promise<ProtocolRoot>}
   */
  async _fetchProtocolJson(url) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.json();
    } catch (e) {
      // Fallback: local protocol files served by the app
      let localFallback = 'data/tot.json';
      if (url.includes('js_protocol')) {
        localFallback = 'data/v8.json';
      }
      const localRes = await fetch(localFallback);
      if (!localRes.ok)
        throw new Error(`Fallback failed (${localFallback}): HTTP ${localRes.status}`);
      return await localRes.json();
    }
  }

  async init() {
    try {
      const [browserProto, jsProto] = await Promise.all([
        this._fetchProtocolJson(PROTOCOL_URLS.browser),
        this._fetchProtocolJson(PROTOCOL_URLS.js),
      ]);

      this._prepareDatasets(browserProto, jsProto);
      this._onRoute();
    } catch (error) {
      this._contentElement.textContent = '';
      const message = error instanceof Error ? error.message : String(error);
      this._contentElement.appendChild(renderError(`Initialization failed: ${message}`));
    }
  }

  /**
   * Prepares protocol datasets for tot, stable, and v8.
   * @param {ProtocolRoot} browserProto
   * @param {ProtocolRoot} jsProto
   */
  _prepareDatasets(browserProto, jsProto) {
    // 1. Tip-of-Tree (Tot)
    const combinedTotDomains = [
      ...structuredClone(browserProto.domains || []),
      ...structuredClone(jsProto.domains || []),
    ];
    const normalizedTot = normalizeProtocol({ domains: combinedTotDomains });
    const totDomains = normalizedTot.domains;
    const stableTotDomains = totDomains
      .filter((/** @type {NormalizedProtocolDomain} */ domain) => !domain.experimental)
      .map((/** @type {NormalizedProtocolDomain} */ domain) => stabilize(domain));

    computeBackReferences(totDomains);
    computeBackReferences(stableTotDomains);

    for (const d of totDomains) {
      this._targetStore.tot.all.set(d.domain, d);
    }
    for (const d of stableTotDomains) {
      this._targetStore.tot.stable.set(d.domain, d);
    }

    // 2. Stable Protocol (1.3)
    // Stable target is the stabilized Tip-of-Tree protocol (strictly no experimental domains/items)
    for (const d of stableTotDomains) {
      this._targetStore.stable.all.set(d.domain, d);
      this._targetStore.stable.stable.set(d.domain, d);
    }

    // 3. V8 Inspector
    const v8Domains = normalizeProtocol({
      domains: structuredClone(jsProto.domains || []),
    }).domains;
    const stableV8Domains = v8Domains
      .filter((/** @type {NormalizedProtocolDomain} */ domain) => !domain.experimental)
      .map((/** @type {NormalizedProtocolDomain} */ domain) => stabilize(domain));

    computeBackReferences(v8Domains);
    computeBackReferences(stableV8Domains);

    for (const d of v8Domains) {
      this._targetStore.v8.all.set(d.domain, d);
    }
    for (const d of stableV8Domains) {
      this._targetStore.v8.stable.set(d.domain, d);
    }
  }

  _setupDrawerEvents() {
    if (this._drawerToggle) {
      this._drawerToggle.addEventListener('click', () => this._toggleDrawer());
    }
    if (this._drawerBackdrop) {
      this._drawerBackdrop.addEventListener('click', () => this._closeDrawer());
    }
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && document.body.classList.contains('drawer-open')) {
        this._closeDrawer();
      }
    });
  }

  _toggleDrawer() {
    document.body.classList.toggle('drawer-open');
  }

  _closeDrawer() {
    document.body.classList.remove('drawer-open');
  }

  _setupSidebarEvents() {
    // Target selector dropdown
    if (this._targetSelector) {
      this._targetSelector.addEventListener('change', () => {
        const nextTarget = normalizeTarget(this._targetSelector.value);
        if (nextTarget === this._currentTarget) return;

        this._currentTarget = nextTarget;
        const targetStore = this._targetStore[this._currentTarget] || this._targetStore.tot;
        const domainExistsInTarget =
          this._currentDomain && targetStore.all.has(this._currentDomain);
        const domain = domainExistsInTarget ? this._currentDomain : null;

        const newRoute = formatRoute({
          target: this._currentTarget,
          domain,
          member: null,
        });
        this.navigate(newRoute);
      });
    }
  }

  _setupLinkInterception() {
    document.body.addEventListener(
      'click',
      (event) => {
        const target = /** @type {HTMLElement|null} */ (event.target);
        if (!target) return;
        const anchor = target.closest('a');
        if (!anchor) return;
        if (anchor.target === '_blank') return;
        if (anchor.hostname && anchor.hostname !== window.location.hostname) return;

        const href = anchor.getAttribute('href');
        if (
          anchor.classList.contains('section-jump-pill') ||
          href === '#methods' ||
          href === '#events' ||
          href === '#types'
        ) {
          return;
        }
        if (href && (href.startsWith('#') || href.startsWith('?'))) {
          event.preventDefault();
          this._closeDrawer();
          this.navigate(href);
        }
      },
      false,
    );
  }

  _setupRoutingEvents() {
    window.addEventListener('hashchange', () => this._onRoute());
    window.addEventListener('popstate', () => this._onRoute());
  }

  _updateActiveDomains() {
    const store = this._targetStore[this._currentTarget] || this._targetStore.tot;
    this._activeDomains = store.all;

    this._search.setDomains(Array.from(this._activeDomains.values()));
    this._renderSidebar(this._activeDomains);
  }

  _onRoute() {
    let rawRoute = window.location.hash;
    if (window.location.search && !rawRoute) {
      rawRoute = window.location.search;
    } else if (!rawRoute || /^#(?:method|type|event)-/.test(rawRoute)) {
      rawRoute = window.location.pathname + (rawRoute || '');
    }

    const route = parseRoute(rawRoute);

    // Sync target
    if (route.target !== this._currentTarget) {
      this._currentTarget = route.target;
    }
    if (this._targetSelector && this._targetSelector.value !== this._currentTarget) {
      this._targetSelector.value = this._currentTarget;
    }

    this._updateActiveDomains();

    const domain = route.domain;
    const member = route.member;

    if (!domain) {
      this._currentDomain = null;
      this._onNavigateHome();
      return;
    }

    // In-page navigation: if domain is already rendered, scroll to member without DOM re-render
    if (this._currentDomain === domain && this._contentElement.firstChild && member) {
      const canonicalTitle = `${domain}.${member}`;
      document.title = `${canonicalTitle} - DevTools Protocol`;
      this._search.setDefaultValue(canonicalTitle);
      const titleId = ProtocolRenderer.titleId(domain, member);
      const elem = this._contentElement.querySelector('#' + titleId);
      if (elem) {
        elem.scrollIntoView();
      }
      this.focusContent();
      return;
    }

    this._currentDomain = domain;
    this._onNavigateDomain(domain, member);
  }

  /**
   * @param {string} domain
   * @param {string|null} member
   */
  _onNavigateDomain(domain, member) {
    const canonicalTitle = member ? `${domain}.${member}` : domain;
    document.title = `${canonicalTitle} - DevTools Protocol`;

    const searchDefault = member ? `${domain}.${member}` : domain;
    this._search.setDefaultValue(searchDefault);
    this._search.cancelSearch();

    this._contentElement.textContent = '';

    // Update active link in sidebar
    const active = this._domainListElement.querySelector('.active-link');
    if (active) {
      active.classList.remove('active-link');
    }

    if (!this._activeDomains.has(domain)) {
      this._contentElement.appendChild(renderError(`Unknown domain: ${domain}.`));
      return;
    }

    const currentLink = /** @type {HTMLElement|null} */ (
      this._domainListElement.querySelector(`[data-domain='${domain}']`)
    );
    if (currentLink) {
      currentLink.classList.add('active-link');
      if (typeof currentLink.scrollIntoViewIfNeeded === 'function') {
        currentLink.scrollIntoViewIfNeeded(false);
      }
    }

    const domainObject = this._activeDomains.get(domain);
    if (!domainObject) return;
    const rendered = ProtocolRenderer.renderDomain(domainObject);
    if (rendered) {
      this._contentElement.appendChild(rendered);
      if (member) {
        const titleId = ProtocolRenderer.titleId(domain, member);
        const elem = rendered.querySelector('#' + titleId);
        if (elem) {
          elem.scrollIntoView();
        } else {
          this._contentElement.scrollTop = 0;
        }
      } else {
        this._contentElement.scrollTop = 0;
      }
    }

    this.focusContent();
  }

  _onNavigateHome() {
    document.title = 'DevTools Protocol Viewer';
    this._search.setDefaultValue('');
    this._search.cancelSearch();
    this._contentElement.textContent = '';

    const active = this._domainListElement.querySelector('.active-link');
    if (active) {
      active.classList.remove('active-link');
    }

    const template = /** @type {HTMLTemplateElement|null} */ (document.querySelector('#landing'));
    if (template) {
      const clone = document.importNode(template.content, true);
      this._contentElement.appendChild(clone);
    }
  }

  /**
   * @param {Map<string, NormalizedProtocolDomain>} domains
   */
  _renderSidebar(domains) {
    this._domainListElement.textContent = '';
    const domainNames = Array.from(domains.keys());

    for (const name of domainNames) {
      const domain = domains.get(name);
      const link = document.createElement('a');
      link.href = this.formatRef(name);
      link.className = 'domain-link';
      link.dataset.domain = name;
      link.textContent = name;

      ProtocolRenderer.applyBackground(domain, link);

      this._domainListElement.appendChild(link);
    }
  }
}

/**
 * @param {string} error
 * @returns {Element}
 */
function renderError(error) {
  const main = document.createElement('div');
  main.className = 'box';
  const box = document.createElement('div');
  box.className = 'box-content';
  const h2 = document.createElement('h2');
  h2.textContent = 'Error';
  const p = document.createElement('p');
  p.textContent = error;
  box.append(h2, p);
  main.appendChild(box);
  return main;
}
