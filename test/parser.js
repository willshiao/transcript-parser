"use strict";
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const TranscriptParser = require('../app.js');
const chai = require('chai');
chai.should();

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
    it('should parse a transcript with no errors', function(done) {
      fs.readFileAsync('test/transcripts/sample_1.txt', {encoding: 'UTF-8'})
        .then(info => {
          const result = tp.parseOne(info);
          result.should.not.equal(false);
          done();
        })
        .catch(e => done(e));
    });
  });
});