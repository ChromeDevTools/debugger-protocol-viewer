'use strict';

/**
 * Utility command that creates HTML file in the _domains folder for each domain found in the _data/protocol.json.
 */

const fs = require('fs');
const DOMAINS_FOLDER = '_domains/';
const PROTOCOL_FILE = '_data/Inspector-1.1.json';

clearDomainsFolder();
generateDomainFiles();

function clearDomainsFolder() {
  fs.readdirSync(DOMAINS_FOLDER).forEach((file, index) => fs.unlinkSync(`${DOMAINS_FOLDER}/${file}`));
}

function generateDomainFiles() {
  const protocolText = fs.readFileSync(PROTOCOL_FILE);
  const protocol = JSON.parse(protocolText);

  (protocol.domains).forEach((domain, idx) => {
    const name = domain.domain;
    const fileName = `${DOMAINS_FOLDER}/${name}.html`;
    const content = `---
title: ${name}
idx: ${idx}
---`;

    fs.writeFileSync(fileName, content);
  });
}

