/**
 * @fileoverview Fuzzy search controller and UI rendering for protocol entities.
 */

/** @import { ProtocolDomain } from './types.d.ts' */

// Number of search results to render immediately.
const SEARCH_RENDER_COUNT = 50;

/** @enum {symbol} */
const SearchItemType = {
  Method: Symbol('Method'),
  Type: Symbol('Type'),
  Event: Symbol('Event'),
};

class SearchItem {
  /**
   * @param {string} domainName
   * @param {string} domainEntry
   * @param {symbol} itemType
   * @param {string} [description]
   */
  constructor(domainName, domainEntry, itemType, description) {
    this.domainName = domainName;
    this.domainEntry = domainEntry;
    this.type = itemType;
    this.description = description || '';
    this.title = this.domainName + '.' + this.domainEntry;
    this.route = (window.app && window.app.formatRef) ? window.app.formatRef(this.title) : '#/' + this.title;
  }
}

class SearchResult {
  /**
   * @param {SearchItem} item
   * @param {number} score
   * @param {Array<number>} matches
   */
  constructor(item, score, matches) {
    this.item = item;
    this.score = score;
    this.matches = matches;
  }
}

class Search {
  /**
   * @param {Element} searchHeader
   * @param {Element} resultsElement
   */
  constructor(searchHeader, resultsElement) {
    const input = searchHeader.tagName === 'INPUT' ? searchHeader : (searchHeader.querySelector('input') || searchHeader);
    this._searchInput = /** @type {HTMLInputElement} */ (input);
    /** @type {Array<SearchItem>} */
    this._items = [];
    /** @type {Set<string>} */
    this._domainNames = new Set();
    /** @type {Element|null} */
    this._selectedElement = null;
    this._defaultValue = '';
    this._searchInput.addEventListener('input', this._onInput.bind(this), false);
    this._searchInput.addEventListener('keydown', this._onKeyDown.bind(this), false);
    this._resultsElement = resultsElement;

    // Activate search on any keypress (unless user is in an input field)
    document.addEventListener('keypress', event => {
      const target = /** @type {HTMLElement|null} */ (event.target);
      if (target && target.matches && target.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      if (this._searchInput === document.activeElement)
        return;
      if (/\S/.test(event.key)) {
        if (event.key !== '.')
          this._searchInput.value = '';
        this._searchInput.focus();
      }
    });

    // Activate search on backspace, delete, '/', or Cmd+K
    document.addEventListener('keydown', event => {
      const target = /** @type {HTMLElement|null} */ (event.target);
      if (target && target.matches && target.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      if (this._searchInput === document.activeElement)
        return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key === 'k')) {
        event.preventDefault();
        this._searchInput.focus();
        this._searchInput.select();
        return;
      }
      if (event.keyCode === 8 || event.keyCode === 46)
        this._searchInput.focus();
    });

    // Activate on paste
    document.addEventListener('paste', event => {
      const target = /** @type {HTMLElement|null} */ (event.target);
      if (target && target.matches && target.matches('input, textarea, select, [contenteditable="true"]'))
        return;
      if (this._searchInput === document.activeElement)
        return;
      this._searchInput.focus();
    });

    document.addEventListener('click', event => {
      const target = /** @type {HTMLElement|null} */ (event.target);
      if (!target || this._searchInput.contains(target))
        return;
      const searchItem = /** @type {HTMLElement & { __route?: string } | null} */ (target.closest('.search-item'));
      if (searchItem) {
        event.preventDefault();
        event.stopPropagation();
        this.cancelSearch();
        if (window.app && window.app.navigate && searchItem.__route)
          window.app.navigate(searchItem.__route);
        return;
      }
    });
  }

  /**
   * @param {Array<ProtocolDomain>} domains
   */
  setDomains(domains) {
    this._domainNames.clear();
    this._items = [];
    for (var domain of domains) {
      this._domainNames.add(domain.domain.toLowerCase());
      for (var command of (domain.commands || [])) {
        let item = new SearchItem(domain.domain, command.name, SearchItemType.Method, command.description);
        this._items.push(item);
      }
      for (var event of (domain.events || [])) {
        let item = new SearchItem(domain.domain, event.name, SearchItemType.Event, event.description);
        this._items.push(item);
      }
      for (var type of (domain.types || [])) {
        let item = new SearchItem(domain.domain, type.id, SearchItemType.Type, type.description);
        this._items.push(item);
      }
    }
  }

