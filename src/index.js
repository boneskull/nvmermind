#!/usr/bin/env node

'use strict';

const {execFile} = require('child_process');
const prompts = require('prompts');
const {parse} = require('semver');
const {resolve} = require('path');
const {Env} = require('@humanwhocodes/env');
const ora = require('ora');
const {readdir} = require('fs/promises');

const env = new Env();

const NODE_VERSIONS_RELDIR = 'versions/node';
const NVM_BIN = resolve(__dirname, 'nvm.sh');

async function main() {
  const nvmDir = env.require('NVM_DIR');
  const oldVersions = await getOldInstalledVersions(nvmDir);
  const confirmation = await prompts({
    type: 'confirm',
    name: 'removeAll',
    onRender(kleur) {
      const displayList = oldVersions
        .map((version) => `${kleur.red(version.raw)} (at ${version.dirpath})`)
        .join('\n');

      this.msg = `${kleur.yellow(
        'The following Node.js versions will be removed:'
      )}

${displayList}
          
Proceed?`;
    },
    message: '',
  });

  if (confirmation.removeAll) {
    console.error(
      'Warning: estimated duration is directly proportional to the size of global node_modules'
    );
    const spinner = ora({
      text: 'Removing old versions...',
      spinner: 'shark',
    });
    const success = await nvmUninstall(
      oldVersions.map(({raw}) => raw),
      spinner
    );
    if (!success) {
      throw new Error('One or more removals failed!');
    }
  }
}

/**
 * Returns a minimal environment in which `nvm` can run
 * @param {object} [overrides] - Environment overrides
 * @returns {NodeJS.ProcessEnv}
 */
function getMinimalEnv(overrides = {}) {
  const {env} = process;
  return Object.keys(env).reduce(
    (e, key) => {
      if (
        key.startsWith('npm_') ||
        key.startsWith('NVM_') ||
        env[key] === undefined
      ) {
        return e;
      }
      e[key] = e[key] ?? env[key];
      return e;
    },
    {...overrides}
  );
}

/**
 * Runs `nvm` with args and options.  Resolves with output from run
 * @param {string[]} [args] - Args for `nvm`
 * @param {import('child_process').ExecFileOptions} [opts] - Options for `execFile`
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runNvm(args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(
      NVM_BIN,
      args,
      {
        ...opts,
        env: getMinimalEnv({
          ...(opts.env ?? {}),
          NVM_DIR: opts.env?.NVM_DIR ?? env.require('NVM_DIR'),
        }),
      },
      (err, stdout, stderr) => {
        if (err) {
          return reject(err);
        }
        resolve({
          stdout: stdout,
          stderr: stderr,
        });
      }
    );
  });
}

/**
 * Run `nvm uninstall <version>` for each of `versions`.
 * @param {string[]} versions - List of Node.js version id's, e.g., `v14.0.1`
 * @param {import('ora').Ora} spinner - Spinner to use
 * @returns {Promise<boolean>} `true` if success
 */
async function nvmUninstall(versions, spinner) {
  let failed = false;
  for await (const version of versions) {
    spinner.start(`Removing ${version}...`);
    try {
      await runNvm(['uninstall', version]);
      spinner.succeed(`Removed ${version}`);
    } catch (err) {
      spinner.warn(err);
      failed = true;
    }
  }
  return !failed;
}

/**
 * Get a sorted list of objects representing all installed-by-NVM Node.js versions
 * @param {string} nvmDir - Typically `$NVM_DIR` env var
 * @returns {Promise<(import('semver').SemVer & {dirpath: string})[]>}
 */
async function getAllInstalledVersions(nvmDir) {
  const nodeVersionsDir = resolve(nvmDir, NODE_VERSIONS_RELDIR);
  const versionDirEntries = await readdir(nodeVersionsDir, {
    withFileTypes: true,
  });
  return versionDirEntries
    .filter((dirEnt) => dirEnt.isDirectory())
    .map(({name}) => ({
      ...parse(name),
      dirpath: resolve(nodeVersionsDir, name),
    }))
    .sort(
      (versionA, versionB) =>
        versionB.major < versionA.major ||
        versionB.minor - versionA.minor ||
        versionB.patch - versionA.patch
    );
}

/**
 * Filter the list returned by {@link getAllInstalledVersions} to only include
 * those which should be removed: any versions of a major older than the latest installed version (for a major).
 * @param {string} nvmDir - Typically `$NVM_DIR` env var
 * @returns {Promise<(import('semver').SemVer & {dirpath: string})[]>}
 */
async function getOldInstalledVersions(nvmDir) {
  return (await getAllInstalledVersions(nvmDir)).filter(
    (version, idx, versions) => versions[idx - 1]?.major === version.major
  );
}

if (require.main === module) {
  (async () => {
    try {
      await main();
      console.error('OK');
    } catch ({message}) {
      console.error(message);
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  getOldInstalledVersions,
  getAllInstalledVersions,
  nvmUninstall,
  runNvm,
  getMinimalEnv,
};
