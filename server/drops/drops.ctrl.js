/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/drops/{request}.
 *
 */

"use strict";

var express = require("express");
var dropsRouter = express.Router();
var formidable = require("formidable");
var sanitize = require("sanitize-filename");

var drops = require("./drops.model");
var users = require("../users/users.model");
var auth = require("../auth/auth.model");
var sharing = require("../sharing/sharing.model");
var storage = require("../storage");
var utils = require("../utils");


/**
 * @desc HTTP GET request to get a drop's information.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 200, data: {path, createdUID, createdDate, editUID, editDate, ownerUID}} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.get("/info", (req, res, next) => {
  var path = req.query.path;
  var access_token = req.query.access_token;

  if(!access_token || !path){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  var foundDrop;
  sharing.checkPermission(path, uid, "read")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getDrop(path);
    })
    .then(drop => {
      if(drop === null){
        throw Error("invalid_path");
      }
      drop = drop.get({plain:true});
      foundDrop = drop;
      return storage.getSize(path);
    })
    .then(size =>{
      foundDrop.size = size;
      return res.json({"data": foundDrop});
    })
    .catch(err => next(err));
});

/**
 * @desc Helper function to handle multiple file upload.
 */
function handleUpload(req, res, next, uid, path, ownerUID){
  var form = new formidable.IncomingForm();
  form.keepExtensions = true;

  var workingDirPerms;
  var storageLimit;
  return sharing.getPermission(path, undefined, "all")
    .then(permList => {
      workingDirPerms = permList;
      workingDirPerms.forEach(permission => {
        permission = permission.get({ plain: true });
      });
      return users.getUser(ownerUID);
    })
    .then(user => {
      if(user === null){
        throw new Error("invalid_path");
      }
      storageLimit = user.storageLimit;
      return storage.getUsedSpace(ownerUID);
    })
    .then(used => {
      //storageLimit is in MB
      var spaceLeft = Math.max(0, storageLimit * 1000000 - used);
      var storePromises = [];
      var createDropsPromises = [];
      var filenames = [];
      form.parse(req)
        .on("file", (name, file) => {
          var uploadname = sanitize(file.name, {replacement : "_"});

          storage.upload(file.path, path + uploadname, res)
            .then(() => {
              return drops.addDrop(path + uploadname, uid, ownerUID);
            })
            .then(() => {
              var toAdd = [];
              workingDirPerms.forEach(permission => {
                toAdd.push({
                  path : path + uploadname,
                  uid : permission.uid,
                  permission : permission.permission
                });
              });
              return sharing.addBulkPermissions(toAdd);
            });
        })
        .on("progress", (bytesReceived, bytesExpected) => {
          if(bytesReceived > spaceLeft){
            form._error(new Error("invalid_file_size"));
          }
          var percent = (bytesReceived / bytesExpected * 100);
          //TODO send progress over socket
        })
        .on("aborted", () => {
          //TODO close progress socket
        })
        //All files uploaded
        .on("end", () => {
          //TODO close progress socket
          return res.sendStatus(201);
        })
        .on("error", err => {
          return next(err);
        });
    });
}

