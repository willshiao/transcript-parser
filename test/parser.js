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

  describe('contructor', function() {
    it('should remove actions by default', function() {
      const tp = new TranscriptParser();
      var result = tp.parseOne('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)');
      result.speaker.should.eql({
        'PERSON A': [
          'Hello, my name is Bob.'
        ]
      });
    });
    it('should respect the removeActions setting', function() {
      const tp = new TranscriptParser({removeActions: false});
      var result = tp.parseOne('PERSON A: Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)');
      result.speaker.should.eql({
        'PERSON A': [
          'Hello, (PAUSES) (DRINKS WATER) my name is Bob.(APPLAUSE)'
        ]
      });
    });
  });

  describe('#parseOne()', function(){
    const tp = new TranscriptParser();
    it('should parse a transcript correctly', function(done) {
      readSample(1)
        .bind({})
        .then(info => {
          this.result = tp.parseOne(info);
          return readExpected(1);
        }).then(expected => {
          this.result.should.be.eql(JSON.parse(expected));
          done();
        })
        .catch(e => done(e));
    });
  });

  describe('#resolveAliases()', function () {
    const tp = new TranscriptParser({
      aliases: { "DONALD TRUMP": [ /.*TRUMP.*/ ] }
    });
    it('should resolve aliases correctly', function(done) {
      readSample(2)
        .bind({})
        .then(info => {
          this.result = tp.parseOne(info);
          this.result = tp.resolveAliases(this.result);
          return readExpected(2);
        }).then(expected => {
          this.result.should.eql(JSON.parse(expected));
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