#!/usr/bin/env node

/**
 * @fileoverview Generates static legacy stubs (/tot/<Domain>/index.html) and bundles
 * client assets into the output directory for GitHub Pages deployment.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
/** @import { ProtocolDomain } from '../types/types.d.ts' */

/**
 * Generates HTML for a domain redirect stub with noscript fallback links.
 * @param {ProtocolDomain} domain
 * @returns {string}
 */
export function generateDomainStub(domain) {
  const domainName = domain.domain;
  const items = [];

  for (const command of domain.commands || []) {
    items.push(
      `<li><a href="../../#/${domainName}.${command.name}">${domainName}.${command.name}</a></li>`,
    );
  }
  for (const event of domain.events || []) {
    items.push(
      `<li><a href="../../#/${domainName}.${event.name}">${domainName}.${event.name}</a></li>`,
    );
  }
  for (const type of domain.types || []) {
    items.push(`<li><a href="../../#/${domainName}.${type.id}">${domainName}.${type.id}</a></li>`);
  }

  const itemsHtml = items.length ? `\n        ${items.join('\n        ')}\n      ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Redirecting to DevTools Protocol: ${domainName}...</title>
  <script>
    (function() {
      var hash = window.location.hash || '';
      var member = '';
      var match = hash.match(/^#(?:method|type|event)-([\\w-]+)/);
      if (match) member = '.' + match[1];
      window.location.replace('../../#/${domainName}' + member);
    })();
  </script>
</head>
<body>
  <p>Redirecting to <a href="../../#/${domainName}">${domainName}</a>...</p>
  <noscript>
    <ul>
      <!-- Static links to every command, event, and type for SEO, crawling, and grep -->${itemsHtml}</ul>
  </noscript>
</body>
</html>
`;
}

/**
 * Generates stubs and copies assets and data to output directory.
 * @param {Object} options
 * @param {string} [options.protocolPath] Path to protocol JSON (tot.json)
 * @param {string} [options.outputDir] Output directory path
 * @param {string} [options.srcDir] Source directory path
 * @param {string} [options.dataDir] Source data directory path
 * @returns {{ domainCount: number, outputDir: string }}
 */
export function generateStubs({
  protocolPath = path.resolve('data/tot.json'),
  outputDir = path.resolve('devtools-protocol'),
  srcDir = path.resolve('src'),
  dataDir = path.resolve('data'),
} = {}) {
  const rawData = fs.readFileSync(protocolPath, 'utf8');
  const protocol = JSON.parse(rawData);

  if (!protocol || !Array.isArray(protocol.domains)) {
    throw new Error(`Invalid protocol JSON at ${protocolPath}: missing domains array.`);
  }

  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  // Copy all assets from src/ to outputDir/
  fs.cpSync(srcDir, outputDir, { recursive: true });

  // Copy protocol data files to outputDir/data/
  const targetDataDir = path.join(outputDir, 'data');
  fs.mkdirSync(targetDataDir, { recursive: true });
  fs.copyFileSync(protocolPath, path.join(targetDataDir, 'tot.json'));
  const v8SourcePath = path.join(dataDir, 'v8.json');
  if (fs.existsSync(v8SourcePath)) {
    fs.copyFileSync(v8SourcePath, path.join(targetDataDir, 'v8.json'));
  }

  // Create .nojekyll in output directory
  fs.writeFileSync(path.join(outputDir, '.nojekyll'), '');

  // Generate tot/<Domain>/index.html stubs
  const totDir = path.join(outputDir, 'tot');
  fs.mkdirSync(totDir, { recursive: true });

  for (const domain of protocol.domains) {
    if (!domain || !domain.domain) continue;
    const domainDir = path.join(totDir, domain.domain);
    fs.mkdirSync(domainDir, { recursive: true });

    const stubHtml = generateDomainStub(domain);
    fs.writeFileSync(path.join(domainDir, 'index.html'), stubHtml, 'utf8');
  }

  console.log(`[generate-stubs] Generated ${protocol.domains.length} domain stubs in ${totDir}`);
  console.log(`[generate-stubs] Deployed assets, data, and .nojekyll to ${outputDir}`);

  return { domainCount: protocol.domains.length, outputDir };
}

// Auto-run if executed directly as CLI
const isDirectRun =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const protocolPath = process.argv[2] ? path.resolve(process.argv[2]) : undefined;
  const outputDir = process.argv[3] ? path.resolve(process.argv[3]) : undefined;
  generateStubs({ protocolPath, outputDir });
}
