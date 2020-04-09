"use strict"

const hljs = require('highlight.js');

// Include icon as module
const pythonIcon = require('simple-icons/icons/python');

// Include icon as SVG
const pythonIconSVG = require('simple-icons/icons/python.svg');

document.addEventListener("DOMContentLoaded", function() {
  const buildImportIconAsInlineSvgOutput = function() {
    var outputString = "'" + pythonIconSVG + "'";
    console.log(outputString)
    const container = document.querySelector(
      "#icon-as-svg .inspect.output code");
    container.innerText = outputString;
  }
  
  const buildModuleAsInlineSVGToDom = function() {
    const domParser = new DOMParser()
    const svgElem = domParser.parseFromString(
      pythonIconSVG, "text/xml").documentElement;
    svgElem.setAttribute("height", "30px");
    svgElem.setAttribute("width", "30px");
    const container = document.querySelector(
      "#icon-as-svg .render.output");
    container.appendChild(svgElem)
  }
  
  const buildImportIconAsModuleOutput = function() {
    const iconAsModuleOutputContainer = document.querySelector(
      "#icon-as-module > .inspect.output code");
    
    const outputString = JSON.stringify(pythonIcon, null, 2)
    iconAsModuleOutputContainer.innerText = outputString;
  }
  
  const buildImportIconAsModuleToDom = function() {
    const domParser = new DOMParser()
    const svgElem = domParser.parseFromString(
      pythonIcon.svg, "text/xml").documentElement;
    svgElem.setAttribute("height", "30px");
    svgElem.setAttribute("width", "30px");
    svgElem.setAttribute("fill", "#" + pythonIcon.hex)
    const container = document.querySelector(
      "#icon-as-module .render.output");
    container.appendChild(svgElem);  
  }
  
  // Module as inline SVG inspection
  buildImportIconAsInlineSvgOutput();
  
  // Module as inline SVG to image
  buildModuleAsInlineSVGToDom();

  // Module as icon inspection
  buildImportIconAsModuleOutput();
  
  // Module as icon to image
  buildImportIconAsModuleToDom();
  
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightBlock(block);
    block.style.background = "rgba(255,255,255,0)"
  });
});
