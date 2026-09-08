#!/usr/bin/env node

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dir = path.resolve('devtools-protocol');
if (!fs.existsSync(dir)) {
  console.error(`Directory ${dir} does not exist. Run "pnpm run build" first.`);
  process.exit(1);
}

const tmpIndex = path.join(os.tmpdir(), `gh-pages-deploy-index-${Date.now()}`);
try {
  execSync(`git --work-tree="${dir}" add -A .`, {
    env: { ...process.env, GIT_INDEX_FILE: tmpIndex },
    stdio: 'inherit',
  });
  const tree = execSync('git write-tree', {
    env: { ...process.env, GIT_INDEX_FILE: tmpIndex },
    encoding: 'utf8',
  }).trim();
  const commit = execSync(`git commit-tree ${tree} -m "deploy: update gh-pages to modern viewer"`, {
    encoding: 'utf8',
  }).trim();
  console.log(`Created deployment commit: ${commit}`);
  execSync(`git push origin ${commit}:refs/heads/gh-pages --force`, {
    stdio: 'inherit',
  });
  console.log('Successfully deployed to gh-pages branch on origin!');
} finally {
  if (fs.existsSync(tmpIndex)) {
    fs.unlinkSync(tmpIndex);
  }
}