  cancelSearch() {
    this._searchInput.blur();
    /** @type {HTMLElement} */ (this._resultsElement).style.setProperty('display', 'none');
    this._searchInput.value = this._defaultValue;
    if (window.app && window.app.focusContent)
      window.app.focusContent();
  }

  /**
   * @param {string} value
   */
  setDefaultValue(value) {
    this._defaultValue = value;
  }

  _onInput() {
    this._selectedElement = null;
    /** @type {HTMLElement} */ (this._resultsElement).style.setProperty('display', 'block');
    let query = this._searchInput.value.trim();
    let items = this._items;
    let results = this._doSearch(items, query);
    if (results.length === 0) {
      this._renderMessage('Nothing is found.');
      return;
    }
    this._resultsElement.textContent = '';
    if (!query)
      this._addNavigateHomeItem();
    for (let i = 0; i < Math.min(results.length, SEARCH_RENDER_COUNT); ++i)
      this._resultsElement.appendChild(renderSearchResult(results[i]));
    this._addAllResultsButtonIfNeeded(results);
    this._selectedElement = /** @type {Element|null} */ (this._resultsElement.firstChild);
    if (this._selectedElement)
      this._selectedElement.classList.add('selected');
  }

  _addNavigateHomeItem() {
    let main = E.hbox('search-item', 'Navigate Home');
    main.classList.add('custom-search-result');
    /** @type {any} */ (main).__route = '#/';
    this._resultsElement.appendChild(main);
  }

  /**
   * @param {Array<SearchResult>} results
   * @returns {HTMLElement|undefined}
   */
  _addAllResultsButtonIfNeeded(results) {
    let remainingResults = results.length - SEARCH_RENDER_COUNT;
    if (remainingResults <= 0)
      return;
    let main = E.hbox('search-item', `Show Remaining ${remainingResults} Results...`);
    main.classList.add('custom-search-result');
    main.classList.add('monospace');
    main.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      for (let i = SEARCH_RENDER_COUNT; i < results.length; ++i)
        this._resultsElement.appendChild(renderSearchResult(results[i]));
      let next = /** @type {Element|null} */ (main.nextSibling);
      main.remove();
      this._selectElement(next);
      this._searchInput.focus();
    }, false);
    this._resultsElement.appendChild(main);
    return main;
  }

  /**
   * @param {string} text
   */
  _renderMessage(text) {
    this._resultsElement.textContent = '';
    const box = this._resultsElement.box('search-results-message');
    box.el('h4', '', text);
  }

  /**
   * @param {Array<SearchItem>} items
   * @param {string} query
   * @returns {Array<SearchResult>}
   */
  _doSearch(items, query) {
    let results = [];
    if (!query) {
      for (let item of items)
        results.push(new SearchResult(item, 0, []));
      return results;
    }

    let fuzzySearch = new FuzzySearch(query);
    for (let item of items) {
      /** @type {Array<number>} */
      let matches = [];
      let score = fuzzySearch.score(item.title, matches);
      if (score === 0)
        continue;
      results.push(new SearchResult(item, score, matches));
    }
    results.sort((/** @type {SearchResult} */ a, /** @type {SearchResult} */ b) => {
      const scoreDiff = b.score - a.score;
      if (scoreDiff)
        return scoreDiff;
      // Prefer left-most search results.
      const startDiff = (a.matches[0] ?? 0) - (b.matches[0] ?? 0);
      if (startDiff)
        return startDiff;
      return a.item.title.length - b.item.title.length;
    });
    return results;
  }

  /**
   * @param {KeyboardEvent} event
   */
  _onKeyDown(event) {
    if (event.key === 'Escape' || event.keyCode === 27) {
      event.preventDefault();
      event.stopPropagation();
      this.cancelSearch();
    } else if (event.key === 'ArrowDown') {
      this._selectNext(event);
    } else if (event.key === 'ArrowUp') {
      this._selectPrevious(event);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      event.stopPropagation();
      if (this._selectedElement)
        /** @type {HTMLElement} */ (this._selectedElement).click();
    }
  }

  /**
   * @param {Event} event
   */
  _selectNext(event) {
    if (!this._selectedElement)
      return;
    event.preventDefault();
    event.stopPropagation();
    let next = /** @type {Element|null} */ (this._selectedElement.nextSibling);
    if (!next)
      next = /** @type {Element|null} */ (this._resultsElement.firstChild);
    this._selectElement(next);
  }

  /**
   * @param {Event} event
   */
  _selectPrevious(event) {
    if (!this._selectedElement)
      return;
    event.preventDefault();
    event.stopPropagation();
    let previous = /** @type {Element|null} */ (this._selectedElement.previousSibling);
    if (!previous)
      previous = /** @type {Element|null} */ (this._resultsElement.lastChild);
    this._selectElement(previous);
  }

  /**
   * @param {Element|null} item
   */
  _selectElement(item) {
    if (this._selectedElement)
      this._selectedElement.classList.remove('selected');
    this._selectedElement = item;
    if (this._selectedElement) {
      this._selectedElement.classList.add('selected');
      if (typeof this._selectedElement.scrollIntoViewIfNeeded === 'function')
        this._selectedElement.scrollIntoViewIfNeeded(false);
    }
  }
}

