const path = require('path');
const { register } = require('swc-register/dist/node');

register({
	configFile: path.resolve(__dirname, '../config/swcrc.electron.json'),
});

require('../src/main');