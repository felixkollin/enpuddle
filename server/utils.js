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
    }
};
