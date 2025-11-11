# AGENTS.md

This file provides guidance to AI coding agents (such as Claude Code, GitHub Copilot, Cursor, etc.) when working with code in this repository.

## Repository Overview

**nvmermind** is a specialized CLI tool that "takes out the trash" from your NVM (Node Version Manager) installation. It identifies and removes outdated Node.js minor/patch versions while preserving the latest version of each major release.

### Purpose

- **Primary Function**: Clean up `~/.nvm` directory by uninstalling old Node.js versions
- **Strategy**: Keep the newest version of each major (e.g., keep v20.12.0, remove v20.11.0, v20.10.1)
- **Safety**: Uses nvm's built-in uninstall mechanism for safe removal
- **User Experience**: Interactive CLI with colored output, progress spinners, and confirmation prompts

### Project Characteristics

- **Type**: CLI tool / npm package
- **Distribution**: Designed for `npx nvmermind` usage (run without installation)
- **Philosophy**: Minimalist, opinionated, zero configuration
- **Code Size**: ~285 lines in single JavaScript file
- **Architecture**: JavaScript source with comprehensive JSDoc + TypeScript tooling for type safety

### Project Statistics

- **Primary Language**: JavaScript (with TypeScript type definitions)
- **Lines of Code**: ~285 (single main file)
- **Package Manager**: npm
- **Node.js Requirements**: v20.19.0 or newer (as of v1.0.2)
- **Current Version**: 1.0.2
- **License**: Apache-2.0
- **Maintenance Status**: Active (98% automated dependency updates, 2% feature/bug work)

## Quick Start

### Prerequisites

- **Node.js**: v20.19.0 or newer
- **NVM**: Must be properly installed and configured
- **Environment**: `NVM_DIR` environment variable must be set

### Usage

#### As a One-Off Tool (Recommended)

```bash
npx nvmermind
```

#### Local Development Setup

```bash
# Clone repository
git clone https://github.com/boneskull/nvmermind.git
cd nvmermind

# Install dependencies (runs prepare script automatically)
npm install

# Test your changes
npm test

# Lint your changes
npm run lint
```

### What It Does

1. Reads all Node.js versions from `$NVM_DIR/versions/node`
2. Calculates disk space used by each version
3. Partitions versions into "old" (to remove) and "newest by major" (to keep)
4. Displays a colored list showing what will be removed/kept
5. Prompts for confirmation
6. Uninstalls old versions serially using `nvm uninstall`
7. Reports total disk space recovered

## Essential Commands

### Development

```bash
# Build TypeScript type definitions
npm run build

# Clean generated types
npm run clean

# Rebuild (clean + build)
npm run rebuild

# Run smoke tests
npm test
```

### Linting & Formatting

```bash
# Run all linters (ESLint + Prettier + Markdownlint)
npm run lint

# Lint source files (ESLint + Prettier)
npm run lint:sources

# ESLint only
npm run lint:eslint

# Prettier only
npm run lint:prettier

# Markdown linting
npm run lint:markdown

# Lint staged files (pre-commit)
npm run lint:staged

# Validate commit message
npm run lint:commit
```

## Architecture and Key Concepts

### System Architecture

This is a **minimalist CLI tool** with a deliberately simple architecture:

```text
User runs CLI
    ↓
Environment validation (NVM_DIR check)
    ↓
Read versions from $NVM_DIR/versions/node
    ↓
Parse semver + calculate folder sizes (parallel)
    ↓
Partition by major version (newest vs old)
    ↓
Display formatted list with colors/emojis
    ↓
User confirmation prompt
    ↓
Serial uninstallation via nvm.sh wrapper
    ↓
Display space recovered summary
```

**Design Principles:**

- Single responsibility: Clean up old Node.js versions
- No configuration: Opinionated behavior (keep latest of each major)
- Safety first: Use nvm's uninstall, not manual deletion
- UX focused: Colors, spinners, clear messaging, confirmation prompts
- Fail gracefully: Helpful error messages, non-zero exit codes

### Core Concepts

#### 1. **Version Partitioning Algorithm**

**Location**: `src/index.js` lines 248-266

The heart of the tool is the partition algorithm:

```javascript
// Get all versions sorted descending (newest first)
const versions = await getAllInstalledVersions(nvmDir);

// Single pass: first occurrence of each major = keep, rest = remove
for (const version of versions) {
  const major = version.version.major;
  if (!newest.has(major)) {
    newest.set(major, version); // First seen = newest
  } else {
    old.push(version); // Already seen this major = old
  }
}
```

**Why it works**: Pre-sorted descending list means first occurrence of each major version is guaranteed to be the latest.

#### 2. **NVM Integration via Bash Wrapper**

**Location**: `src/nvm.sh`

**Challenge**: Node.js cannot directly call bash functions (nvm is a bash function, not a binary)

**Solution**: Shell script wrapper that sources nvm and passes through commands:

