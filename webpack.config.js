const path = require('path')

module.exports = {
	entry: {
		app: path.resolve(__dirname, 'src/main.tsx'),
	},
	output: {
		path: path.resolve(__dirname, 'static'),
		filename: 'js/[name].js',
		publicPath: '/'
	},
	resolve: {
		extensions: ['.tsx','.ts', '.js'],
		fallback: {
			fs: false,
			path: false,
			crypto: false
		}
	},
	plugins: [
	],
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				exclude: /(node_modules|\.webpack)/,
				use: {
					loader: 'ts-loader',
					options: {
						transpileOnly: true,
					},
				},
			},
			{
				test: /\.css$/,
				use: [
					'style-loader',
					'css-loader'
				]
			}
		]
	},
	stats: {
		errorDetails: true
	},
	devtool : 'inline-source-map'
}
