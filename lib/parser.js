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
const TranscriptParser = function (options) {
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
  lines = this.settings.removeActions ? lines.map(line => removeAll(line, this.regex.action)): lines;
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
  //Current speaker
  var speaker = 'none';

  //Convert synchronous errors to asynchronous ones
  try {
    //Remove blank lines
    return Promise.filter(transcript.split(this.regex.newLine), line => line.length > 0)
      .then(lines => {
        if(this.settings.removeActions) {
          return Promise.map(lines, line => removeAll(line, this.regex.action));
        }
        return Promise.resolve(lines);
      }).then(lines => {
        if(this.settings.removeAnnotations) {
          //Remove annotations
          return Promise.map(lines, line => removeAll(line, this.regex.annotation));
        } else if(this.settings.removeTimestamps) {
          //Remove timestamps
          return Promise.map(lines, line => removeAll(line, this.regex.timestamp));
        }
        return Promise.resolve(lines);
      })
      .then(lines => {
        //Remove newly blank lines
        return Promise.filter(lines, line => line.length > 0);
      })
      .then(lines => {
        var ignore = false;
        return Promise.each(lines, (line) => {
          if(line.match(this.regex.speaker)) {
            //Regex match
            speaker = this.regex.speaker.exec(line)[1].trim();
            //Remove the speaker from the line
            line = line.replace(this.regex.speaker, '');
            ignore = (this.settings.blacklist.indexOf(speaker) > -1);
          }
          //If speaker was blacklisted, return
          if(ignore) return;
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
        if(hasCallback) cb(null, output);
        return Promise.resolve(output);
      }).catch(err => {
        if(hasCallback) cb(err);
        else return this.reject(err);
      });
    } catch(err) {
      if(hasCallback) cb(err);
      else return Promise.reject(err);
    }
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
      _.each(regexes, (regex, regexKey) => {
        //If the regex matches
        if(regex.test(speakerName) && speakerName != newName) {
          if(newName in speakers) {
            //Add the lines from the regex-matched speaker
          //to the new speaker if the new speaker exists
            speakers[newName] = _.concat(lines, speakers[newName]);
          } else {
            //Otherwise, make a new list 
            speakers[newName] = lines.slice();
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
    if(hasCallback) cb(null, data);
    return Promise.resolve(data);
  }

  //Convert synchronous errors to asynchronous ones
  try {
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
              speakers[trueName] = speakers[speakerName];
            //Delete the old key
            delete speakers[speakerName];
            return;
          }
        });
      }));
    })).then(() => {
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
      else return this.reject(err);
    });
  } catch(err) {
    if(hasCallback) cb(err);
    else return Promise.reject(err);
  }
};

proto.parseStream = function(inputStream, cb) {
  const stream = byline.createStream(inputStream);
  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];
  
  var line;
  var speaker = 'none';

  stream.on('readable', () => {
    const line = stream.read()
    if(line === null) return cb(null, output);

    var filteredLine = this.filterLine(line);
    if(filteredLine) {
      if(filteredLine.match(this.regex.speaker)) {
        //Regex match - is speaker
        speaker = this.regex.speaker.exec(filteredLine)[1].trim();
        //Remove the speaker from the line
        filteredLine = filteredLine.replace(this.regex.speaker, '');
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
        output.speaker[speaker].push(filteredLine);
        output.order.push(speaker);
      }
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