```bash
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm $@
```

**Usage**: `runNvm(['uninstall', 'v14.15.0'])` → executes via `nvm.sh` → calls `nvm uninstall v14.15.0`

#### 3. **Serial Uninstallation Strategy**

**Location**: `src/index.js` lines 175-178

**Decision**: Uninstall versions one-at-a-time, not in parallel

**Rationale** (from code comments):

> "This removes installations in serial, mainly because it's more of a pain to display multiple progress bars."

**Trade-off**: Slower execution for better UX (single progress spinner vs complex multi-spinner UI)

**Performance Note**: Removal speed is "directly proportional to the amount of crap you globally installed" because each version's global npm packages must be cleaned up.

#### 4. **JavaScript + TypeScript Hybrid**

**Philosophy**: Get TypeScript benefits without TypeScript source complexity

**Implementation**:

- Source code: JavaScript (`src/index.js`)
- Type annotations: Comprehensive JSDoc comments
- Type checking: TypeScript compiler validates JSDoc (`checkJs: true`)
- Output: TypeScript declaration files (`.d.ts`) for npm consumers
- Build: `tsc -b` generates types in `types/` directory

**Benefits**:

- Runtime simplicity (plain JavaScript, no transpilation)
- Type safety during development (IDE autocomplete, compile-time checks)
- Published types for library consumers
- No build step for execution, only for type generation

#### 5. **Dependency Type Workarounds**

**Known Issues** (documented in code):

```javascript
// @ts-expect-error - types broken; see https://github.com/humanwhocodes/env/pull/78
const {Env} = require('@humanwhocodes/env');

/** @type {import('get-folder-size')} */
const {default: getFolderSize} = /** @type {any} */ (
  await import('get-folder-size')
); // jacked up types
```

**Context**: Several dependencies have incorrect or incomplete TypeScript definitions, requiring type casting and error suppression to maintain build success.

### Data Flow

**Primary Data Structure**: `InstalledVersion`

```javascript
{
  version: SemVer,      // Parsed semantic version (from semver package)
  dirpath: string,      // Absolute path: $NVM_DIR/versions/node/v14.15.0
  size: number          // Bytes (calculated via get-folder-size)
}
```

**Transformation Pipeline**:

1. **Discovery**: Read directory entries → filter valid semver names
2. **Enrichment**: Parse to SemVer objects → calculate folder sizes (parallel)
3. **Sorting**: Sort by version descending (newest first)
4. **Partitioning**: Group by major, separate old vs newest
5. **Presentation**: Format with colors/emojis → build display list
6. **Action**: User confirms → serial uninstall → report results

## Project Structure

```text
nvmermind/
├── .github/
│   └── workflows/              # CI/CD automation
│       ├── commitlint.yml      # PR commit message validation
│       ├── nodejs.yml          # Test matrix: Node 20, 22, 24
│       └── release.yml         # Automated npm publish via release-please
├── .husky/                     # Git hooks
│   ├── pre-commit              # Runs lint-staged
│   └── commit-msg              # Runs commitlint
├── src/
│   ├── index.js               # Main entry point (285 lines)
│   └── nvm.sh                 # Bash wrapper for nvm commands
├── test/
│   └── fixtures/              # Mock NVM_DIR for smoke tests
│       └── versions/node/     # Fake version directories
├── types/                     # Generated TypeScript declarations
│   └── src/
│       └── index.d.ts         # Auto-generated from JSDoc
├── .editorconfig              # Editor settings (2-space indent, LF, UTF-8)
├── .eslintrc.yml              # ESLint: semistandard + prettier
├── .gitignore                 # Git ignore rules
├── .markdownlint.yml          # Markdown linting config
├── .npmrc                     # npm config: save-exact=true
├── .prettierignore            # Prettier exclusions
├── .release-please-manifest.json  # Release automation state
├── CHANGELOG.md               # Auto-generated from commits
├── commitlint.config.js       # Conventional commits (relaxed)
├── package.json               # Project metadata + scripts
├── package-lock.json          # Locked dependencies
├── release-please-config.json # Release automation config
├── tsconfig.json              # TypeScript declaration generation
└── README.md                  # User documentation
```

### Key Directories

- **`.github/workflows/`**: All CI/CD automation (commitlint, test matrix, releases)
- **`.husky/`**: Git hooks for pre-commit linting and commit message validation
- **`src/`**: All source code (single JavaScript file + bash wrapper)
- **`types/`**: Generated TypeScript definitions (build artifact, not source)
- **`test/fixtures/`**: Minimal fixtures for smoke testing

### Entry Points

**CLI Entry**:

- Binary: `./src/index.js` (executable via shebang `#!/usr/bin/env node`)
- Package bin: `nvmermind` command (registered in package.json)
- Self-executing: Uses `if (require.main === module)` pattern

**Programmatic Entry**:

