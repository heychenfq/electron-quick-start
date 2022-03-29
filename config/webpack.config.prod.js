const baseConfig = require('./webpack.config.base');
const { merge } = require('webpack-merge');

module.exports = merge(baseConfig, {
	mode: 'production',
	output: {
		publicPath: './',
		filename: '[name].[contenthash].js',
	},
	devtool: 'source-map',
});