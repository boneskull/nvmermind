#!/usr/bin/env node

'use strict';

const pluralize = require('pluralize');
const kleur = require('kleur');
const {execFile} = require('child_process');
const prompts = require('prompts');
const {parse} = require('semver');
const path = require('node:path');
// @ts-expect-error - types broken; see https://github.com/humanwhocodes/env/pull/78
const {Env} = require('@humanwhocodes/env');
const ora = require('ora');
const {readdir} = require('node:fs/promises');
const {version} = require('../package.json');

const env = new Env();

/**
 * Directory within `$NVM_DIR` where Node.js versions are installed
 */
const NODE_VERSIONS_RELDIR = 'versions/node';

/**
 * Path to the `nvm` wrapper script
 */
const NVM_BIN = path.resolve(__dirname, 'nvm.sh');

/**
 * Object representing a Node.js version on disk installed by nvm
 * @typedef InstalledVersion
 * @property {import('semver').SemVer} version - Parsed version
 * @property {string} dirpath - Absolute path to version directory
 * @property {number} size - Size in bytes
 */

/**
 * Build a list of Node.js versions for display
 * @param {(size: number) => unknown} filesize - Function to convert bytes to human-readable format
 * @param {InstalledVersion[]} oldVersions - List of old versions
 * @param {Record<string, InstalledVersion>} newestVersionsByMajor - Map of newest versions by major version
 * @returns {string} List of versions for display
 */
function buildDisplayList(filesize, oldVersions, newestVersionsByMajor) {
  return oldVersions
    .map(({version, dirpath, size}) => {
      return `${kleur.gray('-')} ${kleur.red(version.raw)} (${kleur.yellow(
        String(filesize(size)),
      )} in ${dirpath}; keeping ${kleur.green(
        newestVersionsByMajor[version.major].version.raw,
      )})`;
    })
    .join('\n');
}

/**
 * Main entry point
 * @returns {Promise<void>}
 */
async function main() {
  console.error(`😒 ${kleur.blue('nvmermind')} ${kleur.white(`v${version}`)}`);

  /** @type {string} */
  let nvmDir;
  try {
    nvmDir = env.require('NVM_DIR');
  } catch (err) {
    console.error(
      kleur.red(
        'Could not find the NVM_DIR environment variable. Make sure nvm is installed and enabled',
      ),
    );
    process.exitCode = 1;
    return;
  }

  const spinner = ora({
    text: 'Analyzing installed versions of Node.js…',
  }).start();

  /** @type {InstalledVersion[]} */
  let oldVersions;
  /** @type {Record<string, InstalledVersion>} */
  let newestVersionsByMajor;

  try {
    ({oldVersions, newestVersionsByMajor} = await partitionVersions(nvmDir));
  } catch (err) {
    spinner.fail(
      `Failed to locate installed versions (is NVM_DIR correct?): ${kleur.red(
        /** @type {Error} */ (err).message,
      )}`,
    );
    return;
  }

  if (oldVersions.length) {
    spinner.succeed(
      `Found ${pluralize('old version', oldVersions.length, true)}`,
    );
  } else {
    spinner.info('No old versions found; nothing to do. Sorry / not sorry');
    return;
  }

  const {filesize} = await import('filesize');
  const displayList = buildDisplayList(
    filesize,
    oldVersions,
    newestVersionsByMajor,
  );

  const confirmation = await prompts({
    type: 'confirm',
    name: 'removeAll',
    message: `The following Node.js versions will be removed:

${displayList}

Proceed?`,
  });

  if (confirmation.removeAll) {
    console.error(
      'Warning: estimated duration is directly proportional to the amount of crap you globally installed',
    );
    const spinner = ora({
      text: 'Removing old versions…',
      spinner: 'shark',
    });
    const success = await nvmUninstall(
      oldVersions.map(({version}) => version.raw),
      spinner,
    );
    if (!success) {
      throw new Error(
        'Something went wrong! Hopefully the output above helps! ¯\\_(ツ)_/¯',
      );
    } else {
      const totalSize = oldVersions.reduce((sum, {size}) => sum + size, 0);

      console.error(
        `${kleur.green('✔')} Done; ${kleur.green(
          String(filesize(totalSize)),
        )} recovered`,
      );
    }
  }
}

