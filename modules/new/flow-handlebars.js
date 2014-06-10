/*!
 * Implements a Handlebars layer for FlowBoard.TemplateEngine
 */

( function ( $, undefined ) {
	window.mw = window.mw || {}; // mw-less testing
	mw.flow = mw.flow || {}; // create mw.flow globally

	var _tplcache = {},
		_timestamp = {
		list: [],
		currentIndex: 0
	};


	/**
	 * Instantiates a FlowHandlebars instance for TemplateEngine.
	 * @param {Object} FlowStorageEngine
	 * @returns {FlowHandlebars}
	 * @constructor
	 */
	function FlowHandlebars( FlowStorageEngine ) {
		return this;
	}

	mw.flow.FlowHandlebars = FlowHandlebars;

	/**
	 * Returns a given template function. If template is missing, the template function is noop with mw.flow.debug.
	 * @param {String} templateName
	 * @returns {Function}
	 */
	FlowHandlebars.prototype.getTemplate = function ( templateName ) {
		if ( _tplcache[ templateName ] ) {
			// Return cached compiled template
			return _tplcache[ templateName ];
		}

		_tplcache[ templateName ] = mw.mantle.template.get( templateName + '.handlebars' );
		if ( _tplcache[ templateName ] ) {
			// Try to get this template via Mantle
			_tplcache[ templateName ] = _tplcache[ templateName ].render;
		}

		return _tplcache[ templateName ] || function () { mw.flow.debug( '[Handlebars] Missing template', arguments ); };
	};

	/**
	 * Processes a given template and returns the actual DOM nodes generated by it.
	 * @param {String} templateName
	 * @param {*} [args]
	 * @returns {String}
	 */
	FlowHandlebars.prototype.processTemplate = function ( templateName, args ) {
		return FlowHandlebars.prototype.getTemplate( templateName )( args );
	};

	/**
	 * Runs processTemplate inside, but returns a DocumentFragment instead of an HTML string.
	 * This should be used for runtime parsing of a template, as it triggers processProgressiveEnhancement on the
	 * fragment, which allows progressiveEnhancement blocks to be instantiated.
	 * @param {String} templateName
	 * @param {*} [args]
	 * @returns {DocumentFragment}
	 */
	FlowHandlebars.prototype.processTemplateGetFragment = function ( templateName, args ) {
		var $fragment = $( document.createDocumentFragment() ),
			div = document.createElement( 'div' ),
			scrs, i, len;

		div.innerHTML = FlowHandlebars.prototype.processTemplate( templateName, args );

		//FlowHandlebars.prototype.processProgressiveEnhancement( div );

		while ( div.childNodes.length ) {
			$fragment[0].appendChild( div.childNodes[0] );
		}

		div = null;

		return $fragment[0];
	};

	/**
	 * A method to call helper functions from outside templates. This removes Handlebars.SafeString wrappers.
	 * @param {String} helperName
	 * @param {...*} [args]
	 */
	FlowHandlebars.prototype.callHelper = function ( helperName, args ) {
		var result = this[ helperName ].apply( this, Array.prototype.slice.call( arguments, 1 ) );
		if ( result && result.string ) {
			return result.string;
		}
		return result;
	};

	/**
	 * Finds scripts of x-handlebars-template-progressive-enhancement type, compiles its innerHTML as a Handlebars
	 * template, and then replaces the whole script tag with it. This is used to "progressively enhance" a page with
	 * elements that are only necessary with JavaScript. On a non-JS page, these elements are never rendered at all.
	 * @param {Element|jQuery} target
	 * @todo Lacks args, lacks functionality, full support. (see also FlowHandlebars.prototype.progressiveEnhancement)
	 */
	FlowHandlebars.prototype.processProgressiveEnhancement = function ( target ) {
		$( target ).find( 'script' ).filter( '[type="text/x-handlebars-template-progressive-enhancement"]' ).each( function () {
			$( this )
				.replaceWith(
					$( Handlebars.compile( this.innerHTML )() )
				);
		} );
	};

	// @todo remove and replace with mw.message || $.noop
	function flowMessages( str ) {
		var strings = ( {
				"Reply": "Reply", // TODO: pass in and parse $author['gender']
				"Topics_n": function ( count, options ) {
					return "Topics (" + count + ")";
				},

				"started_with_participants": function ( context, options ) {
					var author = FlowHandlebars.prototype.authorBlock( context, options );
					return author.name + " started this topic" +
						( context.author_count > 1 ? (
						", with " + ( context.author_count - 1 ) + " other participant" +
							( context.author_count > 2 ? 's' : '' )
						) : '' );
				},
				"topic_count_sidebar": function ( context, options ) {
					return "Showing " + context.topics.length + " of " + context.topic_count + " topics attached to this page";
				},
				"Reply_to_author_name": function ( context, options ) {
					return "Reply to " + FlowHandlebars.prototype.authorBlock( context, options ).name;
				},
				"comment_count": function ( context, options ) {
						return context.reply_count + " comment" + ( !context.reply_count || context.reply_count > 1 ? 's' : '' );
				},


				"_time": function ( seconds_ago ) {
					var str = ' second',
						new_time = seconds_ago;

					if ( seconds_ago >= 604800 ) {
						new_time = seconds_ago / 604800;
						str = ' week';
					} else if ( seconds_ago >= 86400 ) {
						new_time = seconds_ago / 86400;
						str = ' day';
					} else if ( seconds_ago >= 3600 ) {
						new_time = seconds_ago / 3600;
						str = ' hour';
					} else if ( seconds_ago >= 60 ) {
						new_time = seconds_ago / 60;
						str = ' minute';
					}

					return Math.floor( new_time ) + str + ( new_time < 1 || new_time >= 2 ? 's' : '' );
				},
				"time_ago": function ( seconds_ago ) { return this._time( seconds_ago ) + " ago"; },
				"active_ago": function ( seconds_ago ) { return "Active " + this.time_ago( seconds_ago ); },
				"started_ago": function ( seconds_ago ) { return "Started " + this.time_ago( seconds_ago ); },
				"edited_ago": function ( seconds_ago ) { return "Edited " + this.time_ago( seconds_ago ); },

				"datetime": function ( timestamp ) {
					return ( new Date( timestamp ) ).toLocaleString();
				}
			} ),
			result = strings[ str ];

		if ( !result ) {
			result = mw.message( str );
		}

		if ( Object.prototype.toString.call( result ) === '[object Function]' ) {
			// Callable; return the result of callback(arguments)
			result = result.apply( strings, Array.prototype.slice.call( arguments, 1 ) );
		}

		// Return the result string
		return { text: function () { return result; } };
	}

	/**
	 * Calls flowMessages to get localized message strings.
	 * @todo use mw.message
	 * @example {{l10n "reply_count" 12}}
	 * @param {String} str
	 * @param {...*} [args]
	 * @param {Object} [options]
	 * @returns {String}
	 */
	FlowHandlebars.prototype.l10n = function ( str, args, options ) {
		var res = flowMessages.apply( mw, arguments ).text();

		if ( !res ) {
			mw.flow.debug( "[l10n] Empty String", arguments );
			return "(l10n:" + str + ")";
		}

		return res;
	};

	// Register l10n
	Handlebars.registerHelper( 'l10n', FlowHandlebars.prototype.l10n );

	// TODO: l10nParse function?

	/**
	 * @todo completely
	 * @returns {String}
	 */
	FlowHandlebars.prototype.uuidTimestamp = function ( ) {
		// I have no idea
		// @todo
	};

	// Register timestamp
	Handlebars.registerHelper( 'uuidTimestamp', FlowHandlebars.prototype.uuidTimestamp );

	/**
	 * Generates markup for an "nnn sssss ago" and date/time string.
	 * @example {{timestamp start_time "started_ago"}}
	 * @param {int} timestamp milliseconds
	 * @param {String} str
	 * @param {bool} [timeAgoOnly]
	 * @returns {String|undefined}
	 */
	FlowHandlebars.prototype.timestamp = function ( timestamp, str, timeAgoOnly ) {
		if ( isNaN( timestamp ) || !str ) {
			mw.flow.debug( '[timestamp] Invalid arguments', arguments);
			return;
		}

		var time_ago, guid,
			seconds_ago = ( +new Date() - timestamp ) / 1000;

		if ( seconds_ago < 2419200 ) {
			// Return "n ago" for only dates less than 4 weeks ago
			time_ago = FlowHandlebars.prototype.l10n( str, seconds_ago );

			if ( timeAgoOnly === true ) {
				// timeAgoOnly: return only this text
				return time_ago;
			}
		} else if ( timeAgoOnly === true ) {
			// timeAgoOnly: return nothing
			return;
		}

		// Generate a GUID for this element to find it later
		guid = FlowHandlebars.prototype.generateUID();

		// Store this in the timestamps auto-updater array
		_timestamp.list.push( { guid: guid, timestamp: timestamp, str: str, failcount: 0 } );

		// Render the timestamp template
		return FlowHandlebars.prototype.html(
			FlowHandlebars.prototype.processTemplate(
				'timestamp',
				{
					time_iso: timestamp,
					time_readable: FlowHandlebars.prototype.l10n( 'datetime', timestamp ),
					time_ago: time_ago,
					guid: guid
				}
			)
		);
	};

	// Register timestamp
	Handlebars.registerHelper( 'timestamp', FlowHandlebars.prototype.timestamp );

	/**
	 * Updates one <time> node at a time every 100ms, until finishing, and then sleeps 5s.
	 * Nodes do not get updated again until they have changed.
	 * @todo Perhaps only update elements within the viewport?
	 * @todo Maybe updating elements every few seconds is distracting? Think about this.
	 */
	function timestampAutoUpdate() {
		var arrayItem, $ago, failed, secondsAgo, text,
			currentTime = +new Date() / 1000;

		// Only update elements that need updating (eg. only update minutes every 60s)
		do {
			arrayItem = _timestamp.list[ _timestamp.list._currentIndex ];

			if ( !arrayItem || !arrayItem.nextUpdate || currentTime >= arrayItem.nextUpdate ) {
				break;
			}

			// Find the next array item
			_timestamp.list._currentIndex++;
		} while ( arrayItem );

		if ( !arrayItem ) {
			// Finished array; reset loop
			_timestamp.list._currentIndex = 0;

			// Run again in 5s
			setTimeout( timestampAutoUpdate, 5000 );
			return;
		}

		$ago = $( '#' + arrayItem.guid );
		failed = true;
		secondsAgo = currentTime - ( arrayItem.timestamp / 1000 );

		if ( $ago && $ago.length ) {
			text = FlowHandlebars.prototype.timestamp( arrayItem.timestamp, arrayItem.str, true );

			// Returned a valid "n ago" string?
			if ( text ) {
				// Reset the failcount
				failed = arrayItem.failcount = 0;

				// Set the next update time
				arrayItem.nextUpdate = currentTime + ( secondsAgo > 604800 ? 604800 - currentTime % 604800 : ( secondsAgo > 86400 ? 86400 - currentTime % 86400 : ( secondsAgo > 3600 ? 3600 - currentTime % 3600 : ( secondsAgo > 60 ? 60 - currentTime % 60 : 1 ) ) ) );

				// Only touch the DOM if the text has actually changed
				if ( $ago.text() !== text ) {
					$ago.text( text );
				}
			}
		}

		if ( failed && ++arrayItem.failcount > 9 ) {
			// Remove this array item if we failed this 10 times in a row
			_timestamp.list.splice( _timestamp.list._currentIndex, 1 );
		} else {
			// Go to next item
			_timestamp.list._currentIndex++;
		}

		// Run every 100ms until we update all nodes
		setTimeout( timestampAutoUpdate, 100 );
	}

	$( document ).ready( timestampAutoUpdate );

	/**
	 * Do not escape HTML string. Used as a Handlebars helper.
	 * @example {{html "<div/>"}}
	 * @param {String} string
	 * @returns {String|Handlebars.SafeString}
	 */
	FlowHandlebars.prototype.html = function ( string ) {
		return new Handlebars.SafeString( string );
	};

	// Register html
	Handlebars.registerHelper( 'html', FlowHandlebars.prototype.html );

	/**
	 *
	 * @example {{#ifEquals one two}}
	 * @param {*} left
	 * @param {*} right
	 * @param {Object} options
	 * @returns {String}
	 */
	FlowHandlebars.prototype.ifEquals = function ( left, right, options ) {
		/* jshint -W116 */
		if ( left == right ) {
			return options.fn( this );
		}
		return options.inverse ? options.inverse( this ) : false;
	};

	// Register ifEquals
	Handlebars.registerHelper( 'ifEquals', FlowHandlebars.prototype.ifEquals );

	/**
	 *
	 * @example {{block this}}
	 * @param {Object} context
	 * @param {Object} options
	 * @returns {String}
	 */
	FlowHandlebars.prototype.workflowBlock = function ( context, options ) {
		return FlowHandlebars.prototype.html( FlowHandlebars.prototype.processTemplate(
			"flow_block_" + context.type + ( context['block-action-template'] || '' ),
			context
		) );
	};

	// Register block
	Handlebars.registerHelper( 'block', FlowHandlebars.prototype.workflowBlock );

	/**
	 * @example {{post ../../../../rootBlock this}}
	 * @param {Object} context
	 * @param {Object} revision
	 * @param {Object} options
	 * @returns {String}
	 */
	FlowHandlebars.prototype.postBlock = function ( context, revision, options ) {
		return FlowHandlebars.prototype.html( FlowHandlebars.prototype.processTemplate(
			"flow_post",
			{
				revision: revision,
				rootBlock: context
			}
		) );
	};

	// Register author
	Handlebars.registerHelper( 'post', FlowHandlebars.prototype.postBlock );

	/**
	 * @example {{#each topics}}{{#eachPost this}}{{content}}{{/eachPost}}{{/each}}
	 * @param {String} context
	 * @param {Array|String} postIds
	 * @param {Object} options
	 * @returns {String}
	 * @todo support multiple postIds in an array
	 */
	FlowHandlebars.prototype.eachPost = function ( context, postIds, options ) {
		var revId = context.posts[postIds][0],
			revision = context.revisions[revId] || { content: null };
		return options.fn ? options.fn( revision ) : revision;
	};

	// Register author
	Handlebars.registerHelper( 'eachPost', FlowHandlebars.prototype.eachPost );

	/**
	 * Gets a URL for a given variable.
	 * @example {{url "board.search"}}
	 * @param {String} str
	 * @param {Object} options
	 * @returns {String}
	 * @todo Implement
	 */
	FlowHandlebars.prototype.url = function ( str, options ) {
		return Array.prototype.pop.apply( arguments );
	};

	// Register url
	Handlebars.registerHelper( 'url', FlowHandlebars.prototype.url );

	/**
	 * Creates a form element based on the given input.
	 * Automatically applies mw-ui-button classes and creates sibling mw-ui nodes.
	 * Takes option keys:
	 * * String: content, role, pattern, name, value, placeholder
	 * * Bool: required, collapsible, expandable
	 * * Number: maxlength, min, max, step, rows, cols
	 * @example {{formElement this "button" class="mw-ui-sleeper" text='{{l10n "Preview"}}'}}
	 * @param {Object} context
	 * @param {String} type
	 * @param {Object} options
	 * @returns {String}
	 */
	FlowHandlebars.prototype.formElement = function ( context, type, options ) {
		var hash = options.hash,
			data = {
				tag:         type,
				fieldtype:   null,
				closing_tag: null,
				'class':     hash['class'] || '',
				required:    !!hash.required,
				maxlength:   hash.maxlength,
				pattern:     hash.pattern,
				name:        hash.name,
				value:       hash.value,
				content:     hash.content,
				role:        hash.role || type,
				collapsible: !!hash.collapsible,
				expandable:  !!hash.expandable,
				radio:       false,
				checkbox:    false
			};

		switch ( type ) {
			case 'submit':
			case 'reset':
			case 'button':
				data.tag = 'button';
				data.closing_tag = data.tag;

				// Apply mw-ui- class based on role (or type if role is omitted)
				switch ( hash.role || type ) {
					case 'submit':
					case 'constructive':
						data.fieldtype = 'constructive';
						break;

					case 'action':
					case 'progressive':
						data.fieldtype = 'progressive';
						break;

					case 'regressive':
						data.fieldtype = 'regressive';
						break;

					case 'cancel':
					case 'reset':
					case 'destructive':
						data.fieldtype = 'destructive';
						break;

					default:
						data.fieldtype = 'button';
						break;
				}

				if ( data.fieldtype !== 'button' ) {
					data['class'] = 'flow-ui-' + data.fieldtype + ' ' + data['class'];
				}
				data['class'] = 'flow-ui-button ' + data['class'];
				break;

			case 'color':
			case 'date':
			case 'email':
			case 'number':
			case 'url':
			case 'range':
			case 'time':
				data.validation = true;
			/* fall through */
			case 'search':
			case 'text':
			case 'input':
				data.tag = 'input';
				data.fieldtype = type === 'input' ? 'text' : type;
				data.validation = data.validation || data.required || data.min || data.max;
				data.type = type === 'input' ? 'text' : type;
				if ( type !== 'color' && type !== 'range' ) {
					// These are NOT styled correctly yet
					data['class'] = 'mw-ui-input ' + data['class'];
				}
				data.min = hash.min;
				data.max = hash.max;
				data.step = hash.step;
				break;

			case 'textarea':
				data.closing_tag = data.tag;
				data['class'] = 'mw-ui-input ' + data['class'];
				data.validation = true;
				data.rows = hash.rows;
				data.cols = hash.cols;
				break;

			case 'radio':
			case 'checkbox':
				data.tag = 'input';
				data.type = type;
				data.fieldtype = type;
				data.radio = type === 'radio';
				data.checkbox = type === 'checkbox';
				data.validation = true;
				if ( data.content ) {
					data.content = ' ' + data.content;
				}
				break;

			default:
				break;
		}

		if ( hash.placeholder ) {
			data.placeholder = Handlebars.compile( hash.placeholder )( context, options );
		}

		return FlowHandlebars.prototype.html( FlowHandlebars.prototype.processTemplate( 'form_element', data ) );
	};

	// Register formElement
	Handlebars.registerHelper( 'formElement', FlowHandlebars.prototype.formElement );

	/**
	 *
	 * @example {{generateUID}}
	 * @returns {String}
	 */
	FlowHandlebars.prototype.generateUID = function () {
		return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace( /[xy]/g , function ( c ) {
			var r = Math.random() * 16 | 0, v = ( c === 'x' ? r : ( r & 0x3 | 0x8 ) );
			return v.toString( 16 );
		} );
	};

	// Register generateUID
	Handlebars.registerHelper( 'generateUID', FlowHandlebars.prototype.generateUID );

	/**
	 * Simple math.
	 * @example {{math @index "+" 1}}
	 * @param {Number} lvalue
	 * @param {String} operator
	 * @param {Number} rvalue
	 * @param {Object} options
	 * @return {Number}
	 */
	FlowHandlebars.prototype.math = function ( lvalue, operator, rvalue, options ) {
		lvalue = parseFloat(lvalue);
		rvalue = parseFloat(rvalue);

		return {
			"+": lvalue + rvalue,
			"-": lvalue - rvalue,
			"*": lvalue * rvalue,
			"/": lvalue / rvalue,
			"%": lvalue % rvalue
		}[operator];
	};

	// Register math
	Handlebars.registerHelper( 'math', FlowHandlebars.prototype.math );

	/**
	 * The progressiveEnhancement helper essentially does one of replace things:
	 * 1. type="replace": (target="selector") Replaces target entirely with rendered template.
	 * 2. type="content": (target="selector") Replaces target's content with rendered template.
	 * 3. type="insert": Inserts rendered template at the helper's location.
	 *
	 * This template is used to simplify server-side and client-side rendering. Client-side renders a
	 * progressiveEnhancement helper instantly, in the post-process stage. The server-side renders only a script tag
	 * with a template inside. This script tag is found ondomready, and then the post-processing occurs at that time.
	 *
	 * Option keys:
	 * * type=String (replace, content, insert)
	 * * target=String (jQuery selector; needed for replace and content)
	 * * template=String (Handlebars template)
	 * * data-object=Object (data to be used to render the template; usually the keyword "this")
	 * * data-json=String ()
	 * @example {{progressiveEnhancement type="content"}}
	 * @param {Object} options
	 * @return {String}
	 * @todo Implement support for full functionality, perhaps revisit the implementation.
	 */
	FlowHandlebars.prototype.progressiveEnhancement = function ( options ) {
		var hash = options.hash;

		return FlowHandlebars.prototype.html( '<scr' + 'ipt type="text/x-handlebars-template-progressive-enhancement" data-target="' + hash.target +'" data-target="' + hash.target +'" data-type="' + hash.type + '" id="' + hash.id + '">' + hash.template + '</scr' + 'ipt>' );
	};

	// Register progressiveEnhancement
	Handlebars.registerHelper( 'progressiveEnhancement', FlowHandlebars.prototype.progressiveEnhancement );
}( jQuery ) );
