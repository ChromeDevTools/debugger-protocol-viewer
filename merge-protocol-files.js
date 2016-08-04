'use strict';

/**
 * Utility command that merges two protocol files together
 */

const fs = require('fs');

const args = process.argv.slice(2);

const protocol1Text = fs.readFileSync(args[0]);
const protocol1 = JSON.parse(protocol1Text);

const protocol2Text = fs.readFileSync(args[1]);
const protocol2 = JSON.parse(protocol2Text);

var mergedDomains = [];
protocol1.domains.forEach(domain => mergedDomains.push(domain))
protocol2.domains.forEach(domain => mergedDomains.push(domain))

const protocolMerged = {
  domains: mergedDomains
};

console.log(JSON.stringify(protocolMerged, null, '    '));
