/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "users" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var database = require("../database");
var storage = require("../storage");
var crypto = require("crypto");

const Users = database.define("users", {
  uid : {
    type: Sequelize.STRING,
    primaryKey : true
  },
  password : { type: Sequelize.STRING },
  alias : { type: Sequelize.STRING },
  bio : { type: Sequelize.STRING },
  storageLimit : { type: Sequelize.INTEGER }
}, {
  timestamps: false
});

module.exports = {
  getUser : (uid) => {
    return Users.findOne({
  		where : {
  			uid : uid
  		}
    });
  },

  getTotalStorage : () => {
    return Users.sum("storageLimit");
  },

  deleteUser : (uid) => {
  return Users.destroy({
  		where : {
  			uid : uid
  		}
  	});
  },

  addUser : (uid, password, storageLimit) => {
    password = crypto.createHash("sha256").update(password).digest("hex");
    return Users.findOrCreate({
      where: {
        uid: uid
      },
      defaults: {
    		uid : uid,
    		password : password,
    		alias  : uid,
    		bio : "",
    		storageLimit : storageLimit
      }
  	});
  },

  editUser : (uid, alias, bio) => {
    var update = {
      bio : bio,
      alias : alias
    };
    if(bio === undefined){
      delete update.bio;
    }
    if(alias === undefined){
      delete update.alias;
    }
    return Users.update(
      update,
      { where: {
        uid : uid
      }
    });
  }
};
