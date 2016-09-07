'use strict';

/***********************
 * Module dependencies
 ***********************/
const _ = require('lodash');
const Promise = require('bluebird');
const byline = require('byline');


/***********************
 * Object creation
 ***********************/
const TranscriptParser = function(options) {
  options = options || {};
  this.defaultSettings = {
    removeActions: true,
    removeAnnotations: true,
    removeTimestamps: true, //Overriden by removeAnnotations
    removeUnknownSpeakers: false,
    aliases: {},
    regex: {
      newLine: /\r?\n/,
      action: /\([A-Z\ ]+\)\ ?/,
      speaker: /^((?:\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?)?[A-Z\d\ \/,.\-\(\)]+?)(?:\ ?\[[A-z\ ]+\])? ?:\ ?/,
      timestamp: /\ ?\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?/,
      annotation: /\[.+?\]\ ?/
    },
    blacklist: []
  };
  this.settings = _.assign(this.defaultSettings, options);
  this.regex = this.settings.regex;
};

//Expose the object
exports = module.exports = TranscriptParser;

const proto = TranscriptParser.prototype;

/***********************
 * Synchronous parseOne method
 ***********************/
proto.parseOneSync = function(transcript) {
  var lines = transcript.split(this.regex.newLine)
    .filter(line => line.length > 0); //Remove blank lines
  lines = this.settings.removeActions ?
    lines.map(line => removeAll(line, this.regex.action)) : lines;

  if(this.settings.removeAnnotations) {
    //Remove annotations
    lines = lines.map(line => removeAll(line, this.regex.annotation));
  } else if(this.settings.removeTimestamps) {
    //Remove timestamps
    lines = lines.map(line => removeAll(line, this.regex.timestamp));
  }
  lines = lines.filter(line => line.length > 0); //Remove newly blank lines

  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  //Current speaker
  var speaker = 'none';
  //Are we ignoring the line because of a blacklisted speaker?
  var ignore = false;

  for(var i = 0; i < lines.length; i++) {
    if(lines[i].match(this.regex.speaker)) {
      //Regex match - is speaker
      speaker = this.regex.speaker.exec(lines[i])[1].trim();
      //Remove the speaker from the line
      lines[i] = lines[i].replace(this.regex.speaker, '');
      //Ignore the speaker if he is in our blacklist
      ignore = (this.settings.blacklist.indexOf(speaker) > -1);
    }
    if(ignore || (speaker === 'none' && this.settings.removeUnknownSpeakers)) continue;
    //If the speaker's key doesn't already exist
    if(!(speaker in output.speaker)) {
      //Set the output's speaker key to a new empty array
      output.speaker[speaker] = [];
    }
    //Add the text to the output speaker's key and speaker name to the order array
    output.speaker[speaker].push(lines[i]);
    output.order.push(speaker);
  }
  return output;
};

/***********************
 * Asynchronous parseOne method
 ***********************/
proto.parseOne = function(transcript, cb) {
  const hasCallback = (typeof cb !== 'undefined' && cb !== null);
  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];
  let speaker = 'none'; //Current speaker

  return Promise.try(() => {
    //Remove blank lines
    let lines = _.filter(transcript.split(this.regex.newLine), line => (line.length > 0));
    let ignore = false, match = null;

    lines = _.map(lines, line => {
      if(this.settings.removeActions)
        line = removeAll(line, this.regex.action);
      if(this.settings.removeAnnotations)
        line = removeAll(line, this.regex.annotation);
      else if(this.settings.removeTimestamps)
        line = removeAll(line, this.regex.timestamp);
      return line;
    });

    //Remove newly blank lines
    lines = _.filter(lines, line => (line.length > 0));
    _.each(lines, (line) => {
      if((match = this.regex.speaker.exec(line)) !== null) {
        //Regex match
        speaker = match[1].trim();
        //Remove the speaker from the line
        line = line.replace(this.regex.speaker, '');
        ignore = (this.settings.blacklist.indexOf(speaker) > -1);
      }

      //If speaker was blacklisted, return
      if(ignore || (speaker === 'none' && this.settings.removeUnknownSpeakers)) return;
      //If the speaker's key doesn't already exist
      if(!(speaker in output.speaker)) {
        //Set the output's speaker key to a new empty array
        output.speaker[speaker] = [];
      }
      //Add the text to the output speaker's key and speaker name to the order array
      output.speaker[speaker].push(line);
      output.order.push(speaker);
    });
    if(hasCallback) cb(null, output);
    return Promise.resolve(output);
  }).catch(err => {
    if(hasCallback) cb(err);
    else return Promise.reject(err);
  });
};

