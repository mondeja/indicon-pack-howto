"use strict"

import path from "path";

import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';

export default {
  input: 'index.js',
  output: {
    file: path.resolve(__dirname, "dist", "bundle.js"),
    format: 'iife',
    name: "bundle",
  },
  plugins: [
    resolve(),
    commonjs()
  ]
};