- Module exports: `partitionVersions`, `getAllInstalledVersions`, `nvmUninstall`, `runNvm`
- Type definitions: Available at `./types/src/index.d.ts`
- **Note**: API is intentionally undocumented (README states "I don't feel like documenting it")

## Important Patterns

### Code Organization

**Single File Architecture**:

- All logic in `src/index.js` (285 lines)
- Functions ordered from high-level (main entry) to low-level utilities
- Explicit exports at file end: `module.exports = { ... }`

**Function Hierarchy**:

```text
main()                          // Top-level orchestration
  ↓
getAllInstalledVersions()       // Version discovery
  ↓
partitionVersions()            // Core business logic
  ↓
buildDisplayList()             // UI formatting
  ↓
nvmUninstall()                 // Batch uninstallation
  ↓
runNvm()                       // Low-level nvm wrapper
```

### Naming Conventions

**Files**:

- JavaScript: lowercase `.js` extension (`index.js`, `nvm.sh`)
- TypeScript declarations: `.d.ts` extension (generated)
- Config files: kebab-case or dot-prefix (`.eslintrc.yml`, `commitlint.config.js`)

**Code**:

- **camelCase**: Variables and functions (`nvmDir`, `getAllInstalledVersions`, `partitionVersions`)
- **UPPER_SNAKE_CASE**: Constants (`NODE_VERSIONS_RELDIR`, `NVM_BIN`)
- **PascalCase**: Type definitions (`InstalledVersion`)

### Module System

**CommonJS** (not ES modules):

```javascript
// External dependencies
const pluralize = require('pluralize');
const kleur = require('kleur');

// Node.js built-ins with node: prefix
const path = require('node:path');
const {readdir} = require('node:fs/promises');

// Dynamic imports for ESM-only packages
const {filesize} = await import('filesize');
const {default: getFolderSize} = await import('get-folder-size');

// Exports
module.exports = {
  partitionVersions,
  getAllInstalledVersions,
  nvmUninstall,
  runNvm,
};
```

### Error Handling

**Philosophy**: Graceful degradation with user-friendly messages

**Patterns**:

```javascript
// Environment validation
try {
  nvmDir = env.require('NVM_DIR');
} catch (err) {
  console.error(kleur.red('Error: NVM_DIR not found'));
  process.exitCode = 1;
  return; // Don't call process.exit()
}

// Error type casting for TypeScript
catch (err) {
  console.error(/** @type {Error} */ (err).message);
}
```

**Rules**:

- Use `console.error()` for ALL output (including non-errors)
- Set `process.exitCode` instead of calling `process.exit()` directly
- Always cast caught errors to Error type for TypeScript
- Show helpful messages with context, not raw stack traces
- Confirm before destructive operations

### Async Patterns

**Async/Await**: Primary pattern throughout

```javascript
// IIFE wrapper at top level
(async () => {
  await main();
})().catch((err) => {
  console.error(/** @type {Error} */ (err).message);
  process.exitCode = 1;
});
```

**Parallel Operations**:

```javascript
// Calculate folder sizes in parallel
const versions = await Promise.all(
  dirs.map(async (dir) => {
    const size = await getFolderSize.loose(dirpath);
    return {version: parse(dir), dirpath, size};
  }),
);
```

**Serial Operations**:

```javascript
// Uninstall one version at a time (UX decision)
for await (const version of versions) {
  await runNvm(['uninstall', version]);
}
```

### User Interface Patterns

**Colors** (kleur):

- **Red**: Removed items, errors
- **Green**: Success, kept items, recovered space
- **Yellow**: Warnings, file sizes
- **Blue**: Application name
- **Gray**: List bullets
- **White**: Version numbers

**Progress Indication** (ora):

```javascript
const spinner = ora('Discovering installed versions...').start();
// ... work ...
spinner.succeed('Found 12 versions');
```

**Prompts** (prompts):

```javascript
const {confirmed} = await prompts({
  type: 'confirm',
  name: 'confirmed',
  message: 'Remove old versions?',
});
```

**Emojis**:

- 😒 (face with rolling eyes) - Brand emoji for nvmermind

### Testing Approach

**Smoke Testing Only**:

- Framework: `midnight-smoker`
- No unit tests, integration tests, or E2E tests
- Test command: Creates mock NVM_DIR, runs CLI, validates it doesn't crash

**Test Execution**:

```bash
npm test  # → smoker test:smoke
```

**Test Setup**:

```bash
# Creates test/fixtures/versions/node directory
npx mkdirp ./test/fixtures/versions/node

# Sets fake NVM_DIR and runs CLI
npx cross-env NVM_DIR=./test/fixtures node .
```

**Why Smoke Tests Only**: Simple architecture (285 lines, single file) doesn't warrant complex test infrastructure. Smoke tests verify package installation and basic execution work.

## Code Style

### Language-Specific Conventions

