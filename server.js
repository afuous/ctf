"use strict";

let http = require("http");
let io = require("socket.io");
let fs = require("fs");
let url = require("url");
let physics = require("./physics");

let server = http.createServer(function(req, res) {
	let path = url.parse(req.url).pathname.substring(1);

	if(path == "") {
		res.end(fs.readFileSync("index.html"));
	}
	else if(~["script.js", "socketio.js", "physics.js"].indexOf(path)) {
		res.end(fs.readFileSync(path));
	}
	else res.end("404");
});
server.listen(process.argv[2] || 80);

const game = {
	width: 1200,
	height: 600,
	accel: 0.04,
	decel: 0.13,
	radius: 16,
	bounce: 0.2,
	flag: {
		offset: 100,
		radius: 70
	},
	freezeTime: 5000
}

const LEFT = 0;
const RIGHT = 1;
const UP = 2;
const DOWN = 3;
const CENTER = 4;

const RED = 0;
const BLUE = 1;

let red = [];
let blue = [];

let redScore = 0;
let blueScore = 0;

var lastUpdate = Date.now();

function update() {
	for(let player of red.concat(blue)) {
		player.socket.emit("update", {
			players: red.concat(blue).map(p => ({
				x: p.x,
				y: p.y,
				dx: p.dx,
				dy: p.dy,
				name: p.name,
				horiz: p.horiz,
				vert: p.vert,
				team: p.team,
				frozen: p.frozen,
				hasFlag: p.hasFlag,
				scores: p.scores,
				tags: p.tags,
				tagged: p.tagged,
				self: p == player
			})),
			redScore: redScore,
			blueScore: blueScore,
			lastUpdate: lastUpdate
		});
	}
}

setInterval(function() {
	while(lastUpdate + 10 < Date.now()) {
		physics.run(red.concat(blue), game);
		checkCollisions();
		lastUpdate += 10;
	}
}, 10);

function dist(a, b) {
	return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function checkCollisions() {
	var transfer = function(team) {
		for(let player1 of team) {
			for(let player2 of team) {
				if(player1 != player2) {
					if(player2.touching == player1) {
						if(dist(player1, player2) > game.radius * 2) {
							player2.touching = null;
						}
					}
					if(player1.hasFlag && player1.touching != player2 && dist(player1, player2) <= game.radius * 2) {
						player1.hasFlag = false;
						player2.hasFlag = true;
						player2.touching = player1;
						update();
					}
				}
			}
		}
	};
	transfer(red);
	transfer(blue);
	for(let redPlayer of red) {
		if(dist({x: game.width - game.flag.offset - game.flag.radius, y: game.height / 2}, redPlayer) < game.flag.radius + game.radius) {
			if(!red.some(player => player.hasFlag)) {
				redPlayer.hasFlag = true;
				update();
			}
		}
		if(redPlayer.hasFlag && redPlayer.x < game.width / 2) {
			redPlayer.hasFlag = false;
			redScore++;
			redPlayer.scores++;
			update();
		}
	}
	for(let bluePlayer of blue) {
		if(dist({x: game.flag.offset + game.flag.radius, y: game.height / 2}, bluePlayer) < game.flag.radius + game.radius) {
			if(!blue.some(player => player.hasFlag)) {
				bluePlayer.hasFlag = true;
				update();
			}
		}
		if(bluePlayer.hasFlag && bluePlayer.x > game.width / 2) {
			bluePlayer.hasFlag = false;
			blueScore++;
			bluePlayer.scores++;
			update();
		}
	}
	for(let redPlayer of red) {
		for(let bluePlayer of blue) {
			if(dist(redPlayer, bluePlayer) <= game.radius * 2) {
				if(redPlayer.x + bluePlayer.x > game.width && bluePlayer.frozen == 0) {
					redPlayer.x = game.flag.offset / 2;
					redPlayer.y = game.height / 2;
					redPlayer.dx = redPlayer.dy = 0;
					redPlayer.frozen = game.freezeTime;
					redPlayer.hasFlag = false;
					redPlayer.tagged++;
					bluePlayer.tags++;
				}
				else if(redPlayer.x + bluePlayer.x < game.width && redPlayer.frozen == 0) {
					bluePlayer.x = game.width - game.flag.offset / 2;
					bluePlayer.y = game.height / 2;
					bluePlayer.dx = bluePlayer.dy = 0;
					bluePlayer.frozen = game.freezeTime;
					bluePlayer.hasFlag = false;
					bluePlayer.tagged++;
					redPlayer.tags++;
				}
				update();
			}
		}
	}
}

io.listen(server).on("connection", function(socket) {
	socket.on("join", function(obj) {
		var name = obj.name.trim();
		if(name.length == 0 || red.concat(blue).some(player => socket == player.socket)) return;
		name = name.substring(0, 25);
		if(red.concat(blue).some(player => name.toLowerCase() == player.name.toLowerCase())) {
			socket.emit("start", {
				valid: false
			});
		}
		else {
			(obj.team == RED ? red : blue).push({
				socket: socket,
				x: obj.team == RED ? game.flag.offset / 2 : game.width - game.flag.offset / 2,
				y: game.height / 2,
				dx: 0,
				dy: 0,
				name: name,
				horiz: CENTER,
				vert: CENTER,
				team: obj.team == RED ? RED : BLUE,
				frozen: 0,
				hasFlag: false,
				touching: null,
				scores: 0,
				tags: 0,
				tagged: 0
			});
			socket.emit("start", {
				valid: true,
				game: game
			});
			update();
		}
	});

	socket.on("disconnect", function() {
		red = red.filter(player => socket != player.socket);
		blue = blue.filter(player => socket != player.socket);
		if(red.length == 0 && blue.length == 0) {
			redScore = 0;
			blueScore = 0;
		}
		update();
	});

	socket.on("keyDown", function(dir) {
		for(let player of red.concat(blue).filter(player => socket == player.socket)) {
			physics.keyDown(player, dir);
		}
		update();
	});

	socket.on("keyUp", function(dir) {
		for(let player of red.concat(blue).filter(player => socket == player.socket)) {
			physics.keyUp(player, dir);
		}
		update();
	});
});
