/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "drops" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var database = require("../database");
var sockets = require("../sockets.ctrl");
var utils = require("../utils");

const Drops = database.define("drops", {
  path : {
    type: Sequelize.STRING(191),
    primaryKey : true
  },
  createdUID : { type: Sequelize.STRING(191) },
  createdDate : { type: Sequelize.DATE },
  editUID : { type: Sequelize.STRING(191) },
  editDate : { type: Sequelize.DATE },
  ownerUID : { type: Sequelize.STRING(191) }
}, { timestamps: false });

Drops.beforeDestroy((drop, options) => {
  sockets.deletedDrop(drop.path);
  sockets.modifiedDrop(utils.parseWorkingDir(drop.path));
});
Drops.beforeUpsert((drop, options) => {
  sockets.modifiedDrop(utils.parseWorkingDir(drop.path));
});

//Hooks does not work on this raw query, that is why socket emits is not used
module.exports = {
  redefineDrop : (old_path, new_path, editUID, newOwner) => {
    //If directory, rename all underneath
    if(new_path.charAt(new_path.length - 1) === "/"){
      //Subdrops regex:
      var pathRegex = new RegExp(old_path + ".*").toString().slice(1, -1);
      var date = new Date().toISOString().slice(0, 19).replace("T", " ");
      return database.query("UPDATE drops SET path = REPLACE(path, :old_path, :new_path), ownerUID = :ownerUID, editUID = :editUID, editDate = :date WHERE (path REGEXP :pathRegex)", {
        replacements: {
          old_path : old_path,
          new_path : new_path,
          editUID : editUID,
          ownerUID : newOwner,
          date : date,
          pathRegex : pathRegex
        },
        type: database.QueryTypes.UPDATE
      }).then(() => {
        sockets.modifiedDrop(utils.parseWorkingDir(old_path));
        sockets.modifiedDrop(utils.parseWorkingDir(new_path));
        sockets.redefinedDrop(old_path, new_path);

        //Emit subdrop changes to sockets
        module.exports.getSubDrops(old_path).then(dropList => {
          dropList.forEach(subdrop => {
            subdrop = subdrop.get({ plain: true });
            var new_sub_path = subdrop.path.replace(old_path, new_path);
            sockets.redefinedDrop(subdrop.path, new_sub_path);
          });
        });
        return Promise.resolve();
      });
    }else{
      return Drops.update(
        { path : new_path,
          editUID : editUID,
          editDate : new Date()
        },
        { where: {
          path : old_path
        }
      }).then(() => {
        sockets.modifiedDrop(utils.parseWorkingDir(old_path));
        sockets.modifiedDrop(utils.parseWorkingDir(new_path));
        sockets.redefinedDrop(old_path, new_path);
        return Promise.resolve();
      });
    }
  },
  deleteDrop : (path) => {
    //If directory, delete all underneath
    if(path.charAt(path.length - 1) === "/"){
      var regex = new RegExp(path + ".*");
      path = { $regexp: regex.toString().slice(1, -1)};
    }

    return Drops.destroy({
      where: {
        path : path
      },
      individualHooks: true
    });
  },
  getSubDrops : (path) => {
    //If not directory, there are no subdrops
    if(path.charAt(path.length - 1) === "/"){
      return Promise.resolve([]);
    }

    //Path followed by /anything = subdrops
    var regex = new RegExp(path + ".+"); //To escape all special chars

    return Drops.findAll({
      where: {
        path : { $regexp: regex.toString().slice(1, -1)}
      }
    });
  },

  getDrop : (path) => {
    return Drops.findOne({
  		where : {
        path : path
  		}
    });
  },

  getAllWithPath : (path) => {
    //If directory, get subdrops as well
    if(path.charAt(path.length - 1) === "/"){
      var regex = new RegExp(path + ".*");
      path = { $regexp: regex.toString().slice(1, -1)};
    }

    return Drops.findAll({
      where: {
        path : path
      }
    });
  },

  addDrop : (path, createdUID, ownerUID) => {
    var date = new Date();
    return Drops.upsert({
      path : path,
      createdUID : createdUID,
      createdDate : date,
      editUID : createdUID,
      editDate : date,
      ownerUID : ownerUID
    });
  },

  addBulkDrops : (dropList) => {
    var promiseList = [];
    dropList.forEach(drop => {
      promiseList.push(module.exports.addDrop(drop.path, drop.createdUID, drop.ownerUID));
    });
    return Promise.all(promiseList);
  }
};
