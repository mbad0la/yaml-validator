/**
 * yaml-validator
 * https://github.com/paazmaya/yaml-validator
 *
 * Copyright (c) Juga Paazmaya <paazmaya@yahoo.com> (https://paazmaya.fi)
 * Licensed under the MIT license.
 */

'use strict';

const fs = require('fs');

const yaml = require('js-yaml');
const check = require('check-type').init();

const YamlValidatore = function YamlValidatore(options) {
  this.options = options;
  this.logs = [];
  this.nonValidPaths = []; // list of property paths
  this.inValidFilesCount = 0;
};

/**
 * Store log messages
 * possible later use by writing a log file.
 * @param {string} msg Error message
 * @returns {void}
 */
YamlValidatore.prototype.errored = function errored(msg) {
  this.logs.push(msg);
};

/**
 * Check that the given structure is available.
 * @param {Object} doc Object loaded from Yaml file
 * @param {Object} structure Structure requirements
 * @param {string} parent Address in a dot notation
 * @returns {Array} List of not found structure paths
 */
YamlValidatore.prototype.validateStructure = function validateStructure(doc, structure, parent) {
  let notFound = [],
    current = '',
    notValid; // false or path

  parent = parent || '';

  Object.keys(structure).forEach(function eachKey(key) {

    current = parent;
    if (!check(structure).is('Array')) {
      current += (parent.length > 0 ? '.' : '') + key;
    }

    const item = structure[key];

    if (item instanceof Array) {
      if (check(doc).has(key) && check(doc[key]).is('Array')) {
        doc[key].forEach(function eachArray(child, index) {
          notValid = validateStructure([child], item, current + '[' + index + ']');
          notFound = notFound.concat(notValid);
        });
      }
      else {
        notFound.push(current);
      }
    }
    else if (typeof item === 'string') {
      notValid = !((check(structure).is('Array') || check(doc).has(key)) && check(doc[key]).is(item));

      // Key can be a index number when the structure is an array, but passed as a string
      notFound.push(notValid ? current : false);
    }
    else if (typeof item === 'object' && item !== null) {
      notValid = validateStructure(doc[key], item, current);
      notFound = notFound.concat(notValid);
    }

  });

  return notFound.filter(function filterFalse(item) {
    return item !== false;
  });
};

/**
 * Read and parse the given Yaml file.
 * @param {string} filepath Yaml file path
 * @returns {string|null} Parsed Yaml or null on failure
 */
YamlValidatore.prototype.loadFile = function loadFile(filepath) {
  // Verbose output will tell which file is being read
  const data = fs.readFileSync(filepath, 'utf8'),
    _self = this;

  let doc;

  try {
    doc = yaml.safeLoad(data, {
      onWarning: function onWarning(error) {
        _self.errored(filepath + ' > ' + error);
        if (_self.options.yaml &&
          typeof _self.options.yaml.onWarning === 'function') {
          _self.options.yaml.onWarning.call(this, error, filepath);
        }
      }
    });
  }
  catch (err) {
    console.error(err);
    return null;
  }

  return doc;
};

/**
 * Read the given Yaml file, load and check its structure.
 * @param {string} filepath Yaml file path
 * @returns {number} 0 when no errors, 1 when errors.
 */
YamlValidatore.prototype.checkFile = function checkFile(filepath) {
  const doc = this.loadFile(filepath);

  if (!doc) {
    return 1;
  }

  if (this.options.writeJson) {
    const json = JSON.stringify(doc, null, '  ');
    fs.writeFileSync(filepath.replace(/\.yml$/, '.json'), json, 'utf8');
  }

  if (this.options.structure) {
    const nonValidPaths = this.validateStructure(doc, this.options.structure);

    if (nonValidPaths.length > 0) {
      this.errored(filepath + ' is not following the correct structure, missing:');
      this.errored(nonValidPaths.join('\n'));
      this.nonValidPaths = this.nonValidPaths.concat(nonValidPaths);
    }
  }

  return 0;
};

/**
 * Create a report out of this, but in reality also run.
 * @param {array} files List of files that have been checked that they exist
 * @returns {void}
 */
YamlValidatore.prototype.validate = function validate(files) {
  const _self = this;
  this.inValidFilesCount = files.map(function mapFiles(filepath) {
    return _self.checkFile(filepath);
  }).reduce(function reduceFiles(prev, curr) {
    return prev + curr;
  });
};

/**
 * Create a report out of this, but in reality also run.
 * @returns {void}
 */
YamlValidatore.prototype.report = function report() {

  if (this.inValidFilesCount > 0) {
    this.errored('Yaml format related errors in ' + this.inValidFilesCount + ' files');
  }

  const len = this.nonValidPaths.length;
  this.errored('Total of ' + len + ' structure validation error(s)');

  if (typeof this.options.log === 'string') {
    fs.writeFileSync(this.options.log, this.logs.join('\n'), 'utf8');
  }
};

module.exports = YamlValidatore;

