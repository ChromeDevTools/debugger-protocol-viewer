/**
 * @fileoverview DOM Renderer for CDP Domains, Commands, Events, and Types.
 */

/** @import { ProtocolDomain, NormalizedProtocolDomain, ProtocolType, ProtocolCommand, ProtocolEvent, ProtocolParameter, ProtocolBackReference } from './types.d.ts' */

class ProtocolRenderer {
  /**
   * @param {string} domainName
   * @param {string} domainEntry
   * @returns {string}
   */
  static titleId(domainName, domainEntry) {
    return domainName + '_' + domainEntry;
  }

  /**
   * @param {ProtocolDomain} domain
   * @returns {HTMLElement}
   */
  static renderDomain(domain) {
    let result = E.div();
    let main = result.div('domain');
    if (domain.experimental) {
      main.classList.add('domain-experimental');
    }
    if (domain.deprecated) {
      main.classList.add('domain-deprecated');
    }
    ProtocolRenderer.applyBackground(domain, main);
    result.div('domain-padding', '\u2606');
    {
      // Render domain main description.
      let container = main.div('box');
      let header = container.div('box-content');

      let title = header.el('h2');
      title.textContent = domain.domain;
      ProtocolRenderer.applyMarks(domain, title, false);

      if (domain.description) {
        ProtocolRenderer.renderDescription(domain.description, header);
      }

      ProtocolRenderer.renderTableOfContents(domain, header);
    }

    if (domain.commands && domain.commands.length) {
      // Render methods.
      let title = main.el('h3');
      title.id = 'methods';
      title.textContent = 'Methods';
      let container = main.box('box');
      for (let method of domain.commands)
        container.appendChild(ProtocolRenderer.renderEventOrMethod(domain, method, false));
    }

    if (domain.events && domain.events.length) {
      // Render events.
      let title = main.el('h3');
      title.id = 'events';
      title.textContent = 'Events';
      let container = main.box('box');
      for (let event of domain.events)
        container.appendChild(ProtocolRenderer.renderEventOrMethod(domain, event, true));
    }

    if (domain.types && domain.types.length) {
      // Render types.
      let title = main.el('h3');
      title.id = 'types';
      title.textContent = 'Types';
      let container = main.box('box');
      for (let type of domain.types)
        container.appendChild(ProtocolRenderer.renderDomainType(domain, type));
    }

    return main;
  }

  /**
   * @param {ProtocolDomain} domain
   * @param {ProtocolType} type
   * @returns {HTMLElement}
   */
  static renderDomainType(domain, type) {
    let main = E.div('type');
    ProtocolRenderer.applyBackground(type, main);
    ProtocolRenderer.applyBackground(domain, main);
    main.appendChild(ProtocolRenderer.renderTitle(domain.domain, type.id, type, 'type', Boolean(domain.experimental)));
    if (type.type) {
      const p = main.el('p', '', 'Type: ');
      const span = p.span('parameter-type');
      span.textContent = type.type;
    }
    if (type.description) {
      ProtocolRenderer.renderDescription(type.description, main);
    }
    if (type.properties && type.properties.length) {
      // Render parameters.
      let title = main.el('h5');
      title.textContent = 'Properties';
      let container = main.el('dl', 'parameter-list');
      for (let parameter of type.properties)
        container.appendChild(ProtocolRenderer.renderParameter(domain, parameter));
    }
    if (type.enum) {
      main.el('h5', '', 'Allowed values');
      const p = main.el('p', 'enum-values');
      type.enum.forEach((value, index) => {
        const code = document.createElement('code');
        code.textContent = value;
        p.append(code);
        if (index < (type.enum?.length ?? 0) - 1) {
          p.append(', ');
        }
      });
    }
    if (type.referencedBy && type.referencedBy.length) {
      // Render back references.
      let title = main.el('h5');
      title.textContent = 'Referenced By';
      let container = main.el('ul', 'references-list');
      for (let reference of type.referencedBy) {
        const li = container.el('li');
        const referenceIcon = li.span('reference-icon');
        if (reference.type === 'command')
          referenceIcon.appendChild(ProtocolRenderer.renderMethodIcon());
        else if (reference.type === 'event')
          referenceIcon.appendChild(ProtocolRenderer.renderEventIcon());
        else if (reference.type === 'type')
          referenceIcon.appendChild(ProtocolRenderer.renderTypeIcon());

        li.appendChild(ProtocolRenderer.renderRef(reference.name));
      }
    }

    return main;
  }

