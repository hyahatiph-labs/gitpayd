import axios from "axios";
import { Delimiters, splitter, validateCollaborators } from "../util/util";
import {
  API,
  ChannelBalance,
  GitpaydConfig,
  GITPAYD_OWNER,
  GITPAYD_REPO,
  MAX_PAYMENT,
  MERGE_BODY,
  PaymentRequest,
  PAYMENT_THRESHOLD,
  SendPayment,
} from "./config";
import log, { LogLevel } from "../util/logging";
import { getLrpc, getRouter } from "./setup";
let githubToken: string;

// set accept in axios header
axios.defaults.headers.get.Accept = "application/vnd.github.v3+json";

/**
 * Run payment validity logic
 * @param issueAmount - issue bounty
 * @param balance - balance of the lightning node gitpayd connects to
 * @returns
 */
const isValidPayment = (issueAmount: number, balance: number): boolean => {
  return (
    issueAmount > 0 &&
    issueAmount < MAX_PAYMENT &&
    balance - PAYMENT_THRESHOLD > issueAmount
  );
};

/**
 * Make the API call to LND for processing payments
 * @param {string} paymentRequest - lnd invoice
 */
const sendPayment = (paymentRequest: string): void => {
  // send the payment
  const REQUEST = {
    pay_req: paymentRequest,
    timeout_seconds: GitpaydConfig.PAYMENT_TIMEOUT
  }
  const CALL = getRouter().sendPaymentV2(REQUEST);
  CALL.on("data", (r: SendPayment) => {
    // A response was received from the server.
    log(`payment pre-image: ${r.payment_preimage}`, LogLevel.INFO, false);
  });
};

/**
 * Process issue number and bounty amount from pull request
 * @param issueNum - issue number
 * @param paymentRequest - lightning invoice
 * @param pullNum - pull request number
 */
async function processIssues(
  issueNum: string,
  paymentRequest: string,
  pullNum: number
): Promise<void> {
  log(`processing issue #${issueNum}...`, LogLevel.INFO, true);
  let issue: string;
  await axios
    .get(`${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/issues/${issueNum}`)
    .then((res) => (issue = res.data.body))
    .catch(() => log(`no issues found`, LogLevel.ERROR, true));
  if (issue) {
    const AMT: string | null = splitter(issue, Delimiters.BOUNTY);
    log(
      `attempting to settle pull request #${pullNum} for ${AMT} sats`,
      LogLevel.INFO,
      true
    );
    parseAmountDue(AMT, paymentRequest, pullNum);
  }
}

/**
 * Helper function for validating payments
 * @param issueAmount - amount on the Bounty tag in the issue
 * @param balance - balance of the node connected to gitpayd
 * @param pullNum - pull request number being processed
 * @param paymentRequest - lightning invoice
 */
async function processPayments(
  issueAmount: number,
  balance: number,
  pullNum: number,
  paymentRequest: string
): Promise<void> {
  if (isValidPayment(issueAmount, balance)) {
  //   const headers: object = { authorization: `token ${githubToken}` };
  //   const MERGE = await axios.put(
  //     `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/pulls/${pullNum.toString()}/merge`,
  //     MERGE_BODY,
  //     { headers }
  //   );
  //   log(`${MERGE.data.message}`, LogLevel.INFO, true);
  //   if (MERGE.data.merged) {
  //     // if pull request merged successfully send payment
  //     sendPayment(paymentRequest);
  //   }
  // } else {
  //   log("invalid payment request", LogLevel.ERROR, true);
  // }
  sendPayment(paymentRequest);
  }
}

/**
 * Helper function for processing payment validity
 * @param {string} issueAmount - bounty from the issue
 * @param {string} paymentRequest - lnd invoice
 * @param {string} pullNum - pull request number
 */
const parseAmountDue = (
  issueAmount: string,
  paymentRequest: string,
  pullNum: number
): void => {
  const REQUEST: object = { pay_req: paymentRequest };
  // decode the payment request and make sure it matches bounty
  getLrpc().decodePayReq(REQUEST, (de: Error, dr: PaymentRequest) => {
    if (de) {
      log(`${de}`, LogLevel.ERROR, true);
    }
    const DECODED: number = dr.num_satoshis;
    log(`lnrpc decoded response ${DECODED}`, LogLevel.DEBUG, false);
    const AMT_MATCHES_BOUNTY: boolean = DECODED.toString() === issueAmount;
    if (!AMT_MATCHES_BOUNTY) {
      log("decoded amount does not match bounty!", LogLevel.ERROR, true);
    } else {
      getLrpc().channelBalance({}, (be: Error, br: ChannelBalance) => {
        if (be) {
          log(`${be}`, LogLevel.ERROR, true);
        }
        const BALANCE = br.local_balance.sat;
        log(`gitpayd channel balance is: ${BALANCE} sats`, LogLevel.INFO, true);
        // ensure the node has a high enough local balance to payout
        processPayments(parseInt(issueAmount, 10), BALANCE, pullNum, paymentRequest);
      });
    }
  });
};

/**
 * This function acquires the issue linked in the pull request
 * @param token - Github token from the workflow
 */
export async function runNoOps(token: string): Promise<void> {
  githubToken = token;
  let pr: object[];
  await axios
    .get(`${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/pulls?state=open`)
    .then((res) => (pr = res.data))
    .catch(() => log("failed to fetch pull requests", LogLevel.ERROR, true));
  pr.forEach(async (pull: any) => {
    const ISSUE_NUM: string | null = splitter(pull.body, Delimiters.ISSUE);
    log(`checking issue number: ${ISSUE_NUM}`, LogLevel.DEBUG, true);
    const PAYMENT_REQUEST: string | null = splitter(
      pull.body,
      Delimiters.INVOICE
    );
    const PULL_NUM: number = pull.number;
    log(`parsed pull request: ${PULL_NUM}`, LogLevel.DEBUG, true);
    const isCollaborator: boolean = validateCollaborators(
      pull.author_association
    );
    if (!isCollaborator) {
      log(`unauthorized user: ${pull.user.login}`, LogLevel.DEBUG, true);
    }
    if (ISSUE_NUM && PAYMENT_REQUEST && isCollaborator) {
      processIssues(ISSUE_NUM, PAYMENT_REQUEST, PULL_NUM);
    } else {
      log("no pull requests are eligible", LogLevel.INFO, true);
    }
  });
}
