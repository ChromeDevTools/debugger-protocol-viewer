/**
 * @fileoverview Main Application Controller for Chrome DevTools Protocol Viewer.
 */

import {
  normalizeProtocol,
  stabilize,
  computeBackReferences,
  parseRoute,
  formatRoute,
  normalizeTarget,
} from './protocol-model.js';

const PROTOCOL_URLS = {
  browser: 'https://cdn.jsdelivr.net/gh/ChromeDevTools/devtools-protocol@master/json/browser_protocol.json',
  js: 'https://cdn.jsdelivr.net/gh/ChromeDevTools/devtools-protocol@master/json/js_protocol.json',
};

document.addEventListener('DOMContentLoaded', () => {
  const sidebarElement = document.getElementById('sidebar');
  const domainListElement = document.getElementById('domain-list');
  const contentElement = document.getElementById('content');
  const searchElement = document.getElementById('search');
  const searchResultsElement = document.getElementById('sresults');
  const targetSelector = document.getElementById('target-selector');
  const domainFilterInput = document.getElementById('domain-filter');
  const drawerToggle = document.getElementById('drawer-toggle');
  const drawerBackdrop = document.getElementById('drawer-backdrop');

  window.app = new App({
    sidebarElement,
    domainListElement,
    contentElement,
    searchElement,
    searchResultsElement,
    targetSelector,
    domainFilterInput,
    drawerToggle,
    drawerBackdrop,
  });
});

class App {
  /**
   * @param {Object} elements
   */
  constructor({
    sidebarElement,
    domainListElement,
    contentElement,
    searchElement,
    searchResultsElement,
    targetSelector,
    domainFilterInput,
    drawerToggle,
    drawerBackdrop,
  }) {
    this._sidebarElement = sidebarElement;
    this._domainListElement = domainListElement;
    this._contentElement = contentElement;
    this._targetSelector = targetSelector;
    this._domainFilterInput = domainFilterInput;
    this._drawerToggle = drawerToggle;
    this._drawerBackdrop = drawerBackdrop;

    /** @type {'tot'|'stable'|'v8'} */
    this._currentTarget = 'tot';
    /** @type {string|null} */
    this._currentDomain = null;

    /** @type {Map<string, Object>} */
    this._activeDomains = new Map();

    /** @type {Record<'tot'|'stable'|'v8', { all: Map<string, Object>, stable: Map<string, Object> }>} */
    this._targetStore = {
      tot: { all: new Map(), stable: new Map() },
      stable: { all: new Map(), stable: new Map() },
      v8: { all: new Map(), stable: new Map() },
    };

    this._search = new Search(searchElement, searchResultsElement);

    this._setupDrawerEvents();
    this._setupSidebarEvents();
    this._setupLinkInterception();
    this._setupRoutingEvents();

    this._initialize();
  }

  focusContent() {
    this._contentElement.focus();
  }

  /**
   * Navigates to given route.
   * @param {string} route
   */
  navigate(route) {
    if (window.location.hash !== route) {
      window.location.hash = route;
    } else {
      this._onRoute();
    }
  }

  /**
   * Formats a canonical route string given an entity ref (e.g. 'Page.navigate' or 'DOM').
   * @param {string} ref
   * @returns {string}
   */
  formatRef(ref) {
    if (!ref) {
      return formatRoute({ target: this._currentTarget, domain: null, member: null });
    }
    const dotIndex = ref.indexOf('.');
    if (dotIndex !== -1) {
      const domain = ref.slice(0, dotIndex);
      const member = ref.slice(dotIndex + 1);
      return formatRoute({ target: this._currentTarget, domain, member });
    }
    return formatRoute({ target: this._currentTarget, domain: ref, member: null });
  }

  /**
   * Fetches a JSON file and fails fast if response is not ok.
   * @param {string} url
   * @returns {Promise<Object>}
   */
  async _fetchProtocolJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load protocol from ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /**
   * Loads protocols and prepares tot, stable, and v8 target datasets.
   */
  async _initialize() {
    try {
      const [browserProto, jsProto] = await Promise.all([
        this._fetchProtocolJson(PROTOCOL_URLS.browser),
        this._fetchProtocolJson(PROTOCOL_URLS.js),
      ]);

      this._prepareDatasets(browserProto, jsProto);
      this._setupExperimentalToggle();
      this._onRoute();
    } catch (error) {
      this._contentElement.textContent = '';
      this._contentElement.appendChild(renderError(`Initialization failed: ${error.message}`));
    }
  }

