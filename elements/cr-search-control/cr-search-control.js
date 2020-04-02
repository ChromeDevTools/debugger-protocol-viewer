import {PolymerElement, html} from '../../node_modules/@polymer/polymer/polymer-element.js';
import {mixinBehaviors} from '../../node_modules/@polymer/polymer/lib/legacy/class.js';

import '../../node_modules/@polymer/iron-ajax/iron-ajax.js';
import {IronButtonState} from '../../node_modules/@polymer/iron-behaviors/iron-button-state.js';
import '../../node_modules/@polymer/paper-icon-button/paper-icon-button.js';
import {Debouncer} from '../../node_modules/@polymer/polymer/lib/utils/debounce.js';

import '../cr-search-menu/cr-search-menu.js';

(function() {

  

  class CRSearchControl extends mixinBehaviors([IronButtonState], PolymerElement) {
    static get template() {
      return html`
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
