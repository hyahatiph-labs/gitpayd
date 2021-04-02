import axios from 'axios';
import log, { LogLevel } from './logging';
import { AuthorizedRoles, GitpaydConfig } from './setup';
const API: string = 'https://api.github.com/repos';
const OWNER: string = process.env.GITPAYD_OWNER;
const REPO: string = process.env.GITPAYD_REPO;
const GITPAYD_HOST: string = `https://${process.env.GITPAYD_HOST}/gitpayd`;
const headers: object = { 'Authorization': process.env.API_KEY };
const TOKEN: string = `token ${process.env.GITHUB_TOKEN}`;
const MERGE_BODY: object = { "commit_title": "merged by gitpayd" };

// set accept in axios header
axios.defaults.headers.get.Accept = 'application/vnd.github.v3+json';

/**
 * Perform validation on collaborators
 * @param {string} role - role extracted from the pull request
 * @returns boolean
 */
const validateCollaborators = (role:AuthorizedRoles): boolean => {
    return role === AuthorizedRoles.COLLABORATOR || role === AuthorizedRoles.OWNER;
}

/**
 * Helper function for parsing values from github metadata
 * @param {string} str - body from the api call
 * @param {string} delimiter - split on this
 * @returns String
 */
export const splitter = (body:string, delimiter:string):string | null => {
    const PRE_PARSE = body.split(delimiter);
    return PRE_PARSE[1] !== undefined ? PRE_PARSE[1].split('\n')[0].trim() : null;
}

/**
 * Make the API call to LND for processing payments
 * @param {string} paymentRequest - lnd invoice
 */
async function sendPayment(paymentRequest:string):Promise<void> {
    // send the payment
    const PRE_IMAGE =
    await axios.post(`${GITPAYD_HOST}/pay/${paymentRequest}`, {}, {headers});
    log(`payment pre-image: ${PRE_IMAGE.data.image}`, LogLevel.INFO, false);
}

/**
 * Helper function for processing payment validity
 * @param {string} amount - bounty from the issue
 * @param {string} paymentRequest - lnd invoice
 */
 async function amtParser(amount:string, paymentRequest:string):Promise<void> {
    // decode the payment request and make sure it matches bounty
    const DECODED_AMT =
    await axios.get(`${GITPAYD_HOST}/decode/${paymentRequest}`, {headers});
    log(`payment amount decoded: ${DECODED_AMT.data.amt} sats`, LogLevel.DEBUG, false);
    // TODO: add this check for strict payments
    // if(DECODED_AMT.data.amt !== amount) {
    //     throw new Error('Decoded amount does not match bounty!')
    // }
    const BALANCE = await axios.get(`${GITPAYD_HOST}/balance`, {headers});
    log(`gitpayd channel balance is: ${BALANCE.data.balance.sat} sats`, LogLevel.DEBUG, false);
    // ensure the node has a high enough local balance to payout
    const NUM_AMT = parseInt(amount, 10);
    const isValidPayment = NUM_AMT > 0 && NUM_AMT < GitpaydConfig.MAX_PAYMENT
        && (BALANCE.data.balance.sat >= NUM_AMT) && NUM_AMT < GitpaydConfig.PAYMENT_THRESHOLD
    if(isValidPayment) {
        sendPayment(paymentRequest);
    } else {
        throw new Error('invalid valid payment');
    }

}

/**
 * This function acquires the issue linked in the pull request
 */
async function acquireIssues():Promise<void> {
    const PR = await axios.get(`${API}/${OWNER}/${REPO}/pulls?state=open`);
    PR.data.forEach(async (pull:any) => {
        const ISSUE_NUM:string | null = splitter(pull.body, 'Closes #');
        const PAYMENT_REQUEST:string | null = splitter(pull.body, 'LN:');
        const PULL_NUM:number = pull.number;
        const isCollaborator: boolean = validateCollaborators(pull.author_association);
        if (!isCollaborator) {
            throw new Error(`unauthorized collaborator ${pull.user.login} access on gitpayd`);
        }
        if(ISSUE_NUM && PAYMENT_REQUEST && isCollaborator) {
            log(`Processing issue #${ISSUE_NUM}...`, LogLevel.INFO, false);
            const ISSUE = await axios.get(`${API}/${OWNER}/${REPO}/issues/${ISSUE_NUM}?state=open`);
            const AMT:string | null = splitter(ISSUE.data.body, 'Bounty: ');
            log(`Attempting to settle pull request #${PULL_NUM} for ${AMT} sats`, LogLevel.INFO, false);
            amtParser(AMT, PAYMENT_REQUEST);
            // const MERGE = await axios.put(`${API}/${OWNER}/${REPO}/pulls/${PULL_NUM}/merge`,
            //     MERGE_BODY, { headers: {'authorization': TOKEN} });
            // log(`${MERGE.data.message}`, LogLevel.INFO, false);
        }
    })
}

acquireIssues().catch(e => {
    log(`${e}`, LogLevel.DEBUG, false);
    log('failed to process issues', LogLevel.ERROR, false)
});