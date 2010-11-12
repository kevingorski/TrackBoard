var board = (function() {
	var meta = {
		version : '0.0.3'
	};
	var settings = {
		drawerOpen : false,
		refreshRate : 10,
		plusServer : 'trackboardplus.heroku.com'
	};
	var state = [];
	var undoState = [];
	var canUsePlusServer = false;
	var loading = false;
	var pollingHandle;
	var undoMessageDisplayHandle;
	var dragStartIndex;

	var boardStateKey = 'boardState';
	var settingsKey = 'settings';
	
	
	var collectConfigurationData = function(widget) {
		var updatedData = {};
		var selector = '.editor input[type!=button]';
		var gatherData = function() {
			var item = $(this);
			updatedData[this.name] = item.is(':checkbox') 
				? item.attr('checked')
				: item.val();
		};

		if(widget) {
			$(widget).find(selector).each(gatherData);
		} else {
			$('#configuration' + selector).each(gatherData);
		}

		return updatedData;
	};

	var loadWidget = function(tracker, queryData, appendToSelector, index) {
		var loadingWidget = true;
		var widget;
		
		if(appendToSelector.jquery) {
			widget = $(appendToSelector);
		} else {
			widget = $('<li class="widget"><div class="body">Loading...</div></li>');
			
			if(typeof(index) != 'undefined') {
				if(index == 0) { 
					$(appendToSelector).prepend(widget);
				} else {
					$(appendToSelector + ' .widget:eq(' + (index - 1) + ')').after(widget);
				}
			} else {
				widget.appendTo(appendToSelector);
			}
		}

		var pulse = function() {
			if(!loadingWidget) {
				widget.stop().fadeIn();

				return;
			}

			widget.fadeTo(500, 0.5, function() { widget.fadeTo(500, 1, pulse); });
		};

		pulse();

		tracker.process(widget, queryData, function() { 
			loadingWidget = false;
			
			widget.stop().find(".body").remove();
		});
		
		return widget;
	};
	
	var openDrawer = function() {
		$('#trackers').slideDown();
		$(this).val("↑");

		board.updateSetting('drawerOpen', true);
	};
	
	var closeDrawer = function() {
		$('#trackers').slideUp();
		$(this).val("↓");

		board.updateSetting('drawerOpen', false);
	};
	
	var addWidgetData = function(data, trackerTitle, index) {
		// Don't re-save while re-creating widgets from storage
		if(loading) { return; }
		
		var end = state.splice(index);
		
		state = state.concat({
			'queryData': data,
			'trackerTitle': trackerTitle
		}, end);

		save();
	};
	
	var updateWidgetData = function(widget, data, trackerTitle) {
		state[$("#board .widget").index(widget)] = {
			'queryData': data,
			'trackerTitle': trackerTitle
		};
		
		save();
	};
	
	var save = function() {
		if(canUsePlusServer) {
			$.ajax({
				type: 'POST',
				dataType: 'json',
				url: 'http://' + settings.plusServer + '/board',
				data: state,
				error: function(request, status, error) {
					// Retry?
					console.log(status);
				}
			 });
			
			return;
		}
		
		if(!Modernizr.localstorage) { return; }
		
		// This could throw QUOTA_EXCEEDED_ERR, but deferring
		localStorage.setItem(boardStateKey, JSON.stringify(state));
	};
	
	var initializeDOM = function() {
		$.extend($.templates, {
			toolbarTemplate: $.tmpl('<div class="toolbar"><a href="#" class="remove">X</a><a href="#" class="edit">∆</a></div>'),
			errorTemplate: $.tmpl('<div class="body">There was an error loading this tracker</div>'),
			configurationButtons: $.tmpl('<div class="buttons"><input id="previewMenu" name="previewMenu" class="addTracker" value="Preview" type="button"><input id="goMenu" name="goMenu" class="addTracker" value="Add" type="button"></div>'),
			editButtons: $.tmpl('<div class="buttons"><input class="saveTracker" value="Update" type="button"><input class="cancel" value="Cancel" type="button"></div>')
		});

		$('#footerTemplate')
			.render($.extend(settings, meta))
			.appendTo('footer');
		
		$('#board').sortable({
			placeholder: 'ui-state-highlight dropPlaceholder',
			forcePlaceholderSize: true,
			handle: '.body',
			start: function(event, ui) {
				dragStartIndex = $("#board .widget").index(ui.item);
			},
			update: function(event, ui) {
				var dragEndIndex = $("#board .widget").index(ui.item);
				var swap = state[dragStartIndex];
				
				state[dragStartIndex] = state[dragEndIndex];
				state[dragEndIndex] = swap;
				
				save();
			}
		});
		
		$(document).bind('keydown', 'ctrl+z meta+z', function(event) {
			board.undo();
		});
	};
	
	var buildThatBoard = function() {
		$(state).each(function() {
			var item = this,
				tracker = $.grep(trackers, function(t) { return t.title == item.trackerTitle; })[0];

			if(tracker) {
				board.createWidget(tracker, item.queryData);
			}
		});
	};
	
	return {
		load : function () {

			loading = true;
			
			initializeDOM();
			
			canUsePlusServer = settings.plusServer && settings.plusServer == window.location.host;
			
			if(!readCookie('lastVisited')) {
				this.displayIntroduction();
			}
			
			createCookie('lastVisited', new Date(), 365);
			
			if(Modernizr.localstorage) {
				json = localStorage.getItem(settingsKey);

				if(json) {
					// Merge new defaults into stored settings
					settings = $.extend(settings, $.parseJSON(json));
				}
			
				if(!canUsePlusServer) {
					// Load and apply widgets
					var json = localStorage.getItem(boardStateKey);

					if(json) {
						buildThatBoard(state = $.parseJSON(json));
					}
				}
			}
			
			if(canUsePlusServer) {
				$.getJSON('http://' + settings.plusServer + '/board', function(data) {
					state = data;
					
					buildThatBoard();
				});
			}
			
			var handle = $('#trackerHandle input');
			
			if(settings.drawerOpen) {
				openDrawer.call(handle);
				
				handle.toggle(closeDrawer, openDrawer);
			} else {
				handle.toggle(openDrawer, closeDrawer);
			}
			
			pollingHandle = setInterval(this.updateWidgets, settings.refreshRate * 1000);
			
			loading = false;
		},
		
		removeWidgetData : function(widget) {
			var index = $('#board .widget').index(widget);
			var originalState = state.splice(index, 1)[0];
						
			save();
			
			undoState.push({ action:"remove", index: index, widgetState: originalState });
			
			$('#undoMessage').fadeIn();
			
			board.removeUndoMessage();
		},

		createWidget : function(tracker, queryData, index) {
			queryData = queryData || collectConfigurationData();
			
			var widget = loadWidget(tracker, queryData, '#board', index);
			
			widget
				.data({
					'tracker': tracker, 
					'data': queryData })
				.prepend('toolbarTemplate', {})
				.attr("draggable", "true");
			
			addWidgetData(queryData, tracker.title, index);
		},
		
		updateWidgets : function() {
			$('#board .widget:not(.introduction)').each(function() {
				var widget = $(this);
				var data = widget.data();
				
				loadWidget(data.tracker, data.data, widget);
			});
		},
		
		updateWidget : function(widget) {
			var queryData = collectConfigurationData(widget);
			var tracker = widget.data().tracker;
			
			loadWidget(tracker, queryData, widget);

			widget.data('data', queryData);
			
			updateWidgetData(widget, queryData, tracker.title);
		},
		
		displayPreview : function(tracker, queryData) {
			var selector = '#results';

			$(selector).empty();

			loadWidget(tracker, queryData || collectConfigurationData(), selector);
		},
		
		updateSetting : function(settingName, newValue) {
			settings[settingName] = newValue;
			
			if(!Modernizr.localstorage) { return; }
			
			// This could throw QUOTA_EXCEEDED_ERR, but deferring
			localStorage.setItem(settingsKey, JSON.stringify(settings));
		},
		
		displayIntroduction : function() {
			$('#introductionTemplate')
				.render($.extend(settings, meta))
				.appendTo('#board');
		},
		
		stopUpdating : function() {
			clearInterval(pollingHandle);
		},
		
		undo : function() {
			if(undoState.length == 0) return;
			
			var action = undoState.pop();
			
			switch(action.action) {
				case "remove":
					var item = action.widgetState;
					var tracker = $.grep(trackers, function(t) { return t.title == item.trackerTitle; })[0];

					board.createWidget(tracker, item.queryData, action.index);
				break;
			}
			
			if(undoState.length == 0) {
				$('#undoMessage').fadeOut();
			}
		},
		
		removeUndoMessage : function() {
			undoMessageDisplayHandle = setTimeout(function() {
				$('#undoMessage').fadeOut();
			}, 5000);
		},
		
		keepUndoMessage : function() {
			clearTimeout(undoMessageDisplayHandle);
		}
	};
}());


