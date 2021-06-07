# nvmermind

> Uninstall old versions of Node.js as installed by [nvm](https://github.com/nvm-sh/nvm)

If you have a stinking bonepile of old Node.js versions in your `~/.nvm` folder, this script helps remove them nicely.

## Install

You _could_ install this, but maybe better to...

## Usage

Run:

```bash
npx nvmermind
```

`nvmermind` will keep the **latest installed version of _each_ major** it finds, and prompt to remove all the others. So, if you have `14.16.1` and `14.17.0` installed, it will keep `14.17.0`.

As of

### API

There's an "API." You can `require('nvmermind')`, but I don't feel like documenting it. Maybe next week? There are some docstrings, which is better than nothing.

### Usage Notes

- Removal uses `nvm uninstall`, which does its thing safely (_read_: slowly).
- `nvmermind` accepts no options, arguments, flags, cards, cash or checks.

## Acknowledgments

- I stole some code from Wes Todd's [nvmjs](https://github.com/wesleytodd/nvmjs). I should probably send a PR.

## License

Copyright © 2021 Christopher Hiller. Licensed Apache-2.0
