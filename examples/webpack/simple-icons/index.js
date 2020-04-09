"use strict"

const hljs = require('highlight.js');

// Include icon as module
const pythonIcon = require('simple-icons/icons/python');

document.addEventListener("DOMContentLoaded", function() {
  const buildIncludeIconAsModuleOutput = function() {
    const parser = new DOMParser();
    const pythonIconSvgDomElement = parser.parseFromString(
      pythonIcon.svg, "text/xml").documentElement;
    const pythonIconPath = pythonIconSvgDomElement.getElementsByTagName("path")[0];
    pythonIconPath.setAttribute("d", pythonIconPath.getAttribute("d").substring(0, 40) + "...")
    
    const output = {}
    for (let key in pythonIcon) {
      if (key == "path") {
        output[key] = pythonIcon[key].substring(0, 40) + "..."
      } else if (key == "svg") {
        output[key] = pythonIconSvgDomElement.outerHTML
      } else {
        output[key] = pythonIcon[key]
      }
    }
    const iconAsModuleOutputContainer = document.querySelector(
      "#icon-as-module > .exported.output code");
    
    const outputString = JSON.stringify(
      output, null, 2).replace(
      /[^\/]></g, '>" +\n     "<').replace(
      "/>", '/>" + \n   "');
    iconAsModuleOutputContainer.innerText = outputString;
  }
  
  const buildModuleAsIconToImage = function() {
    const domParser = new DOMParser()
    const svgElem = domParser.parseFromString(
      pythonIcon.svg, "text/xml").documentElement;
    svgElem.setAttribute("height", "30px");
    svgElem.setAttribute("width", "30px");
    svgElem.setAttribute("fill", "#" + pythonIcon.hex)
    const container = document.querySelector(
      "#icon-as-module .export-to-img.output");
    container.appendChild(svgElem);
    
  }

  // Module as icon example
  buildIncludeIconAsModuleOutput();
  
  // Module as icon to omage
  buildModuleAsIconToImage();
  
  document.querySelectorAll('pre code').forEach((block) => {
    hljs.highlightBlock(block);
    block.style.background = "rgba(255,255,255,0)"
  });
})
