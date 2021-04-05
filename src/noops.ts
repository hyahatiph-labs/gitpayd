#!/usr/bin/env node
import axios from "axios";
import { splitter, validateCollaborators } from "../util/util";
import {
  API,
  GITPAYD_OWNER,
  GITPAYD_REPO,
  MAX_PAYMENT,
  MERGE_BODY,
  PaymentAction,
  PAYMENT_THRESHOLD,
} from "./config";
import log, { LogLevel } from "./logging";
import { handlePaymentAction } from "../util/util";
let githubToken: string;

// set accept in axios header
axios.defaults.headers.get.Accept = "application/vnd.github.v3+json";

/**
 * Make the API call to LND for processing payments
 * @param {string} paymentRequest - lnd invoice
 */
async function sendPayment(paymentRequest: string): Promise<void> {
  // send the payment
  let preImage: string;
  const PRE_IMAGE = await handlePaymentAction(
    paymentRequest,
    PaymentAction.PAY
  ).then((res) => (preImage = res.data.payment_preimage));
  log(`payment pre-image: ${PRE_IMAGE.data.image}`, LogLevel.INFO, false);
}

/**
 * Helper function for processing payment validity
 * @param {string} issueAmount - bounty from the issue
 * @param {string} paymentRequest - lnd invoice
 * @param {string} pullNum - pull request number
 */
async function parseAmountDue(
  issueAmount: string,
  paymentRequest: string,
  pullNum: number
): Promise<void> {
  let decodedAmt: string;
  let balance: number;
  // decode the payment request and make sure it matches bounty
  await handlePaymentAction(paymentRequest, PaymentAction.DECODE).then(
    (res) => (decodedAmt = res.data.num_satoshis)
  );
  log(`payment amount decoded: ${decodedAmt} sats`, LogLevel.INFO, false);
  const AMT_MATCHES_BOUNTY: boolean = decodedAmt === issueAmount;
  if (!AMT_MATCHES_BOUNTY) {
    log("decoded amount does not match bounty!", LogLevel.ERROR, true);
    throw new Error('bounty payment request mismatch');
  } else {
    await handlePaymentAction(null, PaymentAction.RETURN_BALANCE).then(
      (res) => (balance = res.data.local_balance.sat)
    );
    log(`gitpayd channel balance is: ${balance} sats`, LogLevel.INFO, true);
    // ensure the node has a high enough local balance to payout
    const NUM_AMT = parseInt(issueAmount, 10);
    const isValidPayment =
      NUM_AMT > 0 &&
      NUM_AMT < MAX_PAYMENT &&
      AMT_MATCHES_BOUNTY &&
      balance >= NUM_AMT &&
      NUM_AMT < PAYMENT_THRESHOLD;
    if (isValidPayment) {
      const headers: object = {'authorization': `token ${githubToken}`}
      const MERGE = await axios.put(
        `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/pulls/${pullNum.toString()}/merge`,
        MERGE_BODY,
        { headers }
      );
      log(`${MERGE.data.message}`, LogLevel.INFO, true);
      if (MERGE.data.merged) {
        // if pull request merged successfully send payment
        sendPayment(paymentRequest);
      }
    } else {
      log("invalid payment request", LogLevel.ERROR, true);
      throw new Error('invalid payment request');
    }
  }
}

/**
 * This function acquires the issue linked in the pull request
 */
export async function runNoOps(token: string): Promise<void> {
  githubToken = token;
  let pr: object[];
  await axios.get(
    `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/pulls?state=open`
  ).then(res => pr = res.data)
  .catch(() => log('failed to fetch pull requests', LogLevel.ERROR, true));
  pr.forEach(async (pull: any) => {
    const ISSUE_NUM: string | null = splitter(pull.body, "Closes #");
    const PAYMENT_REQUEST: string | null = splitter(pull.body, "LN:");
    const PULL_NUM: number = pull.number;
    const isCollaborator: boolean = validateCollaborators(
      pull.author_association
    );
    if (!isCollaborator) {
      throw new Error(
        `unauthorized collaborator ${pull.user.login} access on gitpayd`
      );
    }
    if (ISSUE_NUM && PAYMENT_REQUEST) {
      log(`processing issue #${ISSUE_NUM}...`, LogLevel.INFO, true);
      let issue: string;
      await axios.get(
        `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/issues/${ISSUE_NUM}`
      ).then(res => issue = res.data.body)
      .catch(() => log(`no issues found`, LogLevel.ERROR, true));
      if(issue) {
        const AMT: string | null = splitter(issue, "Bounty: ");
        log(
          `attempting to settle pull request #${PULL_NUM} for ${AMT} sats`,
          LogLevel.INFO,
          true
        );
        parseAmountDue(AMT, PAYMENT_REQUEST, PULL_NUM)
          .catch(() => new Error('failed to parse amount'));
      }
    } else {
      log('no pull requests are eligible', LogLevel.INFO, true);
      throw new Error('no pull request found');
    }
  });
}
