/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "follows" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var database = require("../database");
var sockets = require("../sockets.ctrl");

const Follows = database.define("follows", {
  id : {
    type: Sequelize.INTEGER,
    primaryKey : true,
    autoIncrement: true
  },
  uid : { type: Sequelize.STRING(191) },
  path : { type: Sequelize.STRING(191) }
}, {timestamps: false});

Follows.afterDestroy((follow, options) => {
  sockets.deletedFollow(follow.uid, follow.path);
});
Follows.afterCreate((follow, options) => {
  sockets.addedFollow(follow.uid, follow.path);
});

module.exports = {
  // Notify all that follows path with message
  notifyAll : (path, message) => {
    module.exports.getAllFollowing(path).then(list => {
      list.forEach(follow => {
        sockets.notification(follow.uid, message);
      });
    });
  },

  redefinedDrop : (old_path, new_path) => {
    if(new_path.charAt(new_path.length - 1) === "/"){
      //Subdrops & main regex:
      var pathRegex = new RegExp(old_path + ".*").toString().slice(1, -1);
      return database.query("UPDATE follows SET path = REPLACE(path, :old_path, :new_path) WHERE (path REGEXP :pathRegex)", {
        replacements: {
          old_path : old_path,
          new_path : new_path,
          pathRegex : pathRegex
        },
        type: database.QueryTypes.UPDATE
      });
    }else{
      return Follows.update(
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

    return Follows.destroy({
      where: {
        path : path
      },
      individualHooks: true
    });
  },

  getAllFollows : (uid) => {
    return Follows.findAll({
  		where : {
  			uid : uid
  		}
    });
  },
  getAllFollowing : (path) => {
    return Follows.findAll({
  		where : {
  			path : path
  		}
    });
  },

  deleteAllFollows : (uid, path) => {
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
    return Follows.destroy({
  		where : query,
      individualHooks: true
  	});
  },

  deleteFollow : (uid, path) => {
    return Follows.destroy({
  		where : {
        path : path,
  			uid : uid
  		},
      individualHooks: true
  	});
  },

  addFollow : (uid, path) => {
    return Follows.findOrCreate({
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
