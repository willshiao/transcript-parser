transcript-parser
=================
[![Build Status](https://travis-ci.org/willshiao/transcript-parser.svg?branch=master)](https://travis-ci.org/willshiao/transcript-parser)
[![Coverage Status](https://coveralls.io/repos/github/willshiao/transcript-parser/badge.svg?branch=master)](https://coveralls.io/github/willshiao/transcript-parser?branch=master)
[![npm](https://img.shields.io/npm/v/transcript-parser.svg?maxAge=2592000)](https://www.npmjs.com/package/transcript-parser)

- [Description](#description)
- [Usage](#usage)
- [Config](#config)
- [Documentation](#documentation)
  * [\.parseStream()](#parsestream)
  * [\.parseOneSync()](#parseonesync)
  * [\.parseOne()](#parseone)
  * [\.resolveAliasesSync()](#resolvealiasessync)
  * [\.resolveAliases()](#resolvealiases)
- [Example](#example)


## Description

Parses plaintext speech/debate/radio transcripts into JavaScript objects. It is still in early development. Pull requests are welcome.

Tests can be run with `npm test` and a benchmark can be run with `npm run benchmark`. For a full coverage report using [Istanbul](https://github.com/gotwarlost/istanbul), run `npm run travis-test`.

Tested for Node.js >= v4.4.6

## Usage

`npm install transcript-parser`

```node
'use strict';
const fs = require('fs');
const TranscriptParser = require('transcript-parser');
const tp = new TranscriptParser();

//Synchronous example
const parsed = tp.parseOneSync(fs.readFileSync('transcript.txt', 'utf8'));
console.log(parsed);

//Asynchronous example
fs.readFile('transcript.txt', (err, data) => {
  if(err) return console.error('Error:', err);
  tp.parseOne(data, (err, parsed) => {
    if(err) return console.error('Error:', err);
    console.log(parsed);
  }));
});

//Stream example
const stream = fs.createReadStream('transcript.txt', 'utf8');
tp.parseStream(stream, (err, parsed) => {
  if(err) return console.error('Error:', err);
  console.log(parsed);
});
```


## Config

The constructor for `TranscriptParser` accepts a settings object.

- `removeActions`
    + default: `true`
    + Specifies if the parser should remove actions (e.g. `(APPLAUSE)`).
- `removeAnnotations`
    + default: `true`
    + Specifies if the parser should remove annotations (surrounded by `[]`).
- `removeTimestamps`
    + default: `true`
    + **True if `removeAnnotations` is true**
    + Specifies if the parser should remove timestamps (in the `[##:##:##]` format).
- `removeUnknownSpeakers`
    + default: `false`
    + Specifies if the parser should remove lines that have no associated speaker.
    + If true, lines that have no associated speaker will be stored under the key `none`.
- `blacklist`
    + default: `[]`
    + A list of speakers (as strings) that the parser should ignore.
- `aliases`
    + default: `{}`
    + A object with the real name as the key and an `Array` of the aliases' regular expressions as the value.
    + Example: `{ "Mr. Robot": [ /[A-Z\ ]*SLATER[A-Z\ ]*/ ] }`
        * Renames all speakers who match the regex to "Mr. Robot".

Settings can be changed after object creation by changing the corresponding properties of `tp.settings`, where `tp` is an instance of `TranscriptParser`.


## Documentation

### .parseStream()

The `parseStream()` method parses a [`Stream`](https://nodejs.org/api/stream.html) and returns an object representing it.

This is the preferred method for parsing streams asynchronously as it doesn't have to load the entire transcript into memory (unlike `parseOne()`).

#### Syntax

`tp.parseOneSync(stream, callback)`

##### Parameters

- `stream`
    + The `Readable` stream to read.
- `callback(err, data)`
    + A callback to be executed on function completion or error.


### .parseOneSync()

The `parseOneSync()` method parses a string and returns an object representing it.

#### Syntax

`tp.parseOneSync(transcript)`

##### Parameters

- `transcript`
    + The transcript, as a `string`.


### .parseOne()

The `parseOne()` method parses a string and returns an object representing it.

#### Syntax

`tp.parseOne(transcript, callback)`

##### Parameters

- `transcript`
    + The transcript, as a `string`.
- `callback(err, data)`
    + A callback to be exectuted on function completion or error.


### .resolveAliasesSync()

The `resolveAliasesSync()` method resolves all aliases specified in the configuration passed to the `TranscriptParser`'s constructor (see above).

Renames the names in the `order` list to match the new names in the transcript. Note that there is a signifigant performance penalty, so don't use this method unless you need it.

#### Syntax

`tp.resolveAliasesSync(data)`

##### Parameters

- `data`
    + The transcript object after being parsed.
 

### .resolveAliases()

The `resolveAliases()` method resolves all aliases specified in the configuration passed to the `TranscriptParser`'s constructor (see above).

Renames the names in the `order` list to match the new names in the transcript. Note that there is a signifigant performance penalty, so don't use this method unless you need it.

#### Syntax

`tp.resolveAliases(data, callback)`

##### Parameters

- `data`
    + The transcript object after being parsed.
- `callback(err, resolved)`
    + A callback to be executed on function completion or error.


## Example

### Input
```
A: I like Node.js.
A: I also like C#.
B: I like Node.js too!
A: I especially like the Node Package Manager.
```

### Output
```node
{
  speaker: {
    A: [
      'I like Node.js.',
      'I also like C#.',
      'I especially like the Node Package Manager.'
    ],
    B: ['I like Node.js too!']
  },
  order: ['A', 'A', 'B', 'A']
}
```
