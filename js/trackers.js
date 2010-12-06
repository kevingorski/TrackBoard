function Tracker(title, configurationTemplate, defaultData, template, process) {
	var me = this;
	
	this.title = title;
	this.configurationTemplate = '<fieldset>' + configurationTemplate + '</fieldset>';
	this.defaultData = defaultData;
	this.template = '<div class="body">' + template + '</div>';
	this.process = function() { return process.apply(me, arguments); }
}

function JsonpTracker(title, configurationTemplate, defaultData, template, configureAjax) {
	var base = new Tracker(title, configurationTemplate, defaultData, template, 
		function(target, queryData, markComplete) {
			var error = function(request, status, error) {
				if(status) {
					markComplete();

					target.append('errorTemplate', {});
				}
			};
			
			$.ajax(
				$.extend({
					dataType: "jsonp",
					error: error
				}, 
				configureAjax(this, target, queryData, markComplete)));
		});
	
	return base;
}

function YqlTracker(title, configurationTemplate, defaultData, formatQuery, template) {
	var base = new JsonpTracker(title, configurationTemplate, defaultData, template,
		function(tracker, target, queryData, markComplete) {
			return {
				url: 'http://query.yahooapis.com/v1/public/yql',
				data: { q: tracker.formatQuery(queryData), format:'json' },
				success: function(data){
					markComplete();
					
					if(data && data.query && data.query.count > 0) {
						target.append(base.template, $.extend(queryData, data.query.results));
					} else {	
						target.append('errorTemplate', {});
					}

					target.fadeTo(1, 1);
				}
			};
		});
		
	base.formatQuery = formatQuery;
	
	return base;
}

