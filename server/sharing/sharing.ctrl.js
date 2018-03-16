/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/sharing/{request}.
 *
 */

"use strict";

var express = require("express");
var sharingRouter = express.Router();

var sharing = require("./sharing.model");
var users = require("../users/users.model");
var auth = require("../auth/auth.model");
var drops = require("../drops/drops.model");

const valid_permissions = {read: "read", write: "write", modify: "modify", all: "all"};

/**
 * @desc HTTP GET request to get the permissions of a drop.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.permission read/write/modify/all.
 * @param {String} [req.body.uid] Optional, specific username.
 *
 * @return {status: 200, data: [{uid, permission}]} When successful.
 * Otherwise: Send to error handler middleware.
 */
sharingRouter.get("/permission", (req, res, next) => {
  var path = req.query.path;
  var permission = req.query.permission;
  var access_token = req.query.access_token;
  var uid = req.query.uid;

  if(!path || !permission || !access_token){
    return next(new Error("incorrect_params"));
  }

  if(valid_permissions[permission] === undefined){
    return next(new Error("incorrect_permission"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  // Only modify can check permissions of others
  // You can always check your own permissions
  var start;
  if(request_uid !== uid){
    start = sharing.checkPermission(path, request_uid, "modify")
      .then(result => {
        if(result === null){
          throw Error("insufficient_permissions");
        }
        return sharing.getPermission(path, uid, permission);
      });
  }else{
    start = sharing.getPermission(path, uid, permission);
  }

  start.then(permList => {
      var permissions = [];
      permList.forEach(permission => {
        permission = permission.get({
          plain: true
        });
        permissions.push({
          uid : permission.uid,
          permission : permission.permission
        });
      });
      return res.json({data: permissions});
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP POST request to grant a user permission/s to a drop.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.permission read/write/modify/all.
 * @param {String} req.body.uid Username which to grant to.
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
sharingRouter.post("/permission", (req, res, next) => {
  var path = req.body.path;
  var permission = req.body.permission;
  var access_token = req.body.access_token;
  var uid = req.body.uid;

  if(!path || !permission || !access_token || !uid){
    return next(new Error("incorrect_params"));
  }

  if(valid_permissions[permission] === null){
    return next(new Error("incorrect_permission"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  users.getUser(uid)
    .then(result => {
      if(result === null){
        throw Error("invalid_username");
      }
      return sharing.checkPermission(path, request_uid, "modify");
    })
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return sharing.setPermission(path, uid, permission);
    })
    .then(() => res.sendStatus(201))
    .catch(err => next(err));
});

/**
 * @desc HTTP DELETE request to delete a permission/s from a user.
 *
 * @param {String} req.body.path The path of the drop.
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.permission read/write/modify/all.
 * @param {String} req.body.uid Username which to delete from to.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
sharingRouter.delete("/permission", (req, res, next) => {
  var path = req.query.path;
  var permission = req.query.permission;
  var access_token = req.query.access_token;
  var uid = req.query.uid;

  if(!path || !permission || !access_token || !uid){
    return next(new Error("incorrect_params"));
  }

  if(valid_permissions[permission] === null){
    return next(new Error("incorrect_permission"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  users.getUser(uid)
    .then(result => {
      if(result === null){
        throw Error("invalid_username");
      }
      return drops.getDrop(path);
    })
    .then(drop => {
      if(drop === null){
        throw Error("invalid_path");
      }
      //Cannot delete perms of owner
      if(drop.ownerUID === uid){
        throw Error("invalid_username");
      }
      return sharing.checkPermission(path, request_uid, "modify");
    })
    .then(result => {
      if(result === null){
        throw Error("insufficient_permissions");
      }
      return sharing.deletePermission(path, uid, permission);
    })
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
});

module.exports = sharingRouter;
