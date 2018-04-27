/**
 * @file
 * @author Felix Kollin <felix.kollin@gmail.com>
 * @version 0.1
 * Utilities, helper functions.
 *
 */

"use strict";

module.exports = {
    parseWorkingDir : (path) => {
      if(path.charAt(path.length - 1) === "/"){ // Dir
        return path.substr(0, path.lastIndexOf("/",path.lastIndexOf("/")-1) + 1);
      }else{//File
        return path.substring(0, path.lastIndexOf("/") + 1);
      }
    },

    // /this/is/a/dir/ => dir/
    // /this/is/a/file => file
    parseName : (path) => {
      if(path.charAt(path.length - 1) === "/"){ // Dir
        var split = path.split('/');
        split.pop();
        return split.pop();
      }else{//File
        return path.split('/').pop();
      }
    },

    capitalize : (string) => {
      return string.charAt(0).toUpperCase() + string.slice(1);
    },

    getOwner : (path) => {
      return path.substr(0, path.indexOf('/'));
    },

    clampNum : (num, min, max) => {
      return num <= min ? min : num >= max ? max : num;
    }
};