  /**
   * @param {string} domainName
   * @param {string} title
   * @param {ProtocolCommand | ProtocolEvent | ProtocolType} item
   * @param {'type' | 'event' | 'method'} titleType
   * @param {boolean} [isParentDomainExperimental]
   * @returns {HTMLElement}
   */
  static renderTitle(domainName, title, item, titleType, isParentDomainExperimental = false) {
    // Render heading.
    let heading = E.el('h4', 'monospace text-overflow');

    if (titleType === 'type')
      heading.appendChild(ProtocolRenderer.renderTypeIcon());
    else if (titleType === 'event')
      heading.appendChild(ProtocolRenderer.renderEventIcon());
    else if (titleType === 'method')
      heading.appendChild(ProtocolRenderer.renderMethodIcon());

    let id = `${domainName}.${title}`;
    heading.setAttribute('id', ProtocolRenderer.titleId(domainName, title));
    const domainSpan = heading.span('method-domain');
    domainSpan.textContent = domainName + '.';
    const nameSpan = heading.span('method-name');
    nameSpan.textContent = title;
    ProtocolRenderer.applyMarks(item, heading, isParentDomainExperimental);
    let href = (window.app && window.app.formatRef) ? window.app.formatRef(id) : '#/' + id;
    const link = E.a(href, '#');
    link.classList.add('title-link');
    heading.appendChild(link);
    return heading;
  }

  /**
   * @param {ProtocolDomain} domain
   * @param {HTMLElement} container
   */
  static renderTableOfContents(domain, container) {
    const isDomainExp = Boolean(domain.experimental);
    /**
     * @param {ProtocolCommand | ProtocolEvent} method
     * @param {HTMLElement} container
     */
    let renderEventOrMethodEntry = (method, container) =>
      ProtocolRenderer.renderTableOfContentsEntry(domain.domain, method.name, container);
    /**
     * @param {ProtocolType} type
     * @param {HTMLElement} container
     */
    let renderTypeEntry = (type, container) =>
      ProtocolRenderer.renderTableOfContentsEntry(domain.domain, type.id, container);

    if ((domain.commands && domain.commands.length) || (domain.events && domain.events.length) || (domain.types && domain.types.length)) {
      let toc = container.div('domain-toc');
      if (domain.commands && domain.commands.length)
        ProtocolRenderer.renderTableOfContentsSection("Methods", "method", domain.commands, renderEventOrMethodEntry, toc, isDomainExp);
      if (domain.events && domain.events.length)
        ProtocolRenderer.renderTableOfContentsSection("Events", "event", domain.events, renderEventOrMethodEntry, toc, isDomainExp);
      if (domain.types && domain.types.length)
        ProtocolRenderer.renderTableOfContentsSection("Types", "type", domain.types, renderTypeEntry, toc, isDomainExp);
    }
  }

