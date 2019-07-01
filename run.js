"use strict";

let http = require("http");
let io = require("socket.io");

let ctf = require("./server");
let server = http.createServer(ctf.app);
server.listen(process.argv[2] || 80);
io.listen(server).on("connection", ctf.sioOnConnection);
