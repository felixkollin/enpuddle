/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/self/{request}.
 *
 */

"use strict";

var express = require("express");
var selfRouter = express.Router();
var formidable = require("formidable");

var users = require("../users/users.model");
var auth = require("../auth/auth.model");
var storage = require("../storage");

/**
 * @desc HTTP GET request to get the info of the user with given access token.
 *
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 200, {uid, alias, bio}} When successful.
 * Otherwise: Send to error handler middleware.
 */
selfRouter.get("/info", (req, res, next) => {
  var access_token = req.query.access_token;
  if(!access_token){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  res.redirect("/api/users/" + uid + "/info?access_token=" + access_token);
});

/**
 * @desc HTTP GET request to get the storage info of the user with given access token.
 *
 * @param {String} req.body.access_token An access token.
 *
 * @return {status: 200, {limit, used}} When successful.
 * Otherwise: Send to error handler middleware.
 */
selfRouter.get("/storage_info", (req, res, next) => {
  var access_token = req.query.access_token;

  if(!access_token){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  var limit;
  users.getUser(uid)
    .then(user => {
      if(user === null){
        throw new Error("invalid_access_token");
      }
      user = user.get({ plain: true });
      limit = user.storageLimit;
      return storage.getUsedSpace(uid);
    })
    .then(used => {
      return res.json({used: (used / 1000000), limit: limit});
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP GET request to get the avatar of the user with given access token.
 *
 * @param {String} req.query.access_token An access token.
 *
 * @return {status: 200, 200x200 PNG image} When successful.
 * Otherwise: Send to error handler middleware.
 */
selfRouter.get("/avatar", (req, res, next) => {
  var access_token = req.query.access_token;

  if(!access_token){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  res.redirect("/api/users/" + uid + "/avatar?access_token=" + access_token);
});

/**
 * @desc HTTP PUT request to edit the info of the user with given access token.
 *
 * @param {String} req.body.access_token An access token.
 * @param {String} [req.body.bio] The new bio.
 * @param {String} [req.body.alias] The new alias.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
selfRouter.put("/info", (req, res, next) => {
  var access_token = req.body.access_token;
  var bio = req.body.bio;
  var alias = req.body.alias;

  //Check for undefined instead, we want to allow empty strings
  if(!access_token || (alias === undefined && bio === undefined)){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }

  users.editUser(uid, alias, bio)
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
});

/**
 * @desc HTTP PUT request to edit the avatar of the user with given access token.
 *
 * @param {String} req.query.access_token An access token.
 * @param {PNG/JPG/JPEG image, max 5 MB} req.body Image to make new avatar.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
selfRouter.put("/avatar", (req, res, next) => {
  var access_token = req.query.access_token;
  if(!access_token){
    return next(new Error("incorrect_params"));
  }

  var uid;
  try {
    uid = auth.validateAccessToken(access_token);
  }catch(err) {
    return next(err);
  }
  var sizeLimit = 5000000; //5 MB
  var form = new formidable.IncomingForm();
  form.keepExtensions = true;
  form.onPart = (part) => {
    if(!part.filename || part.filename.match(/.*\.(jpeg|png|jpg)$/i)){
      form.handlePart(part);
    }else{
      return next(new Error("invalid_file_type"));
    }
  };
  form.parse(req)
    .on("file", (name, file) => {
        storage.uploadAvatar(file.path, uid, ".png")
          .then(() => res.sendStatus(204))
          .catch(err => next(err));
    })
    .on("progress", (bytesReceived, bytesExpected) => {
      if(bytesReceived > sizeLimit ){
        form._error(new Error("invalid_file_size"));
      }
      var percent = (bytesReceived / bytesExpected * 100);
      //TODO send progress over socket
    })
    .on("aborted", () => {
      //TODO close progress socket
    })
    .on("error", err => {
      return next(err);
    });
});

module.exports = selfRouter;
