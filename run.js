"use strict";

let http = require("http");
let WebSocket = require("ws");

let ctf = require("./server");
let server = http.createServer(ctf.app);
let wss = new WebSocket.Server({ server: server });
wss.on("connection", ctf.wsOnConnection);
server.listen(process.argv[2] || 80);
