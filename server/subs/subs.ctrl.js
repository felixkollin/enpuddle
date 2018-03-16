/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Router which handles HTTP requests to ../api/sharing/{request}.
 *
 */

"use strict";

var express = require("express");
var subsRouter = express.Router();

var subs = require("./subs.model");
var drops = require("../drops/drops.model");
var auth = require("../auth/auth.model");
var sharing = require("../sharing/sharing.model");

/**
 * @desc HTTP GET request to list the paths the user is subscribed to.
 *
 * @param {String} req.body.access_token An access token.
 *
 * @return {status 200, data: [path]} When successful.
 * Otherwise: Send to error handler middleware.
 */
subsRouter.get("/list", (req, res, next) => {
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

  subs.getAllSubs(uid)
    .then(subList => {
      var list = [];
      subList.forEach(sub => {
        sub = sub.get({ plain: true });
        list.push(sub.path);
      });
      return res.json({"data": list});
    })
    .catch(err => next(err));
});

/**
 * @desc HTTP POST request to add a path the user is subscribed to.
 *
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.path Path to subscribe to.
 *
 * @return {status: 201} When successful.
 * Otherwise: Send to error handler middleware.
 */
 subsRouter.post("/sub", (req, res, next) => {
   var access_token = req.body.access_token;
   var path = req.body.path;
   if(!access_token || !path){
     return next(new Error("incorrect_params"));
   }

   var uid;
   try {
     uid = auth.validateAccessToken(access_token);
   }catch(err) {
     return next(err);
   }

   drops.getDrop(path)
     .then(result => {
       if(result === null){
         throw Error("invalid_path");
       }
       return sharing.checkPermission(path, uid, "read");
     })
     // Can only sub when you have read permission
     .then(result => {
       if(result === null){
         throw Error("insufficient_permissions");
       }
       return subs.addSub(uid, path);
     })
     .then(() => res.sendStatus(201))
     .catch(err => next(err));
 });

/**
 * @desc HTTP DELETE request to delete a path the user is subscribed to.
 *
 * @param {String} req.body.access_token An access token.
 * @param {String} req.body.path Path to unsubscribe from.
 *
 * @return {status: 204} When successful.
 * Otherwise: Send to error handler middleware.
 */
 subsRouter.delete("/sub", (req, res, next) => {
   var access_token = req.query.access_token;
   var path = req.query.path;
   if(!access_token || !path){
     return next(new Error("incorrect_params"));
   }

   var uid;
   try {
     uid = auth.validateAccessToken(access_token);
   }catch(err) {
     return next(err);
   }

   subs.deleteSub(uid, path)
    .then(() => res.sendStatus(204))
    .catch(err => next(err));
 });

module.exports = subsRouter;
