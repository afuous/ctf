"use strict";

let http = require("http");
let io = require("socket.io");
let fs = require("fs");
let url = require("url");
let physics = require("./physics");

let staticPages = [
	"script.js",
	"physics.js",
	"socketio.js",
	"style.css",
];

let server = http.createServer(function(req, res) {
	let path = url.parse(req.url).pathname.substring(1);
	let file = staticPages.indexOf(path) != -1 ? path : "index.html";
	fs.createReadStream(require("path").join(__dirname, file)).pipe(res);
});
server.listen(process.argv[2] || 80);

const conf = {
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
	freezeTime: 5000, // ms
	tickTime: 10, // ms
}

const LEFT = 0;
const RIGHT = 1;
const UP = 2;
const DOWN = 3;
const CENTER = 4;

const RED = 0;
const BLUE = 1;

// TODO: maybe give all players an id
let privateGames = {};
let nextPublicGame = null;
let publicGames = {};
let publicGameUid = 0;

function createGame() {
	return {
		red: [],
		blue: [],
		redScore: 0,
		blueScore: 0,
		lastUpdate: Date.now(),
	};
}

function createPlayer(socket, name, team) {
	return {
		socket: socket,
		x: team == RED ? conf.flag.offset / 2 : conf.width - conf.flag.offset / 2,
		y: conf.height / 2,
		dx: 0,
		dy: 0,
		name: name,
		horiz: CENTER,
		vert: CENTER,
		team: team,
		frozen: 0,
		hasFlag: false,
		touching: null,
		scores: 0,
		tags: 0,
		tagged: 0,
	};
}

function getToken() {
	return Array(8).fill()
		.map(() => String.fromCharCode(Math.floor(Math.random() * 26) + 97))
		.join("");
}

function update(game) {
	let players = getPlayers(game);
	for(let player of players) {
		player.socket.emit("update", {
			players: players.map(p => ({
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
				isSelf: p == player,
			})),
			redScore: game.redScore,
			blueScore: game.blueScore,
			lastUpdate: game.lastUpdate,
		});
	}
}

function getPlayers(game) {
	return game.red.concat(game.blue);
}

setInterval(function() {
	let games = Object.keys(privateGames).map(key => privateGames[key])
		.concat(Object.keys(publicGames).map(key => publicGames[key]));
	for (let game of games) {
		while(game.lastUpdate + conf.tickTime < Date.now()) {
			physics.run(getPlayers(game), conf);
			checkCollisions(game);
			game.lastUpdate += conf.tickTime;
		}
	}
}, conf.tickTime);

function dist(a, b) {
	return Math.sqrt(Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2));
}

function checkCollisions(game) {
	let transfer = function(team) {
		for(let player1 of team) {
			for(let player2 of team) {
				if(player1 != player2) {
					if(player2.touching == player1) {
						if(dist(player1, player2) > conf.radius * 2) {
							player2.touching = null;
						}
					}
					if(player1.hasFlag && player1.touching != player2 && dist(player1, player2) <= conf.radius * 2) {
						player1.hasFlag = false;
						player2.hasFlag = true;
						player2.touching = player1;
						update(game);
					}
				}
			}
		}
	};
	transfer(game.red);
	transfer(game.blue);
	for(let redPlayer of game.red) {
		if(dist({x: conf.width - conf.flag.offset - conf.flag.radius, y: conf.height / 2}, redPlayer) < conf.flag.radius + conf.radius) {
			if(!game.red.some(player => player.hasFlag)) {
				redPlayer.hasFlag = true;
				update(game);
			}
		}
		if(redPlayer.hasFlag && redPlayer.x < conf.width / 2) {
			redPlayer.hasFlag = false;
			game.redScore++;
			redPlayer.scores++;
			update(game);
		}
	}
	for(let bluePlayer of game.blue) {
		if(dist({x: conf.flag.offset + conf.flag.radius, y: conf.height / 2}, bluePlayer) < conf.flag.radius + conf.radius) {
			if(!game.blue.some(player => player.hasFlag)) {
				bluePlayer.hasFlag = true;
				update(game);
			}
		}
		if(bluePlayer.hasFlag && bluePlayer.x > conf.width / 2) {
			bluePlayer.hasFlag = false;
			game.blueScore++;
			bluePlayer.scores++;
			update(game);
		}
	}
	for(let redPlayer of game.red) {
		for(let bluePlayer of game.blue) {
			if(dist(redPlayer, bluePlayer) <= conf.radius * 2) {
				if(redPlayer.x + bluePlayer.x > conf.width
					&& bluePlayer.frozen == 0
					&& (bluePlayer.dx != 0 || bluePlayer.dy != 0)
				) {
					redPlayer.x = conf.flag.offset / 2;
					redPlayer.y = conf.height / 2;
					redPlayer.dx = redPlayer.dy = 0;
					redPlayer.frozen = conf.freezeTime;
					redPlayer.hasFlag = false;
					redPlayer.tagged++;
					bluePlayer.tags++;
				}
				else if(redPlayer.x + bluePlayer.x < conf.width
					&& redPlayer.frozen == 0
					&& (redPlayer.dx != 0 || redPlayer.dy != 0)
				) {
					bluePlayer.x = conf.width - conf.flag.offset / 2;
					bluePlayer.y = conf.height / 2;
					bluePlayer.dx = bluePlayer.dy = 0;
					bluePlayer.frozen = conf.freezeTime;
					bluePlayer.hasFlag = false;
					bluePlayer.tagged++;
					redPlayer.tags++;
				}
				update(game);
			}
		}
	}
}