//		EVENT HANDLERS

$('.remove').live('click', function(event) {
	event.preventDefault();
	var widget = $(this).parents('.widget');
	
	board.removeWidgetData(widget);
	
	widget.fadeOut(function() { 			
		$(this).remove();
	});
});

$('.saveTracker').live('click', function() {
	board.updateWidget($(this).parents('.widget'));
});

$('.cancel').live('click', function() {
	$(this).parents('.editor').remove();
});

$('.edit').live('click', function(event) {
	event.preventDefault();
	
	var widget = $(this).parents('.widget');
	
	// Prevent adding multiple editors
	if(widget.has('.editor').length) { return; }
	
	var allData = widget.data();
	var tracker = allData.tracker;
	
	widget.prepend(
		'<div class="editor">' + tracker.configurationTemplate + '{{include "editButtons"}}</div>', 
		allData.data);
		
	enhanceNumericTextboxes(widget);
});

$('#trackers ul li').live('click', function(event) {
	event.preventDefault();
	
	var tracker = trackers[$('#trackers ul li').index(this)];
	
	$('#trackers .editor')
		.html($.render(tracker.configurationTemplate + '{{include "configurationButtons"}}', tracker.defaultData));

	enhanceNumericTextboxes('#trackers');
	
	$('#previewMenu').click(function() {
		board.displayPreview(tracker);
	});
	
	$('#goMenu').click(function() {
		board.createWidget(tracker);
	});
	
	board.displayPreview(tracker, tracker.defaultData);
});

$('#undoMessage a').live('click', function(event) {
	event.preventDefault();
	
	board.undo();
});

$('#undoMessage').live('mouseenter', function() {
	board.keepUndoMessage();
});

$('#undoMessage').live('mouseleave', function() {
	board.removeUndoMessage();
});

var enhanceNumericTextboxes = function(context) {
	// Modernizr cares if programmatic assignement of value rejects invalid data; I don't
	if(!(Modernizr.inputtypes.number || $.browser.webkit)) {
		var numberInputs = $(context).find('.editor input[type=number]');

		numberInputs.spinner({ 
			min:numberInputs.attr('min'), 
			max:numberInputs.attr('max'), 
			showOn:'always'
		});
	}
};


//		DOM INITIALIZATION

$(function() {
	$(trackers).each(function() {
		$('#trackers ul').append('<li><a href="#">' + this.title + '</a></li>');
	});
	
	board.load();
});