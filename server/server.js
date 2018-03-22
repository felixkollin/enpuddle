/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Main launch file, initiates and starts the server.
 *
 */

"use strict";
var config = require("./config");
var cluster = require('cluster');

if (cluster.isMaster) {
  var database = require("./database");
  var storage = require("./storage");
  database.sync().then(() => {
    storage.init().catch(err => {
      throw Error("Storage initialization failed!");
    });
  }).catch(e => {
    console.log(e);
  });
  var cpuCount = require('os').cpus().length;

  // Create a worker for each CPU
  // For each core, create a new worker
  for (var i = 0; i < cpuCount; i += 1) {
      cluster.fork();
  }
  console.log("-----------------------------------------------------");
  console.log("Enpuddle server started on port: " + config.server.port);
  console.log("-----------------------------------------------------");
  console.log("Configuration:");
  console.log(config);
  console.log("-----------------------------------------------------");

  // Listen for dying workers
  cluster.on('exit', function (worker) {
    cluster.fork();
  });
// Code to run if we're in a worker process
} else {
  var http = require("http");
  var app = require("./routes");
  var httpServer = http.Server(app);
  var socketsController = require("./sockets.ctrl").init(httpServer);

  httpServer.listen(config.server.port, () => {
    console.log("Running on core: " + cluster.worker.id);
  });
}
