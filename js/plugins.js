/*
 * jQuery Templating Plugin
 *	 NOTE: Created for demonstration purposes.
 * Copyright 2010, John Resig
 * Dual licensed under the MIT or GPL Version 2 licenses.
 */
(function(jQuery){
	// Override the DOM manipulation function
	var oldManip = jQuery.fn.domManip,
			safe_var = "(function(){try{return $1;}catch(err){if(err.name==='ReferenceError'||err.name==='TypeError'){return undefined;}throw err;}}.call(this))",
			$context = "var _params = '$2'.split(/,\\s?/), _context = undefined; if(_params.length){ _context = {}; $.each(_params, function (_i, _item) { _context[_item] = eval(_item) }); }",
			rx_oper	 = /((<<|>?>>|[&\*\+-\/\^\|])?=|\+\+|--|\{|\}|\[)/,
			rx_keywd = /\b(break|(cas|els|continu|delet|whil)e|(ca|swi)tch|with|default|do|finally|try|for|var|function|return|if|new|throw|void)\b/;
	
	jQuery.fn.extend({
		render: function( data ) {
			return this.map(function(i, tmpl){
				return jQuery.render( tmpl, data );
			});
		},
		
		// This will allow us to do: .append( "template", dataObject )
		domManip: function( args ) {
			// This appears to be a bug in the appendTo, etc. implementation
			// it should be doing .call() instead of .apply(). See #6227
			if ( args.length > 1 && args[0].nodeType ) {
				arguments[0] = [ jQuery.makeArray(args) ];
			}

			if ( args.length === 2 && typeof args[0] === "string" && typeof args[1] !== "string" ) {
				arguments[0] = [ jQuery.render( args[0], args[1] ) ];
			}
			
			return oldManip.apply( this, arguments );
		}
	});
	
	jQuery.extend({
		render: function( tmpl, data ) {
			var fn;
			
			// Use a pre-defined template, if available
			if ( jQuery.templates[ tmpl ] ) {
				fn = jQuery.templates[ tmpl ];
				
			// We're pulling from a script node
			} else if ( tmpl.nodeType ) {
				var node = tmpl, elemData = jQuery.data( node );

				if ( !( fn = elemData.tmpl ) ) {
					// fill cache
					jQuery.data( node, "tmpl", fn = jQuery.tmpl( node.innerHTML ) );
				}
			}

			fn = fn || jQuery.tmpl( tmpl );
			
			// We assume that if the template string is being passed directly
			// in the user doesn't want it cached. They can stick it in
			// jQuery.templates to cache it.

			if ( jQuery.isArray( data ) ) {
				return jQuery.map( data, function( data, i ) {
					return $( fn.call( data, jQuery, data, i ) ).get();
				});
			}
			else {
				return $( fn.call( data, jQuery, data, 0 ) ).get();
			}
		},
		
		// You can stick pre-built template functions here
		templates: {},

		/*
		 * For example, someone could do:
		 *	 jQuery.templates.foo = jQuery.tmpl("some long templating string");
		 *	 $("#test").append("foo", data);
		 */

		tmplcmd: {
			"each": {
				_default: [ null, "$i" ],
				prefix: "(function(){var $first=true;jQuery.each($1,function($2){ $CONTEXT with(this){",
				suffix: "}$first=false});}).call(this);"
			},
			"if": {
				prefix: "if($SAFE){",
				suffix: "}"
			},
			"ifdef": {
				prefix: "if( typeof($SAFE) !== 'undefined' ){",
				suffix: "}"
			},
			"ifndef": {
				prefix: "if( typeof($SAFE) === 'undefined' ){",
				suffix: "}"
			},
			"else": {
				prefix: "}else{"
			},
			"elseif": {
				prefix: "}else if($SAFE){",
				suffix: "}"
			},			
			"with": {
				_default: [ "", "" ],
				prefix: "(function($2){ $CONTEXT ",
				suffix: "}.call(this,$SAFE))"
			},
			"include": {
				prefix: "_.push(String($1) in $.templates?$.templates[$1].call(this, $, typeof _context !== 'undefined' ? _context : _.data):'');"
			},
			"html": {
				prefix: "_tmp=$SAFE;_.push(typeof _tmp==='function'?_tmp.call(this):_tmp);"
			},
			"=": {
				_default: [ "this" ],
				prefix: "_tmp=$SAFE;_.push($.encode(typeof _tmp==='function'?_tmp.call(this):_tmp));"
			}
		},

		encode: function( text ) {
			return text == null ? '' : 
				( text + '' ).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
				.replace(/&amp;lt;/g,'&lt;').replace(/&amp;gt;/g,'&gt;'); // if &lt;/&gt; exists in the text to be encoded, the result is incorrect.
		},

		tmpl: function( str, data, i ) {
			var base = str;
			var rx_esc = /(\\(?!["'])|[\n\r\b\t])/g, 
					fn_esc = function ( a ) {
							var h = a.charCodeAt( 0 ).toString( 16 );
							return '\\u0000'.substring( 0, 6 - h.length ) + h;
						};
			
			// remove all comments {# ... #} from the template string
			str = str.replace( /\{#("(\"|[^"])*?"|'(\'|[^'])*?'|[\S\s])*?#\}/g, '' );
			
			// Convert alternate variable syntax (${ ... }) into tag syntax ({{= ... }})
			str = str.replace(/\${([^}]*)}/g, "{{= $1}}");
			
			// Convert the template into JavaScript
			var m, stack = [], s = [
				"var $=jQuery,_=[],_tmp;", 
				"_.data=$data;", 
				"_.index=$i||0;",
				"with($data){" // Introduce the data as local variables using with(){}
			];
			//the regex from commit 718c50e576cca22bcf682c664c226669411c795d was breaking IE something awful.
			//while ( m = str.match( /^([\s\S]*?){{\s*(\/?)(\w+|\S)(?:\s+((?:[^'"]*?|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*')*?))?(?:\s+as\s+(.*?))?\s*}}/ ) ) {
			while ( m = str.match( /^([\s\S]*?){{\s*(\/?)(\w+|\S)(?:\s+([\s\S]*?))?(?:\s+as\s+(.*?))?\s*}}/ ) ) {
			
				// have prefix before tag
				if ( m[1] ) {
					s.push( "_.push('" + m[1].replace( rx_esc, fn_esc ) + "');" );
				}

				var slash = m[2], type = m[3], args = m[4], fnargs = m[5];

				// have a matching template
				var tmpl = jQuery.tmplcmd[ type ];
				if ( !tmpl ) {
					throw ReferenceError("Template tag not found: " + type);
				}

				//escape { and } braces.
				var rx_braces = /\\([}|{])/g;
				if(args && rx_braces.test(args)){
					args = args.replace(rx_braces, '$1');
				}

				// escape any escapables within arguments strings
				if ( args && /['"]/.test( args ) ) { //'// Syntax Highlighting Fix
					args = args.replace(/(")((?:\\"|[^"])*?)"|(')((?:\\'|[^'])*?)'/g, function ( a, b, c, d, e ) {
						return (b||d) + (c || e || '').replace( rx_esc, fn_esc ) + (b||d);
					});
				}

				// attempt to block mutating as much is reasonably possible by limiting syntax
				// user can theoretically do `arrayname.slice(1,2)` but then that is his mess to deal with
				if ( args || fnargs ) {
					var fail,
							cleaned = (args + ' ' +fnargs).replace( /"(?:\\"|[^"])*?"|'(?:\\'|[^'])*?'|[!=]=+|([^<>])[><]=|\b\[/g, '$1' ),
							tag = m[0].substr( ( m[1] || '' ).length );
					// disallow: {}, =, +=, -=, *=, /=, >>=, <<=, >>>=, &=, |=, ^=, ++, --
					if ( (fail = cleaned.match( rx_oper )) ) {
						throw SyntaxError('Illegal template operator "' + fail[0] + '" in ' + tag);
					}
					// disallow: break, case, catch, continue, default, delete, do, else, finally, for, function, if, new, return, 
					//					 switch, throw, try, var, void, while, with
					else if ( fail = cleaned.match( rx_keywd ) ) {
						throw SyntaxError('Illegal reserved word "' +	 fail[0] + '" in ' + tag);
					}
				}
				
				// default args & fnargs
				var tag, def = tmpl._default || [];
				
				// for tags that define both a prefix and a suffix, keep a stack of nesting...
				if ( tmpl.prefix && tmpl.suffix ) {
					if ( slash ) {
						// pop stack
						tag = stack.pop();
						if ( !tag || tag[0] !== type ) {
							throw SyntaxError('Unexpected termination by "' + type +'".');
						}
						// recall opener arguments
						args = tag[1];
						fnargs = tag[2];
					}
					else	{
						// push to stack
						stack.push([ type, args, fnargs ]);
					}
				}

				s.push( tmpl[ slash ? "suffix" : "prefix" ]
					.split('$CONTEXT').join($context)
					.split("$SAFE").join( safe_var )
					.split("$1").join( args		|| def[0] )
					.split("$2").join( fnargs || def[1] )
				);
				
				str = str.substr( m[0].length );
			}
			
			// push any remaining string 
			if ( str ) {
				s.push( "_.push('" + str.replace( rx_esc, fn_esc ) + "');" );
			}
			
			s.push( "}", "return _.join('');" );

			// Generate a reusable function that will serve as a template
			// generator (and which will be cached).
			var fn = new Function( "jQuery","$data","$i", s.join('\n') );

			// Provide some basic currying to the user
			return data ? jQuery( fn.call( this, jQuery, data, i ) ).get() : fn;
	
		}
	});
})(jQuery);

/*
 * JavaScript Pretty Date
 * Copyright (c) 2008 John Resig (jquery.com)
 * Licensed under the MIT license.
 */

// Takes an ISO time and returns a string representing how
// long ago the date represents.
function prettyDate(time){
	var timeStr = (time || "").replace(/-\d{2}:\d{2}/g," ").replace(/[TZ]/g," "),
		date = new Date(timeStr),
		diff = (((new Date()).getTime() - date.getTime()) / 1000),
		day_diff = Math.floor(diff / 86400);
	
	if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
		return;
	
	return day_diff == 0 && (
			diff < 60 && "just now" ||
			diff < 120 && "1 minute ago" ||
			diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
			diff < 7200 && "1 hour ago" ||
			diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
		day_diff == 1 && "Yesterday" ||
		day_diff < 7 && day_diff + " days ago" ||
		day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
}

// If jQuery is included in the page, adds a jQuery plugin to handle it as well
if ( typeof jQuery != "undefined" )
	jQuery.fn.prettyDate = function(){
		return this.each(function(){
			var date = prettyDate(this.title);
			if ( date )
				jQuery(this).text( date );
		});
	};

// paulirish.com/2009/log-a-lightweight-wrapper-for-consolelog/
window.log = function(){
  log.history = log.history || [];   // store logs to an array for reference
  log.history.push(arguments);
  if(this.console){
    console.log( Array.prototype.slice.call(arguments) );
  }
};

// Borrowed from twitter.js
window.ify = function() {
  return {
    "link": function(t) {
      return t.replace(/[a-z]+:\/\/[a-z0-9-_]+\.[a-z0-9-_:~%&\?\/.=]+[^:\.,\)\s*$]/ig, function(m) {
        return '<a href="' + m + '">' + ((m.length > 25) ? m.substr(0, 24) + '...' : m) + '</a>';
      });
    },
    "at": function(t) {
      return t.replace(/(^|[^\w]+)\@([a-zA-Z0-9_]{1,15})/g, function(m, m1, m2) {
        return m1 + '@<a href="http://twitter.com/' + m2 + '">' + m2 + '</a>';
      });
    },
    "hash": function(t) {
      return t.replace(/(^|[^\w'"]+)\#([a-zA-Z0-9_]+)/g, function(m, m1, m2) {
        return m1 + '<a href="http://search.twitter.com/search?q=%23' + m2 + '">#' + m2 + '</a>';
      });
    },
    "clean": function(tweet) {
      return this.hash(this.at(this.link(tweet)));
    }
  };
}();

// Cookie methods borrowed from quirksmode.org/js/cookies.html
window.readCookie = function(name) {
	var nameEQ = name + "=";
	var ca = document.cookie.split(';');
	
	for(var i=0;i < ca.length;i++) {
		var c = ca[i];
		while (c.charAt(0)==' ') c = c.substring(1,c.length);
		if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
	}
	
	return null;
};

window.createCookie = function(name,value,days) {
	if (days) {
		var date = new Date();
		date.setTime(date.getTime()+(days*24*60*60*1000));
		var expires = "; expires="+date.toGMTString();
	}
	else var expires = "";
	document.cookie = name+"="+value+expires+"; path=/";
};

// catch all document.write() calls
(function(doc){
  var write = doc.write;
  doc.write = function(q){ 
    log('document.write(): ',arguments); 
    if (/docwriteregexwhitelist/.test(q)) write.apply(doc,arguments);  
  };
})(document);


