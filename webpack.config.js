const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    background: './src/background/index.ts',
    content: './src/content/index.ts',
    popup: './src/popup/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].js',
    clean: true
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: 'manifest.json' },
        { from: 'public', to: '.', noErrorOnMissing: true },
        { from: 'src/popup/popup.html', to: 'popup.html', noErrorOnMissing: true },
        { from: 'src/styles', to: '.', noErrorOnMissing: true }
      ]
    })
  ],
  optimization: {
    minimize: false // Easier debugging
  },
  devtool: false // Disable source maps to avoid CSP issues
};
