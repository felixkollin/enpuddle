/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Sets up the database ORM using the specified configuration.
 *
 */

"use strict";

const Sequelize = require("sequelize");

var config = require("./config");

var database = new Sequelize(config.database.name, config.database.user, config.database.password, {
  host: config.database.host,
  dialect: config.database.dialect,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  },
  logging: false
});

module.exports = database;
