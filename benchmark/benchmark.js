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

const firstTranscript = readTranscriptSync('1');
const longTranscript = readTranscriptSync('long');
const spacedTranscript = readTranscriptSync('manyBlank');

let firstStream = makeStringStream(firstTranscript);
let longStream = makeStringStream(longTranscript);
let spacedStream = makeStringStream(spacedTranscript);

const firstParsed = tp.parseOneSync(firstTranscript);
const longParsed = tp.parseOneSync(longTranscript);

/***********************
 * Benchmarks
 ***********************/
function benchmarkParse() {
  const suite = new Benchmark.Suite();
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
    .add('Synchronous Many-Blank Parse', {
      defer: false,
      fn: () => {
        tp.parseOneSync(spacedTranscript);
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
    .add('Asynchronous Many-Blank Parse', {
      defer: true,
      fn: defer => {
        tp.parseOne(spacedTranscript, () => defer.resolve());
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
    .add('Stream Many-Blank Parse', {
      defer: true,
      fn: defer => {
        tp.parseStream(spacedStream, a => {
          //Creating the new Readable stream increases time slightly,
          // but not by too much (< 1 ms on my machine).
          spacedStream = makeStringStream(spacedTranscript);
          defer.resolve();
        });
      }
    })
    .on('complete', function() {
      this.forEach(printStats);
      benchmarkresolveAliases();
    })
    .run({async: true});
  return suite;
}

function benchmarkresolveAliases() {
  const suite = new Benchmark.Suite();
  const tp1 = new TranscriptParser();
  const tp2 = new TranscriptParser();

  tp1.settings.aliases = {
    'Bernie Sanders': [ /.*SANDERS.*/i ],
    'Hilary Clinton': [ /.*HILARY.*/i ],
    'Donald Trump': [ /.*TRUMP.*/i ],
    'Jeb Bush': [ /.*BUSH.*/i ],
  };
  tp2.settings.aliases = {
    'Bernie Sanders': [ /.*SANDERS.*/i ],
    'Hilary Clinton': [ /.*HILARY.*/i ],
    'Wolf Blitzer': [ /.*BLITZER.*/i ],
    'Dana Bash': [ /.*BASH.*/i ],
    'Donald Trump': [ /.*TRUMP.*/i ],
    'John Dickerson': [ /.*DICKERSON.*/i ],
    'John Kasich': [ /.*KASICH.*/i ],
    'Ben Carson': [ /.*CARSON.*/i ],
    'Marco Rubio': [ /.*RUBIO.*/i ],
    'Ted Cruz': [ /.*CRUZ.*/i ],
    'Jeb Bush': [ /.*BUSH.*/i ]
  };

  suite
    .add('Synchronous Short (Few Regexes) resolveAliases', {
      fn: () => {
        tp1.resolveAliasesSync(firstParsed);
      }
    })
    .add('Synchronous Long (Few Regexes) resolveAliases', {
      fn: () => {
        tp1.resolveAliasesSync(longParsed);
      }
    })
    .add('Asynchronous Short (Few Regexes) resolveAliases', {
      defer: true,
      fn: defer => {
        tp1.resolveAliases(firstParsed, () => {
          defer.resolve();
        });
      }
    })
    .add('Asynchronous Long (Few Regexes) resolveAliases', {
      defer: true,
      fn: defer => {
        tp1.resolveAliases(longParsed, () => {
          defer.resolve();
        });
      }
    })
    .add('Synchronous Short (Many Regexes) resolveAliases', {
      fn: () => {
        tp2.resolveAliasesSync(firstParsed);
      }
    })
    .add('Synchronous Long (Many Regexes) resolveAliases', {
      fn: () => {
        tp2.resolveAliasesSync(longParsed);
      }
    })
    .add('Asynchronous Short (Many Regexes) resolveAliases', {
      defer: true,
      fn: defer => {
        tp2.resolveAliases(firstParsed, () => {
          defer.resolve();
        });
      }
    })
    .add('Asynchronous Long (Many Regexes) resolveAliases', {
      defer: true,
      fn: defer => {
        tp2.resolveAliases(longParsed, () => {
          defer.resolve();
        });
      }
    })
    .on('complete', function() {
      this.forEach(printStats);
    })
    .run({async: true});
}

benchmarkParse();


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
  const r = new Readable({
    highWaterMark: 16384 * 10
  });
  r.push(str);
  r.push(null);
  return r;
}

function readTranscriptSync(name) {
  return fs.readFileSync(path.join(__dirname, `/transcripts/${name}.txt`),
    {encoding: 'utf8'});
}
