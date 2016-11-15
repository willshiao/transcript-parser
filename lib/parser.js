'use strict';

/***********************
 * Module dependencies
 ***********************/
const _ = require('lodash');
const Promise = require('bluebird');
const es = require('event-stream');


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
      newLine: /(?:\r?\n)+/,
      action: /\([A-Z\ ]+\)\ ?/,
      speaker: /^((?:\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?)?[A-Z\d\ \/,.\-\(\)]+?)(?:\ ?\[[A-z\ ]+\])? ?:\ ?/,
      timestamp: /\ ?\[\d{1,2}:\d{1,2}:\d{1,2}\]\ ?/,
      annotation: /\[.+?\]\ ?/
    },
    conciseSpeakers: false,
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
  let lines = transcript.split(this.regex.newLine);

  lines = _.reduce(lines, (out, line) => {
    if(this.settings.removeActions)
      line = removeAll(line, this.regex.action);
    if(this.settings.removeAnnotations)
      line = removeAll(line, this.regex.annotation);
    else if(this.settings.removeTimestamps)
      line = removeAll(line, this.regex.timestamp);

    if(line.length > 0) out.push(line);
    return out;
  }, []);

  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  let speaker = 'none'; //Current speaker
  let ignore = false; //Are we ignoring the line because of a blacklisted speaker?
  let match;

  _.each(lines, (line) => {
    if((match = this.regex.speaker.exec(line)) !== null) {
      speaker = match[1].trim(); //Get speaker from regex match
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

    if(!this.settings.conciseSpeakers) {
      output.order.push(speaker);
    } else if(shouldAddNewSpeaker(output.order, speaker)) {
      output.order.push([speaker, 1]); //Add new speaker
    } else {
      output.order[output.order.length - 1]++; //Last speaker is the same, so increment count by one
    }
  });
  return output;
};

function shouldAddNewSpeaker(order, speaker) {
  return order.length === 0 //Must be new if the array is empty
    || order[order.length - 1][0] != speaker; //Make sure new speaker is different from last one
}

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
  let speaker = 'none'; //Current speaker
  let ignore = false, match = null;

  return Promise
    .try(() => {
      return Promise.reduce(transcript.split(this.regex.newLine), (out, line) => {
        if(this.settings.removeActions)
          line = removeAll(line, this.regex.action);
        if(this.settings.removeAnnotations)
          line = removeAll(line, this.regex.annotation);
        else if(this.settings.removeTimestamps)
          line = removeAll(line, this.regex.timestamp);

        if(line.length > 0) out.push(line);
        return out;
      }, []);
    })
    .each(line => {
      if((match = this.regex.speaker.exec(line)) !== null) {
        speaker = match[1].trim(); //Regex match
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

      if(!this.settings.conciseSpeakers) {
        output.order.push(speaker);
      } else if(shouldAddNewSpeaker(output.order, speaker)) {
        output.order.push([speaker, 1]); //Add new speaker
      } else {
        output.order[output.order.length - 1]++; //Last speaker is the same, so increment count by one
      }
    })
    .then(() => {
      return Promise.resolve(output);
    })
    .asCallback(cb);
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
            // to the new speaker if the new speaker exists
            speakers[newName] = _.concat(lines, speakers[newName]);
          } else {
            speakers[newName] = lines; //Otherwise, make a new list
          }
          //Delete the old key
          delete speakers[speakerName];
          return false; //Break
        }
      });
    });
  });

  //Fix the names in the order array
  data.order = data.order.map(speaker => {
    for(const trueName in aliases) {
      for(const aliasKey in aliases[trueName]) {
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
              speakers[speakerName]; //Otherwise, make a new list

            delete speakers[speakerName]; //Delete the old key
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
  //Output object
  const output = {};
  //Object containing the speakers and their lines
  output.speaker = {};
  //List of the speakers, in order
  output.order = [];

  let speaker = 'none';
  let ignore = false, match;

  inputStream
    .pipe(es.split(this.regex.newLine))
    .pipe(es.mapSync(line => {
      if(line === null) return;
      line = this.filterLine(line);
      if(!line) return;

      if((match = this.regex.speaker.exec(line)) !== null) {
        speaker = match[1].trim(); //Regex match - is speaker
        //Remove the speaker from the line
        line = line.replace(this.regex.speaker, '');
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
      output.speaker[speaker].push(line);
      output.order.push(speaker);
    }))
    .on('close', () => {
      return cb(null, output);
    });

};

//Filters a line based on the defined settings
//Returns null on the line being completely removed
proto.filterLine = function(line) {
  if(typeof line !== 'string') line = line.toString();
  if(this.settings.removeActions)
    line = removeAll(line, this.regex.action);
  if(this.settings.removeAnnotations)
    line = removeAll(line, this.regex.annotation);
  else if(this.settings.removeTimestamps)
    line = removeAll(line, this.regex.timestamp);

  if(line.length <= 0) return null;
  return line;
};

function removeAll(text, regex) {
  return text.split(regex).join('');
}