  /**
   * Prepares protocol datasets for tot, stable, and v8.
   * @param {Object} browserProto
   * @param {Object} jsProto
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
      .filter(domain => !domain.experimental)
      .map(domain => stabilize(domain));

    computeBackReferences(totDomains);
    computeBackReferences(stableTotDomains);

    for (const d of totDomains) {
      this._targetStore.tot.all.set(d.domain, d);
    }
    for (const d of stableTotDomains) {
      this._targetStore.tot.stable.set(d.domain, d);
    }

    // 2. Stable Protocol (1.3)
    // Stable target is the stabilized Tip-of-Tree protocol
    for (const d of stableTotDomains) {
      this._targetStore.stable.all.set(d.domain, d);
      this._targetStore.stable.stable.set(d.domain, d);
    }

    // 3. V8 Inspector
    const v8Domains = normalizeProtocol({
      domains: structuredClone(jsProto.domains || []),
    }).domains;
    const stableV8Domains = v8Domains
      .filter(domain => !domain.experimental)
      .map(domain => stabilize(domain));

    computeBackReferences(v8Domains);
    computeBackReferences(stableV8Domains);

    for (const d of v8Domains) {
      this._targetStore.v8.all.set(d.domain, d);
    }
    for (const d of stableV8Domains) {
      this._targetStore.v8.stable.set(d.domain, d);
    }
  }

  _setupExperimentalToggle() {
    const isExpEnabled = window.localStorage['experimental'] !== 'false';
    document.body.classList.toggle('experimental-enabled', isExpEnabled);

    const expToggle = document.getElementById('experimental');
    if (expToggle) {
      expToggle.addEventListener('click', () => {
        const currentlyEnabled = window.localStorage['experimental'] !== 'false';
        const nextState = !currentlyEnabled;
        window.localStorage['experimental'] = nextState ? 'true' : 'false';
        document.body.classList.toggle('experimental-enabled', nextState);
        this._updateActiveDomains();
        this._onRoute();
      });
    }
  }

  _setupDrawerEvents() {
    if (this._drawerToggle) {
      this._drawerToggle.addEventListener('click', () => this._toggleDrawer());
    }
    if (this._drawerBackdrop) {
      this._drawerBackdrop.addEventListener('click', () => this._closeDrawer());
    }
    document.addEventListener('keydown', event => {
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
    // In-sidebar domain filter
    if (this._domainFilterInput) {
      this._domainFilterInput.addEventListener('input', () => {
        this._applyDomainFilter();
      });
    }

    // Target selector dropdown
    if (this._targetSelector) {
      this._targetSelector.addEventListener('change', () => {
        const nextTarget = normalizeTarget(this._targetSelector.value);
        if (nextTarget === this._currentTarget) return;

        this._currentTarget = nextTarget;
        const newRoute = formatRoute({
          target: this._currentTarget,
          domain: this._currentDomain,
          member: null,
        });
        this.navigate(newRoute);
      });
    }
  }

  _applyDomainFilter() {
    if (!this._domainFilterInput || !this._domainListElement) return;
    const query = this._domainFilterInput.value.trim().toLowerCase();
    const links = this._domainListElement.querySelectorAll('.domain-link');
    for (const link of links) {
      const name = link.dataset.domain ? link.dataset.domain.toLowerCase() : link.textContent.toLowerCase();
      link.style.display = name.includes(query) ? '' : 'none';
    }
  }

  _setupLinkInterception() {
    document.body.addEventListener('click', event => {
      const anchor = event.target.closest('a');
      if (!anchor) return;
      if (anchor.target === '_blank') return;
      if (anchor.hostname && anchor.hostname !== window.location.hostname) return;

      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('#') || href.startsWith('?'))) {
        event.preventDefault();
        this._closeDrawer();
        this.navigate(href);
      }
    }, false);
  }

  _setupRoutingEvents() {
    window.addEventListener('hashchange', () => this._onRoute());
    window.addEventListener('popstate', () => this._onRoute());
  }

  _updateActiveDomains() {
    const isExp = window.localStorage['experimental'] !== 'false';
    const store = this._targetStore[this._currentTarget] || this._targetStore.tot;
    this._activeDomains = isExp ? store.all : store.stable;

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

    let domain = route.domain;
    const member = route.member;

    // If domain is null but member exists (isolated legacy anchor), resolve to current domain
    if (!domain && member && this._currentDomain) {
      domain = this._currentDomain;
    }

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
      this._contentElement.appendChild(
        renderError(`Unknown domain: ${domain}. Enable experimental domains above?`)
      );
      return;
    }

    const currentLink = this._domainListElement.querySelector(`[data-domain='${domain}']`);
    if (currentLink) {
      currentLink.classList.add('active-link');
      if (typeof currentLink.scrollIntoViewIfNeeded === 'function') {
        currentLink.scrollIntoViewIfNeeded(false);
      }
    }

    const domainObject = this._activeDomains.get(domain);
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

    const template = document.querySelector('#landing');
    if (template) {
      const clone = document.importNode(template.content, true);
      this._contentElement.appendChild(clone);
    }
  }

  /**
   * @param {Map<string, Object>} domains
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

    this._applyDomainFilter();
  }
}

/**
 * @param {string} error
 * @returns {Element}
 */
function renderError(error) {
  const main = E.box();
  const box = main.div('box-content');
  box.el('h2', '', 'Error');
  box.p('', error);
  return main;
}
