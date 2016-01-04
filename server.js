var Console = require('console').Console;
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var fs = require('fs');

// redefine console
var logfile = __dirname + '/debug.log';
var stdout = fs.createWriteStream(logfile, {flags: 'a+'});
var stderr = fs.createWriteStream(logfile, {flags: 'a+'});
var console = new Console(stdout, stderr);

var oldConsoleLog = console.log
console.log = function(){
	var args = arguments;
	var date = new Date();
	args[0] = '[' + date.toLocaleDateString() + ' ' + date.toLocaleTimeString() + ']' + args[0];
	oldConsoleLog.apply(this, arguments);
};

process.on('uncaughtException', function(err){
	console.log('unCaught exception: ' + err);
});

app.get('/*', function(req, res){
	var url = req.url;
	var pos = url.indexOf('?');
	if (pos != -1) {
		url = url.substring(0, pos);
	}
	if (url == '/') {
		url = '/index.html';
	}
	var path = __dirname + '/client' + url;
	if (fs.existsSync(path)) {
		res.sendFile(path);
	} else {
		res.writeHead(404);
		res.end();
	}
});

var ID_ROOM_MAP = {};
var ROOM_STATUS_MAP = {};
var ROOM_RECORD_MAP = {};

function getRoom(id) {
	return ID_ROOM_MAP[id];
}

function setRoom(id, room) {
	ID_ROOM_MAP[id] = room;
}

function getStatus(room, key) {
	var status = ROOM_STATUS_MAP[room];
	if (status == null) {
		return null;
	}
	if (key == null) {
		return status;
	}
	return status[key];
}

function setStatus(room, key, val) {
	var status = ROOM_STATUS_MAP[room];
	if (status == null) {
		ROOM_STATUS_MAP[room] = {};
	}
	ROOM_STATUS_MAP[room][key] = val;
}

function getRecord(room) {
	return ROOM_RECORD_MAP[room];
}

function appendRecord(room, data) {
	var record = ROOM_RECORD_MAP[room];
	if (record == null) {
		ROOM_RECORD_MAP[room] = [];
	}
	ROOM_RECORD_MAP[room].push(data);
}

function isInRoom(room, id) {
	var ids = io.sockets.adapter.rooms[room];
	if (ids == null) {
		return false;
	}
	return (ids[id] != null);
}

function getNameBySocket(socket) {
	var name = 'unknown';
	if (socket != null) {
		if (socket.name != null) {
			name = socket.name;
		} else {
			name = socket.id;
		}
	}
	return '<b>' + name + '</b>';
}

function getNameBySocketId(id) {
	var socket = io.sockets.connected[id];
	return getNameBySocket(socket);
}

function setName(socket, data) {
	var name = data.name;
	socket.name = name;
	socket.emit('data', {action: 'msg', msg: '您的昵称为: ' + name});
}

function join(socket, data) {
	var room = data.room;
	var oldRoom = getRoom(socket.id);
	if (oldRoom != null && oldRoom != room) {
		leave(socket);
	}
	socket.join(room);
	setRoom(socket.id, room);
	var msg = '进入了房间[' + room + ']'; 
	socket.broadcast.to(room).emit('data', {action: 'msg', msg: getNameBySocket(socket) + msg});
	socket.emit('data', {action: 'msg', msg: '您' + msg});
	var ids = io.sockets.adapter.rooms[room];
	for (var id in ids) {
		if (id == socket.id) {
			continue;
		}
		socket.emit('data', {action: 'msg', msg: getNameBySocketId(id) + msg});
	}
	var record = getRecord(room);
	if (record != null) {
		for (var i = 0; i < record.length; ++i) {
			socket.emit('data', record[i]);
		}
	}
}

function ready(socket, data) {
	var room = getRoom(socket.id);
	if (room == null) {
		return;
	}
	var msg = '选择了执' + ((data.color == 1) ? '黑子' : '白子');
	var key = 'player' + data.color;
	var id = getStatus(room, key);
	var flag = false;
	if (id != null) {
		if (id != socket.id && isInRoom(room, id)) {
			socket.emit('data', {action: 'msg', msg: getNameBySocketId(id) + '已经' + msg});
			return;
		}
		flag = true;
	}
	id = socket.id;
	setStatus(room, key, id);
	socket.broadcast.to(room).emit('data', {action: 'msg', msg: getNameBySocket(socket) + msg});
	socket.emit('data', {action: 'msg', msg: '您' + msg});
	var key2 = 'player' + ((data.color == 1) ? 0 : 1);
	var id2 = getStatus(room, key2);
	if (id2 != null) {
		setStatus(room, 'status', 1);
		io.sockets.in(room).emit('data', {action: 'ready', status: getStatus(room)});
		var msg = flag ? '对弈继续：' : '对弈开始：';
		if (data.color == 1) {
			msg += getNameBySocketId(id) + ' vs ' + getNameBySocketId(id2);
		} else {
			msg += getNameBySocketId(id2) + ' vs ' + getNameBySocketId(id);
		}
		
		io.sockets.in(room).emit('data', {action: 'msg', msg: msg});
	}
}

function play(socket, data) {
	var room = getRoom(socket.id);
	if (room == null) {
		return;
	}
	var status = getStatus(room, 'status');
	if (status == null) {
		socket.emit('data', {action: 'msg', msg: '请先选择好棋子颜色'});
		return;
	}
	socket.broadcast.to(room).emit('data', data);
	appendRecord(room, data);
}

function leave(socket) {
	var room = getRoom(socket.id);
	if (room == null) {
		return;
	}
	socket.leave(room);
	setRoom(socket.id, null);
	var msg = '离开了房间[' + room + ']';
	socket.broadcast.to(room).emit('data', {action: 'msg', msg: getNameBySocket(socket) + msg});
	socket.emit('data', {action: 'msg', msg: '您' + msg});
	var id0 = getStatus(room, 'player0');
	var id1 = getStatus(room, 'player1');
	if (socket.id == id0) {
		io.sockets.in(room).emit('data', {action: 'msg', msg: '执白子选手掉线/退出,请找人接替'});
	}
	if(socket.id == id1) {
		io.sockets.in(room).emit('data', {action: 'msg', msg: '执黑子选手掉线/退出,请找人接替'});
	}
}

function chat(socket, data) {
	var content = data.content;
	io.sockets.emit('data', {action: 'msg', msg: getNameBySocket(socket) + '：' + content});
}

io.on('connection', function(socket) {
	//console.log(socket.id + ': conntected...');
	socket.on('data', function(data) {
		//console.log(socket.id, data);
		switch(data.action) {
			case 'setName':
				setName(socket, data);
				break;
			case 'join':
				join(socket, data);
				break;
			case 'ready':
				ready(socket, data);
				break;
			case 'play':
				play(socket, data);
				break;
			case 'leave':
				leave(socket);
				break;
			case 'chat':
				chat(socket, data);
				break;
		}
	});
	socket.on('disconnect', function() {
		//console.log(socket.id + ': disconnect...');
	});
});

var port = 8080;
http.listen(port, function(){
	console.log('Listening on 0.0.0.0:' + port);
});