/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Abstraction of on disk storage functionality.
 *
 */

"use strict";

var fs = require("fs-extra");
var jimp = require("jimp");
var path = require("path");

var config = require("./config");
var base_dir = path.join(__dirname, "/../" + config.storage.base_dir);
var default_avatar = path.join(__dirname, "/assets/avatar.png");
var avatars_dir = path.join(__dirname, "/../" + config.storage.avatars_dir);

function readSizeRecursive(item, total) {
  return fs.lstat(item)
  .then(stats => {
    total.size += stats.size;
    if(stats.isDirectory()){
      return fs.readdir(item);
    }
  })
  .then(diritems => {
    if(diritems){
      var recursive = [];
      diritems.forEach(diritem => {
        recursive.push(readSizeRecursive(path.join(item, diritem), total));
      });
      return Promise.all(recursive);
    }
  });
}

module.exports = {
  init : () => {
    return fs.ensureDir(base_dir)
    .then(() => {
      return fs.ensureDir(avatars_dir);
    });
  },
  mkdir : (drop) => {
    return fs.ensureDir(base_dir + drop);
  },
  download : (res, next, drop) => {
    return res.download(base_dir + drop, function(err){
      if (err) {
        return next(new Error("download_failed"));
      }
    });
  },
  upload : (tmp_path, new_path) => {
    return fs.copy(tmp_path, base_dir + new_path);
  },
  delete : (drop) => {
    return fs.remove(base_dir + drop);
  },
  rename : (drop, new_path) => {
    return fs.rename(base_dir + drop, base_dir + new_path);
  },
  copy : (drop, new_path) => {
    return fs.copy(base_dir + drop, base_dir + new_path);
  },
  getUsedSpace : (uid) => {
    var total = {size: 0};
    return readSizeRecursive(base_dir + uid + "/", total)
    .then(() =>{
      return total.size;
    });
  },
  getSize : (path) => {
    var total = {size: 0};
    return readSizeRecursive(base_dir + path, total)
    .then(() =>{
      return total.size;
    });
  },

  uploadAvatar : (tmp_path, uid, extension) => {
    var destination = avatars_dir + uid + extension;
    return jimp.read(tmp_path)
     .then(image => {
      return image.cover(256, 256)     // resize
           .write(destination); // save
      });
  },
  hasAvatar : (uid) => {
    return fs.pathExists(avatars_dir + uid + ".png");
  },
  getDefaultAvatarPath : () => {
    return default_avatar;
  },
  getAvatarPath : (uid) => {
    return avatars_dir + uid + ".png";
  }
};
