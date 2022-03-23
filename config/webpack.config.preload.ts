
import { Configuration } from 'webpack';
import path from 'path';

const config: Configuration = {
	mode: 'production',
	entry: './src/preload',
	target: 'electron-preload',
	output: {
		filename: 'preload.js',
		path: path.resolve(__dirname, '../output'),
	},
	module: {
    rules: [
			{
        test: /\.tsx?$/,
        exclude: /node_modules/,
				use: [{
					loader: 'swc-loader',
					options: {
						configFile: path.resolve(__dirname, 'swcrc.browser.json'),
					},
				}],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
}

export default config;
