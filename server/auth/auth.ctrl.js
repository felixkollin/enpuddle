/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/auth/{request}.
 *
 */

"use strict";

var express = require("express");
var authRouter = express.Router();
var XRegExp = require("xregexp");

var auth = require("./auth.model");
var users = require("../users/users.model");
var drops = require("../drops/drops.model");
var sharing = require("../sharing/sharing.model");
var follows = require("../follows/follows.model");
var storage = require("../storage");
var config = require("../config");

// Used to validate username (4-20 chars, letters, numbers: 0-9, symbols: ._-)
const username_regex = new XRegExp("(?=^.{4,20}$)^[0-9\\pL\\pM._\\-]+$");

/**
 * @desc HTTP POST request to get a refresh token and an access token.
 *
 * @param {String} req.body.uid The UID of the account.
 * @param {String} req.body.password The account's password.
 *
 * @return {status: 200, refresh_token, access_token, expires} When successful.
 * Otherwise: Send to error handler middleware.
 */
authRouter.post("/refresh_token", (req, res, next) => {
  var uid = req.body.uid;
  var password = req.body.password;
  if(!uid || !password){
    return next(new Error("incorrect_params"));
  }

  auth.requestRefreshToken(uid, password).then(refresh_token => {
    var access_token = auth.generateAccessToken(uid);
    return res.json({
      refresh_token: refresh_token.token,
      access_token: access_token.token,
      expires: access_token.expiryDate
    });
  })
  .catch(err => next(err));
});

/**
 * @desc HTTP GET request to get a new access token valid for 1 hour.
 *
 * @param {String} req.body.refresh_token The refresh token used.
 *
 * @return {status: 200, access_token, expires} When successful.
 * Otherwise: Send to error handler middleware.
 */
authRouter.get("/access_token", (req, res, next) => {
  var refresh_token = req.query.refresh_token;
  if(!refresh_token){
    return next("incorrect_params");
  }

  auth.getRefreshToken(refresh_token).then(token => {
      if(token === null){
        throw Error("invalid_refresh_token");
      }
      var access_token = auth.generateAccessToken(token.uid);
      return res.json({access_token: access_token.token, expires: access_token.expiryDate});
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP POST request to create a new user account.
 *
 * @param {String} req.body.uid The UID of the account. Regex: (?=^.{4,20}$)^[0-9\p{L}\p{M}._\-]+$
 * @param {String} req.body.password The account's password.
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
authRouter.post("/account", (req, res, next) => {
  var uid = req.body.uid;
  var password = req.body.password;
  if(!uid || !password){
    return next("incorrect_params");
  }

  if(!username_regex.test(uid)){
    return next("invalid_username");
  }

  users.getTotalStorage()
    .then(storage => {
      if(!isNaN(storage)){
        if(storage + Number(config.storage.user_limit) > config.storage.total_limit){
          throw new Error("server_storage_full");
        }
      }

      return users.addUser(uid, password, config.storage.user_limit);
    })
    .then(result => {
      var created = result[1];
      if(!created){
        throw Error("username_taken");
      }
      return drops.addDrop(uid + "/", uid, uid);
    })
    .then(() => {
      return sharing.setPermission(uid, uid + "/", "all");
    })
    .then(() => storage.mkdir(uid))
    .then(() => res.sendStatus(201))
    .catch(err => next(err));
});

/**
 * @desc HTTP DELETE request to delete a user account.
 *
 * @param {String} req.body.refresh_token The refresh token associated with the account.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
authRouter.delete("/account", (req, res, next) => {
  var refresh_token = req.query.refresh_token;
  if(!refresh_token){
    return next(new Error("incorrect_params"));
  }
  // Delete user
  var uid;
  auth.getRefreshToken(refresh_token)
    .then(token => {
      if(token === null){
        throw Error("invalid_refresh_token");
      }
      uid = token.uid;
      return users.deleteUser(token.uid);
    })
    // Delete all permissions for puddle
    .then(deletions => {
      if(deletions === 0){
        throw Error("deletion_failed");
      }
      return sharing.deletePermission(uid + "/", undefined, "all");
    })
    // Delete puddle
    .then(() => drops.deleteDrop(uid + "/"))
    // Delete all permission entries with user
    .then(() => sharing.deleteAllUserPermissions(uid))
    // Delete in storage
    .then(() => storage.delete(uid + "/"))
    // Delete refresh tokens
    .then(() => auth.invalidateRefreshTokens(uid))
    // Delete the follows records of user
    .then(() => follows.deleteAllFollows(uid, undefined))
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
});

module.exports = authRouter;
