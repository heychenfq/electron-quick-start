const path = require('path');
require('ts-node').register({
	project: path.resolve(__dirname, '../config/tsconfig.electron.json'),
	transpileOnly: true,
	swc: true,
});

require('../src/main');