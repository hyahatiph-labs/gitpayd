# gitpayd

git + [BTC](https://bitcoin.org/en/bitcoin-core) / [LND](https://github.com/lightningnetwork/lnd), gitpayd watches your repo for new commits and sends payments to contributors

  

![image](https://user-images.githubusercontent.com/13033037/112792971-6e67e800-9032-11eb-96bb-79e5a460320c.png)

*** <b>Caution</b>: This application and Lightning Network APIs are beta and breaking changes may occur. Use mainnet at your own risk!

## Project Layout

```bash
gitpayd/
├── src                 # All source code
   ├── gitpayd.ts        # Entry point for the app
   ├── logging.ts        # In house logger, since TS hates console.log()
   ├── noops.ts          # NoOps / DevOps script for processing CI / CD payments
   ├── setup.ts          # Creates configuration, connects to LND, helper functions, etc.
```

## Development

1. Run `npm i && npm start`
2. Test health check at `http://localhost/gitpayd/health`
3. Verify configuration files at `~/.gitpayd/config.json`
*** Optional: Configure SSL certs


## Notes
1. This application runs on Node 15.x+
2. Currently, only battle tested on Fedora 34 Beta
3. You may need to run `sudo setcap cap_net_bind_service=+ep `readlink -f \`which node\``` for the app to run on port 80
4. Secrets can be configured in your repository `settings` => `secrets`
5. Sample Github workflow .yml is located in `gitpayd/.github/workflows/build.yml`

<b>Required Environment Variables</b>
<ul>
<li>GITPAYD_OWNER -  repo owner
<li>GITPAYD_REPO - name of repo to watch
<li>GITPAYD_HOST - host of your server
<li>GITPAYD_TOKEN - aka GITHUB token
<li>API_KEY - default is same as LND admin.macaroon
</ul>
<b>Sample .gitpayd/config.json</b>

`{`
  `"macaroonPath": "/home/USER/.lnd/data/chain/bitcoin/mainnet/admin.macaroon",`
 ` "lndHost": "https://localhost:8080"`
`}`

## Building

1. Run `npm run build`
2. Output is in `/dist`

## Releasing

TODO: Automated release management via `npm pkg` and workflows

## Testing

WIP

## Contributing

Fork it and open a pull request.