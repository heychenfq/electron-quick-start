
const path = require('path');

const config = {
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
					loader: 'esbuild-loader',
					options: {
						target: 'es2018',
						loader: 'tsx',
						tsconfigRaw: require('../config/tsconfig.browser.json'),
					},
				}],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
}

module.exports = config;