/**
 * @desc HTTP POST request to upload files using multipart form.
 *
 * @param {String} req.query.path The path of the drop.
 * @param {String} req.query.access_token An access token.
 * @param {String} req.body The multipart data (files).
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.post("/upload", (req, res, next) => {
  var path = req.query.path;
  var access_token = req.query.access_token;
  if(!access_token || !path){
    return next(new Error("incorrect_params"));
  }

  // Can only add file to dir
  if(path.charAt(path.length - 1) !== "/"){
    return next(new Error("invalid_path"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  sharing.checkPermission(path, request_uid, "write")
    // Check write permission in working directory
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getDrop(path);
    })
    // Retrieve owner of working directory and upload drops
    .then(workingDrop => {
      if(workingDrop === null){
        throw Error("invalid_path");
      }
      return handleUpload(req, res, next, request_uid, path, workingDrop.ownerUID);
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP POST request to add a directory to a drop (directory).
 *
 * @param {String} req.body.path The path of the drop (directory).
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.dir_name The name of the new directory.
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.post("/directory", (req, res, next) => {
  var access_token = req.body.access_token;
  var path = req.body.path;
  var dir_name = req.body.dir_name;

  if(!access_token || !path || !dir_name){
    return next(new Error("incorrect_params"));
  }

  dir_name = sanitize(dir_name, {replacement : "_"});
  // Can only add dir to dir
  if(path.charAt(path.length - 1) !== "/"){
    return next(new Error("invalid_path"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  var ownerUID;
  sharing.checkPermission(path, request_uid, "write")
    // Check write permission in working directory
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getDrop(path);
    })
    // Retrieve owner of working directory and create drop
    .then(drop => {
      if(drop === null){
        throw Error("invalid_path");
      }
      // Add new dir to server storage
      ownerUID = drop.ownerUID;
      return storage.mkdir(path + dir_name);
    })
    .then(() => {
      return drops.addDrop(path + dir_name + "/", request_uid, ownerUID);
    })
    // Get all permissions from working directory
    .then(created => {
      if(!created){ //Already exists
        throw Error("directory_exists");
      }
      return sharing.getPermission(path,undefined,"all");
    })
    // Add all permissions to the new directory
    .then(permList => {
      var toAdd = [];
      permList.forEach(permission => {
        permission = permission.get({ plain: true });
        toAdd.push({
          path : path + dir_name + "/",
          uid : permission.uid,
          permission : permission.permission
        });
      });
      return sharing.addBulkPermissions(toAdd);
    })
    .then(() => res.sendStatus(201))
    .catch(err => {
      //Delete any failed creations
      storage.delete(path + dir_name);
      next(err);
    });
});

/**
 * @desc HTTP POST request to download a drop (only files).
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 200} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.get("/download", (req, res, next) => {
  var path = req.query.path;
  var access_token = req.query.access_token;

  if(!access_token || !path){
    return next(new Error("incorrect_params"));
  }

  // Can only download files (for now)
  if(path.charAt(path.length - 1) === "/"){
    return next(new Error("invalid_path"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  sharing.checkPermission(path, uid, "read")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getDrop(path);
    })
    .then(result => {
      if(result === null){
        throw Error("invalid_path");
      }else{
        return storage.download(res, next, path);
      }
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP PUT request to move a drop to a new directory.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.new_path The new path of the drop.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.put("/move", (req, res, next) => {
  var path = req.body.path;
  var access_token = req.body.access_token;
  var new_dir = req.body.new_dir;

  if(!access_token || !path || !new_dir){
    return next(new Error("incorrect_params"));
  }

  // Check so new dir is directory
  if(new_dir.charAt(new_dir.length - 1) === "/"){
    return next(new Error("invalid_dir"));
  }
  //Cannot move a directory inside itself
  if(path.startsWith(new_dir)){
    return next(new Error("invalid_path"));
  }

  var source_dir = utils.parseWorkingDir(path);
  var filename = utils.parseName(path);
  var new_path = new_dir + filename;
  var newOwnerUID = utils.getOwner(new_dir);

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  sharing.checkPermission(path, uid, "write")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return sharing.checkPermission(new_dir, uid, "write");
    })
    //Check so drop exists
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }else{
        return drops.getDrop(path);
      }
    })
    //Check so new drop doesnt exist
    .then(result => {
      if(result === null){
        throw Error("invalid_path");
      }
      return drops.getDrop(new_path);
    })
    .then(result => {
      if(result !== null){
        throw Error("invalid_path");
      }
      return drops.redefineDrop(path, new_path, uid, newOwnerUID);
    })
    // Make sure the owner of the destination has all permissions
    .then(() => {
      return sharing.setPermission(new_path, newOwnerUID, "all");
    })
    .then(() => storage.rename(path, new_path))
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
});

/**
 * @desc HTTP POST request to copy a drop.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.destination The destination path of the copy.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.post("/copy", (req, res, next) => {
  var path = req.body.path;
  var access_token = req.body.access_token;
  var destination = req.body.destination;

  if(!access_token || !path || !destination){
    return next(new Error("incorrect_params"));
  }

  //Sanatize each portion of destination, dont remove any /
  var split = destination.split("/");
  split = split.map(part => sanitize(part, {replacement : "_"}));
  destination = split.join("/");

  //If copying dir, new path has to be dir as well
  var is_path_dir = (path.charAt(path.length - 1) === "/");
  var is_dest_dir = (destination.charAt(destination.length - 1) === "/");
  if(is_path_dir !== is_dest_dir){
    return next(new Error("invalid_path"));
  }

  var destination_dir = utils.parseWorkingDir(destination);

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  var ownerUID;
  sharing.checkPermission(path, uid, "read")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return sharing.checkPermission(destination_dir, uid, "write");
    })
    //Check so drop exists
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getDrop(path);
    })
    //Check so new drop doesnt exist
    .then(result => {
      if(result === null){
        throw Error("invalid_path");
      }
      ownerUID = result.ownerUID;
      return drops.getDrop(destination);
    })
    // Add new drop
    .then(result => {
      if(result !== null){
        throw Error("invalid_path");
      }
      return drops.addDrop(destination, uid, ownerUID);
    })
    // Get subdrops of copied drop
    .then(() => {
      return drops.getSubDrops(path);
    })
    .then(dropList => {
      var subDrops = [];
      dropList.forEach(drop => {
        drop = drop.get({ plain: true });
        var new_path = drop.path.replace(path, destination);
        subDrops.push({
          path : new_path,
          createdUID : uid,
          ownerUID : ownerUID
        });
      });
      return drops.addBulkDrops(subDrops);
    })
    // Copy permissions from destination dir to new drop and subdrops
    .then(() => {
      return sharing.getPermission(destination_dir, undefined, "all");
    })
    .then(permList => {
      var toAdd = [];
      permList.forEach(permission => {
        permission = permission.get({ plain: true });
        toAdd.push({
          path : destination,
          uid : permission.uid,
          permission : permission.permission
        });
      });
      return sharing.addBulkPermissions(toAdd);
    })
    //Copy on disk
    .then(() => storage.copy(path, destination))
    .then(() => res.sendStatus(201))
    .catch(err => next(err));
});

/**
 * @desc HTTP GET request to display the contents of a drop.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 200, data: [{path, createdUID, createdDate, editUID, editDate, ownerUID}] } When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.get("/contents", (req, res, next) => {
  var path = req.query.path;
  var access_token = req.query.access_token;

  if(!access_token || !path){
    return next(new Error("incorrect_params"));
  }

  // Can only check contents of dir
  if(path.charAt(path.length - 1) !== "/"){
    return next(new Error("invalid_path"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  var foundContents = [];
  sharing.checkPermission(path, uid, "read")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return drops.getAllWithPath(path);
    })
    .then(contents => {
      var getSizes = [];
      contents.forEach(item => {
        item = item.get({ plain: true });
        if(utils.parseWorkingDir(item.path) === path){
          foundContents.push(item);
          getSizes.push(storage.getSize(item.path));
        }
      });
      return Promise.all(getSizes);
    })
    .then(sizes => {
      var keys = Object.keys(foundContents);
      var i = 0;
      sizes.forEach(size => {
        foundContents[keys[i]].size = size;
        i++;
      });
      return res.json({"data": foundContents});
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP DELETE request to delete a drop.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
dropsRouter.delete("/delete", (req, res, next) => {
  var path = req.query.path;
  var access_token = req.query.access_token;

  if(!access_token || !path){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  //Cannot delete puddle (working dir with < 1 "/")
  if(utils.parseWorkingDir(path).replace(/[^\/]/g, "").length < 1){
    return next(new Error("invalid_path"));
  }

  sharing.checkPermission(path, uid, "write")
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return sharing.deletePermission(path, undefined, "all");
    })
    .then(() => {
      return drops.deleteDrop(path);
    })
    // Remove drop and subdrops from sub lists
    .then(deletions => {
      if(deletions === 0){
        throw Error("deletion_failed");
      }
      return storage.delete(path);
    })
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
});

module.exports = dropsRouter;