/**
 * @param {SearchResult} searchResult
 * @returns {Element}
 */
function renderSearchResult(searchResult) {
  let item = searchResult.item;
  let main = E.hbox('search-item');
  let icon = main.el('span');
  icon.classList.add('search-item-icon');
  // Render icon
  if (item.type === SearchItemType.Method) {
    icon.appendChild(ProtocolRenderer.renderMethodIcon());
  } else if (item.type === SearchItemType.Type) {
    icon.appendChild(ProtocolRenderer.renderTypeIcon());
  } else if (item.type === SearchItemType.Event) {
    icon.appendChild(ProtocolRenderer.renderEventIcon());
  }
  {
    // Render Name and Description
    let container = main.div('search-item-main');
    let p1 = container.el('div', 'search-item-title monospace');
    let domainElement = p1.span('search-item-title-domain');
    domainElement.appendChild(renderTextWithMatches(item.title, searchResult.matches, 0, item.domainName.length + 1));
    p1.appendChild(renderTextWithMatches(item.title, searchResult.matches, item.domainName.length + 1, item.title.length));
    let p2 = container.el('div', 'search-item-description');
    p2.textContent = item.description;
  }
  /** @type {any} */ (main).__route = item.route;
  return main;
}

/**
 * @param {string} text
 * @param {Array<number>} matches
 * @param {number} fromIndex
 * @param {number} toIndex
 * @returns {Node}
 */
function renderTextWithMatches(text, matches, fromIndex, toIndex) {
  if (!matches.length)
    return E.textNode(text.substring(fromIndex, toIndex));
  let result = document.createDocumentFragment();
  let insideMatch = false;
  let currentIndex = fromIndex;
  let matchIndex = new Set(matches);
  for (let i = fromIndex; i < toIndex; ++i) {
    if (insideMatch !== matchIndex.has(i)) {
      add(currentIndex, i, insideMatch);
      insideMatch = matchIndex.has(i);
      currentIndex = i;
    }
  }
  add(currentIndex, toIndex, insideMatch);
  return result;

  /**
   * @param {number} from
   * @param {number} to
   * @param {boolean} isHighlight
   */
  function add(from, to, isHighlight) {
    if (to === from)
      return;
    if (isHighlight) {
      const span = result.span('search-highlight');
      span.textContent = text.substring(from, to);
    } else {
      result.appendChild(E.textNode(text.substring(from, to)));
    }
  }
}

// Expose on Search class for backward compatibility and window
/** @type {any} */ (Search).ItemType = SearchItemType;
/** @type {any} */ (Search).Item = SearchItem;
/** @type {any} */ (Search).SearchResult = SearchResult;

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).Search = Search;
}