**ESLint Configuration**:

- Extends: `semistandard` + `prettier`
- Environment: Node.js + ES2021
- Semicolons required (via semistandard)
- Prettier integration for consistent formatting

**Prettier Configuration**:

```javascript
{
  "bracketSpacing": false,        // {foo} not { foo }
  "endOfLine": "auto",            // Platform-appropriate
  "singleQuote": true,            // 'string' not "string"
  "plugins": [
    "prettier-plugin-pkg",        // Format package.json
    "prettier-plugin-jsdoc"       // Format JSDoc comments
  ]
}
```

**EditorConfig**:

- 2-space indentation
- LF line endings
- UTF-8 charset
- Trim trailing whitespace (except Markdown)
- Insert final newline

### Documentation Standards

**JSDoc Comments**: Comprehensive type annotations for all functions

**Example**:

```javascript
/**
 * Partition versions into old (to remove) and newest by major
 *
 * @param {string} nvmDir - Path to NVM directory
 * @returns {Promise<{
 *   old: InstalledVersion[];
 *   newest: Map<number, InstalledVersion>;
 * }>}
 */
async function partitionVersions(nvmDir) {
  // ...
}

/**
 * @typedef {object} InstalledVersion
 * @property {import('semver').SemVer} version - Parsed version
 * @property {string} dirpath - Absolute path to version directory
 * @property {number} size - Size in bytes
 */
```

**Inline Comments**: Used sparingly, only for non-obvious logic

```javascript
// note that parse() understands the `v` prefix
const version = parse(dir);
```

### Import/Export Patterns

**Import Order**:

1. External dependencies
2. Node.js built-ins (with `node:` prefix)
3. Local modules

**Destructuring**: Used for selective imports

```javascript
const {execFile} = require('node:child_process');
const {readdir} = require('node:fs/promises');
```

**Dynamic Imports**: For ESM-only packages in CommonJS context

```javascript
// filesize is ESM-only, must use dynamic import
const {filesize} = await import('filesize');
```

## Dependencies and External Services

### Core Dependencies (8 total)

- **@humanwhocodes/env** (3.0.1) - Environment variable validation with `require()` method
- **filesize** (11.0.13) - Human-readable file size formatting (e.g., "2.3 GB")
- **get-folder-size** (4.0.0) - Recursive directory size calculation
- **kleur** (4.1.5) - Terminal colors (fast chalk alternative)
- **ora** (5.4.1) - Terminal spinners for progress indication
- **pluralize** (8.0.0) - Word pluralization ("1 version" vs "2 versions")
- **prompts** (2.4.2) - Interactive CLI prompts for confirmations
- **semver** (7.7.3) - Semantic version parsing and comparison

**Dependency Strategy**:

- Minimal dependencies (only 8 runtime deps)
- Each dependency has a clear, singular purpose
- No dependency bloat or kitchen-sink libraries
- Versions pinned exactly (no `^` or `~` ranges)

### Dev Dependencies

**Linting & Formatting** (10 packages):

- ESLint + plugins (semistandard, prettier, import, promise, node)
- Prettier + plugins (jsdoc, pkg)
- markdownlint-cli2

**Git Workflow** (4 packages):

- husky, lint-staged
- @commitlint/cli, @commitlint/config-conventional

**TypeScript** (6 packages):

- TypeScript compiler
- @tsconfig/node16 base config
- @types/node, @types/get-folder-size, @types/pluralize, @types/prompts, @types/semver

**Testing & Build** (2 packages):

- midnight-smoker (smoke testing)
- npm-run-all2 (parallel script execution)

### External Services

**NVM Integration**:

- **Requirement**: nvm must be installed and configured
- **Detection**: Checks for `$NVM_DIR` environment variable
- **Execution**: Sources `$NVM_DIR/nvm.sh` via bash wrapper
- **Commands Used**: `nvm uninstall <version>`

**GitHub Services**:

- **GitHub Actions**: CI/CD workflows
- **Renovate Bot**: Automated dependency updates
- **Release Please**: Automated semantic versioning and releases
- **npm Registry**: Package distribution

### Environment Variables

**Required**:

```bash
NVM_DIR=/Users/username/.nvm  # Path to NVM installation directory
```

**Validation**: Uses `@humanwhocodes/env` package:

```javascript
const env = new Env();
const nvmDir = env.require('NVM_DIR'); // Throws if not set
```

**Error Handling**: If `NVM_DIR` not found, shows user-friendly error:

```text
Error: The NVM_DIR environment variable is not defined.
Are you sure you have NVM installed and configured?
```

## Development Workflows

### Git Workflow

**Branch Strategy**:

- Main branch: `main`
- No specific branch naming convention enforced

**Commit Message Convention**: **Conventional Commits** (strictly enforced)

**Format**: `type(scope): description`

**Common Types**:

