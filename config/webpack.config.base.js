
const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const baseConfig = {
	entry: {
		preload: './src/preload',
		main: './src/browser/index',
	},
	target: 'electron-renderer',
	output: {
		path: path.resolve(__dirname, '../output/browser'),
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
						sourceMaps: true,
					},
				}],
      },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
	plugins: [
    new HtmlWebpackPlugin({
      title: 'Electron App',
			template: 'src/browser/index.html',
			
    }),
  ],
	optimization: {
		moduleIds: 'deterministic',
		runtimeChunk: 'single',
		splitChunks: {
			cacheGroups: {
				vendor: {
					test: /[\\/]node_modules[\\/]/,
					name: 'vendors',
					chunks: 'all',
				},
			},
		},
	},
};

module.exports = baseConfig;
