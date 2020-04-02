import {html, render} from 'lit-html';
import './cr-markdownish.js';

/**
 * A model managing keywords searches.
 * TODO: remembers previous searches (localstorage?).
 */
class KeywordsModel {
  constructor(index) {
    this.index = index;
    this.keys = Object.keys(index);
  }
  getMatches(str) {
    if (!str) {
      return [];
    }
    let useCache = false;
    if (this.prevKey_) {
      const occurredAt = str.indexOf(this.prevKey_);
      // An occurance at 0 means the previous key is contained in the new
      // search string.
      // We don't handle the case where the search is exactly the same;
      // we assume it cannot be the same because we're handling a 'change'
      // event. This logic should be updated if ever not handled by a 'change'
      // event.
      if (occurredAt === 0) {
        // Use the cached list of matching keys.
        useCache = true;
      }
    }
    let matches;
    if (useCache) {
      matches = this.prevMatches_.filter((key) => {
        return key.indexOf(str) !== -1;
      });
    } else {
      const exactMatches = [];
      const wildcardMatches = [];
      this.keys.forEach((key) => {
        let matchIndex = key.indexOf(str);
        if (matchIndex === 0) {
          exactMatches.push(key);
        } else if (matchIndex !== -1) {
          wildcardMatches.push(key);
        }
      });
      matches = exactMatches.concat(wildcardMatches);
    }

    this.prevKey_ = str;
    this.prevMatches_ = matches;

    return matches.map((key) => {
      return this.index[key];
    });
  }
}

const TYPE_ENUM = {
  DOMAIN: '0',
  EVENT: '1',
  PARAM: '2',
  TYPE: '3',
  METHOD: '4'
};

const TYPE_LABEL_ENUM = {
  '0': 'Domain',
  '1': 'Event',
  '2': 'Parameter',
  '3': 'Type',
  '4': 'Method'
};

const TYPE_ICON_ENUM = {
  '0': '',
  '1': 'image:wb-iridescent',
  '2': 'icons:more-horiz',
  '3': 'icons:code',
  '4': 'icons:apps'
};

class CRSearchResults extends HTMLElement {
  constructor(baseUrl) {
    super();
    this.attachShadow({mode: 'open'});
    
    this.baseUrl = baseUrl;
  }

  set searchString(searchString) {
    const matches = this.keywordsModel.getMatches(searchString);

    render(html`
      <style>
        :host {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: white;

          padding: 15px;
        }
        .results {
          box-shadow: var(--elevation-shadow);
          height: calc(100% - 25px);
          background-color: white;
          padding: 20px 0;
          overflow-y: auto;
        }
        .match-info {
          margin: 10px 0;
          padding: 0 20px;
          text-decoration: none;
          color: initial;
          display: block;
        }
        .match-info:hover {
          background-color: #E8F0FF;
        }
        .match-label {
          font-size: 1.4em;
          margin-bottom: 5px;
        }
        .match-label .type {
          font-size: 0.7em;
        }
      </style>
      <div class="results">
        ${matches.map((match) => {
          const {keyword, pageReferences} = match;
          const {type, description, href, domainHref} = pageReferences[0];

          let fullUrl = this.baseUrl + domainHref;

          if (href) {
            fullUrl += href;
          }
          
          return html`
            <a role="menuitem" class="match-info" href="${fullUrl}" @click=${this.click}>
              <div class="match-label">
                <div class="label">
                  <span>${keyword}</span>
                  <span class="type">${TYPE_LABEL_ENUM[type]}</span>
                </div>
              </div>
              <div class="match-description">
                <cr-markdownish markdown="${description}"></cr-markdownish>
              </div>
            </a>
          `;
        })}
      </div>
    `, this.shadowRoot, {
      eventContext: this
    });
  }

  click() {
    this.dispatchEvent(new CustomEvent('navigation'));
  }
}
customElements.define('cr-search-results', CRSearchResults);

customElements.define('cr-search-control', class extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({mode: 'open'});

    this.createMenu();
  }

  get baseUrl() {
    return this.getAttribute('base-url');
  }

  get protocolSearchIndexUrl() {
    return this.baseUrl + this.getAttribute('protocol-search-index');
  }

  get inputElement() {
    return this.shadowRoot.querySelector('input');
  }

  createMenu() {
    this.menuContainer = document.querySelector('main > section');
    this.menu = new CRSearchResults(this.baseUrl);
    this.menu.addEventListener('navigation', () => {
      this.menu.remove();
      this.inputElement.value = '';
      this.menuContainer.classList.remove('hidden');
    });

    fetch(this.protocolSearchIndexUrl).then(response => {
      return response.json();
    }).then(value => {
      this.menu.keywordsModel = new KeywordsModel(value);
    });
  }

  connectedCallback() {
    render(html`
      <style>
        input {
          border-style: none;
          background-color: transparent;
          width: 100%;
          max-width: 500px;
          font-size: 1.5em;
          color: var(--header-text-color);
          border-bottom-width: 1px;
          border-bottom-style: solid;
          border-bottom-color: var(--header-text-color);

          /* Float to the right */
          margin-left: auto;
          display: block;
        }
        input::placeholder {
          color: var(--header-text-color);
        }
        input:focus {
          transition: border-bottom-color 0.4s ease;
          border-bottom-color: #4BBDA8;
          outline: none;
        }
      </style>
      <input autofocus placeholder="Search..." @input=${this.onInput}/>
    `, this.shadowRoot, {
      eventContext: this,
    });
  }

  onInput(event) {
    const textValue = this.inputElement.value;

    if (textValue === '') {
      this.menu.remove();
      this.menuContainer.classList.remove('hidden');
      return;
    }

    if (!this.menu.connected) {
      this.menuContainer.append(this.menu);
    }

    this.menu.searchString = textValue;
    this.menuContainer.classList.add('hidden');
  }
});