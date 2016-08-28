var LEFT = 0;
var RIGHT = 1;
var UP = 2;
var DOWN = 3;
var CENTER = 4;

function run(players, game) {
	for(var i = 0; i < players.length; i++) {
		var player = players[i];
		if(player.frozen > 0) {
			player.frozen -= 10;
			continue;
		}
		if(player.horiz == LEFT) {
			player.dx -= player.dx < 0 ? game.accel : game.decel;
		}
		else if(player.horiz == RIGHT) {
			player.dx += player.dx > 0 ? game.accel : game.decel;
		}
		player.x += player.dx;
		if(player.x < game.radius) {
			player.x = game.radius;
			player.dx *= -game.bounce;
		}
		if(player.x > game.width - game.radius) {
			player.x = game.width - game.radius;
			player.dx *= -game.bounce;
		}

		if(player.vert == UP) {
			player.dy -= player.dy < 0 ? game.accel : game.decel;
		}
		else if(player.vert == DOWN) {
			player.dy += player.dy > 0 ? game.accel : game.decel;
		}
		player.y += player.dy;
		if(player.y < game.radius) {
			player.y = game.radius;
			player.dy *= -game.bounce;
		}
		if(player.y > game.height - game.radius) {
			player.y = game.height - game.radius;
			player.dy *= -game.bounce;
		}
	}
}

function keyDown(player, dir) {
	if(dir == LEFT && player.horiz != LEFT) {
		if(player.horiz == CENTER) {
			player.horiz = LEFT;
		}
		else if(player.horiz == RIGHT) {
			player.horiz = CENTER;
		}
	}
	else if(dir == RIGHT && player.horiz != RIGHT) {
		if(player.horiz == CENTER) {
			player.horiz = RIGHT;
		}
		else if(player.horiz == LEFT) {
			player.horiz = CENTER;
		}
	}
	else if(dir == UP && player.vert != UP) {
		if(player.vert == CENTER) {
			player.vert = UP;
		}
		else if(player.vert == DOWN) {
			player.vert = CENTER;
		}
	}
	else if(dir == DOWN && player.vert != DOWN) {
		if(player.vert == CENTER) {
			player.vert = DOWN;
		}
		else if(player.vert == UP) {
			player.vert = CENTER;
		}
	}
}

function keyUp(player, dir) {
	if(dir == LEFT && player.horiz != RIGHT) {
		if(player.horiz == CENTER) {
			player.horiz = RIGHT;
		}
		else if(player.horiz == LEFT) {
			player.horiz = CENTER;
		}
	}
	else if(dir == RIGHT && player.horiz != LEFT) {
		if(player.horiz == CENTER) {
			player.horiz = LEFT;
		}
		else if(player.horiz == RIGHT) {
			player.horiz = CENTER;
		}
	}
	else if(dir == UP && player.vert != DOWN) {
		if(player.vert == CENTER) {
			player.vert = DOWN;
		}
		else if(player.vert == UP) {
			player.vert = CENTER;
		}
	}
	else if(dir == DOWN && player.vert != UP) {
		if(player.vert == CENTER) {
			player.vert = UP;
		}
		else if(player.vert == DOWN) {
			player.vert = CENTER;
		}
	}
}

var physics = {
	run: run,
	keyDown: keyDown,
	keyUp: keyUp
};

if(typeof(exports) == "undefined") {
	window.physics = physics;
}
else {
	for(var key in physics) {
		exports[key] = physics[key];
	}
}