- `feat`: New feature
- `fix`: Bug fix
- `chore`: Maintenance (no production code change)
- `docs`: Documentation only
- `ci`: CI/CD changes

**Common Scopes**:

- `deps`: Dependency changes (85%+ of all commits)
- `pkg`: Package configuration
- `workflows`: GitHub Actions changes
- `output` / `display`: UI changes

**Example Commits**:

```bash
git commit -m "feat: add file size calculation"
git commit -m "fix(deps): update semver to 7.7.3"
git commit -m "chore(ci): add Node.js 24 to test matrix"
```

**Validation**: Commitlint runs on:

- Pre-commit hook (local)
- GitHub Actions workflow (PRs)

**Relaxed Rules**: Body/footer length limits disabled, subject case/punctuation flexible

### Local Development

**Setup**:

```bash
npm install          # Installs deps + runs prepare script
npm run prepare      # Runs: husky install && npm run rebuild
```

**Pre-commit Hook** (automatic via husky):

```bash
# Runs lint-staged on git commit
npm run lint:staged
```

**Lint-staged Actions**:

- `*.js` → ESLint auto-fix + Prettier format
- `*.md` → Markdownlint auto-fix + Prettier format
- `*.{yml,yaml,json}` → Prettier format

**Commit Message Hook** (automatic via husky):

```bash
# Validates commit message on git commit
npm run lint:commit -- --edit <commit-msg-file>
```

### Build Process

**TypeScript Declaration Generation**:

```bash
npm run build        # tsc -b (generates types/ directory)
npm run clean        # tsc -b --clean (removes types/)
npm run rebuild      # Sequential: build → clean
```

**What Gets Built**:

- Input: `src/index.js` (JavaScript with JSDoc)
- Output: `types/src/index.d.ts` + `.d.ts.map` (TypeScript declarations)
- No transpilation: Source remains JavaScript

**Build Configuration** (`tsconfig.json`):

- Extends `@tsconfig/node16`
- `allowJs: true` + `checkJs: true` - Type check JavaScript via JSDoc
- `emitDeclarationOnly: true` - Only generate `.d.ts` files, no `.js` output
- Output directory: `./types`

### CI/CD Pipeline

**GitHub Actions Workflows**:

#### 1. Node CI (`.github/workflows/nodejs.yml`)

- **Triggers**: Push, Pull Request
- **Matrix**: Node.js 20, 22, 24 on Ubuntu
- **Steps**:
  1. Checkout code
  2. Setup Node.js
  3. Install dependencies
  4. Run tests (`npm test`)
  5. Run linting (`npm run lint`)

#### 2. Commitlint (`.github/workflows/commitlint.yml`)

- **Triggers**: Pull Requests only
- **Purpose**: Validate commit message format
- **Ensures**: All PR commits follow conventional format

#### 3. Release (`.github/workflows/release.yml`)

- **Triggers**: Push to `main` branch
- **Process**:
  1. Release Please creates/updates release PR
  2. When merged:
     - Bumps version in package.json
     - Updates CHANGELOG.md
     - Creates GitHub release
     - Publishes to npm registry

**Automated Releases**:

- Uses Google's release-please action
- Version bumps based on conventional commits
- CHANGELOG auto-generated from commit messages
- npm publish happens automatically after release

### Release Process

**Releasing a New Version**:

