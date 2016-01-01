$(function () {
	// 变量定义
	var maxRow = 19; // 最大行数
	var maxCol = 19; // 最大列数
	var padding = 75; // 棋盘padding
	var borderWidth = 2; // 棋盘边框宽度
	var cellSpacing = 2; // 棋盘格子间距
	var cellWidth = 36; // 棋盘格子宽度
	var cellHeight = 36; // 棋盘格子高度
	var chessmanWidth = 36; // 棋子宽度
	var chessmanHeight = 36; // 棋子高度
	var positionLabelWidth = 36; // 坐标标签宽度
	var positionLabelHeight = 36; // 坐标标签宽度
	var starLabelWidth = 12; // 九星标签宽度
	var starLabelHeight = 12; // 九星标签高度
	var responseRadius = 0.45; // 鼠标格子响应半径
	var indicatorWidth = 16; // 指示器宽度
	var indicatorHeight = 16; // 指示器高度
	var replayDelay = 5; // 回放延时
	var positionSkipI = true; // 坐标是否跳过I
	var showStepLabel = true; // 是否在棋子上显示步数标签
	var showLibertyLabel = false; // 是否在棋子上显示气数标签
	var lock = false; // 是否锁定状态
	var rotate = 0; // 旋转角度
	var mode = 0; // 模式(0=单机,1=联机)		
	var role = -1; // 角色(-1=自由,0=白子,1=黑子,2=观看者)
	var chessmans = {}; // 棋子数据
	var baseStep = 0; // 基础步数(0=黑子先走,1=白子先走)
	var step = 0; // 当前步数
	var blackNum = 0; // 已下黑子数
	var whiteNum = 0; // 已下白子数
	var allRecords = []; // 走棋记录
	var syncRecords = {}; // 同步记录(联机断线重连数据同步用)
	var startDate = new Date();
	var socket; // socket.io实例

	// 元素定义
	var $chess = $('#chess');
	var $chessboard = $('#chess .chessboard');
	var $starLabel = $('#chess .starLabel');
	var $positionLabel = $('#chess .positionLabel');
	var $indicator = $('#chess .indicator');
	var $chessmans = $('#chess .chessmans');
	var $eventLayer = $('#chess .eventLayer');
	var $console = $('#console');
	var $consoleItem = $('#console .item');
	var $menu = $('#menu');
	var $menuButtons = $('#menu button');
	var $mode = $('#menu .mode');
	var $role = $('#menu .role');
	var $useTime = $('#menu .useTime');
	var $step = $('#menu .step');
	var $whoGo = $('#menu .whoGo');
	var $blackNum = $('#menu .blackNum');
	var $whiteNum = $('#menu .whiteNum');
	var $delay = $('#menu [name=delay]');
	var $name = $('#menu [name=name]');
	var $room = $('#menu [name=room]');
	var $chat = $('#chat');
	var $form = $('#chat form');
	var $dialog = $('#dialog');
	var $showHide = $('#showHide');

	// 函数定义
	function addToObject(obj, key1, key2, val) {
		if (obj[key1] == null) {
			obj[key1] = {};
		}
		obj[key1][key2] = val;
	}
	function removeFromObject(obj, key1, key2) {
		if (obj[key1] != null) {
			obj[key1][key2] = null;
		}
	}
	function existsInObject(obj, key1, key2) {
		return (obj[key1] != null && obj[key1][key2] != null);
	}
	function isValidPos(row, col) {
		if (row == null || col == null) {
			return false;
		}
		if (row < 1 || row > maxRow || col < 1 || col > maxCol) {
			return false;
		}
		return true;
	}
	function hasChessman(row, col) {
		return existsInObject(chessmans, row, col);
	}
	function getColorByStep(step) {
		return (baseStep + step) % 2;
	}
	function getChessmanColor(row, col) {
		if (!isValidPos(row, col)) {
			return null;
		}
		if (chessmans[row] == null || chessmans[row][col] == null) {
			return -1;
		}
		return chessmans[row][col];
	}
	function hasRecord() {
		return (allRecords.length > 0);
	}
	function getCellOffsetX(col) {
		return padding + borderWidth + cellWidth * (col - 1) + cellSpacing * (col - 1);
	}
	function getCellOffsetY(row) {
		return padding + borderWidth + cellHeight * (row - 1) + cellSpacing * (row - 1);
	}
	function getRowPositionLabel(row) {
		return (maxRow - row + 1);
	}
	function getColPositionLabel(col) {
		if (positionSkipI && col >= 9) { // skip I
			++col;
		}
		return String.fromCharCode(64 + col);
	}
	function getReadablePos(row, col) {
		return getColPositionLabel(col) + getRowPositionLabel(row);
	}
	function numToChar(num) {
		if (num <= 26) {
			return String.fromCharCode(num + 96); // a-z
		} else {
			return String.fromCharCode(num - 26 + 64); // A-Z
		}
	}
	function charToNum(char) {
		var code = char.charCodeAt(0);
		if (code > 96) {
			return code - 96; // 1-26
		} else {
			return code + 26 - 64; // 27-52
		}
	}
	function adjustPos(val) {
		var intPart = parseInt(val);
		if ((val - intPart) <= responseRadius) {
			return intPart;
		}
		if ((1 - (val - intPart)) <= responseRadius) {
			return intPart + 1;
		}
		return null;
	}
	function getPosByEventAfterAdjust(event) {
		var srcObj = event.target || event.srcElement;
		var offsetX = event.offsetX || (event.clientX - srcObj.getBoundingClientRect().left);
		var offsetY = event.offsetY || (event.clientY - srcObj.getBoundingClientRect().top);
		var row = (offsetY - padding - borderWidth) / (cellHeight + borderWidth) + 1;
		var col = (offsetX - padding - borderWidth) / (cellWidth + borderWidth) + 1;
		return [adjustPos(row), adjustPos(col)];
	}
	function getUseTime() {
		return ((new Date).getTime() - startDate.getTime());
	}
	function formatTime(time) {
		time = parseInt(time / 1000);
		var arr = [parseInt(time / 3600), parseInt(time / 60), time % 60];
		for (var i = 0; i < arr.length; ++i) {
			if (arr[i] < 10) {
				arr[i] = '0' + arr[i];
			}
		}
		return arr.join(':');
	}
	function isMyTurn() {
		return ((role == -1) || ((step + 1) % 2 == role));
	}
	function getModeName(mode) {
		return (mode == 0) ? '单机' : '联机';
	}
	function getRoleName(role) {
		switch (role) {
			case -1:
				return '自由';
				break;
			case 0:
				return '执白子';
			case 1:
				return '执黑子';
			case 2:
				return '观看者';
		}
	}
	function getNameByColor(color) {
		return (color == 1) ? '黑子' : '白子';
	}
	function createChessboard(maxRow, maxCol) {
		var str = '<table width="100%" cellspacing="' + cellSpacing + '" cellpadding="0" border="0">';
		for (var row = 1; row < maxRow; ++row) {
			str += '<tr>';
			for (var col = 1; col < maxCol; ++col) {
				str += '<td></td>';
			}
			str += '</tr>';
		}
		str += '</table>';
		$chessboard.html(str);
	}
	function createStarLabel() {
		var str = '';
		for (var row = 4; row <= maxRow; row += 6) {
			for (var col = 4; col <= maxCol; col += 6) {
				var left = getCellOffsetX(col) - starLabelWidth / 2 + cellSpacing / 2;
				var top = getCellOffsetY(row) - starLabelHeight / 2 + cellSpacing / 2;
				str += '<b style="left: ' + left + 'px; top: ' + top + 'px"></b>';
			}
		}
		$starLabel.append(str);
	}
	function createPositionLabel(maxRow, maxCol) {
		var str = '';
		var left = (padding - positionLabelWidth) / 2;
		for (var row = 1; row <= maxRow; ++row) {
			var top = getCellOffsetY(row) - positionLabelHeight / 2;
			str += '<b style="left: ' + left + 'px; top: ' + top + 'px">' + getRowPositionLabel(row) + '</b>';
			str += '<b style="right: ' + left + 'px; top: ' + top + 'px">' + getRowPositionLabel(row) + '</b>';
		}
		var top = (padding - positionLabelHeight) / 2;
		for (var col = 1; col <= maxCol; ++col) {
			var left = getCellOffsetX(col) - positionLabelWidth / 2;
			str += '<b style="top: ' + top + 'px; left: ' + left + 'px">' + getColPositionLabel(col) + '</b>';
			str += '<b style="bottom: ' + top + 'px; left: ' + left + 'px">' + getColPositionLabel(col) + '</b>';
		}
		$positionLabel.append(str);
	}
	function updateUseTime() {
		$useTime.text(formatTime(getUseTime()));
	}
	function updateStatus() {
		$step.text(step);
		$whoGo.text(getNameByColor(getColorByStep(step + 1)) + '走');
		$blackNum.text(blackNum);
		$whiteNum.text(whiteNum);
	}
	function updateMode(newMode) {
		mode = newMode;
		$mode.text(getModeName(mode));
	}
	function updateRole(newRole) {
		role = newRole;
		$role.text(getRoleName(role));
	}
	function appendLog(data, attr) {
		var str = '<div class="item"' + attr + '>';
		str += data;
		str += '</div>';
		$console.append(str);
		$console.scrollTop(99999999);
	}
	function appendChessmanLog(row, col, color, step, name, type) {
		var str = getReadablePos(row, col);
		if (str.length == 2) {
			str += (type == 'add') ? '++++' : '----';
		} else {
			str += (type == 'add') ? '+++' : '---';
		}
		str += getNameByColor(color);
		str += '@' + name;
		str += '#' + step;
		appendLog(str, ' step="' + step + '"');
	}
	function findSameColor(found, row, col, color) {
		if (getChessmanColor(row, col) != color) {
			return;
		}
		if (existsInObject(found, row, col)) {
			return;
		}
		addToObject(found, row, col, 1);
		findSameColor(found, row - 1, col, color);
		findSameColor(found, row, col + 1, color);
		findSameColor(found, row + 1, col, color);
		findSameColor(found, row, col - 1, color);
	}
	function calcOneDirectionLiberty(found, row, col) {
		var color = getChessmanColor(row, col);
		if (color != -1) {
			return 0;
		}
		if (existsInObject(found, row, col)) {
			return 0;
		}
		addToObject(found, row, col, 1);
		return 1;
	}
	function calcFourDirectionLiberty(found, row, col) {
		var liberty = 0;
		liberty += calcOneDirectionLiberty(found, row - 1, col);
		liberty += calcOneDirectionLiberty(found, row, col - 1);
		liberty += calcOneDirectionLiberty(found, row + 1, col);
		liberty += calcOneDirectionLiberty(found, row, col + 1);
		return liberty;
	}
	function calcGroupLiberty(group) {
		var liberty = 0;
		var found = {};
		for (var row in group) {
			for (var col in group[row]) {
				liberty += calcFourDirectionLiberty(found, parseInt(row), parseInt(col));
			}
		}
		return liberty;
	}
	function getChessmanId(row, col) {
		return 'cm' + row + '-' + col;
	}
	function refreshOneLiberty(row, col, name, noDeathRemove) {
		if (!isValidPos(row, col)) {
			return;
		}
		if (!hasChessman(row, col)) {
			return;
		}
		var found = {};
		findSameColor(found, row, col, getChessmanColor(row, col));
		var liberty = calcGroupLiberty(found);
		for (var row2 in found) {
			for (var col2 in found[row2]) {
				if (!noDeathRemove && liberty == 0 && hasChessman(row2, col2)) {
					eatChessman(row2, col2, name);
				} else {
					var id = getChessmanId(row2, col2);
					$chessmans.find('#' + id).find('.liberty').text(liberty);
				}
			}
		}
	}
	function refreshRelativeLiberty(row, col, name, noDeathRemove) {
		row = parseInt(row);
		col = parseInt(col);
		var all = [
			{row: row - 1, col: col},
			{row: row - 1, col: col + 1, ignore: true},
			{row: row, col: col + 1},
			{row: row + 1, col: col + 1, ignore: true},
			{row: row + 1, col: col},
			{row: row + 1, col: col - 1, ignore: true},
			{row: row, col: col - 1},
			{row: row - 1, col: col - 1, ignore: true},
		];
		for (var i = 0; i < all.length; ++i) {
			all[i].color = getChessmanColor(all[i].row, all[i].col);
		}
		var color = getChessmanColor(row, col);
		for (var i = 0; i < all.length; i += 2) {
			var j = (i + 1) % all.length;
			var k = (i + 2) % all.length;
			if (all[i].color == null || all[i].color == -1) {
				all[i].ignore = true;
				continue;
			}
			if (all[i].color == all[j].color && all[i].color == all[k].color) {
				all[i].ignore = true;
			}
			if (all[i].color == color) {
				all[i].ignore = true;
			}
		}
		for (var i = 0; i < all.length; ++i) {
			var obj = all[i];
			if (obj.ignore) {
				continue;
			}
			if (obj.color != null && obj.color != -1 && obj.color !== color) {
				refreshOneLiberty(obj.row, obj.col, name, noDeathRemove);
			}
		}
		for (var i = 0; i < all.length; ++i) {
			var obj = all[i];
			if (obj.ignore) {
				continue;
			}
			if (obj.color == color) {
				refreshOneLiberty(obj.row, obj.col, name, noDeathRemove);
			}
		}
		refreshOneLiberty(row, col, name, noDeathRemove);
	}
	function drawChessman(row, col, color, step2, noStepLabel) {
		var left = getCellOffsetX(col) - chessmanWidth / 2;
		var top = getCellOffsetY(row) - chessmanHeight / 2;
		var display = showStepLabel ? 'block' : 'none';
		var display2 = showLibertyLabel ? 'block' : 'none';
		var id = getChessmanId(row, col);
		var str = '<b id="' + id + '" step="' + step2 + '" class="color' + color + '" style="left: ' + left + 'px; top: ' + top + 'px">';
		if (!noStepLabel) {
			str += '<span class="step" style="display:' + display + '">' + step2 + '</span>';
		} else {
			str += '<span class="step" style="display:' + display + '"></span>';
		}
		str += '<span class="liberty" style="display: ' + display2 + '"></span>';
		str += '</b>';
		$chessmans.append(str);
		$chessmans.find('.focus').removeClass('focus');
		$chessmans.find('[step=' + step + ']').addClass('focus');
	}
	function addChessman(row, col, color, name, type, originalStep) {
		var noSync = true;
		var noAddStep = false;
		var noStepLabel = false;
		var noDeathRemove = false;
		switch (type) {
			case 'user-add':
				noSync = false;
				break;
			case 'rollback-add':
				break;
			case 'restore-add':
				break;
			case 'restore-add-by-B-W':
				break;
			case 'restore-add-by-AB-AW':
				noAddStep = true;
				noStepLabel = true;
				noDeathRemove = true;
				break;
			case 'sync-add':
				break;
			default:
				appendLog('invalid add type' + type);
				break;
		}
		row = parseInt(row);
		col = parseInt(col);
		if (hasChessman(row, col)) {
			appendLog(getReadablePos(row, col) + '已有棋子,添加失败!');
			return;
		}
		if (type != 'rollback-add') {
			if (!noAddStep) {
				++step;
			}
			var record = allRecords[step];
			if (record == null) {
				record = {add: [], eat: []};
				allRecords[step] = record;
			}
			record.add.push([row, col, color, name, step]);
			appendChessmanLog(row, col, color, step, name, 'add');
			drawChessman(row, col, color, step, noStepLabel);
		} else {
			drawChessman(row, col, color, originalStep, noStepLabel);
		}
		addToObject(chessmans, row, col, color);
		if (color == 1) {
			++blackNum;
		} else {
			++whiteNum;
		}
		refreshRelativeLiberty(row, col, name, noDeathRemove);
		updateStatus();
		if (!noSync) {
			sendData({action: 'play', row: row, col: col, color: color, step: step, name: name});
		}
		if (type == 'user-add') {
			playSound();
		}
	}
	function eatChessman(row, col, name) {
		row = parseInt(row);
		col = parseInt(col);
		var id = getChessmanId(row, col);
		var originalStep = $chessmans.find('#' + id).attr('step');
		var eat = allRecords[step].eat;
		var color = getChessmanColor(row, col);
		eat.push([row, col, color, name, originalStep]);
		appendChessmanLog(row, col, color, step, name, 'eat');
		removeChessman(row, col, originalStep, true);
	}
	function removeChessman(row, col, step2, byEat) {
		row = parseInt(row);
		col = parseInt(col);
		var color = getChessmanColor(row, col);
		removeFromObject(chessmans, row, col);
		if (color == 1) {
			--blackNum;
		} else {
			--whiteNum;
		}
		var id = getChessmanId(row, col);
		$chessmans.find('[id=' + id + ']').remove();
		if (!byEat) {
			--step;
			$console.find('[step=' + step2 + ']').remove();
		}
		if (step > 0) {
			$chessmans.find('.focus').removeClass('focus');
			$chessmans.find('[step=' + step + ']').addClass('focus');
		}
		updateStatus();
		refreshRelativeLiberty(row, col);
	}
	function rollback() {
		var record = allRecords.pop();
		if (record == null) {
			alert('不能后退了!');
			return;
		}
		var add = record.add;
		for (var i in add) {
			var arr = add[i];
			removeChessman(arr[0], arr[1], arr[3]);
		}
		var eat = record.eat;
		for (var i in eat) {
			var arr = eat[i];
			if (!hasChessman(arr[0], arr[1])) {
				addChessman(arr[0], arr[1], arr[2], arr[3], 'rollback-add', arr[4]);
			}
		}
	}
	function reset() {
		mode = 0;
		role = -1;
		chessmans = {};
		step = 0;
		blackNum = 0;
		whiteNum = 0;
		allRecords = [];
		syncRecords = {};
		startDate = new Date();
		updateUseTime();
		updateStatus();
		$chessmans.empty();
		$console.empty();
	}
	function setName() {
		var name = $name.val();
		if (name != '') {
			setCookie('name', name);
			sendData({action: 'setName', name: name}, true);
		}
	}
	function playSound() {
		if (!lock) {
			try {
				document.getElementById('audio').play();
			} catch (e) {

			}
		}
	}
	function setCookie(key, val) {
		$.cookie(key, val, 30 * 24 * 3600);
	}
	function getCookie(key) {
		return $.cookie(key);
	}
	function encodeToGOR(records) {
		var all = [];
		for (var i = 0; i < records.length; ++i) {
			if (records[i] == null) {
				continue;
			}
			for (var j in records[i].add) {
				var arr = records[i].add[j];
				all.push([numToChar(arr[1]), numToChar(arr[0]), arr[2]].join('_'));
			}
		}
		return all.join('/');
	}
	function decodeFromGOR(str) {
		var all = str.split('/');
		if (all == null) {
			return null;
		}
		for (var i = 0; i < all.length; ++i) {
			var arr = all[i].split('_');
			all[i] = [charToNum(arr[1]), charToNum(arr[0]), arr[2]];
		}
		return all;
	}
	function restoreFromGOR(str) {
		if (str == null || str == '') {
			alert('数据为空!');
			return;
		}
		var all = decodeFromGOR(str);
		restoreFromData(all);
	}
	function getNameFromKifu(kifu, key) {
		var root = kifu.root;
		var property = root.property;
		return property[key];
	}
	function restoreFromSGF(str) {
		if (str == null || str == '') {
			alert('数据为空!');
			return;
		}
		var kifu = $.parseSGF(str);
		var defaultName = $name.val();
		var blackName = getNameFromKifu(kifu, 'PB') || defaultName;
		var whiteName = getNameFromKifu(kifu, 'PW') || defaultName;
		var processNode = function (node) {
			var property = node.property;
			for (var k in property) {
				var val = property[k];
				switch (k) {
					case 'B':
					case 'W':
						var row = charToNum(val[1]);
						var col = charToNum(val[0]);
						var color = (k == 'B') ? 1 : 0;
						var name = (k == 'B') ? blackName : whiteName;
						addChessman(row, col, color, name, 'restore-add-by-B-W');
						break;
					case 'AB':
					case 'AW':
						var color = (k == 'AB') ? 1 : 0;
						for (var j in val) {
							var val2 = val[j];
							var row = charToNum(val2[1]);
							var col = charToNum(val2[0]);
							var name = (k == 'AB') ? blackName : whiteName;
							addChessman(row, col, color, name, 'restore-add-by-AB-AW');
						}
						break;
				}
			}
			var children = node.children;
			for (var i in children) {
				processNode(children[i]);
			}
		};
		lock = true;
		processNode(kifu.root);
		lock = false;
	}
	function restoreFromData(all) {
		if (all == null || all.length == 0) {
			alert('数据无效或数据为空!');
			return;
		}
		lock = true;
		var idx = 0;
		var name = getCookie('name') || 'user001';
		var restoreOne = function () {
			if (idx >= all.length) {
				lock = false;
				return;
			}
			var arr = all[idx];
			if (arr != null && arr.length >= 3) {
				addChessman(arr[0], arr[1], arr[2], name, 'restore-add');
			}
			++idx;
			setTimeout(restoreOne, replayDelay);
		};
		restoreOne();
	}

	// 事件绑定
	$eventLayer.mousemove(function (event) {
		if (lock) {
			return;
		}
		var arr = getPosByEventAfterAdjust(event);
		var row = arr[0];
		var col = arr[1];
		if (isValidPos(row, col) && !hasChessman(row, col) && isMyTurn()) {
			$(this).css({cursor: 'pointer'});
			var left = getCellOffsetX(col) - indicatorWidth / 2 + cellSpacing / 2;
			var top = getCellOffsetY(row) - indicatorHeight / 2 + cellSpacing / 2;
			$indicator.css({left: left, top: top});
			$indicator.show();
		} else {
			$(this).css({cursor: 'auto'});
			$indicator.hide();
		}
	});
	$eventLayer.mouseup(function (event) {
		if (lock) {
			return;
		}
		if (event.button != 0) { // 不是左键，跳过
			return;
		}
		var arr = getPosByEventAfterAdjust(event);
		var row = arr[0];
		var col = arr[1];
		if (isValidPos(row, col) && !hasChessman(row, col) && isMyTurn()) {
			var color = getColorByStep(step + 1);
			var name = $name.val();
			addChessman(row, col, color, name, 'user-add');
		}
	});
	$consoleItem.die('mouseover').live('mouseover', function () {
		var step = $(this).attr('step');
		$chessmans.find('[step=' + step + ']').addClass('hover');
	});
	$consoleItem.die('mouseout').live('mouseout', function () {
		var step = $(this).attr('step');
		$chessmans.find('[step=' + step + ']').removeClass('hover');
	});
	$form.submit(function () {
		var input = $(this).find('input');
		var content = input.val();
		if (content != '') {
			input.val('');
			sendData({action: 'chat', content: content}, true);
		}
		return false;
	});
	$menuButtons.click(function () {
		var id = $(this).attr('id');
		switch (id) {
			case 'togglePositionLabel':
				$positionLabel.toggle();
				break;
			case 'toggleStepLabel':
				showLibertyLabel = false;
				$chessmans.find('.liberty').hide();
				if (showStepLabel) {
					$chessmans.find('.step').hide();
				} else {
					$chessmans.find('.step').show();
				}
				showStepLabel = !showStepLabel;
				setCookie('showLibertyLabel', showLibertyLabel);
				setCookie('showStepLabel', showStepLabel);
				break;
			case 'toggleLibertyLabel':
				showStepLabel = false;
				$chessmans.find('.step').hide();
				if (showLibertyLabel) {
					$chessmans.find('.liberty').hide();
				} else {
					$chessmans.find('.liberty').show();
				}
				showLibertyLabel = !showLibertyLabel;
				setCookie('showLibertyLabel', showLibertyLabel);
				setCookie('showStepLabel', showStepLabel);
				break;
			case 'rotateRight':
				rotate += 90;
				$chess.css({rotate: rotate});
				break;
			case 'rotateLeft':
				rotate -= 90;
				$chess.css({rotate: rotate});
				break;
			case 'restore':
				if (lock) {
					alert('恢复正在进行中!');
					return;
				}
				if (mode != 0) {
					alert('联机模式不适用!');
					return;
				}
				if (hasRecord() && !window.confirm('恢复上次数据会清掉当前已有数据，确定要继续吗？')) {
					return;
				}
				var str = getCookie('lastRecords');
				restoreFromGOR(str);
				break;
			case 'loadSGF':
				$dialog.show().fixedInCenter();
				break;
			case 'reset':
				if (lock) {
					alert('请等待恢复完成!');
					return;
				}
				if (mode != 0) {
					alert('联机模式不适用!');
					return;
				}
				if (hasRecord() && !window.confirm('重置数据会清掉当前已有数据，确定要继续吗？')) {
					return;
				}
				reset();
				break;
			case 'rollback':
				if (lock) {
					alert('请等待恢复完成!');
					return;
				}
				if (mode != 0) {
					alert('联机模式不适用!');
					return;
				}
				rollback();
				break;
			case 'join':
				if (hasRecord() && !window.confirm('加入房间会清掉当前已有数据，确定要继续吗？')) {
					return;
				}
				reset();
				updateMode(1);
				updateRole(2);
				var room = $room.val();
				sendData({action: 'join', room: room});
				break;
			case 'ready1':
				if (mode != 1) {
					alert('请先加入房间!');
					return;
				}
				sendData({action: 'ready', color: 1});
				break;
			case 'ready0':
				if (mode != 1) {
					alert('请先加入房间!');
					return;
				}
				sendData({action: 'ready', color: 0});
				break;
			case 'leave':
				if (mode != 1) {
					alert('未加入房间!');
					return;
				}
				sendData({action: 'leave'});
				updateMode(0);
				updateRole(-1);
				break;
		}
	});
	$delay.change(function () {
		replayDelay = $(this).val();
		setCookie('replayDelay', replayDelay);
	});
	$name.change(function () {
		setName();
	});
	$dialog.find('button').click(function () {
		var name = $(this).attr('name');
		switch (name) {
			case 'load':
				if (hasRecord() && !window.confirm('载入棋谱会清掉当前已有数据，确定要继续吗？')) {
					return;
				}
				reset();
				var str = $dialog.find('textarea').val();
				$dialog.hide();
				restoreFromSGF(str);
				break;
			case 'clean':
				var str = $dialog.find('textarea').val();
				$dialog.find('textarea').val($.cleanSGF(str, 'C'));
				alert('清理完毕!');
				break;
			case 'close':
				$dialog.hide();
				break;
		}
	});
	$showHide.click(function () {
		$console.show();
		$menu.show();
		$chat.show();
		$showHide.hide();
	});
	window.onresize = function () {
		if ($(window).width() > $chess.width() + 600) {
			$console.show();
			$menu.show();
			$chat.show();
			$showHide.hide();
		} else {
//			$console.hide();
//			$menu.hide();
//			$chat.hide();
//			$showHide.show();
		}
	};
	window.onunload = function () {
		var str = encodeToGOR(allRecords);
		if (str != '') {
			setCookie('lastRecords', str);
		}
	};

	// cookie处理
	replayDelay = getCookie('replayDelay') || 5;
	$delay.val(replayDelay);
	showStepLabel = (getCookie('showStepLabel') == 'true');
	showLibertyLabel = (getCookie('showLibertyLabel') == 'true');
	if (showStepLabel && showLibertyLabel) {
		showLibertyLabel = false;
	}
	if (!showStepLabel && !showLibertyLabel) {
		showStepLabel = true;
	}
	var name = getCookie('name');
	if (name == null) {
		name = 'user' + Math.random().toString().substr(-3);
	}
	$name.val(name);

	// 相关初始化
	if (location.search) {
		var m = location.search.match(/size=([0-9]+)/);
		if (m) {
			maxRow = maxCol = m[1];
		}
	}
	var windowHeight = $(window).height();
	var minBoardHeight = borderWidth * 2 + cellHeight * (maxRow - 1) + cellSpacing * maxRow;
	if (windowHeight > minBoardHeight + padding * 2) {
		var margin = (windowHeight - minBoardHeight - padding * 2) / 2;
		$chess.css({'margin-top': margin});
	} else if (windowHeight > minBoardHeight + positionLabelHeight * 2) {
		var margin = (windowHeight - minBoardHeight - positionLabelHeight * 2) / 2;
		padding = positionLabelHeight;
		$chess.css({'margin-top': margin});
	} else {
		padding = positionLabelHeight;
	}
	var width = borderWidth * 2 + cellWidth * (maxCol - 1) + cellSpacing * maxCol;
	$chess.css({width: width, padding: padding});
	$chessboard.css({'border-width': borderWidth});
	createChessboard(maxRow, maxCol);
	createStarLabel(maxRow, maxCol);
	createPositionLabel(maxRow, maxCol);
	setInterval(updateUseTime, 1000);
	$(window).resize();

	// socket.io相关处理
	socket = io();
	function sendData(data, skipModeCheck) {
		if (!skipModeCheck && mode != 1) {
			return;
		}
		if (socket == null || !socket.connected) {
			alert('socket未创建或未连接');
			return;
		}
		socket.emit('data', data);
	}
	socket.on('connect', function () {
		appendLog('socket连接成功：SID：' + socket.id);
		$menuButtons.filter('[disabled]').removeAttr('disabled');
		setName();
	});
	socket.on('error', function (err) {
		appendLog('socket连接失败：' + err);
	});
	socket.on('data', function (data) {
		switch (data.action) {
			case 'msg':
				appendLog(data.msg);
				break;
			case 'ready':
				var player0 = data.status.player0;
				var player1 = data.status.player1;
				if (socket.id == player0 && socket.id == player1) {
					updateRole(-1);
				} else if (socket.id == player0) {
					updateRole(0);
				} else if (socket.id == player1) {
					updateRole(1);
				} else {
					updateRole(2);
				}
				break;
			case 'play':
				var step2 = data.step;
				if (step2 == step + 1) {
					addChessman(data.row, data.col, data.color, data.name, 'sync-add');
				} else if (step2 > step + 1) {
					syncRecords[step2] = data;
				}
				lock = true;
				do {
					++step2;
					var data = syncRecords[step2];
					if (data == null) {
						break;
					}
					addChessman(data.row, data.col, data.color, data.name, 'sync-add');
					syncRecords[step2] = null;
				} while (true);
				lock = false;
				break;
		}
	});
});