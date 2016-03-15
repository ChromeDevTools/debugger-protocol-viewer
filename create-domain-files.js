'use strict';

/**
 * Utility command that creates HTML file in the _domains folder for each domain found in the _data/protocol.json.
 */

const fs = require('fs');

clearDomainsFolder();
generateDomainFiles();

function clearDomainsFolder() {
  const path = '_domains/';
  fs.readdirSync(path).forEach((file, index) => {
    fs.unlinkSync(path + '/' + file);
  });
}

function generateDomainFiles() {
  const protocolText = fs.readFileSync('_data/protocol.json');
  const protocol = JSON.parse(protocolText);

  (protocol.domains).forEach((domain, idx) => {
    const name = domain.domain;
    const fileName = '_domains/' + name + '.html';
    const content = "---\n" +
      "title: " + name + '\n' +
      "idx: " + idx + '\n' +
      "---";

    fs.writeFileSync(fileName, content);
  });
}

