# 😒 nvmermind

> Uninstall old versions of Node.js (as installed by [nvm](https://github.com/nvm-sh/nvm)) while keeping the latest of each major version.

If you have a stinking bonepile of old Node.js versions in your `~/.nvm` folder, this script _takes out the trash._

## Install

`nvmermind` requires Node.js v20.19.0 or newer.

You _could_ install this, but maybe better to...

## Usage

Run:

```bash
npx nvmermind
```

`nvmermind` will keep the **latest installed version of _each_ major** it finds.

> Example: if you have `v14.16.1` and `v14.17.0` installed, it will remove `v14.16.1` and keep `v14.17.0`.

`nvmermind` will show you:

- what would be removed
- what will be kept
- how much disk space you'll recover

`nvmermind` will confirm with you (a human) before blasting anything away.

### API

There's an "API", sure. You can `require('nvmermind')`, but I don't feel like documenting it. ~~Maybe next week? There are some docstrings, which is better than nothing.~~

**New in v1.0.0:** There are types now; look at those if you want. I'm still not gonna document it.

### Usage Notes

- Removal uses `nvm uninstall`, which does its thing safely and methodically (_read_: slowly).
- `nvmermind` accepts no options, arguments, flags, or anything else. There is no man page and no `--help`.
- This should work on Windows [insofar as `nvm` works on Windows](https://github.com/nvm-sh/nvm#important-notes).

## Acknowledgments

- I stole some code from Wes Todd's [nvmjs](https://github.com/wesleytodd/nvmjs). I should probably send a PR.

## License

Copyright © 2021 Christopher "[boneskull](https://github.com/boneskull)" Hiller. Licensed Apache-2.0
