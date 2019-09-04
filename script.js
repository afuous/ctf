(function() {

	var getElem = function(id) {
		return document.getElementById(id);
	};

	var socket = io.connect();

	var canvas = getElem("canvas");
	var ctx = canvas.getContext("2d");

	ctx.fillCircle = function(x, y, radius) {
		ctx.beginPath();
		ctx.arc(x, y, radius, 0, Math.PI * 2);
		ctx.fill();
	};

	var LEFT = 0;
	var RIGHT = 1;
	var UP = 2;
	var DOWN = 3;
	var CENTER = 4;

	var RED = 0;
	var BLUE = 1;

	var playing = false;

	var redScore = 0;
	var blueScore = 0;

	var lastUpdate;
	var gameId;

	var fps = 60;

	function setBorder(size) {
		canvas.style.border = size + "px solid black";
	}
	var borderSize = 6;
	setBorder(borderSize);

	document.oncontextmenu = function() {
		return false;
	};

	var keys = {};
	window.onkeydown = function(event) {
		if (!playing) return;
		if (getElem("chatInput") == document.activeElement) return;
		var key = (event || window.event).keyCode;
		if (keys[key]) return;
		keys[key] = true;
		if (key == 37 || key == 65) {
			physics.keyDown(getSelf(), LEFT);
			socket.emit("keyDown", LEFT);
		} else if (key == 39 || key == 68) {
			physics.keyDown(getSelf(), RIGHT);
			socket.emit("keyDown", RIGHT);
		} else if (key == 38 || key == 87) {
			physics.keyDown(getSelf(), UP);
			socket.emit("keyDown", UP);
		} else if (key == 40 || key == 83) {
			physics.keyDown(getSelf(), DOWN);
			socket.emit("keyDown", DOWN);
		}
	};
	window.onkeyup = function(event) {
		if (!playing) return;
		var key = (event || window.event).keyCode;
		if (getElem("chatInput") == document.activeElement) return;
		if (!keys[key]) return;
		keys[key] = false;
		if (key == 37 || key == 65) {
			physics.keyUp(getSelf(), LEFT);
			socket.emit("keyUp", LEFT);
		} else if (key == 39 || key == 68) {
			physics.keyUp(getSelf(), RIGHT);
			socket.emit("keyUp", RIGHT);
		} else if (key == 38 || key == 87) {
			physics.keyUp(getSelf(), UP);
			socket.emit("keyUp", UP);
		} else if (key == 40 || key == 83) {
			physics.keyUp(getSelf(), DOWN);
			socket.emit("keyUp", DOWN);
		} else if (key == 84) {
			getElem("chatInput").focus();
		}
	};

	function getName() {
		var name = getElem("name").value;
		localStorage.name = name;
		return name;
	}

	getElem("join").onclick = function() {
		socket.emit("join", {
			gameId: getElem("gameId").value,
			name: getName(),
		});
		return false;
	};
	getElem("create").onclick = function() {
		socket.emit("create", {
			name: getName(),
		});
	};

	getElem("name").focus();
	if (localStorage.name) {
		getElem("name").value = localStorage.name;
	}

	getElem("gameId").value = window.location.pathname.substring(1);

	socket.on("invalidName", function(obj) {
		alert(obj.message);
	});

	socket.on("invalidGameId", function(obj) {
		alert(obj.message);
	});

	function show() {
		var allScreens = [
			"introScreen",
			"gameScreen",
			"topRow",
			"chat",
		];
		for (var i = 0; i < allScreens.length; i++) {
			getElem(allScreens[i]).style.display = "none";
		}
		for (var i = 0; i < arguments.length; i++) {
			getElem(arguments[i]).style.display = "block";
		}
	}

	socket.on("start", function(obj) {
		playing = true;
		gameId = obj.gameId;
		if (gameId) {
			getElem("gameIdDisplay").innerHTML = "Game ID: <span class='selectable'>" + gameId + "</span>";
			window.history.pushState({}, null, "/" + gameId);
		}
		conf = obj.conf;
		show("gameScreen", "topRow", "chat");
		clearInterval(interval);
		interval = setInterval(function() {
			while (lastUpdate + conf.tickTime < Date.now()) {
				physics.run(players, conf);
				lastUpdate += conf.tickTime;
			}
			if (document.hasFocus()) {
				requestAnimationFrame(draw);
			}
		}, 1000 / fps);
		lastUpdate = Date.now();
	});

	socket.on("disconnect", function() {
		show("introScreen", "nameDisplay");
		clearInterval(interval);
		playing = false;
	});

	socket.on("update", function(obj) {
		players = obj.players;
		redScore = obj.redScore;
		blueScore = obj.blueScore;
		lastUpdate = lastUpdate;
	});

	getElem("chatForm").onsubmit = function() {
		var chatInput = getElem("chatInput");
		socket.emit("message", chatInput.value);
		chatInput.value = "";
		chatInput.blur();
	};

	function sanitize(str) {
		return str
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;");
	}

	socket.on("message", function(obj) {
		var sender;
		for (var i = 0; i < players.length; i++) {
			if (players[i].name == obj.author) {
				sender = players[i];
			}
		}
		if (!sender) return;
		var color = sender.team == RED ? "red" : "blue";
		var author = sanitize(obj.author);
		var content = sanitize(obj.content);
		var messages = getElem("chatMessages");
		var span = document.createElement("span");
		span.innerHTML = "<font color='" + color + "'><b>" + author + "</b> " + content + "</font><br>";
		messages.appendChild(span);
		if (messages.scrollHeight > messages.clientHeight) {
			if (messages.scrollTop + messages.clientHeight + 100 > messages.scrollHeight) {
				messages.scrollTop = messages.scrollHeight - messages.clientHeight;
			}
		}
	});

	var players = [];
	var interval;
	var conf;

	function getSelf() {
		for (var i = 0; i < players.length; i++) {
			if (players[i].isSelf) {
				return players[i];
			}
		}
	}

	function draw() {

		var chat = getElem("chat");
		var topRow = getElem("topRow");

		chat.style.top = topRow.clientHeight + 30;
		getElem("chatMessages").style.height = window.innerHeight - 100
			- getElem("topRow").clientHeight - getElem("chatInput").clientHeight;

		canvas.width = (window.innerWidth - chat.clientWidth) * 0.9;
		canvas.height = canvas.width * conf.height / conf.width;

		var maxHeight = window.innerHeight;
		maxHeight -= topRow.clientHeight;
		maxHeight -= 30;
		if (canvas.height > maxHeight) {
			canvas.width *= maxHeight / canvas.height;
			canvas.height = maxHeight;
		}
		canvas.style.top = topRow.clientHeight + (maxHeight - canvas.height) / 2;
		canvas.style.left = (window.innerWidth + chat.clientWidth - canvas.width) / 2;

		var scale = canvas.width / conf.width;
		function fillRect(x, y, w, h) {
			return ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
		}
		function fillCircle(x, y, r) {
			return ctx.fillCircle(x * scale, y * scale, r * scale);
		}

		setBorder(borderSize * scale);

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		ctx.fillStyle = "black";
		fillRect(conf.width / 2 - 3, 0, borderSize, conf.height);
		ctx.fillStyle = "red";
		fillCircle(conf.flag.offset + conf.flag.radius, conf.height / 2, conf.flag.radius);
		ctx.fillStyle = "blue";
		fillCircle(conf.width - conf.flag.offset - conf.flag.radius, conf.height / 2, conf.flag.radius);
		var redFlagTaken = false;
		var blueFlagTaken = false;
		for (var i = 0; i < players.length; i++) {
			var player = players[i];
			if(player.team == RED && player.hasFlag) blueFlagTaken = true;
			if(player.team == BLUE && player.hasFlag) redFlagTaken = true;
		}
		ctx.fillStyle = "black";
		if (!redFlagTaken) {
			fillCircle(conf.flag.offset + conf.flag.radius, conf.height / 2, conf.flag.radius / 2);
		}
		if (!blueFlagTaken) {
			fillCircle(conf.width - conf.flag.offset - conf.flag.radius, conf.height / 2, conf.flag.radius / 2);
		}
		var table = document.createElement("table");
		table.appendChild(getRow(["", "Scores", "Tags", "Tagged", "Rating"]));
		for (var i = 0; i < players.length; i++) {
			var player = players[i];
			ctx.fillStyle = player.isSelf ? "black" : (player.team == RED ? "red" : "blue");
			fillCircle(player.x, player.y, conf.radius);
			if (player.isSelf) {
				ctx.fillStyle = player.team == RED ? "red" : "blue";
				if (!player.hasFlag) {
					fillCircle(player.x, player.y, conf.radius / 2);
				}
			} else {
				ctx.fillStyle = "black";
				if (player.hasFlag) {
					fillCircle(player.x, player.y, conf.radius / 2);
				}
				ctx.font = 14 * scale + "px Arial";
				ctx.textAlign = "center";
				var x = player.x;
				var y = player.y;
				var offset = 18;
				x = player.x;
				if (y > 50) {
					y -= offset;
				} else {
					y += offset + 10;
				}
				if (x < ctx.measureText(player.name).width / 2) {
					x = 5;
					ctx.textAlign = "left";
				} else if (x > conf.width - ctx.measureText(player.name).width / 2) {
					x = conf.width - 5;
					ctx.textAlign = "right";
				}
				ctx.fillText(player.name, x * scale, y * scale);
			}
			rating = 2 * player.scores + player.tags - 2 * player.tagged;
			table.appendChild(getRow([player.name, player.scores, player.tags, player.tagged, rating], player.team == RED ? "#ffdddd" : "#ddddff"));
		}
		getElem("stats").innerHTML = "";
		getElem("stats").appendChild(table);
		getElem("redScore").innerHTML = redScore;
		getElem("blueScore").innerHTML = blueScore;
	}

	function getRow(cells, background) {
		if (!background) background = "white";
		var tr = document.createElement("tr");
		tr.style.backgroundColor = background;
		for (var i = 0; i < cells.length; i++) {
			var td = document.createElement("td");
			td.width = "100";
			td.style.fontSize = "16px";
			td.innerHTML = sanitize(String(cells[i]));
			tr.appendChild(td);
		}
		return tr;
	}

})();
