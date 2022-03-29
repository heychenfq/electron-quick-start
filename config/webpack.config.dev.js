
const baseConfig = require('./webpack.config.base');
const { merge } = require('webpack-merge');

module.exports = merge(baseConfig, {
	mode: 'development',
	output: {
		publicPath: '/',
		filename: '[name].js',
	},
	devtool: 'inline-source-map',
});