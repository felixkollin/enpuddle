/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Model used to interact with the "refreshtokens" table in the database.
 *
 */

"use strict";

const Sequelize = require("sequelize");
var crypto = require("crypto");

var database = require("../database");
var users = require("../users/users.model");
var config = require("../config");

const cipher_algorithm = "aes-256-ctr";

const RefreshTokens = database.define("refreshtokens", {
  token : {
    type: Sequelize.STRING(191),
    primaryKey : true
  },
  uid : { type: Sequelize.STRING(191) },
  issue_date : { type: Sequelize.DATE }
}, {
  timestamps: false
});

function encrypt(data){
  var cipher = crypto.createCipher(cipher_algorithm, config.database.encryption_password);
  var crypted = cipher.update(data,"utf8","hex");
  crypted += cipher.final("hex");
  return crypted;
}

function decrypt(data){
  var decipher = crypto.createDecipher(cipher_algorithm, config.database.encryption_password);
  var dec = decipher.update(data,"hex","utf8");
  dec += decipher.final("utf8");
  return dec;
}

module.exports = {
  // request a new refresh token to user
  requestRefreshToken : (uid, password) => {
    password = crypto.createHash("sha256").update(password).digest("hex");
    return users.getUser(uid).then(user => {
      if(user === null){
        throw Error("invalid_username");
      } else if(password === user.password){ // Correct login
        return module.exports.generateRefreshToken(uid);
      }else{
        throw Error("incorrect_password");
      }
    });
  },

  //Generates a new refresh token, limited to 10 per user, oldest one is deleted
  generateRefreshToken : (uid) => {
    var refresh_token = crypto.createHash("sha256").update(uid + crypto.randomBytes(
      40)).digest("hex");

    return RefreshTokens.count({
        where: {
          uid : uid
        }
    }).then(count => {
      if(count < 10){
        return RefreshTokens.create({
          token : refresh_token,
          uid : uid,
          issue_date: new Date()
      	});
      }else{
        return RefreshTokens.min("issue_date").then(min => {
          return RefreshTokens.destroy({
            where: {
              uid : uid,
              issue_date : min
            },
            limit: 1
          });
        }).then(() => {
          return RefreshTokens.create({
            token : refresh_token,
            uid : uid,
            issue_date: new Date()
        	});
        });
      }
    });
  },

  getRefreshToken : (refresh_token) => {
    return RefreshTokens.findOne({
  		where : {
  			token : refresh_token
  		}
  	});
  },

  invalidateRefreshTokens : (uid) => {
    return RefreshTokens.destroy({
  		where : {
  			uid : uid
  		}
  	});
  },

  //Validate refresh token before calling this!
  generateAccessToken : (uid) => {
    var expiryDate = new Date();
    expiryDate.setHours(expiryDate.getHours() + 1); // 1 hour access token
    var access_token = {
      uid : uid,
      expiryDate : expiryDate
    };
    return {token : encrypt(JSON.stringify(access_token)), expiryDate};
  },

  //Return uid it validates
  validateAccessToken : (access_token) => {

    var token;
    try {
      var decrypted = decrypt(access_token);
      token = JSON.parse(decrypted);

    } catch(e) {
      throw Error("invalid_access_token");
    }

    if(new Date(token.expiryDate) >= new Date()){
      return token.uid;
    }else{
      throw Error("expired_access_token");
    }
  }
};