  /**
   * @param {string} sectionName
   * @param {string} sectionType
   * @param {Array<any>} entries
   * @param {(item: any, container: HTMLElement) => HTMLElement} renderer
   * @param {HTMLElement} container
   * @param {boolean} [isDomainExp]
   * @returns {HTMLElement}
   */
  static renderTableOfContentsSection(sectionName, sectionType, entries, renderer, container, isDomainExp = false) {
    let sectionWrapper = container.div('toc-section');
    let title = sectionWrapper.el('h4', 'toc-section-heading');
    let badge = title.span(`entity-icon entity-icon-${sectionType}`);
    badge.textContent = sectionType.charAt(0).toUpperCase() + sectionType.slice(1);
    let link = E.a(`#${sectionName.toLowerCase()}`, `${sectionName} (${entries.length})`);
    link.className = 'toc-section-link';
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const target = document.getElementById(sectionName.toLowerCase());
      if (target) {
        const prefersReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
      }
    });
    title.appendChild(link);

    let section = sectionWrapper.div('toc-entries');
    for (let entry of entries) {
      let row = renderer(entry, section);
      ProtocolRenderer.applyMarks(entry, row, isDomainExp);
    }
    return section;
  }

  /**
   * @param {string} domainName
   * @param {string} name
   * @param {HTMLElement} container
   * @returns {HTMLElement}
   */
  static renderTableOfContentsEntry(domainName, name, container) {
    let row = container.div('toc-link');
    let id = `${domainName}.${name}`;
    let link = ProtocolRenderer.renderRef(id);
    link.classList.add('monospace');
    row.appendChild(link);
    return row;
  }

  /**
   * @param {ProtocolDomain} domain
   * @param {ProtocolCommand | ProtocolEvent} method
   * @param {boolean} isEvent
   * @returns {HTMLElement}
   */
  static renderEventOrMethod(domain, method, isEvent) {
    let main = E.div('method');
    ProtocolRenderer.applyBackground(method, main);
    ProtocolRenderer.applyBackground(domain, main);
    main.appendChild(ProtocolRenderer.renderTitle(domain.domain, method.name, method, isEvent ? 'event' : 'method', Boolean(domain.experimental)));
    if (method.description) {
      ProtocolRenderer.renderDescription(method.description, main);
    }
    if (method.parameters && method.parameters.length) {
      // Render parameters.
      let title = main.el('h5');
      title.textContent = 'Parameters';
      let container = main.el('dl', 'parameter-list');
      for (let parameter of method.parameters)
        container.appendChild(ProtocolRenderer.renderParameter(domain, parameter));
    }
    const command = /** @type {ProtocolCommand} */ (method);
    if (command.returns && command.returns.length) {
      // Render return values.
      let title = main.el('h5');
      title.textContent = 'RETURN OBJECT';
      let container = main.el('dl', 'parameter-list');
      for (let parameter of command.returns)
        container.appendChild(ProtocolRenderer.renderParameter(domain, parameter));
    }
    return main;
  }

  /**
   * @param {ProtocolDomain} domain
   * @param {ProtocolParameter} parameter
   * @returns {DocumentFragment}
   */
  static renderParameter(domain, parameter) {
    let main = document.createDocumentFragment();
    {
      // Render parameter name.
      let name = main.div('parameter-name monospace');
      ProtocolRenderer.applyBackground(parameter, name);
      if (parameter.optional)
        name.classList.add('optional');
      name.textContent = parameter.name || '';
    }
    {
      // Render parameter value.
      let container = main.vbox('parameter-value');
      ProtocolRenderer.applyBackground(parameter, container);
      container.appendChild(ProtocolRenderer.renderTypeLink(domain, parameter));
      let description = container.span('parameter-description');
      let descriptions = [];
      if (parameter.description)
        descriptions.push(parameter.description);
      ProtocolRenderer.renderTextWithCode(descriptions.join(' '), description);
      if (parameter.enum) {
        description.append(' Allowed values: ');
        parameter.enum.forEach((value, index) => {
          const code = document.createElement('code');
          code.textContent = value;
          description.append(code);
          if (index < (parameter.enum?.length ?? 0) - 1)
            description.append(', ');
          else
            description.append('.');
        });
      }
      ProtocolRenderer.applyMarks(parameter, description, Boolean(domain.experimental));
    }
    return main;
  }

  /**
   * @param {ProtocolDomain} domain
   * @param {ProtocolParameter} parameter
   * @returns {HTMLElement}
   */
  static renderTypeLink(domain, parameter) {
    const primitiveTypes = new Set([
      "string",
      "integer",
      "boolean",
      "number",
      "object",
      "any"
    ]);

    if (parameter.type && primitiveTypes.has(parameter.type))
      return E.span('parameter-type', parameter.type);
    if (parameter.$ref) {
      let $ref = parameter.$ref;
      if (!$ref.includes('.'))
        $ref = domain.domain + '.' + parameter.$ref;
      return ProtocolRenderer.renderRef($ref);
    }
    if (parameter.type === 'array' && parameter.items) {
      let generic = E.span('parameter-type');
      generic.appendChild(document.createTextNode('array [ '));
      generic.appendChild(ProtocolRenderer.renderTypeLink(domain, parameter.items));
      generic.appendChild(document.createTextNode(' ]'));
      return generic;
    }
    return E.el('span', 'parameter-type', '<TYPE>');
  }

  /**
   * @param {string} $ref
   * @returns {HTMLAnchorElement}
   */
  static renderRef($ref) {
    let a = E.a((window.app && window.app.formatRef) ? window.app.formatRef($ref) : '#/' + $ref, $ref);
    a.className = 'parameter-type';
    return a;
  }

  /**
   * @param {any} item
   * @param {HTMLElement} element
   */
  static applyBackground(item, element) {
    if (!item) return;
    if (item.experimental)
      element.classList.add('experimental-bg');
    else if (item.deprecated)
      element.classList.add('deprecated-bg');
  }

  /**
   * @param {any} item
   * @param {HTMLElement} element
   * @param {boolean} [isParentDomainExperimental]
   */
  static applyMarks(item, element, isParentDomainExperimental = false) {
    if (!item) return;
    if (item.experimental) {
      if (isParentDomainExperimental) {
        return;
      }
      let e = element.span('experimental', 'exp');
      e.title = 'Experimental';
      element.appendChild(e);
    } else if (item.deprecated) {
      let e = element.span('deprecated', 'deprecated');
      e.title = 'Deprecated, will be removed';
      element.appendChild(e);
    }
  }

  static renderMethodIcon() {
    let icon = E.span('entity-icon');
    icon.textContent = 'Method';
    icon.title = 'Method';
    icon.classList.add('entity-icon-method');
    return icon;
  }

  static renderTypeIcon() {
    let icon = E.span('entity-icon');
    icon.textContent = 'Type';
    icon.title = 'Type';
    icon.classList.add('entity-icon-type');
    return icon;
  }

  static renderEventIcon() {
    let icon = E.span('entity-icon');
    icon.textContent = 'Event';
    icon.title = 'Event';
    icon.classList.add('entity-icon-event');
    return icon;
  }

  /**
   * @param {string} text
   * @param {HTMLElement} container
   */
  static renderTextWithCode(text, container) {
    if (!text) return;
    const clean = text.replace(/^LINT\..*$\n?/gm, '');
    const parts = clean.split(/`([^`]+)`/g);
    for (let i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      if (i % 2 === 1) {
        const code = document.createElement('code');
        code.textContent = parts[i];
        container.appendChild(code);
      } else {
        container.appendChild(document.createTextNode(parts[i]));
      }
    }
  }

  /**
   * @param {string} text
   * @param {HTMLElement} parentElement
   */
  static renderDescription(text, parentElement) {
    if (!text) return;
    const clean = text.replace(/^LINT\..*$\n?/gm, '').trim();
    if (!clean) return;
    const paragraphs = clean.split(/\n\s*\n/);
    for (const para of paragraphs) {
      const p = document.createElement('p');
      ProtocolRenderer.renderTextWithCode(para, p);
      parentElement.appendChild(p);
    }
  }
}

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).ProtocolRenderer = ProtocolRenderer;
}
