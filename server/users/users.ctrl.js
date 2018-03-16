/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/users/{request}.
 *
 */

"use strict";

var express = require("express");
var usersRouter = express.Router();

var users = require("./users.model");
var auth = require("../auth/auth.model");
var storage = require("../storage");

/**
 * @desc HTTP GET request to get the info of a user.
 *
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.uid The user to get info from.
 *
 * @return {status: 200, {uid, alias, bio}} When successful.
 * Otherwise: Send to error handler middleware.
 */
usersRouter.get("/:uid/info", (req, res, next) => {
  var access_token = req.query.access_token;
  var uid = req.params.uid;

  if(!access_token || !uid){
    return next(new Error("incorrect_params"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  //TODO only allow if friends/public

  users.getUser(uid)
    .then(user => {
      if(user === null){
        throw new Error("invalid_username");
      }
      user = user.get({ plain: true });
      delete user.password;
      delete user.storageLimit;
      return res.json(user);
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP GET request to get the avatar of a user.
 *
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.uid The user to get avatar from.
 *
 * @return {status: 200, 200x200 PNG image} When successful.
 * Otherwise: Send to error handler middleware.
 */
usersRouter.get("/:uid/avatar", (req, res, next) => {
  var access_token = req.query.access_token;
  var uid = req.params.uid;

  if(!access_token || !uid){
    return next(new Error("incorrect_params"));
  }

  var request_uid;
  try {
    request_uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  users.getUser(uid)
    .then(user => {
      if(user === null){
        throw new Error("invalid_username");
      }
      return storage.hasAvatar(uid);
    })
    .then(exists => {
      if(exists){
        return res.sendFile(storage.getAvatarPath(uid));
      }else{
        return res.sendFile(storage.getDefaultAvatarPath());
      }
    })
    .catch(err => next(err));
});

module.exports = usersRouter;
