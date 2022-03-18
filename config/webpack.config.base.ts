
import { Configuration } from 'webpack';
import path from 'path';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const baseConfig: Configuration = {
	entry: {
		main: './src/browser/index',
	},
	output: {
		path: path.resolve(__dirname, '../dist/browser'),
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
			template: 'src/browser/index.html'
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

export default baseConfig;
