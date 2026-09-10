/**
 * @fileoverview Merges two protocol JSON files (browser_protocol and js_protocol) into tot.json.
 */

import fs from 'node:fs';

const args = process.argv.slice(2);

const protocol1Text = fs.readFileSync(args[0], 'utf8');
const protocol1 = JSON.parse(protocol1Text);

const protocol2Text = fs.readFileSync(args[1], 'utf8');
const protocol2 = JSON.parse(protocol2Text);

const mergedDomains = [...protocol1.domains, ...protocol2.domains];

const protocolMerged = {
  domains: mergedDomains,
};

console.log(JSON.stringify(protocolMerged, null, '    '));
