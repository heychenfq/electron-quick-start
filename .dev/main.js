const path = require('path');
const tsNode = require('ts-node');
tsNode.register({
	configFile: path.resolve(__dirname, '../config/tsconfig.electron.json'),
	transpileOnly: true,
});

require('../src/main');