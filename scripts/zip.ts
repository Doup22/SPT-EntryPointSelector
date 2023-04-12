import { execSync } from 'child_process';
import fs from 'fs-extra';
import { resolve } from 'path';
import packageJson from '../package.json';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const zip = require('bestzip');

async function main() {
  const dirName = packageJson.name;
  const zipFileName = `${packageJson.name}-${packageJson.version}.zip`;

  await fs.remove(zipFileName);
  await fs.emptyDir('dist');
  await fs.emptyDir('client');
  execSync('npm run build');
  execSync('npm run package', { cwd: 'electron' });
  await fs.emptyDir(dirName);
  await fs.copy('client', resolve(dirName, 'client'));
  await fs.copy('data', resolve(dirName, 'data'));
  await fs.copy(resolve('dist', 'src', 'mod.js'), resolve(dirName, 'src', 'mod.js'));
  await Promise.all(['package.json', 'README.md', 'LICENSE'].map(async file => {
    return await fs.copy(file, resolve(dirName, file));
  }));
  await zip({
    source: dirName,
    destination: zipFileName,
  });
  await fs.remove(dirName);
}

main();
