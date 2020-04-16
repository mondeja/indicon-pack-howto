(function () {
	'use strict';

	function createCommonjsModule(fn, module) {
		return module = { exports: {} }, fn(module, module.exports), module.exports;
	}

	function getCjsExportFromNamespace (n) {
		return n && n['default'] || n;
	}

	var highlight = createCommonjsModule(function (module, exports) {
	/*
	Syntax highlighting with language autodetection.
	https://highlightjs.org/
	*/

	(function(factory) {

	  // Find the global object for export to both the browser and web workers.
	  var globalObject = typeof window === 'object' && window ||
	                     typeof self === 'object' && self;

	  // Setup highlight.js for different environments. First is Node.js or
	  // CommonJS.
	  // `nodeType` is checked to ensure that `exports` is not a HTML element.
	  if( !exports.nodeType) {
	    factory(exports);
	  } else if(globalObject) {
	    // Export hljs globally even when using AMD for cases when this script
	    // is loaded with others that may still expect a global hljs.
	    globalObject.hljs = factory({});
	  }

	}(function(hljs) {
	  // Convenience variables for build-in objects
	  var ArrayProto = [],
	      objectKeys = Object.keys;

	  // Global internal variables used within the highlight.js library.
	  var languages = {},
	      aliases   = {};

	  // safe/production mode - swallows more errors, tries to keep running
	  // even if a single syntax or parse hits a fatal error
	  var SAFE_MODE = true;

	  // Regular expressions used throughout the highlight.js library.
	  var noHighlightRe    = /^(no-?highlight|plain|text)$/i,
	      languagePrefixRe = /\blang(?:uage)?-([\w-]+)\b/i,
	      fixMarkupRe      = /((^(<[^>]+>|\t|)+|(?:\n)))/gm;

	  var spanEndTag = '</span>';
	  var LANGUAGE_NOT_FOUND = "Could not find the language '{}', did you forget to load/include a language module?";

	  // Global options used when within external APIs. This is modified when
	  // calling the `hljs.configure` function.
	  var options = {
	    classPrefix: 'hljs-',
	    tabReplace: null,
	    useBR: false,
	    languages: undefined
	  };

	  // keywords that should have no default relevance value
	  var COMMON_KEYWORDS = 'of and for in not or if then'.split(' ');


	  /* Utility functions */

	  function escape(value) {
	    return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	  }

	  function tag(node) {
	    return node.nodeName.toLowerCase();
	  }

	  function testRe(re, lexeme) {
	    var match = re && re.exec(lexeme);
	    return match && match.index === 0;
	  }

	  function isNotHighlighted(language) {
	    return noHighlightRe.test(language);
	  }

	  function blockLanguage(block) {
	    var i, match, length, _class;
	    var classes = block.className + ' ';

	    classes += block.parentNode ? block.parentNode.className : '';

	    // language-* takes precedence over non-prefixed class names.
	    match = languagePrefixRe.exec(classes);
	    if (match) {
	      var language = getLanguage(match[1]);
	      if (!language) {
	        console.warn(LANGUAGE_NOT_FOUND.replace("{}", match[1]));
	        console.warn("Falling back to no-highlight mode for this block.", block);
	      }
	      return language ? match[1] : 'no-highlight';
	    }

	    classes = classes.split(/\s+/);

	    for (i = 0, length = classes.length; i < length; i++) {
	      _class = classes[i];

	      if (isNotHighlighted(_class) || getLanguage(_class)) {
	        return _class;
	      }
	    }
	  }

	  /**
	   * performs a shallow merge of multiple objects into one
	   *
	   * @arguments list of objects with properties to merge
	   * @returns a single new object
	   */
	  function inherit(parent) {  // inherit(parent, override_obj, override_obj, ...)
	    var key;
	    var result = {};
	    var objects = Array.prototype.slice.call(arguments, 1);

	    for (key in parent)
	      result[key] = parent[key];
	    objects.forEach(function(obj) {
	      for (key in obj)
	        result[key] = obj[key];
	    });
	    return result;
	  }

	  /* Stream merging */

	  function nodeStream(node) {
	    var result = [];
	    (function _nodeStream(node, offset) {
	      for (var child = node.firstChild; child; child = child.nextSibling) {
	        if (child.nodeType === 3)
	          offset += child.nodeValue.length;
	        else if (child.nodeType === 1) {
	          result.push({
	            event: 'start',
	            offset: offset,
	            node: child
	          });
	          offset = _nodeStream(child, offset);
	          // Prevent void elements from having an end tag that would actually
	          // double them in the output. There are more void elements in HTML
	          // but we list only those realistically expected in code display.
	          if (!tag(child).match(/br|hr|img|input/)) {
	            result.push({
	              event: 'stop',
	              offset: offset,
	              node: child
	            });
	          }
	        }
	      }
	      return offset;
	    })(node, 0);
	    return result;
	  }

	  function mergeStreams(original, highlighted, value) {
	    var processed = 0;
	    var result = '';
	    var nodeStack = [];

	    function selectStream() {
	      if (!original.length || !highlighted.length) {
	        return original.length ? original : highlighted;
	      }
	      if (original[0].offset !== highlighted[0].offset) {
	        return (original[0].offset < highlighted[0].offset) ? original : highlighted;
	      }

	      /*
	      To avoid starting the stream just before it should stop the order is
	      ensured that original always starts first and closes last:

	      if (event1 == 'start' && event2 == 'start')
	        return original;
	      if (event1 == 'start' && event2 == 'stop')
	        return highlighted;
	      if (event1 == 'stop' && event2 == 'start')
	        return original;
	      if (event1 == 'stop' && event2 == 'stop')
	        return highlighted;

	      ... which is collapsed to:
	      */
	      return highlighted[0].event === 'start' ? original : highlighted;
	    }

	    function open(node) {
	      function attr_str(a) {
	        return ' ' + a.nodeName + '="' + escape(a.value).replace(/"/g, '&quot;') + '"';
	      }
	      result += '<' + tag(node) + ArrayProto.map.call(node.attributes, attr_str).join('') + '>';
	    }

	    function close(node) {
	      result += '</' + tag(node) + '>';
	    }

	    function render(event) {
	      (event.event === 'start' ? open : close)(event.node);
	    }

	    while (original.length || highlighted.length) {
	      var stream = selectStream();
	      result += escape(value.substring(processed, stream[0].offset));
	      processed = stream[0].offset;
	      if (stream === original) {
	        /*
	        On any opening or closing tag of the original markup we first close
	        the entire highlighted node stack, then render the original tag along
	        with all the following original tags at the same offset and then
	        reopen all the tags on the highlighted stack.
	        */
	        nodeStack.reverse().forEach(close);
	        do {
	          render(stream.splice(0, 1)[0]);
	          stream = selectStream();
	        } while (stream === original && stream.length && stream[0].offset === processed);
	        nodeStack.reverse().forEach(open);
	      } else {
	        if (stream[0].event === 'start') {
	          nodeStack.push(stream[0].node);
	        } else {
	          nodeStack.pop();
	        }
	        render(stream.splice(0, 1)[0]);
	      }
	    }
	    return result + escape(value.substr(processed));
	  }

	  /* Initialization */

	  function dependencyOnParent(mode) {
	    if (!mode) return false;

	    return mode.endsWithParent || dependencyOnParent(mode.starts);
	  }

	  function expand_or_clone_mode(mode) {
	    if (mode.variants && !mode.cached_variants) {
	      mode.cached_variants = mode.variants.map(function(variant) {
	        return inherit(mode, {variants: null}, variant);
	      });
	    }

	    // EXPAND
	    // if we have variants then essentially "replace" the mode with the variants
	    // this happens in compileMode, where this function is called from
	    if (mode.cached_variants)
	      return mode.cached_variants;

	    // CLONE
	    // if we have dependencies on parents then we need a unique
	    // instance of ourselves, so we can be reused with many
	    // different parents without issue
	    if (dependencyOnParent(mode))
	      return [inherit(mode, { starts: mode.starts ? inherit(mode.starts) : null })];

	    if (Object.isFrozen(mode))
	      return [inherit(mode)];

	    // no special dependency issues, just return ourselves
	    return [mode];
	  }

	  function compileKeywords(rawKeywords, case_insensitive) {
	      var compiled_keywords = {};

	      if (typeof rawKeywords === 'string') { // string
	        splitAndCompile('keyword', rawKeywords);
	      } else {
	        objectKeys(rawKeywords).forEach(function (className) {
	          splitAndCompile(className, rawKeywords[className]);
	        });
	      }
	    return compiled_keywords;

	    // ---

	    function splitAndCompile(className, str) {
	      if (case_insensitive) {
	        str = str.toLowerCase();
	      }
	      str.split(' ').forEach(function(keyword) {
	        var pair = keyword.split('|');
	        compiled_keywords[pair[0]] = [className, scoreForKeyword(pair[0], pair[1])];
	      });
	    }
	  }

	  function scoreForKeyword(keyword, providedScore) {
	    // manual scores always win over common keywords
	    // so you can force a score of 1 if you really insist
	    if (providedScore)
	      return Number(providedScore);

	    return commonKeyword(keyword) ? 0 : 1;
	  }

	  function commonKeyword(word) {
	    return COMMON_KEYWORDS.indexOf(word.toLowerCase()) != -1;
	  }

	  function compileLanguage(language) {

	    function reStr(re) {
	        return (re && re.source) || re;
	    }

	    function langRe(value, global) {
	      return new RegExp(
	        reStr(value),
	        'm' + (language.case_insensitive ? 'i' : '') + (global ? 'g' : '')
	      );
	    }

	    function reCountMatchGroups(re) {
	      return (new RegExp(re.toString() + '|')).exec('').length - 1;
	    }

	    // joinRe logically computes regexps.join(separator), but fixes the
	    // backreferences so they continue to match.
	    // it also places each individual regular expression into it's own
	    // match group, keeping track of the sequencing of those match groups
	    // is currently an exercise for the caller. :-)
	    function joinRe(regexps, separator) {
	      // backreferenceRe matches an open parenthesis or backreference. To avoid
	      // an incorrect parse, it additionally matches the following:
	      // - [...] elements, where the meaning of parentheses and escapes change
	      // - other escape sequences, so we do not misparse escape sequences as
	      //   interesting elements
	      // - non-matching or lookahead parentheses, which do not capture. These
	      //   follow the '(' with a '?'.
	      var backreferenceRe = /\[(?:[^\\\]]|\\.)*\]|\(\??|\\([1-9][0-9]*)|\\./;
	      var numCaptures = 0;
	      var ret = '';
	      for (var i = 0; i < regexps.length; i++) {
	        numCaptures += 1;
	        var offset = numCaptures;
	        var re = reStr(regexps[i]);
	        if (i > 0) {
	          ret += separator;
	        }
	        ret += "(";
	        while (re.length > 0) {
	          var match = backreferenceRe.exec(re);
	          if (match == null) {
	            ret += re;
	            break;
	          }
	          ret += re.substring(0, match.index);
	          re = re.substring(match.index + match[0].length);
	          if (match[0][0] == '\\' && match[1]) {
	            // Adjust the backreference.
	            ret += '\\' + String(Number(match[1]) + offset);
	          } else {
	            ret += match[0];
	            if (match[0] == '(') {
	              numCaptures++;
	            }
	          }
	        }
	        ret += ")";
	      }
	      return ret;
	    }

	    function buildModeRegex(mode) {

	      var matchIndexes = {};
	      var matcherRe;
	      var regexes = [];
	      var matcher = {};
	      var matchAt = 1;

	      function addRule(rule, regex) {
	        matchIndexes[matchAt] = rule;
	        regexes.push([rule, regex]);
	        matchAt += reCountMatchGroups(regex) + 1;
	      }

	      var term;
	      for (var i=0; i < mode.contains.length; i++) {
	        var re;
	        term = mode.contains[i];
	        if (term.beginKeywords) {
	          re = '\\.?(?:' + term.begin + ')\\.?';
	        } else {
	          re = term.begin;
	        }
	        addRule(term, re);
	      }
	      if (mode.terminator_end)
	        addRule("end", mode.terminator_end);
	      if (mode.illegal)
	        addRule("illegal", mode.illegal);

	      var terminators = regexes.map(function(el) { return el[1]; });
	      matcherRe = langRe(joinRe(terminators, '|'), true);

	      matcher.lastIndex = 0;
	      matcher.exec = function(s) {
	        var rule;

	        if( regexes.length === 0) return null;

	        matcherRe.lastIndex = matcher.lastIndex;
	        var match = matcherRe.exec(s);
	        if (!match) { return null; }

	        for(var i = 0; i<match.length; i++) {
	          if (match[i] != undefined && matchIndexes["" +i] != undefined ) {
	            rule = matchIndexes[""+i];
	            break;
	          }
	        }

	        // illegal or end match
	        if (typeof rule === "string") {
	          match.type = rule;
	          match.extra = [mode.illegal, mode.terminator_end];
	        } else {
	          match.type = "begin";
	          match.rule = rule;
	        }
	        return match;
	      };

	      return matcher;
	    }

	    function compileMode(mode, parent) {
	      if (mode.compiled)
	        return;
	      mode.compiled = true;

	      mode.keywords = mode.keywords || mode.beginKeywords;
	      if (mode.keywords)
	        mode.keywords = compileKeywords(mode.keywords, language.case_insensitive);

	      mode.lexemesRe = langRe(mode.lexemes || /\w+/, true);

	      if (parent) {
	        if (mode.beginKeywords) {
	          mode.begin = '\\b(' + mode.beginKeywords.split(' ').join('|') + ')\\b';
	        }
	        if (!mode.begin)
	          mode.begin = /\B|\b/;
	        mode.beginRe = langRe(mode.begin);
	        if (mode.endSameAsBegin)
	          mode.end = mode.begin;
	        if (!mode.end && !mode.endsWithParent)
	          mode.end = /\B|\b/;
	        if (mode.end)
	          mode.endRe = langRe(mode.end);
	        mode.terminator_end = reStr(mode.end) || '';
	        if (mode.endsWithParent && parent.terminator_end)
	          mode.terminator_end += (mode.end ? '|' : '') + parent.terminator_end;
	      }
	      if (mode.illegal)
	        mode.illegalRe = langRe(mode.illegal);
	      if (mode.relevance == null)
	        mode.relevance = 1;
	      if (!mode.contains) {
	        mode.contains = [];
	      }
	      mode.contains = Array.prototype.concat.apply([], mode.contains.map(function(c) {
	        return expand_or_clone_mode(c === 'self' ? mode : c);
	      }));
	      mode.contains.forEach(function(c) {compileMode(c, mode);});

	      if (mode.starts) {
	        compileMode(mode.starts, parent);
	      }

	      mode.terminators = buildModeRegex(mode);
	    }

	    // self is not valid at the top-level
	    if (language.contains && language.contains.indexOf('self') != -1) {
	      if (!SAFE_MODE) {
	        throw new Error("ERR: contains `self` is not supported at the top-level of a language.  See documentation.")
	      } else {
	        // silently remove the broken rule (effectively ignoring it), this has historically
	        // been the behavior in the past, so this removal preserves compatibility with broken
	        // grammars when running in Safe Mode
	        language.contains = language.contains.filter(function(mode) { return mode != 'self'; });
	      }
	    }
	    compileMode(language);
	  }


	  /**
	   * Core highlighting function.
	   *
	   * @param {string} languageName - the language to use for highlighting
	   * @param {string} code - the code to highlight
	   * @param {boolean} ignore_illegals - whether to ignore illegal matches, default is to bail
	   * @param {array<mode>} continuation - array of continuation modes
	   *
	   * @returns an object that represents the result
	   * @property {string} language - the language name
	   * @property {number} relevance - the relevance score
	   * @property {string} value - the highlighted HTML code
	   * @property {mode} top - top of the current mode stack
	   * @property {boolean} illegal - indicates whether any illegal matches were found
	  */
	  function highlight(languageName, code, ignore_illegals, continuation) {
	    var codeToHighlight = code;

	    function escapeRe(value) {
	      return new RegExp(value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'm');
	    }

	    function endOfMode(mode, lexeme) {
	      if (testRe(mode.endRe, lexeme)) {
	        while (mode.endsParent && mode.parent) {
	          mode = mode.parent;
	        }
	        return mode;
	      }
	      if (mode.endsWithParent) {
	        return endOfMode(mode.parent, lexeme);
	      }
	    }

	    function keywordMatch(mode, match) {
	      var match_str = language.case_insensitive ? match[0].toLowerCase() : match[0];
	      return mode.keywords.hasOwnProperty(match_str) && mode.keywords[match_str];
	    }

	    function buildSpan(className, insideSpan, leaveOpen, noPrefix) {
	      if (!leaveOpen && insideSpan === '') return '';
	      if (!className) return insideSpan;

	      var classPrefix = noPrefix ? '' : options.classPrefix,
	          openSpan    = '<span class="' + classPrefix,
	          closeSpan   = leaveOpen ? '' : spanEndTag;

	      openSpan += className + '">';

	      return openSpan + insideSpan + closeSpan;
	    }

	    function processKeywords() {
	      var keyword_match, last_index, match, result;

	      if (!top.keywords)
	        return escape(mode_buffer);

	      result = '';
	      last_index = 0;
	      top.lexemesRe.lastIndex = 0;
	      match = top.lexemesRe.exec(mode_buffer);

	      while (match) {
	        result += escape(mode_buffer.substring(last_index, match.index));
	        keyword_match = keywordMatch(top, match);
	        if (keyword_match) {
	          relevance += keyword_match[1];
	          result += buildSpan(keyword_match[0], escape(match[0]));
	        } else {
	          result += escape(match[0]);
	        }
	        last_index = top.lexemesRe.lastIndex;
	        match = top.lexemesRe.exec(mode_buffer);
	      }
	      return result + escape(mode_buffer.substr(last_index));
	    }

	    function processSubLanguage() {
	      var explicit = typeof top.subLanguage === 'string';
	      if (explicit && !languages[top.subLanguage]) {
	        return escape(mode_buffer);
	      }

	      var result = explicit ?
	                   highlight(top.subLanguage, mode_buffer, true, continuations[top.subLanguage]) :
	                   highlightAuto(mode_buffer, top.subLanguage.length ? top.subLanguage : undefined);

	      // Counting embedded language score towards the host language may be disabled
	      // with zeroing the containing mode relevance. Use case in point is Markdown that
	      // allows XML everywhere and makes every XML snippet to have a much larger Markdown
	      // score.
	      if (top.relevance > 0) {
	        relevance += result.relevance;
	      }
	      if (explicit) {
	        continuations[top.subLanguage] = result.top;
	      }
	      return buildSpan(result.language, result.value, false, true);
	    }

	    function processBuffer() {
	      result += (top.subLanguage != null ? processSubLanguage() : processKeywords());
	      mode_buffer = '';
	    }

	    function startNewMode(mode) {
	      result += mode.className? buildSpan(mode.className, '', true): '';
	      top = Object.create(mode, {parent: {value: top}});
	    }


	    function doBeginMatch(match) {
	      var lexeme = match[0];
	      var new_mode = match.rule;

	      if (new_mode && new_mode.endSameAsBegin) {
	        new_mode.endRe = escapeRe( lexeme );
	      }

	      if (new_mode.skip) {
	        mode_buffer += lexeme;
	      } else {
	        if (new_mode.excludeBegin) {
	          mode_buffer += lexeme;
	        }
	        processBuffer();
	        if (!new_mode.returnBegin && !new_mode.excludeBegin) {
	          mode_buffer = lexeme;
	        }
	      }
	      startNewMode(new_mode);
	      return new_mode.returnBegin ? 0 : lexeme.length;
	    }

	    function doEndMatch(match) {
	      var lexeme = match[0];
	      var matchPlusRemainder = codeToHighlight.substr(match.index);
	      var end_mode = endOfMode(top, matchPlusRemainder);
	      if (!end_mode) { return; }

	      var origin = top;
	      if (origin.skip) {
	        mode_buffer += lexeme;
	      } else {
	        if (!(origin.returnEnd || origin.excludeEnd)) {
	          mode_buffer += lexeme;
	        }
	        processBuffer();
	        if (origin.excludeEnd) {
	          mode_buffer = lexeme;
	        }
	      }
	      do {
	        if (top.className) {
	          result += spanEndTag;
	        }
	        if (!top.skip && !top.subLanguage) {
	          relevance += top.relevance;
	        }
	        top = top.parent;
	      } while (top !== end_mode.parent);
	      if (end_mode.starts) {
	        if (end_mode.endSameAsBegin) {
	          end_mode.starts.endRe = end_mode.endRe;
	        }
	        startNewMode(end_mode.starts);
	      }
	      return origin.returnEnd ? 0 : lexeme.length;
	    }

	    var lastMatch = {};
	    function processLexeme(text_before_match, match) {

	      var lexeme = match && match[0];

	      // add non-matched text to the current mode buffer
	      mode_buffer += text_before_match;

	      if (lexeme == null) {
	        processBuffer();
	        return 0;
	      }

	      // we've found a 0 width match and we're stuck, so we need to advance
	      // this happens when we have badly behaved rules that have optional matchers to the degree that
	      // sometimes they can end up matching nothing at all
	      // Ref: https://github.com/highlightjs/highlight.js/issues/2140
	      if (lastMatch.type=="begin" && match.type=="end" && lastMatch.index == match.index && lexeme === "") {
	        // spit the "skipped" character that our regex choked on back into the output sequence
	        mode_buffer += codeToHighlight.slice(match.index, match.index + 1);
	        return 1;
	      }
	      lastMatch = match;

	      if (match.type==="begin") {
	        return doBeginMatch(match);
	      } else if (match.type==="illegal" && !ignore_illegals) {
	        // illegal match, we do not continue processing
	        throw new Error('Illegal lexeme "' + lexeme + '" for mode "' + (top.className || '<unnamed>') + '"');
	      } else if (match.type==="end") {
	        var processed = doEndMatch(match);
	        if (processed != undefined)
	          return processed;
	      }

	      /*
	      Why might be find ourselves here?  Only one occasion now.  An end match that was
	      triggered but could not be completed.  When might this happen?  When an `endSameasBegin`
	      rule sets the end rule to a specific match.  Since the overall mode termination rule that's
	      being used to scan the text isn't recompiled that means that any match that LOOKS like
	      the end (but is not, because it is not an exact match to the beginning) will
	      end up here.  A definite end match, but when `doEndMatch` tries to "reapply"
	      the end rule and fails to match, we wind up here, and just silently ignore the end.

	      This causes no real harm other than stopping a few times too many.
	      */

	      mode_buffer += lexeme;
	      return lexeme.length;
	    }

	    var language = getLanguage(languageName);
	    if (!language) {
	      console.error(LANGUAGE_NOT_FOUND.replace("{}", languageName));
	      throw new Error('Unknown language: "' + languageName + '"');
	    }

	    compileLanguage(language);
	    var top = continuation || language;
	    var continuations = {}; // keep continuations for sub-languages
	    var result = '', current;
	    for(current = top; current !== language; current = current.parent) {
	      if (current.className) {
	        result = buildSpan(current.className, '', true) + result;
	      }
	    }
	    var mode_buffer = '';
	    var relevance = 0;
	    try {
	      var match, count, index = 0;
	      while (true) {
	        top.terminators.lastIndex = index;
	        match = top.terminators.exec(codeToHighlight);
	        if (!match)
	          break;
	        count = processLexeme(codeToHighlight.substring(index, match.index), match);
	        index = match.index + count;
	      }
	      processLexeme(codeToHighlight.substr(index));
	      for(current = top; current.parent; current = current.parent) { // close dangling modes
	        if (current.className) {
	          result += spanEndTag;
	        }
	      }
	      return {
	        relevance: relevance,
	        value: result,
	        illegal:false,
	        language: languageName,
	        top: top
	      };
	    } catch (err) {
	      if (err.message && err.message.indexOf('Illegal') !== -1) {
	        return {
	          illegal: true,
	          relevance: 0,
	          value: escape(codeToHighlight)
	        };
	      } else if (SAFE_MODE) {
	        return {
	          relevance: 0,
	          value: escape(codeToHighlight),
	          language: languageName,
	          top: top,
	          errorRaised: err
	        };
	      } else {
	        throw err;
	      }
	    }
	  }

	  /*
	  Highlighting with language detection. Accepts a string with the code to
	  highlight. Returns an object with the following properties:

	  - language (detected language)
	  - relevance (int)
	  - value (an HTML string with highlighting markup)
	  - second_best (object with the same structure for second-best heuristically
	    detected language, may be absent)

	  */
	  function highlightAuto(code, languageSubset) {
	    languageSubset = languageSubset || options.languages || objectKeys(languages);
	    var result = {
	      relevance: 0,
	      value: escape(code)
	    };
	    var second_best = result;
	    languageSubset.filter(getLanguage).filter(autoDetection).forEach(function(name) {
	      var current = highlight(name, code, false);
	      current.language = name;
	      if (current.relevance > second_best.relevance) {
	        second_best = current;
	      }
	      if (current.relevance > result.relevance) {
	        second_best = result;
	        result = current;
	      }
	    });
	    if (second_best.language) {
	      result.second_best = second_best;
	    }
	    return result;
	  }

	  /*
	  Post-processing of the highlighted markup:

	  - replace TABs with something more useful
	  - replace real line-breaks with '<br>' for non-pre containers

	  */
	  function fixMarkup(value) {
	    if (!(options.tabReplace || options.useBR)) {
	      return value;
	    }

	    return value.replace(fixMarkupRe, function(match, p1) {
	        if (options.useBR && match === '\n') {
	          return '<br>';
	        } else if (options.tabReplace) {
	          return p1.replace(/\t/g, options.tabReplace);
	        }
	        return '';
	    });
	  }

	  function buildClassName(prevClassName, currentLang, resultLang) {
	    var language = currentLang ? aliases[currentLang] : resultLang,
	        result   = [prevClassName.trim()];

	    if (!prevClassName.match(/\bhljs\b/)) {
	      result.push('hljs');
	    }

	    if (prevClassName.indexOf(language) === -1) {
	      result.push(language);
	    }

	    return result.join(' ').trim();
	  }

	  /*
	  Applies highlighting to a DOM node containing code. Accepts a DOM node and
	  two optional parameters for fixMarkup.
	  */
	  function highlightBlock(block) {
	    var node, originalStream, result, resultNode, text;
	    var language = blockLanguage(block);

	    if (isNotHighlighted(language))
	        return;

	    if (options.useBR) {
	      node = document.createElement('div');
	      node.innerHTML = block.innerHTML.replace(/\n/g, '').replace(/<br[ \/]*>/g, '\n');
	    } else {
	      node = block;
	    }
	    text = node.textContent;
	    result = language ? highlight(language, text, true) : highlightAuto(text);

	    originalStream = nodeStream(node);
	    if (originalStream.length) {
	      resultNode = document.createElement('div');
	      resultNode.innerHTML = result.value;
	      result.value = mergeStreams(originalStream, nodeStream(resultNode), text);
	    }
	    result.value = fixMarkup(result.value);

	    block.innerHTML = result.value;
	    block.className = buildClassName(block.className, language, result.language);
	    block.result = {
	      language: result.language,
	      re: result.relevance
	    };
	    if (result.second_best) {
	      block.second_best = {
	        language: result.second_best.language,
	        re: result.second_best.relevance
	      };
	    }
	  }

	  /*
	  Updates highlight.js global options with values passed in the form of an object.
	  */
	  function configure(user_options) {
	    options = inherit(options, user_options);
	  }

	  /*
	  Applies highlighting to all <pre><code>..</code></pre> blocks on a page.
	  */
	  function initHighlighting() {
	    if (initHighlighting.called)
	      return;
	    initHighlighting.called = true;

	    var blocks = document.querySelectorAll('pre code');
	    ArrayProto.forEach.call(blocks, highlightBlock);
	  }

	  /*
	  Attaches highlighting to the page load event.
	  */
	  function initHighlightingOnLoad() {
	    window.addEventListener('DOMContentLoaded', initHighlighting, false);
	    window.addEventListener('load', initHighlighting, false);
	  }

	  var PLAINTEXT_LANGUAGE = { disableAutodetect: true };

	  function registerLanguage(name, language) {
	    var lang;
	    try { lang = language(hljs); }
	    catch (error) {
	      console.error("Language definition for '{}' could not be registered.".replace("{}", name));
	      // hard or soft error
	      if (!SAFE_MODE) { throw error; } else { console.error(error); }
	      // languages that have serious errors are replaced with essentially a
	      // "plaintext" stand-in so that the code blocks will still get normal
	      // css classes applied to them - and one bad language won't break the
	      // entire highlighter
	      lang = PLAINTEXT_LANGUAGE;
	    }
	    languages[name] = lang;
	    lang.rawDefinition = language.bind(null,hljs);

	    if (lang.aliases) {
	      lang.aliases.forEach(function(alias) {aliases[alias] = name;});
	    }
	  }

	  function listLanguages() {
	    return objectKeys(languages);
	  }

	  /*
	    intended usage: When one language truly requires another

	    Unlike `getLanguage`, this will throw when the requested language
	    is not available.
	  */
	  function requireLanguage(name) {
	    var lang = getLanguage(name);
	    if (lang) { return lang; }

	    var err = new Error('The \'{}\' language is required, but not loaded.'.replace('{}',name));
	    throw err;
	  }

	  function getLanguage(name) {
	    name = (name || '').toLowerCase();
	    return languages[name] || languages[aliases[name]];
	  }

	  function autoDetection(name) {
	    var lang = getLanguage(name);
	    return lang && !lang.disableAutodetect;
	  }

	  /* Interface definition */

	  hljs.highlight = highlight;
	  hljs.highlightAuto = highlightAuto;
	  hljs.fixMarkup = fixMarkup;
	  hljs.highlightBlock = highlightBlock;
	  hljs.configure = configure;
	  hljs.initHighlighting = initHighlighting;
	  hljs.initHighlightingOnLoad = initHighlightingOnLoad;
	  hljs.registerLanguage = registerLanguage;
	  hljs.listLanguages = listLanguages;
	  hljs.getLanguage = getLanguage;
	  hljs.requireLanguage = requireLanguage;
	  hljs.autoDetection = autoDetection;
	  hljs.inherit = inherit;
	  hljs.debugMode = function() { SAFE_MODE = false; };

	  // Common regexps
	  hljs.IDENT_RE = '[a-zA-Z]\\w*';
	  hljs.UNDERSCORE_IDENT_RE = '[a-zA-Z_]\\w*';
	  hljs.NUMBER_RE = '\\b\\d+(\\.\\d+)?';
	  hljs.C_NUMBER_RE = '(-?)(\\b0[xX][a-fA-F0-9]+|(\\b\\d+(\\.\\d*)?|\\.\\d+)([eE][-+]?\\d+)?)'; // 0x..., 0..., decimal, float
	  hljs.BINARY_NUMBER_RE = '\\b(0b[01]+)'; // 0b...
	  hljs.RE_STARTERS_RE = '!|!=|!==|%|%=|&|&&|&=|\\*|\\*=|\\+|\\+=|,|-|-=|/=|/|:|;|<<|<<=|<=|<|===|==|=|>>>=|>>=|>=|>>>|>>|>|\\?|\\[|\\{|\\(|\\^|\\^=|\\||\\|=|\\|\\||~';

	  // Common modes
	  hljs.BACKSLASH_ESCAPE = {
	    begin: '\\\\[\\s\\S]', relevance: 0
	  };
	  hljs.APOS_STRING_MODE = {
	    className: 'string',
	    begin: '\'', end: '\'',
	    illegal: '\\n',
	    contains: [hljs.BACKSLASH_ESCAPE]
	  };
	  hljs.QUOTE_STRING_MODE = {
	    className: 'string',
	    begin: '"', end: '"',
	    illegal: '\\n',
	    contains: [hljs.BACKSLASH_ESCAPE]
	  };
	  hljs.PHRASAL_WORDS_MODE = {
	    begin: /\b(a|an|the|are|I'm|isn't|don't|doesn't|won't|but|just|should|pretty|simply|enough|gonna|going|wtf|so|such|will|you|your|they|like|more)\b/
	  };
	  hljs.COMMENT = function (begin, end, inherits) {
	    var mode = hljs.inherit(
	      {
	        className: 'comment',
	        begin: begin, end: end,
	        contains: []
	      },
	      inherits || {}
	    );
	    mode.contains.push(hljs.PHRASAL_WORDS_MODE);
	    mode.contains.push({
	      className: 'doctag',
	      begin: '(?:TODO|FIXME|NOTE|BUG|XXX):',
	      relevance: 0
	    });
	    return mode;
	  };
	  hljs.C_LINE_COMMENT_MODE = hljs.COMMENT('//', '$');
	  hljs.C_BLOCK_COMMENT_MODE = hljs.COMMENT('/\\*', '\\*/');
	  hljs.HASH_COMMENT_MODE = hljs.COMMENT('#', '$');
	  hljs.NUMBER_MODE = {
	    className: 'number',
	    begin: hljs.NUMBER_RE,
	    relevance: 0
	  };
	  hljs.C_NUMBER_MODE = {
	    className: 'number',
	    begin: hljs.C_NUMBER_RE,
	    relevance: 0
	  };
	  hljs.BINARY_NUMBER_MODE = {
	    className: 'number',
	    begin: hljs.BINARY_NUMBER_RE,
	    relevance: 0
	  };
	  hljs.CSS_NUMBER_MODE = {
	    className: 'number',
	    begin: hljs.NUMBER_RE + '(' +
	      '%|em|ex|ch|rem'  +
	      '|vw|vh|vmin|vmax' +
	      '|cm|mm|in|pt|pc|px' +
	      '|deg|grad|rad|turn' +
	      '|s|ms' +
	      '|Hz|kHz' +
	      '|dpi|dpcm|dppx' +
	      ')?',
	    relevance: 0
	  };
	  hljs.REGEXP_MODE = {
	    className: 'regexp',
	    begin: /\//, end: /\/[gimuy]*/,
	    illegal: /\n/,
	    contains: [
	      hljs.BACKSLASH_ESCAPE,
	      {
	        begin: /\[/, end: /\]/,
	        relevance: 0,
	        contains: [hljs.BACKSLASH_ESCAPE]
	      }
	    ]
	  };
	  hljs.TITLE_MODE = {
	    className: 'title',
	    begin: hljs.IDENT_RE,
	    relevance: 0
	  };
	  hljs.UNDERSCORE_TITLE_MODE = {
	    className: 'title',
	    begin: hljs.UNDERSCORE_IDENT_RE,
	    relevance: 0
	  };
	  hljs.METHOD_GUARD = {
	    // excludes method names from keyword processing
	    begin: '\\.\\s*' + hljs.UNDERSCORE_IDENT_RE,
	    relevance: 0
	  };

	  var constants = [
	    hljs.BACKSLASH_ESCAPE,
	    hljs.APOS_STRING_MODE,
	    hljs.QUOTE_STRING_MODE,
	    hljs.PHRASAL_WORDS_MODE,
	    hljs.COMMENT,
	    hljs.C_LINE_COMMENT_MODE,
	    hljs.C_BLOCK_COMMENT_MODE,
	    hljs.HASH_COMMENT_MODE,
	    hljs.NUMBER_MODE,
	    hljs.C_NUMBER_MODE,
	    hljs.BINARY_NUMBER_MODE,
	    hljs.CSS_NUMBER_MODE,
	    hljs.REGEXP_MODE,
	    hljs.TITLE_MODE,
	    hljs.UNDERSCORE_TITLE_MODE,
	    hljs.METHOD_GUARD
	  ];
	  constants.forEach(function(obj) { deepFreeze(obj); });

	  // https://github.com/substack/deep-freeze/blob/master/index.js
	  function deepFreeze (o) {
	    Object.freeze(o);

	    var objIsFunction = typeof o === 'function';

	    Object.getOwnPropertyNames(o).forEach(function (prop) {
	      if (o.hasOwnProperty(prop)
	      && o[prop] !== null
	      && (typeof o[prop] === "object" || typeof o[prop] === "function")
	      // IE11 fix: https://github.com/highlightjs/highlight.js/issues/2318
	      // TODO: remove in the future
	      && (objIsFunction ? prop !== 'caller' && prop !== 'callee' && prop !== 'arguments' : true)
	      && !Object.isFrozen(o[prop])) {
	        deepFreeze(o[prop]);
	      }
	    });

	    return o;
	  }

	  return hljs;
	}));
	});

	var json = function(hljs) {
	  var LITERALS = {literal: 'true false null'};
	  var ALLOWED_COMMENTS = [
	    hljs.C_LINE_COMMENT_MODE,
	    hljs.C_BLOCK_COMMENT_MODE
	  ];
	  var TYPES = [
	    hljs.QUOTE_STRING_MODE,
	    hljs.C_NUMBER_MODE
	  ];
	  var VALUE_CONTAINER = {
	    end: ',', endsWithParent: true, excludeEnd: true,
	    contains: TYPES,
	    keywords: LITERALS
	  };
	  var OBJECT = {
	    begin: '{', end: '}',
	    contains: [
	      {
	        className: 'attr',
	        begin: /"/, end: /"/,
	        contains: [hljs.BACKSLASH_ESCAPE],
	        illegal: '\\n',
	      },
	      hljs.inherit(VALUE_CONTAINER, {begin: /:/})
	    ].concat(ALLOWED_COMMENTS),
	    illegal: '\\S'
	  };
	  var ARRAY = {
	    begin: '\\[', end: '\\]',
	    contains: [hljs.inherit(VALUE_CONTAINER)], // inherit is a workaround for a bug that makes shared modes with endsWithParent compile only the ending of one of the parents
	    illegal: '\\S'
	  };
	  TYPES.push(OBJECT, ARRAY);
	  ALLOWED_COMMENTS.forEach(function(rule) {
	    TYPES.push(rule);
	  });
	  return {
	    contains: TYPES,
	    keywords: LITERALS,
	    illegal: '\\S'
	  };
	};

	var javascript = function(hljs) {
	  var FRAGMENT = {
	    begin: '<>',
	    end: '</>'
	  };
	  var XML_TAG = {
	    begin: /<[A-Za-z0-9\\._:-]+/,
	    end: /\/[A-Za-z0-9\\._:-]+>|\/>/
	  };
	  var IDENT_RE = '[A-Za-z$_][0-9A-Za-z$_]*';
	  var KEYWORDS = {
	    keyword:
	      'in of if for while finally var new function do return void else break catch ' +
	      'instanceof with throw case default try this switch continue typeof delete ' +
	      'let yield const export super debugger as async await static ' +
	      // ECMAScript 6 modules import
	      'import from as'
	    ,
	    literal:
	      'true false null undefined NaN Infinity',
	    built_in:
	      'eval isFinite isNaN parseFloat parseInt decodeURI decodeURIComponent ' +
	      'encodeURI encodeURIComponent escape unescape Object Function Boolean Error ' +
	      'EvalError InternalError RangeError ReferenceError StopIteration SyntaxError ' +
	      'TypeError URIError Number Math Date String RegExp Array Float32Array ' +
	      'Float64Array Int16Array Int32Array Int8Array Uint16Array Uint32Array ' +
	      'Uint8Array Uint8ClampedArray ArrayBuffer DataView JSON Intl arguments require ' +
	      'module console window document Symbol Set Map WeakSet WeakMap Proxy Reflect ' +
	      'Promise'
	  };
	  var NUMBER = {
	    className: 'number',
	    variants: [
	      { begin: '\\b(0[bB][01]+)n?' },
	      { begin: '\\b(0[oO][0-7]+)n?' },
	      { begin: hljs.C_NUMBER_RE + 'n?' }
	    ],
	    relevance: 0
	  };
	  var SUBST = {
	    className: 'subst',
	    begin: '\\$\\{', end: '\\}',
	    keywords: KEYWORDS,
	    contains: []  // defined later
	  };
	  var HTML_TEMPLATE = {
	    begin: 'html`', end: '',
	    starts: {
	      end: '`', returnEnd: false,
	      contains: [
	        hljs.BACKSLASH_ESCAPE,
	        SUBST
	      ],
	      subLanguage: 'xml',
	    }
	  };
	  var CSS_TEMPLATE = {
	    begin: 'css`', end: '',
	    starts: {
	      end: '`', returnEnd: false,
	      contains: [
	        hljs.BACKSLASH_ESCAPE,
	        SUBST
	      ],
	      subLanguage: 'css',
	    }
	  };
	  var TEMPLATE_STRING = {
	    className: 'string',
	    begin: '`', end: '`',
	    contains: [
	      hljs.BACKSLASH_ESCAPE,
	      SUBST
	    ]
	  };
	  SUBST.contains = [
	    hljs.APOS_STRING_MODE,
	    hljs.QUOTE_STRING_MODE,
	    HTML_TEMPLATE,
	    CSS_TEMPLATE,
	    TEMPLATE_STRING,
	    NUMBER,
	    hljs.REGEXP_MODE
	  ];
	  var PARAMS_CONTAINS = SUBST.contains.concat([
	    hljs.C_BLOCK_COMMENT_MODE,
	    hljs.C_LINE_COMMENT_MODE
	  ]);

	  return {
	    aliases: ['js', 'jsx', 'mjs', 'cjs'],
	    keywords: KEYWORDS,
	    contains: [
	      {
	        className: 'meta',
	        relevance: 10,
	        begin: /^\s*['"]use (strict|asm)['"]/
	      },
	      {
	        className: 'meta',
	        begin: /^#!/, end: /$/
	      },
	      hljs.APOS_STRING_MODE,
	      hljs.QUOTE_STRING_MODE,
	      HTML_TEMPLATE,
	      CSS_TEMPLATE,
	      TEMPLATE_STRING,
	      hljs.C_LINE_COMMENT_MODE,
	      hljs.COMMENT(
	        '/\\*\\*',
	        '\\*/',
	        {
	          relevance : 0,
	          contains : [
	            {
	              className : 'doctag',
	              begin : '@[A-Za-z]+',
	              contains : [
	                {
	                  className: 'type',
	                  begin: '\\{',
	                  end: '\\}',
	                  relevance: 0
	                },
	                {
	                  className: 'variable',
	                  begin: IDENT_RE + '(?=\\s*(-)|$)',
	                  endsParent: true,
	                  relevance: 0
	                },
	                // eat spaces (not newlines) so we can find
	                // types or variables
	                {
	                  begin: /(?=[^\n])\s/,
	                  relevance: 0
	                },
	              ]
	            }
	          ]
	        }
	      ),
	      hljs.C_BLOCK_COMMENT_MODE,
	      NUMBER,
	      { // object attr container
	        begin: /[{,\n]\s*/, relevance: 0,
	        contains: [
	          {
	            begin: IDENT_RE + '\\s*:', returnBegin: true,
	            relevance: 0,
	            contains: [{className: 'attr', begin: IDENT_RE, relevance: 0}]
	          }
	        ]
	      },
	      { // "value" container
	        begin: '(' + hljs.RE_STARTERS_RE + '|\\b(case|return|throw)\\b)\\s*',
	        keywords: 'return throw case',
	        contains: [
	          hljs.C_LINE_COMMENT_MODE,
	          hljs.C_BLOCK_COMMENT_MODE,
	          hljs.REGEXP_MODE,
	          {
	            className: 'function',
	            begin: '(\\(.*?\\)|' + IDENT_RE + ')\\s*=>', returnBegin: true,
	            end: '\\s*=>',
	            contains: [
	              {
	                className: 'params',
	                variants: [
	                  {
	                    begin: IDENT_RE
	                  },
	                  {
	                    begin: /\(\s*\)/,
	                  },
	                  {
	                    begin: /\(/, end: /\)/,
	                    excludeBegin: true, excludeEnd: true,
	                    keywords: KEYWORDS,
	                    contains: PARAMS_CONTAINS
	                  }
	                ]
	              }
	            ]
	          },
	          {
	            className: '',
	            begin: /\s/,
	            end: /\s*/,
	            skip: true,
	          },
	          { // JSX
	            variants: [
	              { begin: FRAGMENT.begin, end: FRAGMENT.end },
	              { begin: XML_TAG.begin, end: XML_TAG.end }
	            ],
	            subLanguage: 'xml',
	            contains: [
	              {
	                begin: XML_TAG.begin, end: XML_TAG.end, skip: true,
	                contains: ['self']
	              }
	            ]
	          },
	        ],
	        relevance: 0
	      },
	      {
	        className: 'function',
	        beginKeywords: 'function', end: /\{/, excludeEnd: true,
	        contains: [
	          hljs.inherit(hljs.TITLE_MODE, {begin: IDENT_RE}),
	          {
	            className: 'params',
	            begin: /\(/, end: /\)/,
	            excludeBegin: true,
	            excludeEnd: true,
	            contains: PARAMS_CONTAINS
	          }
	        ],
	        illegal: /\[|%/
	      },
	      {
	        begin: /\$[(.]/ // relevance booster for a pattern common to JS libs: `$(something)` and `$.something`
	      },
	      hljs.METHOD_GUARD,
	      { // ES6 class
	        className: 'class',
	        beginKeywords: 'class', end: /[{;=]/, excludeEnd: true,
	        illegal: /[:"\[\]]/,
	        contains: [
	          {beginKeywords: 'extends'},
	          hljs.UNDERSCORE_TITLE_MODE
	        ]
	      },
	      {
	        beginKeywords: 'constructor get set', end: /\{/, excludeEnd: true
	      }
	    ],
	    illegal: /#(?!!)/
	  };
	};

	var beach = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE svg PUBLIC \"-//W3C//DTD SVG 1.1//EN\" \"http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd\">\n<svg version=\"1.1\" xmlns=\"http://www.w3.org/2000/svg\" xmlns:xlink=\"http://www.w3.org/1999/xlink\" x=\"0\" y=\"0\" width=\"15\" height=\"15\" viewBox=\"0 0 15 15\">\n    <path d=\"M15,3 C15,3 15,13 15,13 L0.045,13 C2.195,12.952 4.838,10.924 4.838,10.924 C4.838,10.924 4.336,11.041 3.55,10.588 C3.4,10.458 3.26,10.318 3.11,10.198 C2.825,9.944 2.395,9.944 2.11,10.198 L1.64,10.608 C1.322,10.872 0.923,11.017 0.51,11.018 C0.234,11.024 0.006,10.804 0,10.528 C0,10.525 0,10.522 0,10.518 C0,10.242 0.224,10.018 0.5,10.018 C0.759,9.996 0.999,9.874 1.17,9.678 C1.441,9.389 1.788,9.182 2.17,9.078 C2.782,8.897 3.443,9.036 3.93,9.448 L4.32,9.798 C4.618,10.102 5.105,10.107 5.409,9.809 C5.413,9.806 5.416,9.802 5.42,9.798 C5.56,9.678 5.69,9.548 5.84,9.428 C6.556,9.042 6.85,9.12 6.85,9.12 L8.128,7.691 L7.94,7.578 C7.78,7.448 7.63,7.298 7.47,7.168 C7.185,6.914 6.755,6.914 6.47,7.168 C6.31,7.298 6.16,7.448 6,7.578 C5.292,8.175 4.258,8.175 3.55,7.578 C3.4,7.448 3.26,7.308 3.11,7.188 C2.825,6.934 2.395,6.934 2.11,7.188 L1.64,7.598 L1.112,7.907 L0.51,8.018 C0.51,8.018 0.02,8.036 0.01,7.518 C0,7 0.234,7.018 0.51,7.018 C0.769,6.996 1.009,6.874 1.18,6.678 C1.451,6.389 1.798,6.182 2.18,6.078 C2.792,5.897 3.453,6.036 3.94,6.448 L4.27,6.788 C4.568,7.092 5.055,7.097 5.359,6.799 C5.363,6.796 5.366,6.792 5.37,6.788 C5.51,6.668 5.64,6.538 5.79,6.418 C6.518,5.84 7.556,5.869 8.25,6.488 L8.64,6.828 L8.799,6.924 C10.426,4.835 12.351,3.275 15,3 z\"/>\n</svg>";

	var beach$1 = /*#__PURE__*/Object.freeze({
		__proto__: null,
		'default': beach
	});

	var beachIconSVG = getCjsExportFromNamespace(beach$1);

	highlight.registerLanguage('json', json);
	highlight.registerLanguage('javascript', javascript);



	document.addEventListener("DOMContentLoaded", function() {
	  const buildImportIconAsInlineSvgOutput = function() {
	    var outputString = "'" + beachIconSVG + "'";
	    const container = document.querySelector(
	      "#icon-as-svg .inspect.output code");
	    container.innerText = outputString;
	  };
	  
	  const buildModuleAsInlineSVGToDom = function() {
	    const domParser = new DOMParser();
	    const svgElem = domParser.parseFromString(
	      beachIconSVG, "text/xml").documentElement;
	    svgElem.setAttribute("height", "30px");
	    svgElem.setAttribute("width", "30px");
	    const container = document.querySelector(
	      "#icon-as-svg .render.output");
	    container.appendChild(svgElem);
	  };
	  
	  // Module as inline SVG inspection
	  buildImportIconAsInlineSvgOutput();
	  
	  // Module as inline SVG to image
	  buildModuleAsInlineSVGToDom();
	  
	  document.querySelectorAll('pre code').forEach((block) => {
	    highlight.highlightBlock(block);
	    block.style.background = "rgba(255,255,255,0)";
	  });
	});

}());
