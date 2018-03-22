/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "subscription" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var database = require("../database");
var sockets = require("../sockets.ctrl");

const Subscription = database.define("subscription", {
  id : {
    type: Sequelize.INTEGER,
    primaryKey : true,
    autoIncrement: true
  },
  uid : { type: Sequelize.STRING(191) },
  path : { type: Sequelize.STRING(191) }
}, {timestamps: false, freezeTableName: true});

Subscription.afterDestroy((sub, options) => {
  sockets.deletedSub(sub.uid, sub.path);
});
Subscription.afterCreate((sub, options) => {
  sockets.addedSub(sub.uid, sub.path);
});

module.exports = {
  redefinedDrop : (old_path, new_path) => {
    if(new_path.charAt(new_path.length - 1) === "/"){
      //Subdrops & main regex:
      var pathRegex = new RegExp(old_path + ".*").toString().slice(1, -1);
      return database.query("UPDATE subscription SET path = REPLACE(path, :old_path, :new_path) WHERE (path REGEXP :pathRegex)", {
        replacements: {
          old_path : old_path,
          new_path : new_path,
          pathRegex : pathRegex
        },
        type: database.QueryTypes.UPDATE
      });
    }else{
      return Subscription.update(
        { path : new_path },
        { where: {
          path : old_path
        }
      });
    }
  },

  //Delete all subscription to subdrops when drop is deleted
  deletedDrop : (path) => {
    // To catch subdrops as well if dir
    if(path.charAt(path.length - 1) === "/"){
      var regex = new RegExp(path + ".*");
      path = { $regexp: regex.toString().slice(1, -1)};
    }

    return Subscription.destroy({
      where: {
        path : path
      },
      individualHooks: true
    });
  },

  getAllSubs : (uid) => {
    return Subscription.findAll({
  		where : {
  			uid : uid
  		}
    });
  },

  deleteAllSubs : (uid, path) => {
    var query = {
      uid : uid,
      path : path
    };
    if(uid === undefined){
      delete query.uid;
    }
    if(path === undefined){
      delete query.path;
    }
    return Subscription.destroy({
  		where : query,
      individualHooks: true
  	});
  },

  deleteSub : (uid, path) => {
    return Subscription.destroy({
  		where : {
        path : path,
  			uid : uid
  		},
      individualHooks: true
  	});
  },

  addSub : (uid, path) => {
    return Subscription.findOrCreate({
      where: {
        uid: uid,
        path: path
      },
      defaults: {
        uid: uid,
        path: path
      },
      individualHooks: true
  	});
  }
};
