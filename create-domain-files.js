'use strict';

/**
 * Utility command that creates HTML file in the _domains folder for each domain found in the _data/?/protocol.json.
 */

const fs = require('fs');
const DOMAINS_FOLDER = '_domains';
const VERSIONS_FILE = '_data/versions.json';

const versionsText = fs.readFileSync(VERSIONS_FILE);
const versions = JSON.parse(versionsText);

versions.forEach(version => {
  clearFolder(`${DOMAINS_FOLDER}/${version.slug}`);
  generateDomainFiles(version);
});

function clearFolder(path) {
  fs.readdirSync(path).forEach((file, index) => fs.unlinkSync(`${path}/${file}`));
}

function generateDomainFiles(version) {
  const protocolFile = `_data/${version.slug}/protocol.json`;
  const protocolText = fs.readFileSync(protocolFile);
  const protocol = JSON.parse(protocolText);

  console.log('Generating protocol:', version.name, '– Size in bytes:', protocolText.length.toLocaleString());
  (protocol.domains).forEach((domain, idx) => {
    const name = domain.domain;
    const fileName = `${DOMAINS_FOLDER}/${version.slug}/${name}.html`;
    const content = `---
title: ${name}
category: ${version.slug}
version: ${version.name}
idx: ${idx}
---`;

    console.log('  Writing domain stub:', fileName);

    fs.writeFileSync(fileName, content);
  });
}
