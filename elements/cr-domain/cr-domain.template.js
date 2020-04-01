
export const experimentalDomainTemplate = (domain) => {
  if (domain.experimental) {
    return String.raw`<span class="experimental" title="This may be changed, moved or removed">Experimental</span>`;
  }
  if (domain.deprecated) {
    return String.raw`<span class="deprecated" title="Deprecated, please adopt alternative">Deprecated</span>`;
  }
  return '';
}

export const domainTemplate = (domain) => String.raw`

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