import { AuthorizedRoles, splitter, validateCollaborators } from '../util/util';
import { strict as assert } from 'assert';

const BODY: string = "Bounty: 100000";
const INVALID_BODY: string = "Bountis100000";
const DELIMITER: string = "Bounty:";
const EXPECTED_BOUNTY: number = 100000;

describe('Test helper function for data parsing', () => {
  it('should return amount for parsing bounty', () => {
    const check = splitter(BODY, DELIMITER);
    assert.strictEqual(parseInt(check, 10), EXPECTED_BOUNTY);
  });
  it('should return null on invalid parsing', () => {
    const check = splitter(INVALID_BODY, DELIMITER);
    assert.strictEqual(check, null);
  });
});

describe('Test helper function for author validation', () => {
  it('should return true for owner', () => {
    const check = validateCollaborators(AuthorizedRoles.OWNER);
    assert.strictEqual(check, true);
  });
  it('should return true for collaborator', () => {
    const check = validateCollaborators(AuthorizedRoles.COLLABORATOR);
    assert.strictEqual(check, true);
  });
});