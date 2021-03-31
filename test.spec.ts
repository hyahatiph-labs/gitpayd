import { splitter } from './src/noops';
import { strict as assert } from 'assert';

const BODY = "Bounty: 100000";
const INVALID_BODY = "Bountis100000";
const DELIMITER = "Bounty:";
const EXPECTED_VALUE = 100000;

describe('Validate', () => {
  describe('Result', () => {
    it('should amount for parsing bounty', () => {
      const check = splitter(BODY, DELIMITER);
      assert.strictEqual(parseInt(check, 10), EXPECTED_VALUE);
    });
    it('should return null on invalid parsing', () => {
      const check = splitter(INVALID_BODY, DELIMITER);
      assert.strictEqual(check, null);
    });
  });
});