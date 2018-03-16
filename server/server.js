/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Main launch file, initiates and starts the server.
 *
 */

"use strict";

var http = require("http");

var app = require("./routes");
var config = require("./config");
var database = require("./database");
var storage = require("./storage");

database.sync().then(() => {
  storage.init().catch(err => {
    throw Error("Storage initialization failed!");
  });

  var httpServer = http.Server(app);
  var socketsController = require("./sockets.ctrl").init(httpServer);

  httpServer.listen(config.server.port, () => {
    console.log("-------------------------------------------------------");
    console.log("Enpuddle server started on port: " + config.server.port);
    console.log("-------------------------------------------------------");
    console.log("Configuration:");
    console.log(config);
    console.log("-------------------------------------------------------");
  });
}).catch(e => {
  console.log(e);
});
