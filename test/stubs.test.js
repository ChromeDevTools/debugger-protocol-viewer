import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { generateStubs, generateDomainStub } from '../scripts/generate-stubs.js';

test('generateDomainStub: unit testing HTML generator', async (t) => {
  await t.test('generates redirect script and noscript list', () => {
    const mockDomain = {
      domain: 'TestDomain',
      commands: [{ name: 'testMethod' }],
      events: [{ name: 'testEvent' }],
      types: [{ id: 'TestType' }],
    };

    const html = generateDomainStub(mockDomain);

    assert.match(html, /<title>Redirecting to DevTools Protocol: TestDomain\.\.\.<\/title>/);
    assert.match(html, /window\.location\.replace\('\.\.\/\.\.\/#\/TestDomain' \+ member\);/);
    assert.match(
      html,
      /<li><a href="\.\.\/\.\.\/#\/TestDomain\.testMethod">TestDomain\.testMethod<\/a><\/li>/,
    );
    assert.match(
      html,
      /<li><a href="\.\.\/\.\.\/#\/TestDomain\.testEvent">TestDomain\.testEvent<\/a><\/li>/,
    );
    assert.match(
      html,
      /<li><a href="\.\.\/\.\.\/#\/TestDomain\.TestType">TestDomain\.TestType<\/a><\/li>/,
    );
  });
});

test('generateStubs: end-to-end stub generation in temporary directory', async (t) => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-stubs-'));

  try {
    const { domainCount, outputDir } = generateStubs({
      outputDir: tmpDir,
    });

    assert.equal(outputDir, tmpDir);
    assert.ok(domainCount > 0, 'Should generate stubs for protocol domains');

    await t.test('Page domain stub exists and has expected redirect & member link', () => {
      const pageStubPath = path.join(tmpDir, 'tot', 'Page', 'index.html');
      assert.ok(fs.existsSync(pageStubPath), 'tot/Page/index.html must exist');

      const content = fs.readFileSync(pageStubPath, 'utf8');
      assert.match(content, /window\.location\.replace\('\.\.\/\.\.\/#\/Page' \+ member\)/);
      assert.match(
        content,
        /Page\.navigateToHistoryEntry/,
        'Must contain navigateToHistoryEntry noscript link',
      );
    });

    await t.test('.nojekyll file exists in output directory', () => {
      const nojekyllPath = path.join(tmpDir, '.nojekyll');
      assert.ok(fs.existsSync(nojekyllPath), '.nojekyll must exist in output');
    });

    await t.test('404.html exists in output and contains redirect logic', () => {
      const notFoundPath = path.join(tmpDir, '404.html');
      assert.ok(fs.existsSync(notFoundPath), '404.html must exist in output');

      const content = fs.readFileSync(notFoundPath, 'utf8');
      assert.match(content, /window\.location\.replace/);
      assert.match(content, /\/devtools-protocol/);
      assert.match(content, /#(?:method|type|event)-/);
      assert.match(content, /1-3/);
      assert.match(content, /stable/);
      assert.match(content, /v8/);
      assert.match(content, /tot/);
    });

    await t.test('Static assets from src/ are copied into output directory', () => {
      const expectedAssets = [
        'index.html',
        'main.js',
        'protocol-model.js',
        'protocol_renderer.js',
        'search.js',
        'fuzzy_search.js',
        'utilities.js',
        'style.css',
        'favicons',
        'images',
      ];

      for (const asset of expectedAssets) {
        const assetPath = path.join(tmpDir, asset);
        assert.ok(fs.existsSync(assetPath), `Asset ${asset} must be copied to output`);
      }
    });

    await t.test('CLI script execution succeeds', () => {
      const cliTmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-cli-'));
      try {
        const scriptPath = path.resolve('scripts/generate-stubs.js');
        const output = execFileSync(
          process.execPath,
          [scriptPath, path.resolve('data/tot.json'), cliTmpDir],
          { encoding: 'utf8' },
        );

        assert.match(output, /Generated 53 domain stubs/);
        assert.ok(fs.existsSync(path.join(cliTmpDir, 'tot', 'Page', 'index.html')));
        assert.ok(fs.existsSync(path.join(cliTmpDir, '.nojekyll')));
      } finally {
        fs.rmSync(cliTmpDir, { recursive: true, force: true });
      }
    });
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
