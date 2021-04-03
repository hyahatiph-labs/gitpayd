#!/usr/bin/env node
import axios from "axios";
import { NoOpsEnvironment, splitter, validateCollaborators } from "./util";
import log, { LogLevel } from "../src/logging";

const ENV: string = process.env.GITPAYD_ENV;
const API: string = "https://api.github.com/repos";
const OWNER: string = process.env.GITPAYD_OWNER;
const REPO: string = process.env.GITPAYD_REPO;
const HOST: string = process.env.GITPAYD_HOST;
const PORT: string =
  ENV === NoOpsEnvironment.DEV
    ? process.env.GITPAYD_DEV_PORT
    : process.env.GITPAYD_PORT;
const PROTOCOL: string = ENV === NoOpsEnvironment.DEV ? "http" : "https";
const API_KEY: string = process.env.GITPAYD_API_KEY;
const TOKEN = process.env.GITPAYD_TOKEN;
const HOST_URL: string = `${PROTOCOL}://${HOST}:${PORT}/gitpayd`;
let headers: object;
const GITPAYD_TOKEN_HEADER: object = { authorization: `${API_KEY}` };
const GITHUB_TOKEN_HEADER: object = { authorization: `token ${TOKEN}` };
const MERGE_BODY: object = { commit_title: "merged by gitpayd" };
const CUSTOM_MAX_PAYMENT: string = process.env.MAX_PAYMENT;
const CUSTOM_PAYMENT_THRESHOLD: string = process.env.PAYMENT_THRESHOLD;
const DEFAULT_MAX_PAYMENT: number = 100000;
const DEFAULT_PAYMENT_THRESHOLD: number = 250000;
const MAX_PAYMENT: number | string =
  CUSTOM_MAX_PAYMENT === undefined
  ? DEFAULT_MAX_PAYMENT
  : parseInt(CUSTOM_MAX_PAYMENT, 10);
const PAYMENT_THRESHOLD: number =
  CUSTOM_PAYMENT_THRESHOLD === undefined
    ? DEFAULT_PAYMENT_THRESHOLD
    : parseInt(CUSTOM_PAYMENT_THRESHOLD, 10);

// set accept in axios header
axios.defaults.headers.get.Accept = "application/vnd.github.v3+json";

/**
 * Helper function to warn user of misconfigured environment
 */
const validateEnv = (): void => {
  const ENV_SET: Set<string> = new Set([
    HOST,
    PORT,
    OWNER,
    REPO,
    TOKEN,
    API_KEY,
  ]);
  ENV_SET.forEach((v) => {
    if (v === undefined || v === null || v === "") {
      throw new Error("noops environment variables are not configured");
    }
  });
};

/**
 * Make the API call to LND for processing payments
 * @param {string} paymentRequest - lnd invoice
 */
async function sendPayment(paymentRequest: string): Promise<void> {
  headers = GITPAYD_TOKEN_HEADER;
  // send the payment
  const PRE_IMAGE = await axios.post(
    `${HOST_URL}/pay/${paymentRequest}`,
    {},
    { headers }
  );
  log(`payment pre-image: ${PRE_IMAGE.data.image}`, LogLevel.INFO, false);
}

/**
 * Helper function for processing payment validity
 * @param {string} amount - bounty from the issue
 * @param {string} paymentRequest - lnd invoice
 */
async function amtParser(
  amount: string,
  paymentRequest: string,
  pullNum: number
): Promise<void> {
  // decode the payment request and make sure it matches bounty
  headers = GITPAYD_TOKEN_HEADER;
  const DECODED_AMT = await axios.get(`${HOST_URL}/decode/${paymentRequest}`, {
    headers,
  });
  log(
    `payment amount decoded: ${DECODED_AMT.data.amt} sats`,
    LogLevel.INFO,
    false
  );
  const AMT_MATCHES_BOUNTY: boolean = DECODED_AMT.data.amt === amount;
  if (!AMT_MATCHES_BOUNTY) {
    log("decoded amount does not match bounty!", LogLevel.ERROR, false);
  }
  const BALANCE = await axios.get(`${HOST_URL}/balance`, { headers });
  log(
    `gitpayd channel balance is: ${BALANCE.data.balance.sat} sats`,
    LogLevel.INFO,
    false
  );
  // ensure the node has a high enough local balance to payout
  const NUM_AMT = parseInt(amount, 10);
  const isValidPayment =
    NUM_AMT > 0 &&
    NUM_AMT < MAX_PAYMENT &&
    AMT_MATCHES_BOUNTY &&
    BALANCE.data.balance.sat >= NUM_AMT &&
    NUM_AMT < PAYMENT_THRESHOLD;
  if (isValidPayment) {
    sendPayment(paymentRequest);
    headers = GITHUB_TOKEN_HEADER;
    const MERGE = await axios.put(`${API}/${OWNER}/${REPO}/pulls/${pullNum.toString()}/merge`,
             MERGE_BODY, { headers });
        log(`${MERGE.data.message}`, LogLevel.INFO, false);
  } else {
    log("invalid payment request", LogLevel.ERROR, false);
  }
}

/**
 * This function acquires the issue linked in the pull request
 */
async function noOps(): Promise<void> {
  headers = GITHUB_TOKEN_HEADER;
  const PR = await axios.get(`${API}/${OWNER}/${REPO}/pulls?state=open`);
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
      log(`processing issue #${ISSUE_NUM}...`, LogLevel.INFO, false);
      const ISSUE = await axios.get(
        `${API}/${OWNER}/${REPO}/issues/${ISSUE_NUM}`
      );
      const AMT: string | null = splitter(ISSUE.data.body, "Bounty: ");
      log(
        `attempting to settle pull request #${PULL_NUM} for ${AMT} sats`,
        LogLevel.INFO,
        false
      );
      amtParser(AMT, PAYMENT_REQUEST, PULL_NUM);
    } else {
      log(`no pull requests are eligible`, LogLevel.INFO, true);
    }
  });
}

validateEnv();
noOps().catch(() => new Error("noops failed to execute"));
