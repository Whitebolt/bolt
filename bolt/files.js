'use strict';

/**
 * @module bolt/bolt
 */

const Promise = require('bluebird');
const fs = require('fs');
const path = require('path');
const requireX = require('require-extra');
const lstat = Promise.promisify(fs.lstat);


/**
 * Get the root directory full path from the process arguments.  The root is
 * where the application was called from.
 *
 * @todo  How robust is this? How much better than using __dirname.  What happens when app called from a different directory?
 *
 * @public
 * @returns {string}    The root file path.
 */
function getRoot() {
  return path.dirname(process.argv[1]);
}

function fileExists(filePath) {
  return lstat(filePath).then(stat=>!!stat,err=>false);
}

/**
 * Get the filename of the function, which called the function calling
 * this method.  Use stack trace to achieve this.
 *
 * @todo  Is this robust? Needs testing in multiple circumstances.
 *
 * @public
 * @returns {string}    The file name of the calling function.
 */
function getCallerFileName() {
  let prepareStackTrace = Error.prepareStackTrace;
  let err = new Error();
  let callerfile;
  let currentfile;

  try {
    Error.prepareStackTrace = (err, stack) => stack;
    currentfile = err.stack.shift().getFileName();
    while (err.stack.length) {
      let level = err.stack.shift();
      callerfile = level.getFileName();
      if(callerfile && (currentfile !== callerfile)) break;
    }
  } catch (err) {
  }

  Error.prepareStackTrace = prepareStackTrace;
  return callerfile;
}

/**
 * Find all the directories within a set of directories, which matches a given
 * filter.  Can be passed one directory or an array of directories.
 *
 * @todo  Needs fully testing and perhaps there is a more robust better way to do this, which allows for better options too.
 *
 * @public
 * @param {Array|string} dirPath    Path(s) to search.
 * @param {string} dirNameToFind    Name of directories to return.
 * @returns {Promise}               The found directories.
 */
function directoriesInDirectory(dirPath, dirNameToFind) {
  return ((Array.isArray(dirPath)) ?
    _directoriesInDirectories(dirPath) :
    _directoriesInDirectory(dirPath)
  ).filter(dirPath => {
    return (dirNameToFind && dirNameToFind.length) ?
      dirNameToFind.indexOf(path.basename(dirPath)) !== -1 :
      true;
  });
}

/**
 * Get a list of directories within the directories supplied. Will return a
 * promise resolving to the found directories.
 *
 * @private
 * @param {Array|string} dirPaths   Path(s) to search.
 * @returns {Promise}               Found directories.
 */
function _directoriesInDirectories(dirPaths) {
  return Promise.all(
    dirPaths.map(dirPath => directoriesInDirectory(dirPath))
  ).then(dirPaths => bolt.flattenDeep(dirPaths));
}

/**
 * Get a list of directories within the directory supplied. Will return a
 * promise resolving to the found directories. Unlike,
 * _directoriesInDirectories() it will not search a list of directories just
 * the one supplied. Will return a promise resolving to the found directories.
 *
 * @private
 * @param {string} dirPath    Path to search.
 * @returns {Promise}         Found directories.
 */
function _directoriesInDirectory(dirPath) {
  dirPath = path.resolve(path.dirname(getCallerFileName()), dirPath);

  return Promise.promisify(fs.readdir)(dirPath)
    .then(file => file, err => [])
    .map(filename => path.join(dirPath, filename))
    .filter(fileName => lstat(fileName).then(stat => stat.isDirectory()))
    .map(dirName => path.resolve(dirPath, dirName));
}

/**
 * Find the files in given directory with the given extension.
 *
 * @todo  Add better filter on multiple extension types and/or other criteria.
 *
 * @public
 * @param {string} dirPath      Path to search.
 * @param {string} [ext='js']   Filter files based on this extension.
 * @returns {Promise}           Promise resoving to found files.
 */
function filesInDirectory(dirPath, ext = 'js') {
  dirPath = path.resolve(path.dirname(getCallerFileName()), dirPath);
  let xExt = new RegExp('\.' + ext);

  return Promise.promisify(fs.readdir)(dirPath)
    .then(file => file, err => [])
    .filter(fileName => xExt.test(fileName))
    .map(fileName => path.resolve(dirPath, fileName))
}

function isPathRelativeTo(testPath, isRelativeTo) {
  const xRelativeToDir = new RegExp('^' + path.normalize(isRelativeTo).replace('/', '\/'));
  return xRelativeToDir.test(path.normalize(testPath));
}


module.exports = {
  filesInDirectory, directoriesInDirectory,
  getCallerFileName, getRoot, require: requireX,
  fileExists, isPathRelativeTo
};