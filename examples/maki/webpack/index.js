"use strict"

const hljs = require('highlight.js');

// Include icon as SVG
const cafeIcon = require('maki/icons/cafe-15.svg');

document.addEventListener("DOMContentLoaded", function() {
  const buildImportIconAsInlineSvgOutput = function() {
    var outputString = "'" + cafeIcon + "'";
    console.log(outputString)
    const container = document.querySelector(
      "#icon-as-svg .inspect.output code");
    container.innerText = outputString;
  }
  
  const buildModuleAsInlineSVGToDom = function() {
    const domParser = new DOMParser()
    const svgElem = domParser.parseFromString(
      cafeIcon, "text/xml").documentElement;
    svgElem.setAttribute("height", "30px");
    svgElem.setAttribute("width", "30px");
    const container = document.querySelector(
      "#icon-as-svg .render.output");
    container.appendChild(svgElem)
  }
  
  // Module as inline SVG inspection
  buildImportIconAsInlineSvgOutput();
  
  // Module as inline SVG to image
  buildModuleAsInlineSVGToDom();
  
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightBlock(block);
    block.style.background = "rgba(255,255,255,0)"
  });
});
