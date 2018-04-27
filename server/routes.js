/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Sets up the express applicatuon and routing.
 *
 */

"use strict";

var express = require("express");
var bodyParser = require("body-parser");
var app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

var errors = require("./errors");

app.use("/api/auth", require("./auth/auth.ctrl"));
app.use("/api/drops", require("./drops/drops.ctrl"));
app.use("/api/sharing", require("./sharing/sharing.ctrl"));
app.use("/api/follows", require("./follows/follows.ctrl"));
app.use("/api/users", require("./users/users.ctrl"));
app.use("/api/self", require("./self/self.ctrl"));
app.use(errors.handle); // Error handling middleware

module.exports = app;