/**
 * Runs `nvm` with args and options.  Resolves with output from run
 * @param {string[]} [args] - Args for `nvm`
 * @param {import('child_process').ExecFileOptions} [opts] - Options for `execFile`
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runNvm(args = [], opts = {}) {
  return new Promise((resolve, reject) => {
    execFile(NVM_BIN, args, opts, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      resolve({
        stdout,
        stderr,
      });
    });
  });
}

/**
 * Run `nvm uninstall <version>` for each of `versions`.
 *
 * This removes installations in serial, mainly because it's more of a pain to
 * display multiple progress bars.
 * @param {string[]} versions - List of raw Node.js version id's, e.g., `v14.0.1`
 * @param {import('ora').Ora} spinner - Spinner to use
 * @returns {Promise<boolean>} `true` if success
 */
async function nvmUninstall(versions, spinner) {
  let failed = false;
  for await (const version of versions) {
    spinner.start(`Removing ${version}...`);
    try {
      await runNvm(['uninstall', version]);
      spinner.succeed(`Removed ${kleur.red(version)}`);
    } catch (err) {
      spinner.warn(kleur.yellow(/** @type {Error} */ (err).message));
      failed = true;
    }
  }
  return !failed;
}

/**
 * Get a sorted list of objects representing all installed-by-NVM Node.js versions
 * @param {string} nvmDir - Typically `$NVM_DIR` env var
 * @returns {Promise<InstalledVersion[]>}
 */
async function getAllInstalledVersions(nvmDir) {
  const nodeVersionsDir = path.resolve(nvmDir, NODE_VERSIONS_RELDIR);
  const versionDirEntries = await readdir(nodeVersionsDir, {
    withFileTypes: true,
  });

  /** @type {import('get-folder-size')} */
  const {default: getFolderSize} = /** @type {any} */ (
    await import('get-folder-size')
  ); // jacked up types
  const installedVersions = /** @type {InstalledVersion[]} */ (
    await Promise.all(
      versionDirEntries
        .filter((dirEnt) => dirEnt.isDirectory())
        // note that parse() understands the `v` prefix
        .map((dirEnt) => ({version: parse(dirEnt.name), dirEnt}))
        .filter(({version}) => version) // toss out invalid versions
        .map(async ({version, dirEnt}) => {
          const dirpath = path.resolve(nodeVersionsDir, dirEnt.name);
          const size = await getFolderSize.loose(dirpath);
          return {version, dirpath, size};
        }),
    )
  );

  return installedVersions.sort(({version: versionA}, {version: versionB}) =>
    versionB.compare(versionA),
  );
}

/**
 * Splits the list returned by {@link getAllInstalledVersions} into versions which are old (and should be removed) and a map of the newest version for each major version
 * @param {string} nvmDir - Typically `$NVM_DIR` env var
 * @returns {Promise<{oldVersions: InstalledVersion[], newestVersionsByMajor: Record<string,InstalledVersion>}>}
 */
async function partitionVersions(nvmDir) {
  /** @type {InstalledVersion[]} */
  const oldVersions = [];
  /** @type {Record<string,InstalledVersion>} */
  const newestVersionsByMajor = {};
  const allVersions = await getAllInstalledVersions(nvmDir);

  allVersions.forEach((installedVersion, idx, installedVersions) => {
    if (
      installedVersions[idx - 1]?.version.major ===
      installedVersion.version.major
    ) {
      oldVersions.push(installedVersion);
    } else {
      newestVersionsByMajor[installedVersion.version.major] = installedVersion;
    }
  });

  return {oldVersions, newestVersionsByMajor};
}

if (require.main === module) {
  (async () => {
    try {
      await main();
    } catch (err) {
      console.error(/** @type {Error} */ (err).message);
      process.exitCode = 1;
    }
  })();
}

module.exports = {
  partitionVersions,
  getAllInstalledVersions,
  nvmUninstall,
  runNvm,
};
