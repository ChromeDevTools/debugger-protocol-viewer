import {PolymerElement, html} from '../../node_modules/@polymer/polymer/polymer-element.js';
import './cr-domain-experimental.js';

    customElements.define('cr-domain-toc', class extends PolymerElement {
      static get is() { return 'cr-domain-toc'; }
      static get properties() {
        return {
          domain: String,
          details: Object,
          version: String,
          type: String,
          name: {
            type: String,
            computed: '_computeName(details)'
          }
        }
      }
      static get template() {
        return html`
        <style>
      a {
          font-family: Consolas, Menlo, monospace;
          color: var(--default-primary-color);
          margin: 5px;
      }
      span.domain-dot {
          color: #ababab;
      }
    </style>
    <div class="toc-item">
      <a href$="[[version]]/[[domain]]#[[type]]-[[name]]">
        <span class="domain-dot" hidden$="[[_filterType(type)]]">[[domain]].</span>[[name]]</a>
      <cr-domain-experimental item="[[details]]"></cr-domain-experimental>
    </div>`;
      }
      _computeName(details) {
        return details.name || details.id;
      }
      _filterType(type) {
        return type === 'type';
      }
    });
