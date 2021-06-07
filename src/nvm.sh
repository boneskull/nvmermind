#! /usr/bin/env bash

# This thing executes nvm via a bash shell, so Node.js can execute it

[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm $@
