import {PolymerElement, html} from '../../node_modules/@polymer/polymer/polymer-element.js';

import '../cr-markdownish/cr-markdownish.js';
import './cr-domain-experimental.js';
import './cr-domain-param.js';

    customElements.define('cr-domain-details', class extends PolymerElement {
      static get is() { return 'cr-domain-details'; }
      static get properties() {
        return {
          domain: String,
          details: Object,
          version: String,
          type: String,
          name: {
            type: String,
            computed: '_computeName(details)'
          },
          properties: {
            type: Object,
            computed: '_computeProperties(details)'
          }
        }
      }
      static get template() {
        return html`
            <style>
      [hidden] {
        display: none !important;
      }

      span.domain-dot {
          color: #ababab;
      }

      .details-name, .event-name {
          display: flex;
      }

      :host, .type {
        display: block;
        border-bottom: solid var(--divider-color) 1px;
        padding-bottom: 15px;
      }

      :host(:last-of-type, .type:last-of-type) {
        border-bottom: none;
      }

      .permalink {
        margin-left: 5px;
        vertical-align: top;
        text-decoration: none;
        opacity: 0;
      }

      .permalink:hover {
        text-decoration: underline;
      }

      a {
        color: var(--default-primary-color);
      }

      h4 {
        margin: 1rem 0 0.5rem;
      }

      h4:hover .permalink {
        opacity: 1;
      }

      h5 {
        color: gray;
        font-weight: 300;
        text-transform: uppercase;
        margin: 1rem 0 0;
      }

      .monospace {
        font-family: Consolas, Menlo, monospace;
      }
      .sm {
        font-size: 90%;
      }

      h5 + p {
        margin-top: 0;
      }

      .parameter-list {
        padding: 0.5rem 5px;
        margin: 0 10%;
      }

      /* Wide */
      @media (max-width: 980px) {
        .parameter-list {
          margin: 0;
        }
      }
    </style>
    <div class="details">
      <h4 class="details-name monospace" id$="details-[[name]]">
        <span>
          <span class="domain-dot" hidden$="[[_filterType(type)]]">[[domain]].</span>[[name]]
        </span>
        <a href$="[[version]]/[[domain]]#[[type]]-[[name]]" class="permalink">#</a>
      </h4>

      <p class="details-description">
        <cr-markdownish hidden$="[[!details.description]]" markdown="[[details.description]]"></cr-markdownish> <cr-domain-experimental item="[[details]]"></cr-domain-experimental>
      </p>
      <p hidden$="[[!details.type]]"class="type-type">Type: <strong>[[details.type]]</strong></p>

      <div hidden$="[[!_hasProperties(details)]]">
        <h5>[[properties.name]]</h5>
        <dl class="parameter-list">
          <template is="dom-repeat" items="[[properties.values]]">
            <cr-domain-param
                param="[[item]]"
                version="[[version]]"
                domain="[[domain]]"
            ></cr-domain-param>
          </template>
        </dl>
      </div>

      <div hidden$="[[!details.returns.length]]">
        <h5>Return object</h5>
        <dl class="parameter-list">
          <template is="dom-repeat" items="[[details.returns]]">
            <cr-domain-param
                param="[[item]]"
                version="[[version]]"
                domain="[[domain]]"
            ></cr-domain-param>
          </template>
        </dl>
      </div>

      <div hidden$="[[!details.enum.length]]">
        <h5>Allowed values</h5>
        <p class="monospace sm">
          [[_computeDetailsEnum(details)]]
        </p>
      </div>
    </div>`;
      }
      _computeName(details) {
        return details.name || details.id;
      }
      _computeProperties(details) {
        if (details.parameters) {
          return {
            name: 'parameters',
            values: details.parameters
          };
        } else if (details.properties) {
          return {
            name: 'properties',
            values: details.properties
          };
        }
        return undefined;
      }
      _hasProperties(details) {
        return !!this._computeProperties(details);
      }
      _computeDetailsEnum(details) {
        return details.enum && details.enum.join(', ');
      }
      _filterType(type) {
        return type === 'type';
      }
    });
