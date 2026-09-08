class ProtocolRenderer {
  static titleId(domainName, domainEntry) {
    return domainName + '_' + domainEntry;
  }

  static renderDomain(domain) {
    let result = E.div();
    let main = result.div('domain');
    ProtocolRenderer.applyBackground(domain, main);
    let padding = result.div('domain-padding', '\u2606');
    {
      // Render domain main description.
      let container = main.div('box');
      let header = container.div('box-content');

      let title = header.el('h2');
      title.textContent = domain.domain;

      let description = header.el('p');
      description.textContent = domain.description || '';
      ProtocolRenderer.applyMarks(domain, title);
      ProtocolRenderer.renderTableOfContents(domain, header)
    }

    if (domain.commands.length) {
      // Render methods.
      let title = main.el('h3');
      title.textContent = 'Methods';
      let container = main.box('box');
      for (let method of domain.commands)
        container.appendChild(ProtocolRenderer.renderEventOrMethod(domain, method, false));
    }

    if (domain.events.length) {
      // Render events.
      let title = main.el('h3');
      title.textContent = 'Events';
      let container = main.box('box');
      for (let event of domain.events)
        container.appendChild(ProtocolRenderer.renderEventOrMethod(domain, event, true));
    }

    if (domain.types.length) {
      // Render types.
      let title = main.el('h3');
      title.textContent = 'Types';
      let container = main.box('box');
      for (let type of domain.types)
        container.appendChild(ProtocolRenderer.renderDomainType(domain, type));
    }

    return result;
  }

  static renderDomainType(domain, type) {
    let main = E.div('type');
    ProtocolRenderer.applyBackground(type, main);
    ProtocolRenderer.applyBackground(domain, main);
    main.appendChild(ProtocolRenderer.renderTitle(domain.domain, type.id, type, 'type'));
    if (type.type) {
      main.el('p', '', 'Type: ')
        .text(type.type, 'parameter-type');
    }
    {
      // Render description.
      let p = main.el('p');
      p.textContent = type.description || '';
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
      main.el('p', '', type.enum.join(', '));
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

  static renderTitle(domainName, title, item, titleType) {
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
    heading.text(domainName + '.', 'method-domain');
    heading.text(title, 'method-name');
    ProtocolRenderer.applyMarks(item, heading);
    heading.a('?' + id, '#').classList.add('title-link');
    return heading;
  }

  static renderTableOfContents(domain, container) {
    let renderEventOrMethodEntry = (method, container) =>
      ProtocolRenderer.renderTableOfContentsEntry(domain.domain, method.name, container);
    let renderTypeEntry = (type, container) =>
      ProtocolRenderer.renderTableOfContentsEntry(domain.domain, type.id, container);

    if (domain.commands.length)
      ProtocolRenderer.renderTableOfContentsSection("Methods", domain.commands, renderEventOrMethodEntry, container);
    if (domain.events.length)
      ProtocolRenderer.renderTableOfContentsSection("Events", domain.events, renderEventOrMethodEntry, container);
    if (domain.types.length)
      ProtocolRenderer.renderTableOfContentsSection("Types", domain.types, renderTypeEntry, container);
  }

  static renderTableOfContentsSection(sectionName, entries, renderer, container) {
    let title = container.el('h4');
    title.textContent = sectionName;
    let section = container.div('div');
    for (let entry of entries) {
      let row = renderer(entry, section);
      ProtocolRenderer.applyMarks(entry, row);
    }
    return section;
  }

  static renderTableOfContentsEntry(domainName, name, container) {
    let row = container.div('div');
    let id = `${domainName}.${name}`;
    let link = ProtocolRenderer.renderRef(id);
    link.classList.add('monospace');
    row.appendChild(link);
    return row;
  }

  static renderEventOrMethod(domain, method, isEvent) {
    let main = E.div('method');
    ProtocolRenderer.applyBackground(method, main);
    ProtocolRenderer.applyBackground(domain, main);
    main.appendChild(ProtocolRenderer.renderTitle(domain.domain, method.name, method, isEvent ? 'event' : 'method'));
    {
      // Render description.
      let p = main.el('p');
      p.textContent = method.description || '';
    }
    if (method.parameters.length) {
      // Render parameters.
      let title = main.el('h5');
      title.textContent = 'Parameters';
      let container = main.el('dl', 'parameter-list');
      for (let parameter of method.parameters)
        container.appendChild(ProtocolRenderer.renderParameter(domain, parameter));
    }
    if (method.returns.length) {
      // Render return values.
      let title = main.el('h5');
      title.textContent = 'RETURN OBJECT';
      let container = main.el('dl', 'parameter-list');
      for (let parameter of method.returns)
        container.appendChild(ProtocolRenderer.renderParameter(domain, parameter));
    }
    return main;
  }

  static renderParameter(domain, parameter) {
    let main = document.createDocumentFragment();
    {
      // Render parameter name.
      let name = main.div('parameter-name monospace');
      ProtocolRenderer.applyBackground(parameter, name);
      if (parameter.optional)
        name.classList.add('optional');
      name.textContent = parameter.name;
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
      description.textContent = descriptions.join(' ');
      if (parameter.enum) {
        description.append(' Allowed values: ');
        parameter.enum.forEach((value, index) => {
          const code = document.createElement('code');
          code.textContent = value;
          description.append(code);
          if (index < parameter.enum.length - 1)
            description.append(', ');
          else
            description.append('.');
        });
      }
      ProtocolRenderer.applyMarks(parameter, description);
    }
    return main;
  }

  static renderTypeLink(domain, parameter) {
    const primitiveTypes = new Set([
      "string",
      "integer",
      "boolean",
      "number",
      "object",
      "any"
    ]);

    if (primitiveTypes.has(parameter.type))
      return E.span('parameter-type', parameter.type);
    if (parameter.$ref) {
      let $ref = parameter.$ref;
      if (!$ref.includes('.'))
        $ref = domain.domain + '.' + parameter.$ref;
      return ProtocolRenderer.renderRef($ref);
    }
    if (parameter.type === 'array') {
      let generic = E.span('parameter-type');
      generic.text('array [ ');
      generic.appendChild(ProtocolRenderer.renderTypeLink(domain, parameter.items));
      generic.text(' ]');
      return generic;
    }
    return E.el('span', 'parameter-type', '<TYPE>');
  }

  static renderRef($ref) {
    let a = E.el('a', 'parameter-type');
    a.href = '?' + $ref;
    a.textContent = $ref;
    return a;
  }

  static applyBackground(item, element) {
    if (item.experimental)
      element.classList.add('experimental-bg');
    else if (item.deprecated)
      element.classList.add('deprecated-bg');
  }

  static applyMarks(item, element) {
    if (item.experimental) {
      let e = element.span('experimental', 'experimental');
      e.title = 'This may be changed, moved or removed';
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
};

