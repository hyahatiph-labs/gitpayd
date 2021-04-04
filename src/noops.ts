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
import { getGithubToken, handlePaymentAction } from "./setup";

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
  }
  await handlePaymentAction(null, PaymentAction.RETURN_BALANCE).then(
    (res) => (balance = res.data.local_balance)
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
    const headers: object = getGithubToken();
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
  }
}

/**
 * This function acquires the issue linked in the pull request
 */
export async function runNoOps(): Promise<void> {
  const PR = await axios.get(
    `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/pulls?state=open`
  );
  PR.data.forEach(async (pull: any) => {
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
      const ISSUE = await axios.get(
        `${API}/${GITPAYD_OWNER}/${GITPAYD_REPO}/issues/${ISSUE_NUM}`
      );
      const AMT: string | null = splitter(ISSUE.data.body, "Bounty: ");
      log(
        `attempting to settle pull request #${PULL_NUM} for ${AMT} sats`,
        LogLevel.INFO,
        false
      );
      parseAmountDue(AMT, PAYMENT_REQUEST, PULL_NUM);
    } else {
      log(`no pull requests are eligible`, LogLevel.INFO, true);
    }
  });
}