io.listen(server).on("connection", function(socket) {

	let game;
	let player;

	socket.on("createPrivate", function(obj) {
		let gameId;
		do {
			gameId = getToken();
		} while (gameId in privateGames);
		game = createGame();
		game.isPublic = false;
		game.id = gameId;
		privateGames[gameId] = game;
		joinPrivate(obj.name);
		// TODO: if invalid name, game will still be created
	});

	socket.on("joinPrivate", function(obj) {
		game = privateGames[obj.gameId];
		if (!game) {
			socket.emit("invalidGameId", {
				message: "A game with that ID was not found",
			});
		} else {
			joinPrivate(obj.name);
		}
	});

	socket.on("joinPublic", function(obj) {
		if (!nextPublicGame) {
			nextPublicGame = createGame();
			nextPublicGame.isPublic = true;
		}
		game = nextPublicGame;
		let name = checkName(obj.name);
		if (!name) return;
		let team = game.red.length <= game.blue.length ? RED : BLUE;
		player = createPlayer(socket, name, team);
		(team == RED ? game.red : game.blue).push(player);
		socket.emit("start", {
			conf: conf,
		});
		update(game);
		let playersPerTeam = 2;
		if (nextPublicGame.red.length == playersPerTeam && nextPublicGame.blue.length == playersPerTeam) {
			nextPublicGame.id = publicGameUid++;
			publicGames[nextPublicGame.id] = nextPublicGame;
			nextPublicGame = null;
			// actually start
			// anything for else?
		}
	});

	function checkName(name) {
		name = name.trim().substring(0, 25);
		let players = getPlayers(game);
		if(name.length == 0 || players.some(player => socket == player.socket)) return;
		if(players.some(player => name.toLowerCase() == player.name.toLowerCase())) {
			socket.emit("invalidName", {
				message: "Duplicate name",
			});
			game = null;
			return;
		}
		return name;
	}

	function joinPrivate(name) {
		name = checkName(name);
		if (!name) return;
		let team = game.red.length <= game.blue.length ? RED : BLUE;
		player = createPlayer(socket, name, team);
		(team == RED ? game.red : game.blue).push(player);
		socket.emit("start", {
			conf: conf,
			gameId: game.id,
		});
		update(game);
	}

	socket.on("disconnect", function() {
		if (!game) return;
		game.red = game.red.filter(p => p != player);
		game.blue = game.blue.filter(p => p != player);
		if (game.red.length == 0 && game.blue.length == 0) {
			delete privateGames[game.id];
		} else {
			update(game);
		}
		game = null;
		player = null;
	});

	socket.on("keyDown", function(dir) {
		if (!game || !player) return;
		physics.keyDown(player, dir);
		update(game);
	});

	socket.on("keyUp", function(dir) {
		if (!game || !player) return;
		physics.keyUp(player, dir);
		update(game);
	});

});
