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
    removeActions: true,
    removeAnnotations: true,
    removeTimestamps: true, //Overriden by removeAnnotations
    removeUnknownSpeaker: false,
    aliases: {}
  };
  this.settings = _.assign(this.defaultSettings, options);
  this.regex = {
    newLine: /\r?\n/,
    action: /\([A-Z\ ]+\)\ ?/,
    speaker: /^([A-Z\d\ \/,.\-\(\)]+)(?: \[.+\])?:\ ?/,
    timestamp: /\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?/,
    annotation: /\[.+?\]\ ?/
  };

};

const proto = TranscriptParser.prototype;

proto.parseOne = function(transcript) {
  var lines = transcript.split(this.regex.newLine)
    .filter(line => line.length > 0); //Remove blank lines
  lines = (this.settings.removeActions) ? lines.map(line => line.split(this.regex.action).join('')): lines;
  if(this.settings.removeAnnotations) {
    //Remove annotations
    lines = lines.map(line => line.split(this.regex.annotation).join(''));
  } else if(this.settings.removeTimestamps) {
    //Remove timestamps
    lines = lines.map(line => line.split(this.regex.timestamp).join(''));
  }

  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  //Current speaker
  var speaker = 'none';

  for(var i = 0; i < lines.length; i++) {
    if(lines[i].match(this.regex.speaker)) {
      speaker = this.regex.speaker.exec(lines[i])[1] || speaker;
      lines[i] = lines[i].replace(this.regex.speaker, '');
    }
    if(!(speaker in output.speaker) &&
      (!this.settings.removeUnknownSpeaker || speaker !== 'none')) {
      output.speaker[speaker] = [];
    }
    if(!this.settings.removeUnknownSpeaker || speaker !== 'none') {
      output.speaker[speaker].push(lines[i]);
      output.order.push(speaker);
    }
  }
  return output;
};

proto.resolveAliases = function(data) {
  var aliases = this.settings.aliases;
  
  if(!aliases) return;

  var transcript = data.speaker;

  for(var speaker in transcript) {
    for(var trueName in aliases) {
      for(var aliasKey in aliases[trueName]) {
        var alias = aliases[trueName][aliasKey];
          //If the regex matches
          transcript[trueName] = transcript[trueName] ?
            _.concat(transcript[trueName], transcript[speaker]) : 
            transcript[trueName] = transcript[speaker];
          delete transcript[speaker];
          break;
      }
    }
  }
  

  data.order = data.order.map(speaker => {
    for(trueName in aliases) {
      for(var aliasKey in aliases[trueName]) {
        if(speaker.search(aliases[trueName][aliasKey]) !== -1) {
          return trueName;
        }
      }
    }
    return speaker;
  });

  return data;
};


module.exports = TranscriptParser;