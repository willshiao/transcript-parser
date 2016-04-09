"use strict";
/***********************
 Module dependencies
 ***********************/
// const S = require('string');
const _ = require('lodash');


/***********************
 Object creation
 ***********************/
const TranscriptParser = function (options) {
  options = options || {};
  this.defaultSettings = {
    removeActions: true
  };
  this.settings = _.assign(this.defaultSettings, options);
  this.regex = {
    newLine: /\r?\n/,
    newLineOrAction: /(?:\r?\n|\([A-Z\ ]+\))/,
    speaker: /^([A-Z\d\ \/,.\-\(\)]+)(?: \[.+\])?:/,
    timestamp: /\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?/,
    annotation: /\[.+?\]\ ?/
  };

};

const proto = TranscriptParser.prototype;

proto.parseOne = function(transcript) {
  const lines = transcript.split(this.settings.removeActions?
    this.regex.newLineOrAction : this.regex.newLine)
    //Remove blank lines
    .filter(line => line.length > 0)
    //Remove annotations
    .map(line => line.split(this.regex.annotation).join(''));
  const output = {};
  output.speaker = {};
  output.order = [];

  var speaker = 'none';

  for(var i = 0; i < lines.length; i++) {
    if(lines[i].match(this.regex.speaker)) {
      speaker = this.regex.speaker.exec(lines[i])[1] || speaker;
      lines[i] = lines[i].replace(this.regex.speaker, '');
    }
    if(!(speaker in output.speaker)) {
      output.speaker[speaker] = [];
    }
    output.speaker[speaker].push(lines[i]);
    output.order.push(speaker);

  }
  return output;
};


module.exports = TranscriptParser;