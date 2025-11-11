const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';
  
  return {
    entry: './src/index.js',
    
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: isProduction ? '[name].[contenthash].js' : '[name].js',
      clean: true,
    },
    
    devServer: {
      static: {
        directory: path.join(__dirname, '.'),
      },
      compress: true,
      port: 9000,
      open: true,
      hot: true,
    },
    
    module: {
      rules: [
        {
          test: /\.css$/i,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : 'style-loader',
            'css-loader'
          ],
        },
        {
          test: /\.js$/,
          enforce: 'pre',
          use: ['source-map-loader'],
        },
        {
          test: /\.(png|svg|jpg|jpeg|gif)$/i,
          type: 'asset/resource',
        },
        {
          test: /\.(woff|woff2|eot|ttf|otf)$/i,
          type: 'asset/resource',
        }
      ]
    },
    
    plugins: [
      new HtmlWebpackPlugin({
        template: './admin.html',
        filename: 'index.html'
      }),
      
      new CopyWebpackPlugin({
        patterns: [
          // 移除CSS文件的复制，因为现在使用MiniCssExtractPlugin处理
          { from: 'css/codemirror.css', to: 'css/' },
          { from: 'css/codemirror-theme_xq-light.css', to: 'css/' },
        ],
      }),
      
      new MiniCssExtractPlugin({
        filename: 'css/[name].[contenthash].css',
      }),
    ],
    
    optimization: {
      minimize: isProduction
    }
  };
};