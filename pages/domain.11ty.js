import {domainTemplate} from '../elements/cr-domain/cr-domain.template.js';

class DomainGenerator {
  data() {
    return {
      layout: 'shell.hbs',
      title: 'Chrome DevTools Protocol Viewer',
      pagination: {
        data: 'tot.domains',
        size: 1,
        alias: 'domain',
      },
      permalink(data) {
        return `tot/${data.domain.domain}/index.html`;
      }
    }
  }
  render(data) {
    return domainTemplate(data.pagination.items[0]).getHTML();
  }
}

module.exports = DomainGenerator;
