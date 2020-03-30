import { PolymerElement } from '../../node_modules/@polymer/polymer/polymer-element.js';
class CRHtmlEcho extends PolymerElement {
  static get properties() {
    return {
      html: {
        type: String,
        observer: 'htmlChanged'
      }
    };
  }

  htmlChanged() {
    // WARNING: potential XSS vulnerability if `html` comes from an untrusted source
    this.innerHTML = this.html || '&nbsp;';
  }
};

customElements.define('cr-html-echo', CRHtmlEcho);