/***********************
 * Synchronous resolveAliases method
 ***********************/
proto.resolveAliasesSync = function(data) {
  const aliases = this.settings.aliases;
  if(_.isEmpty(aliases)) return data;
  const speakers = data.speaker;

  _.each(speakers, (lines, speakerName) => {
    _.each(aliases, (regexes, newName) => {
      _.each(regexes, (regex) => {
        //If the regex matches
        if(regex.test(speakerName) && speakerName != newName) {
          if(newName in speakers) {
            //Add the lines from the regex-matched speaker
            //to the new speaker if the new speaker exists
            speakers[newName] = _.concat(lines, speakers[newName]);
          } else {
            //Otherwise, make a new list
            speakers[newName] = lines;
          }
          //Delete the old key
          delete speakers[speakerName];
          //Break
          return false;
        }
      });
    });
  });

  //Fix the names in the order array
  data.order = data.order.map(speaker => {
    for(var trueName in aliases) {
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
  const hasCallback = (typeof cb !== 'undefined' && cb !== null);

  if(_.isEmpty(aliases)) {
    if(hasCallback) return cb(null, data);
    else return Promise.resolve(data);
  }

  return Promise.try(() => {
    const speakers = data.speaker;
    return Promise.all(_.keys(speakers).map(speakerName => {
      return Promise.all(_.keys(aliases).map(trueName => {
        return Promise.each(aliases[trueName], regex => {
          //If the regex matches
          if(regex.test(speakerName) && speakerName != trueName) {
            //Add the lines from the regex-matched speaker
            //to the new speaker if the new speaker exists
            speakers[trueName] = speakers[trueName] ?
              _.concat(speakers[speakerName], speakers[trueName]) :
              //Otherwise, make a new list
              speakers[speakerName];
            //Delete the old key
            delete speakers[speakerName];
            return;
          }
        });
      }));
    }));
  }).then(() => {
    return Promise.each(data.order, (speaker, speakerIndex) => {
      return Promise.all(_.map(aliases, (alias, trueName) => {
        return Promise.all(_.map(alias, (regex) => {
          if(speaker.search(regex) !== -1) {
            data.order[speakerIndex] = trueName;
            return;
          }
        }));
      }));
    });
  }).then(() => {
    if(hasCallback) cb(null, data);
    return Promise.resolve(data);
  }).catch(err => {
    if(hasCallback) cb(err);
    else return Promise.reject(err);
  });
};

proto.parseStream = function(inputStream, cb) {
  const stream = byline.createStream(inputStream);
  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  var speaker = 'none';
  var ignore = false;

  stream.on('readable', () => {
    const line = stream.read();
    if(line === null) return cb(null, output);

    var filteredLine = this.filterLine(line);
    if(filteredLine) {
      if(filteredLine.match(this.regex.speaker)) {
        //Regex match - is speaker
        speaker = this.regex.speaker.exec(filteredLine)[1].trim();
        //Remove the speaker from the line
        filteredLine = filteredLine.replace(this.regex.speaker, '');
        ignore = (this.settings.blacklist.indexOf(speaker) > -1);
      }
      if(ignore || (speaker === 'none' && this.settings.removeUnknownSpeakers)) return;
      //If the speaker's key doesn't already exist
      if(!(speaker in output.speaker)) {
        //Set the output's speaker key to a new empty array
        output.speaker[speaker] = [];
      }
      //If the speaker is defined or the setting to remove undefined speakers is false
      //Add the text to the output speaker's key and speaker name to the order array
      output.speaker[speaker].push(filteredLine);
      output.order.push(speaker);
    }
  });

};

//Filters a line based on the defined settings
//Returns null on the line being completely removed
proto.filterLine = function(line) {
  if(typeof line !== 'string') {line = line.toString();}
  line = this.settings.removeActions ? removeAll(line, this.regex.action) : line;
  if(this.settings.removeAnnotations) {
    line = removeAll(line, this.regex.annotation);
  } else if(this.settings.removeTimestamps) {
    line = removeAll(line, this.regex.timestamp);
  }
  if(line.length <= 0) return null;
  return line;
};

function removeAll(text, regex) {
  return text.split(regex).join('');
}
