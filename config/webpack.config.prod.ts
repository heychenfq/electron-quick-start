import baseConfig from './webpack.config.base';
import { merge } from 'webpack-merge';

export default merge(baseConfig, {
	mode: 'production',
	output: {
		publicPath: './',
		filename: '[name].[contenthash].js',
	},
	devtool: 'source-map',
});