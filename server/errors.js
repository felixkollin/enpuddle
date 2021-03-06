/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Error handling middleware for HTTP requests, assigns the correct status code.
 *
 */

"use strict";

var errors = module.exports;

/**
 * @desc Error handling middleware function.
 *
 * @param req The failed request.
 * @param {Error} err The error generated by the request.
 *
 * @return {status: 500, error: err.message} Could not catch error, unexpected server behaviour.
 * @return {status: 400, error: err.message} The requested information is incomplete or malformed.
 * @return {status: 422, error: err.message} The requested information is okay, but invalid.
 * @return {status: 401, error: err.message} An access token isn’t provided, or is invalid.
 * @return {status: 409, error: err.message} A conflict of data exists, even with valid information.
 * @return {status: 403, error: err.message} An access token is valid, but requires more privileges.
 *
 */
errors.handle = (err, req, res, next) => {
  var statusCode = 500;
  if(err.message === "incorrect_params"
    || err.message === "incorrect_permission"
    || err.message === "invalid_path"
    || err.message === "server_storage_full"
    || err.message === "deletion_failed"){
    statusCode = 400;
  }else if(err.message === "invalid_file_type"
    || err.message === "invalid_file_size"){
    statusCode = 422;
  }else if(err.message === "invalid_access_token"
    || err.message === "expired_access_token"
    || err.message === "invalid_refresh_token"
    || err.message === "incorrect_password"){
    statusCode = 401;
  }else if(err.message === "directory_exists"
    || err.message === "username_taken"){
    statusCode = 409;
  }else if(err.message === "insufficient_permissions"){
    statusCode = 403;
  }
  return res.status(statusCode).json({
    error: err.message
  });
};
