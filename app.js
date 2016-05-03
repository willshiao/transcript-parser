"use strict";
/***********************
 * Module dependencies
 ***********************/
// const S = require('string');
const _ = require('lodash');
const Promise = require('bluebird');


/***********************
 * Object creation
 ***********************/
const TranscriptParser = function (options) {
  options = options || {};
  this.defaultSettings = {
    removeActions: true,
    removeAnnotations: true,
    removeTimestamps: true, //Overriden by removeAnnotations
    removeUnknownSpeakers: false,
    aliases: {}
  };
  this.settings = _.assign(this.defaultSettings, options);
  this.regex = {
    newLine: /\r?\n/,
    action: /\([A-Z\ ]+\)\ ?/,
    speaker: /^((?:\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?)?[A-Z\d\ \/,.\-\(\)]+)(?: \[.+\])?:\ ?/,
    timestamp: /\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?/,
    annotation: /\[.+?\]\ ?/
  };

};

const proto = TranscriptParser.prototype;
const tp = this;

/***********************
 * Synchronous parseOne method
 ***********************/
proto.parseOneSync = function(transcript) {
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
      //Regex match
      speaker = this.regex.speaker.exec(lines[i])[1];
      //Remove the speaker from the line
      lines[i] = lines[i].replace(this.regex.speaker, '');
    }
    //If the speaker's key doesn't already exist
    if(!(speaker in output.speaker) &&
      //And the speaker is defined or the setting to remove undefined speakers is false
      (speaker !== 'none' || !this.settings.removeUnknownSpeakers)) {
      //Set the output's speaker key to a new empty array
      output.speaker[speaker] = [];
    }
    //If the speaker is defined or the setting to remove undefined speakers is false
    if(speaker !== 'none' || !this.settings.removeUnknownSpeakers) {
      //Add the text to the output speaker's key and speaker name to the order array
      output.speaker[speaker].push(lines[i]);
      output.order.push(speaker);
    }
  }
  return output;
};

/***********************
 * Asynchronous parseOne method
 ***********************/
proto.parseOne = function(transcript, cb) {
  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  //Current speaker
  var speaker = 'none';

  //Remove blank lines
  return Promise.filter(transcript.split(this.regex.newLine), line => line.length > 0)
    .then(lines => {
      if(this.settings.removeActions) {
        return Promise.map(lines, line => line.split(this.regex.action).join(''))
      }
      return Promise.resolve(lines);
    }).then(lines => {
      if(this.settings.removeAnnotations) {
        //Remove annotations
        return Promise.map(lines, line => line.split(this.regex.annotation).join(''));
      } else if(this.settings.removeTimestamps) {
        //Remove timestamps
        return Promise.map(lines, line => line.split(this.regex.timestamp).join(''));
      }
      return Promise.resolve(lines);
    }).then(lines => {
      return Promise.each(lines, (line, index) => {
        if(line.match(this.regex.speaker)) {
          //Regex match
          speaker = this.regex.speaker.exec(line)[1];
          //Remove the speaker from the line
          line = line.replace(this.regex.speaker, '');
        }
        //If the speaker's key doesn't already exist
        if(!(speaker in output.speaker) &&
          //And the speaker is defined or the setting to remove undefined speakers is false
          (speaker !== 'none' || !this.settings.removeUnknownSpeakers)) {
          //Set the output's speaker key to a new empty array
          output.speaker[speaker] = [];
        }
        //If the speaker is defined or the setting to remove undefined speakers is false
        if(speaker !== 'none' || !this.settings.removeUnknownSpeakers) {
          //Add the text to the output speaker's key and speaker name to the order array
          output.speaker[speaker].push(line);
          output.order.push(speaker);
        }
      });
    }).then(() => {
      if(typeof cb !== 'undefined' && cb !== null) cb(null, output);
    })
    .catch(err => {
      if(typeof cb !== 'undefined' && cb !== null) cb(err)
    });
};

/***********************
 * Synchronous resolveAliases method
 ***********************/
proto.resolveAliasesSync = function(data) {
  const aliases = this.settings.aliases;
  if(_.isEmpty(aliases)) return data;
  const speakers = data.speaker;

  for(var speaker in speakers) {
    for(var trueName in aliases) {
      for(var aliasKey in aliases[trueName]) {
        var aliasRegex = aliases[trueName][aliasKey];
        //If the regex matches
        if(aliasRegex.test(speaker)) {
          //Add the lines from the regex-matched speaker
          //to the new speaker if the new speaker exists
          speakers[trueName] = speakers[trueName] ?
            _.concat(speakers[trueName], speakers[speaker]) :
          //Otherwise, make a new list 
            speakers[trueName] = speakers[speaker];
          //Delete the old key
          delete speakers[speaker];
          break;
        }
      }
    }
  }
  
  //Fix the names in the order array
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

/***********************
 * Asynchronous resolveAliases method
 ***********************/
proto.resolveAliases = function(data, cb) {
  const aliases = this.settings.aliases;
  if(_.isEmpty(aliases)) return cb(null, data);
  const speakers = data.speaker;

  return Promise.all(_.keys(speakers).map(speakerName => {
    return Promise.all(_.keys(aliases).map(trueName => {
      return Promise.each(aliases[trueName], regex => {
        //If the regex matches
        if(regex.test(speakerName)) {
          //Add the lines from the regex-matched speaker
          //to the new speaker if the new speaker exists
          speakers[trueName] = speakers[trueName] ?
            _.concat(speakers[trueName], speakers[speakerName]) :
            //Otherwise, make a new list 
            speakers[trueName] = speakers[speakerName];
          //Delete the old key
          delete speakers[speakerName];
          return;
        }
      })
    }))
  })).then(() => {
    return Promise.each(data.order, (speaker, speakerIndex) => {
      return Promise.all(_.map(aliases, (alias, trueName) => {
        return Promise.all(_.map(alias, (regex, regexIndex) => {
          if(speaker.search(regex) !== -1) {
            return data.order[speakerIndex] = trueName;
          }
        }));
      }));
    });
  }).then(() => {
    if(typeof cb !== 'undefined' && cb !== null) cb(null, data);
  }).catch(err => {
    if(typeof cb !== 'undefined' && cb !== null) cb(err);
  });
};

module.exports = TranscriptParser;