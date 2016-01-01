(function ($) {
	$.extend({
		cookie: function (key, val, ttl, path, domain) {
			if (val != null) { // set
				var arr = [];
				arr.push(key + '=' + escape(val));
				if (ttl) {
					var date = new Date();
					date.setTime(date.getTime() + ttl);
					arr.push('expires=' + date.toGMTString());
				}
				if (path) {
					arr.push('path=' + path);
				}
				if (domain && domain != 'localhost') {
					arr.push('domain=' + domain);
				}
				document.cookie = arr.join('; ') + ';';
			} else { // get
				var arr = document.cookie.split("; ");
				for (var i = 0; i < arr.length; ++i) {
					var pair = arr[i].split("=");
					if (key == pair[0]) {
						return unescape(pair[1]);
					}
				}
				return null;
			}
		}
	});
	$.fn.fixedInCenter = function (opts) {
		var defaultOpts = {delay: 25};
		$.extend(opts, defaultOpts);
		return this.each(function () {
			var w = $(window);
			var t = $(this);
			var timer;
			if ($.browser.msie && $.browser.version == '6.0') {
				t.css('position', 'absolute');
				var move = function () {
					if (timer && t.css('display') == 'none') {
						clearInterval(timer);
					}
					t.css({
						left: w.width() / 2 - t.outerWidth() / 2 + w.scrollLeft(),
						top: w.height() / 2 - t.outerHeight() / 2 + w.scrollTop()
					});
				};
				timer = setInterval(move, opts.delay);
			} else {
				t.css('position', 'fixed');
				t.css({
					left: w.width() / 2 - t.outerWidth() / 2,
					top: w.height() / 2 - t.outerHeight() / 2
				});
			}
		});
	};
})(jQuery);
