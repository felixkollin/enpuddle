/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Sets up the configuration by reading "enpuddle.cfg".
 *
 */

"use strict";

var fs = require('fs');
var path = require('path');

var config;
try {
  var configPath = path.join(__dirname, "/../enpuddle.cfg");
  config = JSON.parse(fs.readFileSync(configPath, "utf8"));
} catch (err) {
  console.error(err);
}

module.exports = config;
