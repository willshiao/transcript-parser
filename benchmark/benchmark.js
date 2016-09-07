'use strict';

/***********************
 * Dependencies
 ***********************/
const fs = require('fs');
const path = require('path');
const Benchmark = require('benchmark');
const Readable = require('stream').Readable;

const TranscriptParser = require('../app.js');


/***********************
 * Intialization
 ***********************/
const tp = new TranscriptParser();
const suite = new Benchmark.Suite();

const firstTranscript = readTranscriptSync('1');
const longTranscript = readTranscriptSync('long');

let firstStream = makeStringStream(firstTranscript);
let longStream = makeStringStream(longTranscript);


/***********************
 * Benchmarks
 ***********************/
suite
  .add('Synchronous Short Parse', {
    defer: false,
    fn: () => {
      tp.parseOneSync(firstTranscript);
    }
  })
  .add('Synchronous Long Parse', {
    defer: false,
    fn: () => {
      tp.parseOneSync(longTranscript);
    }
  })
  .add('Asynchronous Short Parse', {
    defer: true,
    fn: defer => {
      tp.parseOne(firstTranscript, () => defer.resolve());
    }
  })
  .add('Asynchronous Long Parse', {
    defer: true,
    fn: defer => {
      tp.parseOne(longTranscript, () => defer.resolve());
    }
  })
  .add('Stream Short Parse', {
    defer: true,
    fn: defer => {
      tp.parseStream(firstStream, a => {
        //Creating the new Readable stream increases time slightly,
        // but not by too much (< 1 ms on my machine).
        firstStream = makeStringStream(firstTranscript);
        defer.resolve();
      });
    }
  })
  .add('Stream Long Parse', {
    defer: true,
    fn: defer => {
      tp.parseStream(longStream, a => {
        //Creating the new Readable stream increases time slightly,
        // but not by too much (< 1 ms on my machine).
        longStream = makeStringStream(longTranscript);
        defer.resolve();
      });
    }
  })
  .on('complete', function() {
    this.forEach(printStats);
  })
  .run({async: true});


/***********************
 * Functions
 ***********************/
function printStats(benchmark) {
  console.log('====================');
  console.log('Name:', benchmark.name);
  console.log('Mean:', benchmark.stats.mean, 's');
  console.log('Deviation:', benchmark.stats.deviation, 's');
  console.log('Margin of error:', benchmark.stats.moe, 's');
  console.log('Relative margin of error:', benchmark.stats.rme, '%');
  console.log('Operations/sec:', benchmark.hz);
}

function makeStringStream(str) {
  const r = new Readable();
  r.push(str);
  r.push(null);
  return r;
}

function readTranscriptSync(name) {
  return fs.readFileSync(path.join(__dirname, `/transcripts/${name}.txt`),
    {encoding: 'utf8'});
}
