#TrackBoard
A customizable, browser-based dashboard built with HTML5, CSS 3, and copious JavaScript.

Many features have been prioritized to maximize the opportunity to combine progressive enhancement and new, shiny browser features rather than based upon delivering something immediately useful. The new direction is to have something more visually pleasing and immediately useful to a development team like the [Panic Status Board](http://www.panic.com/blog/2010/03/the-panic-status-board/), if at all possible.

##Current Functionality
* Customizable widget framework
* Automatically updating widget data
* Works best in modern browsers and sufficiently in legacy ones
* State is automatically saved if HTML5 localStorage is available
* No server dependencies for easy deployment
* Keyboard shortcuts
* Re-ordering widgets
* Shims and fallbacks provided to browsers without HTML5 inputs, CSS3 gradients, etc.

## Future Plans
* Remote storage of board state
* Board sharing
* Reactive layout for better mobile experience
* Improved widget styling
* Find/build a proxy for use with build servers/ticket systems that:
 * lack a JSONP implementation
 * lack a publically visible endpoint
 * are hosted on different domains than the TrackBoard instance
* Use [Masonry](http://github.com/desandro/masonry/) or similar to better lay out widgets
* Tracker authoring/sharing

##Libraries Used / Credits
* [jQuery 1.4.4](http://github.com/jquery/jquery)
* [Modernizr 1.6](http://github.com/Modernizr/Modernizr)
* [HTML5 Boilerplate](http://github.com/paulirish/html5-boilerplate)
* [appendto's jQuery templates fork](http://github.com/appendto/jquery-tmpl)
* [YQL](http://developer.yahoo.com/yql/) for some JSONP-versions of RSS feeds, etc.
* [JSON2](http://www.json.org/js.html) for backwards compatible JSON-stringify
* [John Resig's JavaScript Pretty Date](http://ejohn.org/blog/javascript-pretty-date/)
* [Kevin Gorski's fork of John Resig's fork of Tzury Bar Yochay's jQuery Hotkeys](https://github.com/kevingorski/jquery.hotkeys)
* Twitter link highlighting from [twitter.js](http://code.google.com/p/twitterjs/)
* Cookie reading/writing code from [quirksmode](quirksmode.org/js/cookies.html)
* [CSS Sticky Footer](http://www.cssstickyfooter.com/)
* [jQuery Spinner](http://github.com/jogep/jquery.ui.spinner) for a numeric textbox fallback