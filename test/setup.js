const unexpected = require('unexpected');

global.sinon = require('sinon');

global.expect = unexpected.clone().use(require('unexpected-sinon'));
