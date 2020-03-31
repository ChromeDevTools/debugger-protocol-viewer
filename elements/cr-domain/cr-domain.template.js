import {html} from '../../node_modules/lit-html/lit-html.js';

export const domainTemplate = (domain) => html`
<style>
h3 {
font-size: 20px;
line-height: 28px;
}

/* Small */
@media (max-width: 600px) {
h3 {
  margin-left: 7px;
}
}
</style>
<div id="header">
<div class="paper-material" elevation="1" class="heading-domain">
<h2 class="heading"><span>[[domain.domain]]</span> Domain</h2>

<p class="description" hidden$="[[!domain.description]]">
    <cr-markdownish markdown="[[domain.description]]"></cr-markdownish>
</p>
<cr-domain-experimental item="[[domain]]"></cr-domain-experimental>

${
domain.domain
}

<div hidden$="[[!domain.commands.length]]">
  <h3>Methods</h3>
    <template is="dom-repeat" items="[[domain.commands]]">
      <cr-domain-toc
          domain="[[domain.domain]]"
          details="[[item]]"
          version="[[version]]"
          type="method"
      ></cr-domain-toc>
    </template>
</div>

<div hidden$="[[!domain.events.length]]">
  <h3>Events</h3>
  <template is="dom-repeat" items="[[domain.events]]">
    <cr-domain-toc
        domain="[[domain.domain]]"
        details="[[item]]"
        version="[[version]]"
        type="event"
    ></cr-domain-toc>
  </template>
</div>

<div hidden$="[[!domain.types.length]]">
  <h3>Types</h3>
  <template is="dom-repeat" items="[[domain.types]]">
    <cr-domain-toc
        domain="[[domain.domain]]"
        details="[[item]]"
        version="[[version]]"
        type="type"
    ></cr-domain-toc>
  </template>
</div>

</div>

<div hidden$="[[!domain.commands.length]]">
<h3 id="methods">Methods</h3>
<div class="paper-material" elevation="1">
  <template is="dom-repeat" items="[[domain.commands]]">
    <cr-domain-details
        domain="[[domain.domain]]"
        details="[[item]]"
        version="[[version]]"
        type="method"
    ></cr-domain-details>
  </template>
</div>
</div>

<div hidden$="[[!domain.events.length]]">
<h3 id="events">Events</h3>
<div class="paper-material" elevation="1">
  <template is="dom-repeat" items="[[domain.events]]">
    <cr-domain-details
        domain="[[domain.domain]]"
        details="[[item]]"
        version="[[version]]"
        type="event"
    ></cr-domain-details>
  </template>
</div>
</div>

<div hidden$="[[!domain.types.length]]">
<h3 id="types">Types</h3>
<div class="paper-material" elevation="1">
  <template is="dom-repeat" items="[[domain.types]]">
    <cr-domain-details
        domain="[[domain.domain]]"
        details="[[item]]"
        version="[[version]]"
        type="type"
    ></cr-domain-details>
  </template>
</div>
</div>
</div>`;