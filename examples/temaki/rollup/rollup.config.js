"use strict"

import path from "path";

import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import svg from 'rollup-plugin-svg'

export default {
  input: 'index.js',
  output: {
    file: path.resolve(__dirname, "dist", "bundle.js"),
    format: 'iife',
    name: "bundle",
  },
  plugins: [
    resolve(),
    commonjs(),
    svg(),
  ]
};
