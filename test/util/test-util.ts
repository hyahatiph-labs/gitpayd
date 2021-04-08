// TODO: fix yargs breaking test.
// This is duplicated form ../util/util.ts

const TEST_MAX_PAYMENT = 100000;
const TEST_PAYMENT_THRESHOLD = 200000;

/**
 * Authorized roles
 */
export enum AuthorizedRoles {
  COLLABORATOR = "COLLABORATOR",
  OWNER = "OWNER",
}

/**
 * Helper function for parsing values from github metadata
 * @param {string} str - body from the api call
 * @param {string} delimiter - split on this
 * @returns String
 */
export const splitter = (body: string, delimiter: string): string | null => {
  const PRE_PARSE = body.split(delimiter);
  return PRE_PARSE[1] !== undefined ? PRE_PARSE[1].split("\n")[0].trim() : null;
};

/**
 * Perform validation on collaborators
 * @param {string} role - role extracted from the pull request
 * @returns boolean
 */
export const validateCollaborators = (role: AuthorizedRoles): boolean => {
  return (
    role === AuthorizedRoles.COLLABORATOR || role === AuthorizedRoles.OWNER
  );
};

/**
 * Run payment validity logic
 * @param issueAmount - issue bounty
 * @param balance - balance of the lightning node gitpayd connects to
 * @returns
 */
 export const isValidPayment = (issueAmount: string, balance: number): boolean => {
  const NUM_AMT = parseInt(issueAmount, 10);
  return (
    NUM_AMT > 0 &&
    NUM_AMT < TEST_MAX_PAYMENT &&
    (balance - TEST_PAYMENT_THRESHOLD) > NUM_AMT
  );
};