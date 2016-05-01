"use strict";
const Promise = require('bluebird');
const path = require('path');
const fs = Promise.promisifyAll(require('fs'));
const TranscriptParser = require('../app.js');
const chai = require('chai');
chai.should();

const TEST_DIR = path.join(__dirname, 'transcripts');
const EXPECTED_DIR = path.join(__dirname, 'expected');


describe('TranscriptParser', function() {

  /*
   * For the synchronous parseOne method
   *
   */
  describe('#parseOneSync()', function(){
    const tp = new TranscriptParser();

    it('should remove actions by default', function() {
      const parser = new TranscriptParser();
      var result = parser.parseOneSync('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)');
      result.speaker.should.eql({
        'PERSON A': [
          'Hello, my name is Bob.'
        ]
      });
    });

    it('should respect the removeActions setting', function() {
      const parser = new TranscriptParser({removeActions: false});
      var result = parser.parseOneSync('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)');
      result.speaker.should.eql({
        'PERSON A': [
          'Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)'
        ]
      });
    });

    it('should respect the removeTimestamps setting', function() {
      const parser = new TranscriptParser({removeAnnotations: false, removeTimestamps: false});
      var result = parser.parseOneSync('[20:20:34] BERMAN: [2:1:41] The...');
      result.speaker.should.eql({
        '[20:20:34] BERMAN': [
          '[2:1:41] The...'
        ]
      });
    });

    it('should be able to remove timestamps without removing annotations', function() {
      const parser = new TranscriptParser({removeAnnotations: false, removeTimestamps: true});
      var result = parser.parseOneSync('[20:20:34] BERMAN: [2:1:41] The [first] name...');
      result.speaker.should.eql({
        'BERMAN': [
          'The [first] name...'
        ]
      });
    });

    it('should respect the remove unknown speakers setting', function() {
      const parser = new TranscriptParser({removeUnknownSpeakers: true});
      var result = parser.parseOneSync('The quick [brown] fox jumps over the (lazy) dog.');
      result.should.eql({
        speaker: {},
        order: []
      });
    });

    it('should parse a transcript correctly', function(done) {
      readSample(1)
        .bind({})
        .then(info => {
          this.result = tp.parseOneSync(info);
          return readExpected(1);
        }).then(expected => {
          this.result.should.be.eql(JSON.parse(expected));
          done();
        })
        .catch(e => done(e));
    });

  });


  /*
   * For the asynchronous parseOne method
   *
   */
  describe('#parseOne()', function(){
    const tp = new TranscriptParser();

    it('should remove actions by default', function(done) {
      const parser = new TranscriptParser();
      parser.parseOne('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)',
      function(err, result) {
        if(err) return done(err);
        result.speaker.should.eql({
          'PERSON A': [
            'Hello, my name is Bob.'
          ]
        });
        done();
      });
    });

    it('should respect the removeActions setting', function(done) {
      const parser = new TranscriptParser({removeActions: false});
      var result = parser.parseOne('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)',
      function(err, result) {
        if(err) return done(err);
        result.speaker.should.eql({
          'PERSON A': [
            'Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)'
          ]
        });
        done();
      });
    });

    it('should respect the removeTimestamps setting', function(done) {
      const parser = new TranscriptParser({removeAnnotations: false, removeTimestamps: false});
      var result = parser.parseOne('[20:20:34] BERMAN: [2:1:41] The...',
      function(err, result) {
        if(err) return done(err);
        result.speaker.should.eql({
          '[20:20:34] BERMAN': [
            '[2:1:41] The...'
          ]
        });
        done();
      });
    });

    it('should be able to remove timestamps without removing annotations', function(done) {
      const parser = new TranscriptParser({removeAnnotations: false, removeTimestamps: true});
      var result = parser.parseOne('[20:20:34] BERMAN: [2:1:41] The [first] name...',
      function(err, result) {
        if(err) return done(err);
        result.speaker.should.eql({
          'BERMAN': [
            'The [first] name...'
          ]
        });
        done();
      });
    });

    it('should respect the remove unknown speakers setting', function(done) {
      const parser = new TranscriptParser({removeUnknownSpeakers: true});
      var result = parser.parseOne('The quick [brown] fox jumps over the (lazy) dog.',
      function(err, result) {
        if(err) return done(err);
        result.should.eql({
          speaker: {},
          order: []
        });
        done();
      });
    });

    it('should parse a transcript correctly', function(done) {
      readSample(1)
        .bind({})
        .then(info => {
          return Promise.fromCallback(cb => {
            tp.parseOne(info, cb);
          });
        })
        .then(result => {
          this.result = result;
          return readExpected(1);
        }).then(expected => {
          this.result.should.be.eql(JSON.parse(expected));
          done();
        })
        .catch(e => done(e));
    });

  });

  /*
   * For the synchronous resolveAliases method
   *
   */
  describe('#resolveAliasesSync()', function () {

    it('should resolve aliases correctly', function(done) {
      const tp = new TranscriptParser({
        aliases: { "DONALD TRUMP": [ /.*TRUMP.*/ ] }
      });
      readSample(2)
        .bind({})
        .then(info => {
          this.result = tp.parseOneSync(info);
          this.result = tp.resolveAliasesSync(this.result);
          return readExpected(2);
        }).then(expected => {
          this.result.should.eql(JSON.parse(expected));
          done();
        })
        .catch(e => done(e));
    });

    it('should return unchanged data if aliases are not set', function(done) {
      const tp = new TranscriptParser({aliases: {}});
      readSample(2)
        .then(info => {
          var parsed = tp.parseOneSync(info);
          var resolved = tp.resolveAliasesSync(parsed);
          parsed.should.equal(resolved);
          done();
        })
        .catch(e => done(e));
    });
  });

  /*
   * For the asynchronous resolveAliases method
   *
   */
  describe('#resolveAliases()', function () {

    it('should resolve aliases correctly', function(done) {
      const tp = new TranscriptParser({
        aliases: { "DONALD TRUMP": [ /.*TRUMP.*/ ] }
      });
      readSample(2)
        .bind({})
        .then(info => {
          return Promise.fromCallback(cb => tp.parseOne(info, cb));
        }).then(result => {
          return Promise.fromCallback(cb => tp.resolveAliases(result, cb));
        }).then(result => {
          this.result = result;
          return readExpected(2);
        }).then(expected => {
          this.result.should.eql(JSON.parse(expected));
          done();
        })
        .catch(e => done(e));
    });

    it('should return unchanged data if aliases are not set', function(done) {
      const tp = new TranscriptParser({aliases: {}});
      readSample(2)
      .bind({})
        .then(info => {
          return Promise.fromCallback(cb => tp.parseOne(info, cb));
        }).then(parsed => {
          this.parsed = parsed;
          return Promise.fromCallback(cb => tp.resolveAliases(parsed, cb));
        }).then(resolved => {
          this.parsed.should.equal(resolved);
          done();
        })
        .catch(e => done(e));
    });
  });

});

function readSample(sampleName) {
  return fs.readFileAsync(path.join(TEST_DIR, sampleName+'.txt'), {encoding: 'UTF-8'});
}

function readExpected(expectedName) {
  return fs.readFileAsync(path.join(EXPECTED_DIR, expectedName+'.txt'), {encoding: 'UTF-8'});
}