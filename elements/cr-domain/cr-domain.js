import {PolymerElement, html} from '../../node_modules/@polymer/polymer/polymer-element.js';
import '../../node_modules/@polymer/polymer/lib/elements/dom-repeat.js';
import './cr-domain-experimental.js';
import './cr-domain-toc.js';
import './cr-domain-details.js';

import {domainTemplate} from './cr-domain.template.js';

export class ChromeDevToolsDomain extends HTMLElement {
  static get properties() {
    return {
      domain: {
        type: Object,
        observer: '_domainChanged'
      },
      data: Array,
      version: String
    }
  }
  _domainChanged(newDomain) {
    if (newDomain.experimental) {
      this.$.header.classList.add('domain-experimental');
    } else {
      this.$.header.classList.remove('domain-experimental');
    }
  }
}

customElements.define('cr-domain', ChromeDevToolsDomain);
