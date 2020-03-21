# devtools-protocol
Explore the Chrome DevTools Protocol, its methods, events and basic documentation.

More: [DevTools Protocol repo](https://github.com/ChromeDevTools/devtools-protocol) and [published devtools protocol viewer](https://chromedevtools.github.io/devtools-protocol/)


##  Building


```sh
# install bower dependencies
bower install

# install dependencies
yarn

# regenerate the protocol files
yarn prep

# build it
yarn build

# serve it locally
yarn serve
```

Deploying:

We deploy to https://chromedevtools.github.io/devtools-protocol/ despite the source living here. The [repo/branch layout is described here](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/78). Master branch of this repo is deployed every hour (on the 15 minute mark) via the [devtools-protocol/scripts/update-n-publish-docs.sh](https://github.com/ChromeDevTools/devtools-protocol/blob/master/scripts/update-n-publish-docs.sh) script.

```sh
yarn deploy
```



## Adding new version

To add a new protocol version:

1. Modify `_data/versions.json`
1. Create `_data/VERSION_SLUG` folder and put `protocol.json` file there
1. Create `_versions/VERSION_SLUG.html` file with protocol version description
1. Update the `<paper-dropdown-menu id="versions">` tag in `index.html`.
1. Build project

## Adding new domains

Run `node generate-sidenav-html.js` and add into `<div id="drawerToolbar" class="paper-font-title">Domains</div>` in `index.html`.

## History


* [v0.1](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.1/index.html)            original Eric Guzman app.
* [v0.2](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.2/index.html)            irish's "upgrades".
* [v0.8](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.8/index.html)            guzman's polymer 0.8 refactor
* [v1.0](https://rawgit.com/ChromeDevTools/devtools-protocol/v1.0/index.html)            konrad's polymer 1.0 + jekyll refactor
* [v2.0](https://chromedevtools.github.io/devtools-protocol/)                            tim's polymer 2.0 - jekyll refactor
* which brings us to… [now](https://chromedevtools.github.io/devtools-protocol/).


## License

Apache

## Contributing

Pull requests very welcome!
