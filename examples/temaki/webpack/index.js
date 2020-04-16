"use strict"

var hljs = require("highlight.js/lib/highlight");
hljs.registerLanguage('json', require('highlight.js/lib/languages/json'));
hljs.registerLanguage('javascript', require('highlight.js/lib/languages/javascript'));

var beachIconSVG = require("temaki/icons/beach.svg");

document.addEventListener("DOMContentLoaded", function() {
  const buildImportIconAsInlineSvgOutput = function() {
    var outputString = "'" + beachIconSVG + "'";
    const container = document.querySelector(
      "#icon-as-svg .inspect.output code");
    container.innerText = outputString;
  }
  
  const buildModuleAsInlineSVGToDom = function() {
    const domParser = new DOMParser()
    const svgElem = domParser.parseFromString(
      beachIconSVG, "text/xml").documentElement;
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
