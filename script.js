(function() {
	var dgid = function(id) {
		return document.getElementById(id);
	};

	var socket = io.connect();

	var canvas = dgid("canvas");
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

	document.oncontextmenu = function() {
		return false;
	};

	window.onkeydown = function(event) {
		if(!playing) return;
		var key = (event || window.event).keyCode;
		var now = Date.now();
		if(key == 37 || key == 65) {
			physics.keyDown(getSelf(), LEFT);
			socket.emit("keyDown", LEFT);
		}
		else if(key == 39 || key == 68) {
			physics.keyDown(getSelf(), RIGHT);
			socket.emit("keyDown", RIGHT);
		}
		else if(key == 38 || key == 87) {
			physics.keyDown(getSelf(), UP);
			socket.emit("keyDown", UP);
		}
		else if(key == 40 || key == 83) {
			physics.keyDown(getSelf(), DOWN);
			socket.emit("keyDown", DOWN);
		}
	};
	window.onkeyup = function(event) {
		if(!playing) return;
		var key = (event || window.event).keyCode;
		var now = Date.now();
		if(key == 37 || key == 65) {
			physics.keyUp(getSelf(), LEFT);
			socket.emit("keyUp", LEFT);
		}
		else if(key == 39 || key == 68) {
			physics.keyUp(getSelf(), RIGHT);
			socket.emit("keyUp", RIGHT);
		}
		else if(key == 38 || key == 87) {
			physics.keyUp(getSelf(), UP);
			socket.emit("keyUp", UP);
		}
		else if(key == 40 || key == 83) {
			physics.keyUp(getSelf(), DOWN);
			socket.emit("keyUp", DOWN);
		}
	};

	dgid("red").onclick = function() {
		socket.emit("join", {
			name: dgid("name").value,
			team: RED
		});
		return false;
	};
	dgid("blue").onclick = function() {
		socket.emit("join", {
			name: dgid("name").value,
			team: BLUE
		});
		return false;
	};

	dgid("name").focus();

	socket.on("start", function(obj) {
		if(obj.valid) {
			playing = true;
			game = obj.game;
			canvas.width = game.width;
			canvas.height = game.height;
			dgid("table").width = game.width;
			dgid("join").style.display = "none";
			dgid("game").style.display = "block";
			dgid("stats").style.display = "block";
			clearInterval(interval);
			interval = setInterval(function() {
				while(lastUpdate + game.tickTime < Date.now()) {
					physics.run(players, game);
					lastUpdate += game.tickTime;
				}
				draw();
			}, game.tickTime);
			lastUpdate = Date.now();
		}
		else {
			alert("Duplicate name");
		}
	});

	socket.on("disconnect", function() {
		dgid("join").style.display = "block";
		dgid("game").style.display = "none";
		dgid("stats").style.display = "none";
		clearInterval(interval);
		playing = false;
	});

	socket.on("update", function(obj) {
		players = obj.players;
		redScore = obj.redScore;
		blueScore = obj.blueScore;
		lastUpdate = lastUpdate;
	});

	var players = [];
	var interval;
	var game;

	function getSelf() {
		for(var i = 0; i < players.length; i++) {
			if(players[i].isSelf) {
				return players[i];
			}
		}
	}

	function draw() {
		ctx.clearRect(0, 0, game.width, game.height);
		ctx.fillStyle = "black";
		ctx.fillRect(game.width / 2 - 3, 0, 6, game.height);
		ctx.fillStyle = "red";
		ctx.fillCircle(game.flag.offset + game.flag.radius, game.height / 2, game.flag.radius);
		ctx.fillStyle = "blue";
		ctx.fillCircle(game.width - game.flag.offset - game.flag.radius, game.height / 2, game.flag.radius);
		var redFlagTaken = false;
		var blueFlagTaken = false;
		for(var i = 0; i < players.length; i++) {
			var player = players[i];
			if(player.team == RED && player.hasFlag) blueFlagTaken = true;
			if(player.team == BLUE && player.hasFlag) redFlagTaken = true;
		}
		ctx.fillStyle = "black";
		if(!redFlagTaken) ctx.fillCircle(game.flag.offset + game.flag.radius, game.height / 2, game.flag.radius / 2);
		if(!blueFlagTaken) ctx.fillCircle(game.width - game.flag.offset - game.flag.radius, game.height / 2, game.flag.radius / 2);
		var table = document.createElement("table");
		table.appendChild(getRow(["", "Scores", "Tags", "Tagged", "Rating"]));
		for(var i = 0; i < players.length; i++) {
			var player = players[i];
			ctx.fillStyle = player.isSelf ? "black" : (player.team == RED ? "red" : "blue");
			ctx.fillCircle(player.x, player.y, game.radius);
			if(player.isSelf) {
				ctx.fillStyle = player.team == RED ? "red" : "blue";
				if(!player.hasFlag) {
					ctx.fillCircle(player.x, player.y, game.radius / 2);
				}
			}
			else {
				ctx.fillStyle = "black";
				if(player.hasFlag) {
					ctx.fillCircle(player.x, player.y, game.radius / 2);
				}
				ctx.font = "14px Arial";
				ctx.textAlign = "center";
				var x = player.x;
				var y = player.y;
				var offset = 18;
				x = player.x;
				if(y > 50) {
					y -= offset;
				}
				else {
					y += offset + 10;
				}
				if(x < ctx.measureText(player.name).width / 2) {
					x = 5;
					ctx.textAlign = "left";
				}
				else if(x > game.width - ctx.measureText(player.name).width / 2) {
					x = game.width - 5;
					ctx.textAlign = "right";
				}
				ctx.fillText(player.name, x, y);
			}
			rating = 2 * player.scores + player.tags - 2 * player.tagged;
			table.appendChild(getRow([player.name, player.scores, player.tags, player.tagged, rating], player.team == RED ? "#ffdddd" : "#ddddff"));
		}
		dgid("stats").innerHTML = "";
		dgid("stats").appendChild(table);
		dgid("redScore").innerHTML = redScore;
		dgid("blueScore").innerHTML = blueScore;
	}

	function getRow(cells, background) {
		if(!background) background = "white";
		var tr = document.createElement("tr");
		tr.style.backgroundColor = background;
		for(var i = 0; i < cells.length; i++) {
			var td = document.createElement("td");
			td.width = "100";
			td.style.fontSize = "16px";
			td.innerHTML = String(cells[i]).replace("<", "&lt").replace(">", "&gt");
			tr.appendChild(td);
		}
		return tr;
	}
})();
