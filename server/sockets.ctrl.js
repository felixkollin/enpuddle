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

var io_socket;

//{socket_id: uid, socket_id: uid}
var connections = {};

//{uid: [socket,socket], uid: []}
var sessions = {};

function handleconnection(socket){
  var uid = connections[socket.id];
  sessions[uid] = sessions[uid] || [];
  sessions[uid].push(socket);

  console.log("CONNECTED: " + uid);
  socket.join("user:" + uid);

  socket.on("observe_sub", path => {
    console.log("SUB OBSERVE: " + path);
    socket.join("sub:" + path);
  });

  socket.on("observe", path => {
    //TODO check not starts with sub: or user:
    console.log(uid + " observes " + path);
    socket.join("obs:" + path);
  });

  socket.on("unobserve", path => {
    //TODO check not starts with sub:
    console.log(uid + " unobserves " + path);
    socket.leave("obs:" + path);
  });

  socket.on("disconnect", () => {
    console.log(uid + " disconnected");
    delete connections[socket.id];
    var index = sessions[uid].indexOf(socket);
    if (index > -1) {
      sessions[uid].splice(index, 1);
    }
    if(sessions[uid] === []){
      delete sessions[uid];
    }
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
  addedSub : (uid, path) => {
    console.log(uid + " subbed to " + path);
    sessions[uid] = sessions[uid] || [];
    sessions[uid].forEach(socket => {
      socket.join("sub:" + path);
    });
    io_socket.to("user:" + uid).emit("added_sub", {path: path});
  },
  deletedSub : (uid, path) => {
    console.log(uid + " unsubbed to " + path);
    sessions[uid] = sessions[uid] || [];
    sessions[uid].forEach(socket => {
      socket.leave("sub:" + path);
    });
    io_socket.to("user:" + uid).emit("deleted_sub", {path: path});
  },
  // Path of drop has changed, tell client to redirect
  redefinedDrop : (path, new_path) => {
    console.log("Emit redefined to " + path + ", new: " + new_path);
    io_socket.to("obs:" + path).emit("redefined", {
      path: path,
      new_path: new_path
    });
    io_socket.to("sub:" + path).emit("sub_notice",
    {message: path + " was updated to " + new_path});
  },
  // Contents of drop has changed, tell client to refresh
  modifiedDrop : (path) => {
    console.log("Emit modified to " + path);
    io_socket.to("obs:" + path).emit("modified", {path: path});
    io_socket.to("sub:" + path).emit("sub_notice", {message: "The contents of " + path + " was modified."});
  },
  // Drop was deleted
  deletedDrop : (path) => {
    console.log("Emit deleted to " + path);
    io_socket.to("obs:" + path).emit("deleted", {path: path});
    io_socket.to("sub:" + path).emit("sub_notice", {message: path + " was deleted!"});
  },
  // Permissions of drop has changed
  deletedPermission : (path, uid, permission) => {
    console.log("Emit perm_deleted to " + path + ", uid: " + uid + ", perm: " + permission);
    io_socket.to("obs:" + path).emit("perm_deleted", {
      path: path,
      uid: uid,
      permission: permission
    });
    io_socket.to("sub:" + path).emit("sub_notice",
    {message: uid + " was refused permission to " + permission + " " + path});
    //If it's a folder shared to user, it needs to know perms are modified
    if(!path.startsWith(uid + "/")){
      console.log("sharing modified for " + uid);
      io_socket.to("user:" + uid).emit("sharing_modified", {path: path});
    }
  },
  addedPermission : (path, uid, permission) => {
    console.log("Emit perm_added to " + path + ", uid: " + uid + ", perm: " + permission);
    io_socket.to("obs:" + path).emit("perm_added", {
      path: path,
      uid: uid,
      permission: permission
    });
    io_socket.to("sub:" + path).emit("sub_notice",
    {message: uid + " was granted permission to " + permission + " " + path});
    //If it's a folder shared to user, it needs to know perms are modified
    if(!path.startsWith(uid + "/")){
      console.log("sharing modified for " + uid);
      io_socket.to("user:" + uid).emit("sharing_modified", {path: path});
    }
  }
};
