
import baseConfig from './webpack.config.base';
import { merge } from 'webpack-merge';

export default merge(baseConfig, {
	mode: 'development',
	output: {
		publicPath: '/',
		filename: '[name].js',
	},
	devtool: 'inline-source-map',
});