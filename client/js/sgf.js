(function ($) {
	var regSeq = /\(|\)|(;(\s*[A-Z]+(\s*((\[\])|(\[(.|\s)*?([^\\]\]))))+)*)/g;
	var regNode = /[A-Z]+(\s*((\[\])|(\[(.|\s)*?([^\\]\]))))+/g;
	var regIdent = /[A-Z]+/;
	var regProps = /(\[\])|(\[(.|\s)*?([^\\]\]))/g;
	var SGF = {};
	$.SGF = SGF;
	SGF.clean = function (str, ident) {
		var regexp = new RegExp('[^A-Z]' + ident + '((\\[\\])|(\\[(.|\\s)*?([^\\\\]\\]))+)', 'g');
		return str.replace(regexp, '');
	};
	SGF.parse = function (str) {
		var kifu = {root: {parent: null, children: [], property: {}}};
		var stack = [];
		var node = null;
		var sequence = str.match(regSeq) || []; // make sequence of elements and process it
		for (var i in sequence) {
			if (sequence[i] == '(') { // push stack, if new variant
				stack.push(node);
			} else if (sequence[i] == ')') { // pop stack at the end of variant
				node = stack.pop();
			} else { // reading node (string starting with ';')
				if (node) { // create new node
					var child = {parent: node, children: [], property: {}};
					node.children.push(child);
					node = child;
					++kifu.nodeCount;
				} else { // use root
					node = kifu.root;
				}
				var props = sequence[i].match(regNode) || []; // make array of properties
				kifu.propertyCount += props.length;
				for (var j in props) { // insert all properties to node
					var ident = regIdent.exec(props[j])[0]; // get property's identificator
					var vals = props[j].match(regProps); // separate property's values
					for (var k in vals) { // remove additional braces [ and ]
						vals[k] = vals[k].substring(1, vals[k].length - 1).replace(/\\(?!\\)/g, '');
					}
					if (ident != 'AB' && ident != 'AW' && vals.length <= 1) { // if there is only one property, strip array
						vals = vals[0];
					}
					if (node.parent) { // default node property saving
						if ($.isArray(node.property[ident])) {
							$.merge(node.property[ident], vals);
						} else {
							node.property[ident] = vals;
						}
					} else { // default root property saving
						if ($.isArray(kifu.root.property[ident])) {
							$.merge(kifu.root.property[ident], vals);
						} else {
							kifu.root.property[ident] = vals;
						}
					}
				}
			}
		}
		return kifu;
	};
	SGF.getProperty = function (node, ident) {
		var property = node.property;
		return property[ident];
	};
})(jQuery);