1. Merge changes to `main` with conventional commits
2. Release Please workflow automatically:
   - Creates release PR (if one doesn't exist)
   - Updates version in package.json
   - Updates CHANGELOG.md
3. Review and merge release PR
4. Workflow publishes to npm automatically

**Version Bumping Rules** (conventional commits):

- `fix:` → Patch version (1.0.0 → 1.0.1)
- `feat:` → Minor version (1.0.0 → 1.1.0)
- `feat!:` or `BREAKING CHANGE:` → Major version (1.0.0 → 2.0.0)

**Manual Release Steps** (if needed):

```bash
# 1. Ensure you're on main branch
git checkout main
git pull

# 2. Build types
npm run build

# 3. Publish (requires npm auth)
npm publish
```

### Dependency Management

**Renovate Bot**: Handles 98% of all commits

**Configuration** (`.github/renovate.json`):

- Auto-merge enabled (dependencies are automatically merged)
- Minimum release age: 3 days (wait before adopting new versions)
- Labels: `dependencies`
- Ignored: `codecov/codecov-action`

**Update Strategy**:

- Daily automated PRs for dependency updates
- Separate PRs for each dependency
- Auto-merge if CI passes
- Human intervention only for breaking changes

**Exact Versions** (`.npmrc`):

```text
save-exact=true
```

All dependencies pinned to exact versions (no `^` or `~` ranges).

## Hidden Context

### Non-obvious Implementation Details

#### 1. **Why Serial Uninstallation?**

The tool uninstalls versions one-at-a-time rather than in parallel. This is intentional:

**Code Comment** (lines 175-178):

> "This removes installations in serial, mainly because it's more of a pain to display multiple progress bars."

**Trade-off Analysis**:

- **Pro**: Simple, single progress spinner (better UX)
- **Con**: Slower (but removal is already slow due to global packages)
- **Decision**: UX simplicity wins over performance

#### 2. **"Crap You Globally Installed"**

**Warning Message** (lines 125-127):

```javascript
console.error(
  'Warning: estimated duration is directly proportional to the amount of crap you globally installed',
);
```

**Context**: Each Node.js version maintains its own global npm package directory. When uninstalling, nvm must clean up all global packages for that version. The more global packages you've installed, the longer each uninstall takes.

**Why Not Parallelize?**: Even with parallel uninstalls, each would still be slow. Serial + simple spinner is better UX than complex multi-spinner.

#### 3. **The Shark Spinner**

**Code** (line 130):

```javascript
const spinner = ora({
  text: '...',
  spinner: 'shark', // 🦈
});
```

**Context**: Added in v0.2.3 specifically for personality. The shark emoji animation plays during removal operations, adding humor to an otherwise mundane task.

#### 4. **Version String Parsing**

**Code** (line 221):

```javascript
// note that parse() understands the `v` prefix
const version = parse(dir);
```

**Context**: NVM stores versions as `v14.15.0` (with `v` prefix), but semver.parse() handles this automatically. No need for manual string manipulation.

#### 5. **Broken Dependency Types**

**Known Type Issues**:

```javascript
// @ts-expect-error - types broken; see https://github.com/humanwhocodes/env/pull/78
const {Env} = require('@humanwhocodes/env');

/** @type {import('get-folder-size')} */
const {default: getFolderSize} = /** @type {any} */ (
  await import('get-folder-size')
); // jacked up types
```

**Context**: Two dependencies have incorrect TypeScript definitions. Rather than fix upstream or contribute PRs, the tool uses type suppression to move forward. This is pragmatic for a small tool but should be noted for future maintenance.

### Historical Decisions

#### 1. **JavaScript Over TypeScript**

**Decision**: Write in JavaScript with JSDoc instead of TypeScript source

**Reasoning**:

- Simpler runtime (no build step for execution)
- Faster development (no transpilation during dev)
- Still get type safety (TypeScript validates JSDoc)
- Publish types for consumers (best of both worlds)

**Implementation**: TypeScript compiler used ONLY for type checking and `.d.ts` generation

**Result**: 285-line JavaScript file that's easy to read, edit, and debug, with full IDE type support.

#### 2. **No Unit Tests**

**Decision**: Remove unit tests, use only smoke tests

**Evidence**: Git history shows test files were deleted, Mocha config removed

**Reasoning** (inferred):

- Simple codebase (285 lines, single file)
- Few edge cases (version parsing is well-tested by semver package)
- Most logic is I/O (file system, child process) which is better tested via integration
- Smoke tests validate the package actually works end-to-end

**Trade-off**: Faster development, less test maintenance, but lower confidence in edge case handling.

#### 3. **Zero Configuration Philosophy**

**Decision**: No CLI options, arguments, or configuration files

**README Quote**:

> "Accepts no options, arguments, flags, or anything else."

**Reasoning**:

- Opinionated tool with one clear purpose
- Keeps latest of each major version (no other strategy makes sense)
- Confirmation prompt provides safety
- Fewer decisions = simpler UX

**Result**: Tool does one thing well. No `--help`, no man page, no configuration bikeshedding.

#### 4. **No API Documentation**

**Decision**: Publish types but don't document the programmatic API

**README Quote**:

> "I don't feel like documenting it."

**Context**: The tool is designed for CLI usage (`npx nvmermind`). The exported functions exist for flexibility but aren't the primary interface.

**Pragmatic Approach**: TypeScript definitions serve as API documentation for those who need it.

### Code Evolution Patterns

**Core Logic Stability**: The main algorithm (`src/index.js`) has only been touched **9 times in 4.5 years**.

**What Changed**:

- v0.1.0: Initial implementation
- v0.2.x: Display output fixes, added shark spinner
- v1.0.0: Added file size calculation feature
- v1.0.1: Fixed type definitions path
- Minor: Dependency import patterns updated

**What Stayed the Same**:

- Partition algorithm (single-pass, descending sort)
- Serial uninstallation strategy
- Environment variable validation
- User confirmation workflow
- Error handling patterns

**Insight**: The core design was sound from the beginning. Minimal changes needed over 4+ years indicates good initial architecture.

### Technology Migrations

**Node.js Version Lifecycle**:

- v0.1.0: Node.js >= 12
- v0.2.0: Dropped v12 (EOL), required >= 14
- v1.0.0: Required >= 16.13.0
- v1.0.2: Required >= 20.19.0
- Current: Dropped v16/v18, now requires v20+

**Pattern**: Follows Node.js LTS lifecycle closely, dropping support when versions reach EOL.

**ESLint Evolution**:

- Started with eslint-config-semistandard
- Added Prettier integration
- Upgraded to ESLint v9 (2025)
- Migrated from eslint-plugin-node to eslint-plugin-n

**Release Automation**:

- Initially: standard-version (manual releases)
- Migrated: release-please (automated releases)
- Result: Zero-touch releases from conventional commits

## Performance Considerations

### Known Bottlenecks

#### 1. **Global Package Cleanup**

**Slowest Operation**: Uninstalling versions with many global packages

**Why**: Each version's `lib/node_modules` must be removed recursively

**Mitigation**: None implemented. Tool accepts slowness for safety (uses nvm's uninstall).

**User Warning**: "estimated duration is directly proportional to the amount of crap you globally installed"

#### 2. **Folder Size Calculation**

**Operation**: Calculate disk space used by each Node.js version

**Implementation**: Parallel folder size calculation using `Promise.all()`

```javascript
await Promise.all(
  dirs.map(async (dir) => {
    const size = await getFolderSize.loose(dirpath);
    return {version, dirpath, size};
  }),
);
```

**Performance**: Fast (runs in parallel for all versions)

**Trade-off**: Uses `getFolderSize.loose()` (faster but less accurate) instead of strict mode

### Optimization Guidelines

**Current Status**: No performance optimizations needed

**Rationale**:

- CLI tool used occasionally (not hot path)
- Dominated by I/O (file system, child process)
- User-facing delays are in nvm's uninstall (external, can't optimize)

**If Optimization Needed**:

1. Parallel uninstallation (requires complex multi-spinner UI)
2. Skip size calculation (user won't see space recovery estimate)
3. Use symlinks/hard links detection to avoid double-counting

**Recommendation**: Don't optimize. Tool is fast enough for its use case.

## Gotchas and Tips

### Common Pitfalls

#### 1. **NVM_DIR Not Found**

**Error**:

```text
Error: The NVM_DIR environment variable is not defined.
Are you sure you have NVM installed and configured?
```

**Cause**:

- NVM not installed
- NVM installed but not sourced in shell profile
- Running in environment where NVM isn't loaded

**Solution**:

```bash
# Check if NVM_DIR is set
echo $NVM_DIR

# Should output something like: /Users/username/.nvm

# If not set, add to ~/.bashrc or ~/.zshrc:
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
```

#### 2. **Modification During Execution**

**Pitfall**: Installing/uninstalling Node versions while nvmermind is running

**Why It Breaks**: Tool reads version list at startup, doesn't re-scan during execution

**Prevention**: Don't use nvm while nvmermind is running

#### 3. **Windows Compatibility**

**README Warning**:

> "Should work insofar as nvm works on Windows."

**Context**: nvm has limited Windows support. nvmermind inherits those limitations.

**Alternative**: Use nvm-windows (separate project) which may not be compatible

#### 4. **Global Package Removal**

**Behavior**: Uninstalling a Node.js version removes ALL global packages for that version

**Surprise Factor**: Users may forget they globally installed packages in older versions

**Mitigation**: Confirmation prompt shows exactly which versions will be removed

### Pro Tips

#### 1. **Run Periodically**

**Tip**: Add to monthly maintenance routine

**Command**:

```bash
# Every few months
npx nvmermind
```

**Why**: Node.js releases frequently. Old patch/minor versions accumulate over time.

#### 2. **Check Disk Space First**

**Tip**: See how much space you'll recover before running

**Preview**:

```bash
npx nvmermind
# Tool shows space estimate before confirmation
# Press 'n' if not worth it, 'y' to proceed
```

#### 3. **Use in CI/CD**

**Tip**: Clean up CI caches periodically

**Example** (GitHub Actions):

```yaml
- name: Clean old Node versions
  run: npx nvmermind --yes # Note: --yes doesn't exist (intentional)
  # Tool always prompts - run manually only
```

**Caveat**: Tool requires interactive prompt. Not suitable for automated CI/CD.

#### 4. **Debugging Type Issues**

**Tip**: Force type checking during development

**Command**:

```bash
npm run build  # Runs tsc -b, will show type errors
```

**Why**: Type errors only appear during build, not at runtime (JavaScript).

#### 5. **Testing Local Changes**

**Tip**: Test locally before publishing

**Commands**:

```bash
# Create test environment
mkdir -p /tmp/test-nvm/versions/node
cd /tmp/test-nvm/versions/node

# Create fake version directories
mkdir v14.15.0 v14.15.1 v14.16.0 v16.0.0 v16.1.0

# Run nvmermind against test directory
NVM_DIR=/tmp/test-nvm node ~/projects/nvmermind/src/index.js
```

### Platform-Specific Notes

**macOS/Linux**:

- Fully supported
- NVM typically installed in `~/.nvm`
- Bash/Zsh compatibility confirmed

**Windows**:

- Limited support (depends on nvm-windows compatibility)
- May require WSL (Windows Subsystem for Linux)
- Untested by maintainer

## Maintenance Tasks

### Regular Maintenance

**Renovate Bot (Automated)**:

- Runs daily
- Creates PRs for dependency updates
- Auto-merges if CI passes

**Human Intervention Needed**:

- Breaking changes in dependencies
- Node.js version support updates
- Major refactorings
- Security vulnerabilities (rare due to aggressive updating)

### Dependency Updates

**Automated Process** (98% of commits):

1. Renovate detects new version
2. Creates PR with updated package.json + package-lock.json
3. CI runs tests and linting
4. Auto-merges if passing

**Manual Process** (for breaking changes):

1. Review Renovate PR
2. Read changelog/migration guide
3. Update code if needed
4. Approve and merge PR

### Health Checks

**CI/CD Status**: All workflows should be passing

- Node CI: Tests + linting on Node 20, 22, 24
- Commitlint: PR commit messages validated
- Release: Automated releases working

**Dependency Health**: Check Renovate dashboard

- All dependencies should be up-to-date
- No pending security vulnerabilities

**Package Status**: Check npm

```bash
npm view nvmermind
# Should show latest published version matching package.json
```

## Contributing Guidelines

### Code Submission Process

**Workflow**:

1. Fork repository
2. Create feature branch
3. Make changes with conventional commits
4. Run `npm test` and `npm run lint`
5. Push and create pull request
6. CI validates tests, linting, commit messages
7. Maintainer reviews and merges

### Code Review Checklist

When submitting a PR, ensure:

- [ ] All tests pass (`npm test`)
- [ ] All linters pass (`npm run lint`)
- [ ] Commit messages follow conventional format
- [ ] TypeScript builds without errors (`npm run build`)
- [ ] No new dependencies added without justification
- [ ] Code follows existing patterns (camelCase, JSDoc, etc.)
- [ ] Changes are focused (one logical change per PR)

### Definition of Done

A feature/fix is complete when:

1. **Functionality**: Code works as intended
2. **Tests**: Smoke tests pass (or new tests added if needed)
3. **Linting**: ESLint, Prettier, Markdownlint pass
4. **Types**: TypeScript build succeeds, no new type errors
5. **Documentation**: README updated if user-facing changes
6. **Commits**: All commits follow conventional format
7. **CI**: GitHub Actions workflows pass on all Node versions

## Resources

### Internal Documentation

- **README.md**: User-facing documentation
- **CHANGELOG.md**: Auto-generated release history
- **JSDoc Comments**: Inline API documentation
- **TypeScript Definitions**: `types/src/index.d.ts`

### External Resources

- **NVM Documentation**: https://github.com/nvm-sh/nvm
- **Conventional Commits**: https://www.conventionalcommits.org/
- **Semantic Versioning**: https://semver.org/
- **midnight-smoker**: https://github.com/npm/midnight-smoker

### Code Ownership

**Primary Maintainer**: Christopher "boneskull" Hiller

**Git History Patterns**:

- 84% Renovate bot (automated dependency updates)
- 9% boneskull (feature development, bug fixes)
- 6% github-actions bot (automated releases)

**Expertise Areas** (from commit history):

- Core Logic: boneskull
- Dependencies: Renovate bot
- CI/CD: boneskull
- Releases: github-actions (automated)

### Acknowledgments

**Code Attribution**:

- Borrowed from Wes Todd's [nvmjs](https://github.com/wesleytodd/nvmjs)
- Maintainer notes: "I should probably send a PR" (hasn't happened yet)

**Funding**:

- GitHub Sponsors: boneskull

---

## Quick Reference Card

### Most Common Commands

```bash
# Run the tool
npx nvmermind

# Local development
npm install
npm test
npm run lint
npm run build

# Git workflow
git commit -m "feat: description"
git commit -m "fix(deps): description"
```

### Project Philosophy

- **Minimalist**: One file, zero config, no options
- **Opinionated**: Keep latest of each major, remove rest
- **Safe**: Use nvm's uninstall, confirm before removing
- **Humorous**: Personality in code and docs

### Key Files to Know

- `src/index.js`: All application logic (285 lines)
- `src/nvm.sh`: Bash wrapper for nvm commands
- `package.json`: Dependencies, scripts, metadata
- `types/src/index.d.ts`: TypeScript definitions (generated)

### When Things Break

1. **Check NVM_DIR**: `echo $NVM_DIR`
2. **Run tests**: `npm test`
3. **Check types**: `npm run build`
4. **Lint code**: `npm run lint`
5. **Check CI**: GitHub Actions workflows

---

_This AGENTS.md was generated via /essentials:init-ultrathink on 2025-11-11. Last updated for nvmermind v1.0.2._