var trackers = [
	new YqlTracker(
		"RSS Feed",
		'<div><label>Title:</label><input name="title" type="text" value="${title}" /></div>' +
			'<div><label>RSS:</label><input name="rssUrl" value="${rssUrl}" type="url" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="50" /></div>',
		{ title: "Yahoo Top Stories", rssUrl: "http://rss.news.yahoo.com/rss/topstories", limit: 3 },
		function(data) { return 'select * from rss(0,' + data.limit + ') where url="' + data.rssUrl + '"'; },
		'<h3>${title}</h3><ol>{{each item}}<li><a href="${link}">${title}</a></li>{{/each}}</ol>'),

	new JsonpTracker(
		"Twitter Search", 
		'<div><label>Search:</label><input name="searchTerm" type="text" value="${searchTerm}" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="100" /></div>', 
		{ searchTerm: "#newTwitter", limit: 5 }, 
		'<h3>Twitter Search: ${unescape(query)}</h3>' +
			'<ol class="TwitterSearch">{{each results}}<li><img src="${profile_image_url}" alt="${from_user}" /><a href="http://twitter.com/${from_user}">${from_user}</a>: {{html ify.clean(text)}}</li>{{/each}}</ol>',
		function(tracker, target, queryData, markComplete) {
			var refresh_url = $(tracker).data('refresh_url');
			var url = 'http://search.twitter.com/search.json';
			var data = {
				result_type : "recent",
				rpp : queryData.limit,
				q : queryData.searchTerm
			};

			if(refresh_url && refresh_url.match(new RegExp('q=' + escape(queryData.searchTerm)))) {
				url = refresh_url;
				data = {};
			}
			
			return { 
				url: url,
				data: data,
				success: function(data) {
					markComplete();

					target
						.data('refresh_url', data.refresh_url)
						.append(tracker.template, data)
						.fadeTo(1, 1);
				}
			};
		}),

	new JsonpTracker(
		"Google Blog Search",
		'<div><label>Search:</label><input name="searchTerm" type="text" value="${searchTerm}" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="8" /></div>', 
		{ searchTerm: "googlewhack", limit: 5 }, 
		'<h3>Google Blog Search: ${searchTerm}</h3>' +
			'<ol>{{each results}}<li><h3><a href="${url}">{{html title}}</a></h3>{{html content}}</li>{{/each}}</ol>', 
		function(tracker, target, queryData, markComplete) {
			return {
				url: "http://www.google.com/uds/GblogSearch",
				data: { v:"1.0", scoring:'d', rsz:queryData.limit, q:queryData.searchTerm },
				success: function(data) {
					markComplete();

					target
						.append(tracker.template, $.extend(queryData, data.responseData))
						.fadeTo(1, 1);
				}
			};
		}),
		
	new JsonpTracker(
		"Google News Search",
		'<div><label>Search:</label><input name="searchTerm" type="text" value="${searchTerm}" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="8" /></div>', 
		{ searchTerm: "war", limit: 5 }, 
		'<h3>Google News Search: ${searchTerm}</h3>' +
			'<ol>{{each results}}<li><h3><a href="${url}">{{html title}}</a></h3>{{html content}}</li>{{/each}}</ol>', 
		function(tracker, target, queryData, markComplete) {
			return {
				url: "http://www.google.com/uds/GnewsSearch",
				data: { v:"1.0", scoring:'d', rsz:queryData.limit, q:queryData.searchTerm },
				success: function(data) {
					markComplete();

					target
						.append(tracker.template, $.extend(queryData, data.responseData))
						.fadeTo(1, 1);
				}
			};
		}),
		
	new JsonpTracker(
		"GitHub Project Commits",
		'<div><label>User:</label><input name="userName" type="text" value="${userName}" /></div>' +
			'<div><label>Repository:</label><input name="repository" type="text" value="${repository}" /></div>' +
			'<div><label>Branch:</label><input name="branch" type="text" value="${branch}" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="35" /></div>',
		{ userName: 'git', repository: 'git', branch: 'master', searchType:'commits', limit: 5 },
		'<h3>Commits for ${userName}/${repository}:${branch}</h3>' +
			'<ol>{{each commits}}<li><a href="${url}">${prettyDate(committed_date)}</a> - ${author.name}: ${message}</li>{{/each}}</ol>',
		function(tracker, target, queryData, markComplete) {
			return {
				url: "http://github.com/api/v2/json/commits/list/" + queryData.userName + "/" + queryData.repository + "/" + queryData.branch,
				success: function(data) {
					markComplete();
					
					data.commits = data.commits.slice(0, queryData.limit);
					
					target
						.append(tracker.template, $.extend(queryData, data))
						.fadeTo(1, 1);
				}
			};
		}),

	new JsonpTracker(
		"GitHub Project Issues",
		'<div><label>User:</label><input name="userName" type="text" value="${userName}" /></div>' +
			'<div><label>Repository:</label><input name="repository" type="text" value="${repository}" /></div>' +
			'<div><label>Limit:</label><input name="limit" type="number" value="${limit}" min="1" max="35" /></div>',
		{ userName: 'git', repository: 'git', branch: 'master', searchType:'commits', limit: 5 },
		'<h3>Issues for ${userName}/${repository}</h3>' +
			'<ol>{{each issues}}<li>${prettyDate(created_at)} - ${user}: ${title}</li>{{/each}}</ol>',
		function(tracker, target, queryData, markComplete) {
			return {
				url: "http://github.com/api/v2/json/issues/list/" + queryData.userName + "/" + queryData.repository + "/open",
				success: function(data) {
					markComplete();

					data.issues = data.issues.reverse().slice(0, queryData.limit);

					target
						.append(tracker.template, $.extend(queryData, data))
						.fadeTo(1, 1);
				}
			};
		}),
		
	new Tracker(
		"Target Date", 
		'<div><label>Target Date:</label><input name="targetDate" type="date" value="${targetDate}" /></div>' +
			'<div><label>Title:</label><input name="title" type="text" value="${title}" /></div>',
		{ targetDate: $.datepicker.formatDate('mm/dd/yy', new Date()), title:'Important Deadline' },
		'<h3>${title}</h3><span class="count">${days}</span> days ${description}',
		function(target, queryData, markComplete) {
			markComplete();
			
			var date = new Date(queryData.targetDate.toString().replace(/-\d{2}:\d{2}/g," ").replace(/[TZ]/g," ")),
				diff = (((new Date()).getTime() - date.getTime()) / 1000),
				days = Math.floor(diff / 86400);

			if (isNaN(days))
				return;
			
			queryData.days = Math.abs(days);
			queryData.description = days > 0 ? " days ago" : " days left";
			
			target
				.append(this.template, queryData)
				.fadeTo(1,1);
		}),
			
	new YqlTracker(
		"Weather",
		'<div><label>Zip Code:</label><input name="zipCode" type="text" value="${zipCode}" /></div>' +
			'<div><label>Current:</label><input name="currentConditions" type="checkbox" checked="${currentConditions}" /></div>' +
			'<div><label>Forecast:</label><input name="forecast" type="checkbox" checked="${forecast}" /></div>',
		{ zipCode: "80301", currentConditions: true, forecast: true },
		function(data) { return 'select * from weather.forecast where location=' + data.zipCode; },
		'<h3>Weather in ${channel.location.city}, ${channel.location.region}</h3>' +
			
			'{{if currentConditions}}<h4>Current Conditions</h4>' +
				'<ol><li><strong>${channel.item.condition.temp}&deg; ${channel.units.temperature}</strong>' +
				'{{if channel.item.condition.temp != channel.wind.chill}} ${channel.wind.chill}&deg; ${channel.units.temperature} wind chill{{/if}}</li>' +
				'<li>${channel.wind.speed} ${channel.units.speed} wind, ${channel.atmosphere.humidity}% humidity</li>' +
				'</ol>{{/if}}' +
		
			'{{if forecast}}<h4>Forecast</h4>' +
				'<ol>{{each channel.item.forecast}}' +
					'<li><h4>${day}: ${high}&deg; ${channel.units.temperature} / ${low}&deg; ${channel.units.temperature}</h4>${text}</li>' +
				'{{/each}}</ol>{{/if}}'
	)
];