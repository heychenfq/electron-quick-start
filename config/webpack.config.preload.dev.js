const baseConfig = require('./webpack.config.preload');
const { merge } = require('webpack-merge');

module.exports = merge(baseConfig, {
	mode: 'development',
	devtool: 'inline-source-map',
});