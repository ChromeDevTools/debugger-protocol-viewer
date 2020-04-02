import {PolymerElement, html} from '../../node_modules/@polymer/polymer/polymer-element.js';
import {mixinBehaviors} from '../../node_modules/@polymer/polymer/lib/legacy/class.js';

import '../../node_modules/@polymer/iron-ajax/iron-ajax.js';
import {IronButtonState} from '../../node_modules/@polymer/iron-behaviors/iron-button-state.js';
import '../../node_modules/@polymer/paper-icon-button/paper-icon-button.js';
import {Debouncer} from '../../node_modules/@polymer/polymer/lib/utils/debounce.js';

import '../cr-search-menu/cr-search-menu.js';

(function() {

  /**
   * A model managing keywords searches.
   * TODO: remembers previous searches (localstorage?).
   */
  var KeywordsModel = {
    keys: null,
    index: null,

    prevKey_: null,
    prevMatches_: null,
    getMatches: function(str) {
      if (!str) {
        return [];
      }
      var useCache = false;
      if (this.prevKey_) {
        var occurredAt = str.indexOf(this.prevKey_);
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
      var matches;
      if (useCache) {
        matches = this.prevMatches_.filter(function(key) {
          return key.indexOf(str) !== -1;
        });
      } else {
        var exactMatches = [];
        var wildcardMatches = [];
        this.keys.forEach(function(key) {
          var matchIndex = key.indexOf(str);
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

      return matches.map(function(key) {
        return this.index[key];
      }, this);
    },
    createKeywordsModel: function(index) {
      var obj = Object.create(KeywordsModel);
      obj.keys = Object.keys(index);
      obj.index = index;
      return obj;
    }
  };

  class CRSearchControl extends mixinBehaviors([IronButtonState], PolymerElement) {
    static get properties() {
      return {
        protocolSrc: {
          value: String,
          observer: 'fireAjax_'
        },
        inputActive: {
          type: Boolean,
          value: false,
          notify: true,
          reflectToAttribute: true,
          observer: 'handleInputActive_'
        },
        searchText: {
          type: String,
          reflectToAttribute: true,
          notify: true,
          value: '',
          observer: 'handleSearchChange_'
        },
        /**
        * Bound from iron-ajax.
        */
        requests: {
          type: Array,
          value: function() { return []; }
        },
        ajaxResponse: {
          type: Object,
          observer: 'handleAjaxResponse_'
        },
        resultsMenu: {
          type: HTMLElement
        },
      };
    }

    static get template() {
      return html`
      <style>
      :host {
        display: block;
      }
      :host([input-active]) {
        @apply --layout-horizontal;
        @apply --layout-center;
      }
      :host([input-active]) paper-icon-button {
        @apply --layout-flex-none;
        color: black;
      }
      :host([input-active]) #search-input-container {
        @apply --layout-flex;
        @apply --layout-horizontal;
      }
      input[type="search"] {
        -webkit-appearance: textfield;
        display: inline-block;
        font-size: 24px;
        font-weight: 200;
        font-family: Roboto;
        background-color: #3F51B5;
        border-style: none;
        color: white;
        width: 100%;
        @apply --layout-flex;
        border-bottom: 1px solid transparent;
        border-radius: 0;
      }
      input:focus {
        transition: border-color 0.4s ease;
        border-bottom: 1px solid #4BBDA8;
        outline: none;
      }
    </style>
    <iron-ajax id="ajax"
        url="{{protocolSrc}}"
        handle-as="json"
        active-requests="{{requests}}"
        last-response="{{ajaxResponse}}"></iron-ajax>
    <paper-icon-button id="searchButton" toggles
        icon="search"
        on-active-changed="handleButtonActiveChange_"></paper-icon-button>
    <div id="search-input-container" hidden$="{{!inputActive}}">
      <input id="input" value="{{searchText::input}}" on-blur="handleBlur_" autocapitalize="off"
          autocorrect="off" placeholder="Search..." type="search" />
    </div>`;
    }

    get keyBindings() {
      return {
        'esc': 'handleEsc_',
        'enter': 'handleEnter_',
        'up': 'handleUpArrow_',
        'down': 'handleDownArrow_'
      };
    }

    setMenuOpen_(open) {
      this.dispatchEvent(new CustomEvent('search-menu-selected', {open, bubbles: true, composed: true }));
    }

    handleEnter_() {
      this.resultsMenu.chooseHighlightedResult();
    }

    handleUpArrow_() {
      this.resultsMenu.highlightPreviousResult();
    }

    handleDownArrow_() {
      this.resultsMenu.highlightNextResult();
    }

    handleSearchChange_() {
      if (!this.inputActive) {
        return;
      }
      this._debouncer = Debouncer.debounce(this._debouncer,
        Polymer.Async.timeOut.after(70),
        () => {
          this.resultsMenu.searchString = this.searchText;
          this.setMenuOpen_(!!this.searchText);
         });
    }

    handleEsc_() {
      console.log('false');
      if (this.resultsMenu.opened) {
        this.setMenuOpen_(false);
      } else {
        this.inputActive = false;
      }
    }

    fireAjax_() {
      if (this.protocolSrc) {
        this.$.ajax.generateRequest();
      }
    }

    handleButtonActiveChange_() {
      this.inputActive = this.$.searchButton.active;
    }

    handleInputActive_() {
      if (this.inputActive) {
        this.async(function() {
          this.$.input.focus();
          this.handleSearchChange_();
          this.$.searchButton.icon = 'icons:arrow-forward';
        }.bind(this), 50);
      } else {
        this.$.searchButton.icon = 'search';
        this.$.searchButton.active = false;
      }
      this.dispatchEvent(new CustomEvent(this.inputActive ? 'active' : 'inactive', { bubbles: true, composed: true }));
    }

    handleAjaxResponse_() {
      if (this.ajaxResponse) {
        // Set the keywords model (search index) onto the menu.
        this.resultsMenu.keywordsModel = KeywordsModel.createKeywordsModel(
            this.ajaxResponse);
      }
    }

    handleItemActivate_() {
      this.setMenuOpen_(false);
      this.inputActive = false;
    }

    handleBlur_() {
      if (!this.resultsMenu.opened) {
        this.$.searchButton.active = false;
      }
    }
  };

  customElements.define('cr-search-control', CRSearchControl);
})();