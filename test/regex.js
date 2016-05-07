'use strict';

/***********************
 * Test dependencies
 ***********************/
const TranscriptParser = require('../app.js');
const chai = require('chai');
chai.should();


/***********************
 * Tests
 ***********************/
describe('TranscriptParser', function() {
  const transcriptParser = new TranscriptParser();
  describe('.regex', function() {
    const regex = transcriptParser.regex;

    describe('.newLine', function() {
      it('should split newlines', function() {
        const testStr = 'a\nb\r\nc';
        testStr.split(regex.newLine).should.eql(['a','b','c']);
      });
    });

    describe('.action', function() {
      it('should split actions', function() {
        const testStr = 'The (LOUD APPLAUSE) chicken (SILENCE) crossed (LAUGHTER)';
        testStr.split(regex.action).should.eql(['The ','chicken ','crossed ','']);
      });
    });

    describe('.speaker', function() {
      it('should find the speaker', function() {
        regex.speaker.exec('COOPER:  How though?')[1]
          .should.equal('COOPER');
      });
      it('should work on weird names', function() {
        regex.speaker.exec('JO-ANN ARMAO (ASSOCIATE EDITORIAL PAGE EDITOR): The ...')[1]
          .should.equal('JO-ANN ARMAO (ASSOCIATE EDITORIAL PAGE EDITOR)');
        regex.speaker.exec('COREY LEWANDOWSKI, TRUMP 2016 CAMPAIGN MANAGER [to Trump]: North...')[1]
          .should.equal('COREY LEWANDOWSKI, TRUMP 2016 CAMPAIGN MANAGER');
      });
    });

    describe('.annotation', function() {
      it('should be able to remove annotations', function() {
        'Information [annotation] is [actually really] not...'.split(regex.annotation).join('')
          .should.equal('Information is not...');
      });
      it('should be able to remove annotations of all cases', function() {
        'Information [ANNOTATION #1] is [AcTually really] not...'.split(regex.annotation).join('')
          .should.equal('Information is not...');
      });
    });

    describe('.timestamp', function() {
      it('should be able to remove timestamps', function() {
        '[20:20:34] BERMAN: [2:1:41] The...'.split(regex.timestamp).join('')
          .should.equal('BERMAN:The...');
      });
    });

  });
});