//
// uglifyjsplugin still has issues with es6 code. 12/11/2017

const path = require('path');

//
//const UglifyJsPlugin = require("uglifyjs-webpack-plugin");
const MinifyPlugin = require("babel-minify-webpack-plugin");
const ExtractTextPlugin = require('extract-text-webpack-plugin');

const config = {
  mode: 'production',
  entry: {
    wings3d: ["./html/wings3d.bundle.js", './html/styles.css']
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js', // The filename template
  },
  devtool: false,
  module: {
    rules: [
      //{ test: /\.js$/,
      //  include: path.resolve(__dirname, 'js'),
      //},
      //{ test: /\.txt$/, use: 'raw-loader' },
      { test: /\.(png|jpg)$/, loader: 'url-loader'},
      { test: /\.css$/, 
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [{loader:'css-loader'}]
        })
      },
    ]
  },
  plugins: [
    //new UglifyJsPlugin(),
    //new MinifyPlugin(),
    new ExtractTextPlugin("styles.css"),
  ]
};

module.exports = config;

