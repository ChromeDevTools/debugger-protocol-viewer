'use strict';


const fs = require('fs');

debugger;


const verSlugs = require('./_data/versions.json').map(e => e.slug);

const getDomainsInVersion = protocol => tot.domains.map(d => d.domain);

const allDomains = {};

for (const slug of verSlugs){
  const protocol = require(`./_data/${slug}/protocol.json`);
  const domains = protocol.domains.map(d => d.domain);
  domains.forEach(domain => {
    const item = allDomains[domain] || [];
    item.push(slug);
    allDomains[domain] = item;
  });
}

const str = Object.entries(allDomains).sort(([domainA], [domainB]) => domainA.localeCompare(domainB))
  .map(([id, versions]) => `<a data-title="${id}" class="${versions.join(' ')}">${id}</a>`)
  .join('\n');


process.stdout.write(str + '\n');
