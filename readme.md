# devtools-protocol
Explore the Chrome DevTools Protocol, its methods, events and basic documentation.

More: [DevTools Protocol repo](https://github.com/ChromeDevTools/devtools-protocol) and [published devtools protocol viewer](https://chromedevtools.github.io/devtools-protocol/)


##  Building

Dependencies:

```sh
yarn
```

Building:
```sh
yarn build
```

```Serving:
```sh
yarn serve
```

Generate latest up-to-date docs:
```sh
./generate-docs.sh
```

Deploying:

We deploy to https://chromedevtools.github.io/devtools-protocol/ despite the source living here. The [repo/branch layout is described here](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/78).

```sh
# deploy to https://chromedevtools.github.io/devtools-protocol/
git remote add dtprotocol git@github.com:ChromeDevTools/devtools-protocol.git
git push dtprotocol master:gh-pages
```

All pushes to gh-pages instantly trigger a jeklyll build and the site will serve the resulting `_site`.


## Adding new version

To add a new protocol version:

1. Modify `_data/versions.json`
1. Create `_data/VERSION_SLUG` folder and put `protocol.json` file there
1. Create `_versions/VERSION_SLUG.html` file with protocol version description
1. Build project

## Adding new domains

They must be manually added to `<div id="drawerToolbar" class="paper-font-title">Domains</div>` in `index.html`.

## History


* [v0.1](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.1/index.html)            original Eric Guzman app.
* [v0.2](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.2/index.html)            irish's "upgrades".
* [v0.8](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.8/index.html)            guzman's polymer 0.8 refactor
* [v1.0](https://rawgit.com/ChromeDevTools/devtools-protocol/v1.0/index.html)            konrad's polymer 1.0 + jekyll refactor
* which brings us to… [now](https://chromedevtools.github.io/devtools-protocol/).


## License

Apache

## Contributing

Pull requests very welcome!
