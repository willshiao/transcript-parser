'use strict';

/***********************
 * Dependencies
 ***********************/
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const path = require('path');
const _ = require('lodash');
const TranscriptParser = require('../app.js');
const Readable = require('stream').Readable;

const tp = new TranscriptParser();

const longTranscript = readTranscriptSync('long');
const firstTranscript = readTranscriptSync('1');
const numTests = 5;

var s = new Readable();
/***********************
 * Benchmarks
 ***********************/
console.log('Sync Parse #1:', timeFunction(() => {
  tp.parseOneSync(firstTranscript);
}));

console.log('Sync Parse #2:', timeFunction(() => {
  tp.parseOneSync(longTranscript);
}));

console.log('Sync Parse #3:', timeFunction(() => {
  for(var i = 0; i < numTests; i++) {
    tp.parseOneSync(longTranscript);
  }
}));


timePromise(() => {
  return tp.parseOne(firstTranscript);
}).then(msg => {
  console.log('Async Parse #1:', msg);
  return timePromise(() => tp.parseOne(longTranscript));
}).then(msg => {
  console.log('Async Parse #2:', msg);
  return timePromise(parseLongPromise);
}).then(msg => {
  console.log('Async Parse #3:', msg);
  s.push(firstTranscript, 'utf8');
  s.push(null);
  return timePromise(() => Promise.fromCallback(cb => tp.parseStream(s, cb)));
}).then(msg => {
  console.log('Stream Parse #1:', msg);
  s = new Readable();
  s.push(longTranscript, 'utf8');
  s.push(null);
  return timePromise(() => Promise.fromCallback(cb => tp.parseStream(s, cb)));
}).then(msg => {
  console.log('Stream Parse #2:', msg);
}).catch(e => console.error(e.stack));

/***********************
 * Functions
 ***********************/
function parseLongPromise() {
  const q = new Array(numTests);
  for(var i = 0; i < numTests; i++) {
    q[i] = tp.parseOne(longTranscript).then(() => {});
  }
  const tasks = _.chunk(q, 5);
  return Promise.each(tasks, taskGroup => {
    return Promise.all(taskGroup);
  });
}

function timeAsyncFunction(func, cb) {
  const start = process.hrtime();
  func(() => {
    const end = process.hrtime(start);
    return cb(null, end[0] + 's ' + (end[1] / 1000000) + 'ms');
  });
}

function timePromise(promise) {
  const start = process.hrtime();
  return promise().then(() => {
    const end = process.hrtime(start);
    return Promise.resolve(end[0] + 's ' + (end[1] / 1000000) + 'ms');
  });
}

function timeFunction(func) {
  const start = process.hrtime();
  func();
  const end = process.hrtime(start);
  return end[0] + 's ' + (end[1] / 1000000) + 'ms';
}

function readTranscript(name) {
  return fs.readFileAsync(path.join(__dirname, `/transcripts/${name}.txt`), {encoding: 'utf8'});
}

function readTranscriptSync(name) {
  return fs.readFileSync(path.join(__dirname, `/transcripts/${name}.txt`), {encoding: 'utf8'});
}
