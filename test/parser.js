"use strict";
const Promise = require('bluebird');
const fs = Promise.promisifyAll(require('fs'));
const TranscriptParser = require('../app.js');
const chai = require('chai');
chai.should();

describe('TranscriptParser', function() {
  const tp = new TranscriptParser();
  describe('#parse()', function(){
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