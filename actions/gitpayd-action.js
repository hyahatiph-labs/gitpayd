const core = require('@actions/core');
const github = require('@actions/github');
const https = require('https')

try {
  const host = core.getInput('host');
  const port = core.getInput('port');
  const apiKey = core.getInput('api-key');
  const token = core.getInput('token');
  const time = (new Date()).toTimeString();
  core.setOutput("time", time)
  // Get the JSON webhook payload for the event that triggered the workflow
  const payload = JSON.stringify(github.context.payload, undefined, 2)
  console.log(`The event payload: ${payload}`)
} catch (error) {
  core.setFailed(error.message)
}

/**
 * Use Node.js core API to execute a POST to gitpayd
 * @param {string} host 
 * @param {string} port 
 * @param {string} apiKey 
 * @param {string} token 
 */
const executeNoOps = (host, port, apiKey, token) => {
    const options = {
        hostname: `${host}`,
        port: `${port}`,
        path: '/gitpayd/noops',
        method: 'POST',
        headers: {
          'authorization': `${apiKey}`,
          'github-token': `${token}`
        }
      }
      
      const req = https.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`)
      
        res.on('data', d => {
          process.stdout.write(d)
        })
      })
      
      req.on('error', error => {
        console.error(error)
      })
      
      req.write(data)
      req.end()
}