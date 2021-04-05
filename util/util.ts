import { PaymentAction } from "../src/config";
import axios, { AxiosResponse } from "axios";
import { agent, getLndHost } from "../src/setup";

/**
 * Authorized roles
 */
export enum AuthorizedRoles {
  COLLABORATOR = "COLLABORATOR",
  OWNER = "OWNER",
  MEMBER = "MEMBER"
}

/**
 * Delimiters for parsing data from Github
 */
export enum Delimiters {
  ISSUE = 'Closes #',
  INVOICE = 'LN:',
  BOUNTY = 'Bounty: '
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
    role === AuthorizedRoles.COLLABORATOR
    || role === AuthorizedRoles.OWNER
    || role === AuthorizedRoles.MEMBER
  );
};

/**
 * Re-usable function for doing LND Stuff
 * @param {string} paymentRequest - invoice sent to gitpayd
 * @param {PaymentAction} action - decode, get the channel balance, or process payments
 */
 export function handlePaymentAction(
  paymentRequest: string | null,
  action: PaymentAction
): Promise<AxiosResponse<any>> {
  switch (action) {
    // case for decoding payment
    case PaymentAction.DECODE:
      return axios.get(`${getLndHost()}/v1/payreq/${paymentRequest}`, {
        httpsAgent: agent,
      });
    // case for returning channel balance
    case PaymentAction.RETURN_BALANCE:
      return axios.get(`${getLndHost()}/v1/balance/channels`, {
        httpsAgent: agent,
      });
    // case for sending payment
    case PaymentAction.PAY:
      return axios.post(
        `${getLndHost()}/v1/channels/transactions`,
        { payment_request: paymentRequest },
        { httpsAgent: agent }
      );
    default:
      return axios.get(`${getLndHost()}/v1/getinfo`, { httpsAgent: agent });
  }
}