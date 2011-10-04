var board = (function() {
	var meta = {
		version : '0.0.3'
	};
	var settings = {
		drawerOpen : false,
		refreshRate : 10,
		plusServer : 'trackboardplus.heroku.com'
		//plusServer : '0.0.0.0:9292'
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
	
	var keyBindings = [
		{ keys: 'h shift+?', description: 'This menu', action: function() { board.displayHelp(); } },
		{ keys: 'ctrl+z meta+z', event:'keydown', description: 'Undo', action: function() { board.undo(); } },
		{ keys: 'space', event:'keydown', description: 'Opens and closes the tracker drawer', action: function(e) { $('#trackerHandle input').click(); e.preventDefault(); } },
		{ keys: 'esc', event:'keydown', description:'Hides this menu or closes the active widget editor', action: function() { board.escape(); } },
		{ keys: 'left j n', event:'keydown', description:'Moves widget selection left', action: function() { board.moveWidgetSelection('←'); } },
		{ keys: 'right k p', event:'keydown', description:'Moves widget selection right', action: function() { board.moveWidgetSelection('→'); } },
		{ keys: 'up', event:'keydown', description:'Moves tracker selection up', action: function(event) { board.moveTrackerSelection('↑', event); } },
		{ keys: 'down', event:'keydown', description:'Moves tracker selection down', action: function(event) { board.moveTrackerSelection('↓', event); } },
		{ keys: 'o e', description: 'Opens the widget editor', action: function(event) { board.openWidgetEditor(); event.preventDefault(); } },
		{ keys: 'backspace del', event:'keydown', description: 'Removes the current widget', action: function() { board.removeActiveWidget(); } }
	];
	
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
				data: JSON.stringify(state),
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
			configurationButtons: $.tmpl('<div class="buttons"><input id="previewMenu" name="previewMenu" class="addTracker" value="Preview" type="submit"><input id="goMenu" name="goMenu" class="addTracker" value="Add" type="button"></div>'),
			editButtons: $.tmpl('<div class="buttons"><input class="saveTracker" value="Update" type="submit"><input class="cancel" value="Cancel" type="button"></div>')
		});
		
		$(trackers).each(function() {
			$('#trackers ul').append('<li><a href="#">' + this.title + '</a></li>');
		});

		$('#footerTemplate')
			.render($.extend(settings, meta))
			.appendTo('footer');
		
		$('#helpTemplate')
			.render({ shortcuts:keyBindings })
			.appendTo('#container')
			.hide();
			
		$('header h1 a').click(function(event) {
			event.preventDefault();
			
			board.displayHelp();
		});
		
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

		$(keyBindings).each(function(){
			$(document).bind(this.event || 'keypress', this.keys, this.action);
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
		
		loading = false;
	};
	
	return {
		load : function () {

			loading = true;
			
			initializeDOM();
			
			canUsePlusServer = settings.plusServer && settings.plusServer == window.location.host;
			
			if(!readCookie('lastVisited')) {
				board.displayIntroduction();
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
					} else {
						loading = false;
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
		},
		
		displayHelp : function() {
			$('#helpDialog').toggle();
		},
		
		hideHelp : function() {
			$('#helpDialog').hide();
		},
		
		escape : function() {
			if($('#helpDialog:visible').length) {
				board.hideHelp();
				
				return;
			}
			
			$('.activeWidget .cancel').click();
		},
		
		moveWidgetSelection : function(direction) {
			var activeWidget = $('.activeWidget');
			var targetWidget;
			
			switch(direction) {
				case '←':
					targetWidget = activeWidget.length
						? activeWidget.prev()
						: $('#board .widget').last();
					break;
				case '→':
					targetWidget = activeWidget.length
						? activeWidget.next()
						: $('#board .widget').first();
					break;
			}
			
			activeWidget.removeClass('activeWidget');
			targetWidget.addClass('activeWidget');
		},
		
		moveTrackerSelection : function(direction, event) {
			if($('#trackerDrawer').height() == 0) return;
			
			event.preventDefault();
			
			var activeTracker = $('.activeTracker');
			
			switch(direction) {
				case '↑':
					targetTracker = activeTracker.length
						? activeTracker.prev()
						: $('#trackers li').last();
					break;
				case '↓':
					targetTracker = activeTracker.length
						? activeTracker.next()
						: $('#trackers li').first();
					break;
			}
			
			targetTracker
				.click()
				.find('a')[0].focus();
		},
		
		openWidgetEditor : function() {
			$('.activeWidget .edit').click();
		},
		
		removeActiveWidget : function() {
			$('.activeWidget .remove').click();
		}
	};
}());


//		EVENT HANDLERS

$('#board .widget').live('click', function(event) {
	if($(this).is('.activeWidget')) return;
	
	$('#board .activeWidget').removeClass('activeWidget');

	$(this).addClass('activeWidget');
});

$('.remove').live('click', function(event) {
	event.preventDefault();
	var widget = $(this).parents('.widget');
	
	board.removeWidgetData(widget);
	
	widget.fadeOut(function() { 			
		$(this).remove();
	});
});

$('#board .editor').live('submit', function(event) {
	event.preventDefault();
	
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
	
	widget
		.prepend(
			'<form class="editor">' + tracker.configurationTemplate + '{{include "editButtons"}}</form>', 
			allData.data);
	
	enhanceInputs(widget);
	
	widget
		.find('input:first, select:first')
		.focus();
});

$('#trackers ul li').live('click', function(event) {
	event.preventDefault();
	
	var tracker = trackers[$('#trackers ul li').index(this)];
	
	$('#trackers .activeTracker').removeClass('activeTracker');
	$(this).addClass('activeTracker');
	
	$('#trackers .editor')
		.html($.render(tracker.configurationTemplate + '{{include "configurationButtons"}}', tracker.defaultData))
		.unbind('submit')
		.submit(function(event) {
			event.preventDefault();
			
			board.displayPreview(tracker);
		});

	enhanceInputs('#trackers');
	
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

$('#helpDialog .closeDialog').live('click', function(event) {
	event.preventDefault();
	
	board.hideHelp();
});

var enhanceInputs = function(context) {
	// Modernizr cares if programmatic assignement of value rejects invalid data; I don't
	if(!(Modernizr.inputtypes.number || $.browser.webkit)) {
		var numberInputs = $(context).find('.editor input[type=number]');

		numberInputs.spinner({ 
			min:numberInputs.attr('min'), 
			max:numberInputs.attr('max'), 
			showOn:'always'
		});
	}
	
	if(!Modernizr.inputtypes.date) {
		var dateInputs = $(context).find('.editor input[type=date]');
		var names = dateInputs.map(function() { return $(this).attr('name'); });
		var values = dateInputs.map(function() { return $(this).val(); });
		
		dateInputs.replaceWith(function(i) { 
			return '<input type="text" class="date" name="' + names[i] + 
				'" value="' + $.datepicker.formatDate('mm/dd/yy', new Date(values[i])) + '" />'; 
		});
		
		$(context)
			.find('.editor .date')
			.datepicker({
				showAnim: "fadeIn"
			});
	}
};


//		DOM INITIALIZATION

$(board.load);