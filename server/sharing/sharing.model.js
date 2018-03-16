/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "haspermission" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var database = require("../database");
var drops = require("../drops/drops.model");
var sockets = require("../sockets.ctrl");

const HasPermission = database.define("haspermission", {
  id : {
    type: Sequelize.INTEGER,
    primaryKey : true,
    autoIncrement: true
  },
  uid : { type: Sequelize.STRING },
  path : { type: Sequelize.STRING },
  permission : { type: Sequelize.STRING }
}, {
  timestamps: false,
  freezeTableName: true
});

HasPermission.afterDestroy((permission, options) => {
  sockets.deletedPermission(permission.path, permission.uid, permission.permission);
});
HasPermission.afterCreate((permission, options) => {
  sockets.addedPermission(permission.path, permission.uid, permission.permission);
});

module.exports = {
  redefinedDrop : (old_path, new_path) => {
    //If file, rename all underneath
    if(new_path.charAt(new_path.length - 1) === "/"){
      //Subdrops & main regex:
      var pathRegex = new RegExp(old_path + ".*").toString().slice(1, -1);
      return database.query("UPDATE haspermission SET path = REPLACE(path, :old_path, :new_path) WHERE (path REGEXP :pathRegex)", {
        replacements: {
          old_path : old_path,
          new_path : new_path,
          pathRegex : pathRegex
        },
        type: database.QueryTypes.UPDATE
      });
    }else{
      return HasPermission.update(
        { path : new_path },
        { where: {
          path : old_path
        }
      });
    }
  },
  checkPermission : (path, uid, permission) => {
    return HasPermission.findOne({
  		where : {
  			uid : uid,
        path : path,
        permission : permission
  		}
    });
  },

  // Also deletes it from subdrops of directory
  deletePermission : (path, uid, permission) => {
    //If directory, delete all underneath
    if(path.charAt(path.length - 1) === "/"){
      var regex = new RegExp(path + ".*");
      path = { $regexp: regex.toString().slice(1, -1)};
    }

    var query = {
      where : {
        uid : uid,
        path : path,
        permission : permission
      },
      individualHooks: true
    };
    if(permission === "all"){
      delete query.where.permission;
    }
    if(uid === undefined){
      delete query.where.uid;
    }

    return HasPermission.destroy(query);
  },

  deleteAllUserPermissions : (uid) => {
    return HasPermission.destroy({
      where : {
        uid : uid
      },
      individualHooks: true
    });
  },

  getPermission : (path, uid, permission) => {
    var query = {
      where : {
        uid : uid,
        path : path,
        permission : permission
      }
    };
    if(permission === "all"){
      delete query.where.permission;
    }
    if(uid === undefined){
      delete query.where.uid;
    }
    return HasPermission.findAll(query);
  },

  addBulkPermissions : (permList) => {
    var promiseList = [];
    permList.forEach(permission => {
      promiseList.push(module.exports.setPermission(permission.path,permission.uid,permission.permission));
    });
    return Promise.all(promiseList);
  },

  setPermissions : (path, uid, permList) => {
    var promiseList = [];
    permList.forEach(permission => {
      promiseList.push(module.exports.setPermission(uid, path, permission));
    });
    return Promise.all(promiseList);
  },

  //Sets a permission to a drop and its subdrops
  setPermission : (path, uid, permission) => {
    if(permission === "all"){
      return module.exports.setPermissions(path, uid, ["read", "modify", "write"]);
    }else{
      return drops.getAllWithPath(path)
      .then(dropList => {
        var promiseList = [];
        dropList.forEach(drop => {
          drop = drop.get({ plain: true });
          promiseList.push(
            HasPermission.findOrCreate({
              where : {
                uid : uid,
                path : drop.path,
                permission : permission
              },
              defaults: {
                uid : uid,
                path: drop.path,
                permission : permission
              }
            })
          );
        });
        return Promise.all(promiseList);
      });
    }
  },
};
