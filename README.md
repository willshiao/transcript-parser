transcript-parser
=================
[![Build Status](https://travis-ci.org/willshiao/transcript-parser.svg?branch=master)](https://travis-ci.org/willshiao/transcript-parser)
[![Coverage Status](https://coveralls.io/repos/github/willshiao/transcript-parser/badge.svg?branch=master)](https://coveralls.io/github/willshiao/transcript-parser?branch=master)

## Description

Parses plaintext speech/debate/radio transcripts into JavaScript objects. It is still in early development and is not stable. Pull requests are welcome.

## Usage

`npm install transcript-parser`

    const fs = require('fs');
    const TranscriptParser = require('transcript-parser');
    const tp = new TranscriptParser();
    
    //Do not use fs.readFileSync in production
    const output = tp.parseOneSync(fs.readFileSync('transcript.txt', {encoding: 'UTF-8'}));
    console.log(output);


## Config

The constructor for `TranscriptParser` accepts an options argument.

#### Options:

- `removeActions`
    + default: `true`
    + Specifies if the parser should remove actions (e.g. "(APPLAUSE)").
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
- `aliases`
    + default: `{}`
    + A object with the real name as the key and an `Array` of the aliases' regular expressions as the value.
    + Example: `{ "Mr. Robot": [ /[A-Z\ ]*SLATER[A-Z\ ]*/ ] }`
        * Renames all speakers who match the regex to "Mr. Robot".


## Documentation

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
    + A callback to be exectuted on function completion.


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
    + A callback to be executed on function completion.

