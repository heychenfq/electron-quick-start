import baseConfig from './webpack.config.preload';
import { merge } from 'webpack-merge';

export default merge(baseConfig, {
	mode: 'development',
});