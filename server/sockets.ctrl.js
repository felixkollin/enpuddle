/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Controller for managing socket.io connections.
 *
 */

"use strict";

var auth = require("./auth/auth.model");
var drops = require("./drops/drops.model");
var utils = require("./utils");

var io_socket;

//{socket_id: uid, socket_id: uid}
var connections = {};

function handleconnection(socket){
  var uid = connections[socket.id];

  socket.join("user:" + uid);

  socket.on("watch", path => {
    socket.join("watches:" + path);
  });

  socket.on("unwatch", path => {
    socket.leave("watches:" + path);
  });

  socket.on("disconnect", () => {
    delete connections[socket.id];
  });
}

module.exports = {
  init : (httpServer) => {
    io_socket = require("socket.io").listen(httpServer);

    io_socket.use(function(socket, next){
      if (socket.handshake.query && socket.handshake.query.auth_token){
        var token = socket.handshake.query.auth_token;
        auth.getRefreshToken(token)
          .then(result => {
            if(result === null){
              next(Error("invalid_auth_token"));
            }else{
              connections[socket.id] = result.uid;
              next();
            }
          })
          .catch(err => next(err));
      }
      next(Error("invalid_auth_token"));
    });

    io_socket.on("connection", socket => {
      handleconnection(socket);
    });
  },

  redefinedDrop : (path, new_path) => {
    var working = utils.parseWorkingDir(path);
    var new_working = utils.parseWorkingDir(new_path);
    if(working === new_working){ // Only renamed
      io_socket.to("watches:" + working).emit("modified", {path: working});
    }else{
      io_socket.to("watches:" + working).emit("modified", {path: working});
      io_socket.to("watches:" + new_working).emit("modified", {path: new_working});
    }

    io_socket.to("watches:" + path).emit("redefined", {
      path: path,
      new_path: new_path
    });
  },

  addedDrop : (path) => {
    var working = utils.parseWorkingDir(path);
    io_socket.to("watches:" + path).emit("modified", {path: path});
  },

  deletedDrop : (path) => {
    io_socket.to("watches:" + path).emit("deleted", {path: path});

    var working = utils.parseWorkingDir(path);
    io_socket.to("watches:" + path).emit("modified", {path: path});
  },

  notification : (uid, message) => {
    io_socket.to("user:" + uid).emit("notification", {message: message});
  },

  changedPermission : (path, uid, permission, change) => {
    io_socket.to("watches:" + path).emit("perm_" + change, {
      path: path,
      uid: uid,
      permission: permission
    });
    if(!path.startsWith(uid + "/")){
      io_socket.to("user:" + uid).emit("sharing_modified", {path: path});
    }
  }
};
