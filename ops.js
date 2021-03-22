'use strict'
const axios = require('axios')
const owner = process.argv[2]
const repo = process.argv[3]

// set accept in axios header
axios.defaults.headers.get['Accept'] = 'application/vnd.github.v3+json';

// use github REST API to get a list of issues
async function acquireIssues() {
    const issues = await axios.get(`https://api.github.com/repos/${owner}/${repo}/issues`)
    const pr = await axios.get(`https://api.github.com/repos/${owner}/${repo}/pulls`)
    issues.data.forEach(element => {
        const bounty = element.body.split('Bounty: ')[1].split('\n')[0].trim()
        const id = element.id
        console.log(`Processing issue id: ${id} for ${bounty} satoshis`)
    });
}

acquireIssues().catch(e => console.error(e))

// parse payment request, send payment and merge pr

// close issue

// handle errors as needed and fail the build