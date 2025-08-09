# debugger-protocol-viewer

Website for viewing Chrome DevTools Protocol defined at
https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/public/devtools_protocol/.

More: [DevTools Protocol repo](https://github.com/ChromeDevTools/devtools-protocol) and [published devtools protocol viewer](https://chromedevtools.github.io/devtools-protocol/)


##  Building


```sh
# install dependencies
npm i

# regenerate the protocol files
npm run prep

# build it
npm run build

# serve it locally
npm run serve
```

## Deploying

We deploy to https://chromedevtools.github.io/devtools-protocol/ despite the source living here.
The [repo/branch layout is described here](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/78).
There is no need to manually trigger deployments. It’s done [automatically](https://github.com/ChromeDevTools/devtools-protocol/commit/c9c207e583264058326792210d1b29a95109beac) as part of the devtools-protocol GitHub Actions workflow.

FYI: The protocol files here in `debugger-protocol-viewer#master` don't get updated. A deployment writes to the `devtools-protocol#ghpages` branch.

## Adding new version

To add a new protocol version:

1. Modify `pages/_data/versions.json`
1. Create `pages/_data/VERSION_SLUG.json`
1. Create `_versions/VERSION_SLUG.html` file with protocol version description
1. Update the `<div id="versions">` tag in `pages/_includes/shell.hbs`.
1. Build project

## Adding new domains

Run `npm run prep` then `node generate-sidenav-html.cjs` and add into `<div id="domains">` in `pages/_includes/shell.hbs`.

## History


* [v0.1](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.1/index.html)            original Eric Guzman app.
* [v0.2](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.2/index.html)            irish's "upgrades".
* [v0.8](https://rawgit.com/ChromeDevTools/devtools-protocol/v0.8/index.html)            guzman's polymer 0.8 refactor
* [v1.0](https://rawgit.com/ChromeDevTools/devtools-protocol/v1.0/index.html)            konrad's polymer 1.0 + jekyll refactor
* [v2.0](https://github.com/ChromeDevTools/debugger-protocol-viewer/tree/polymer)                            tim's polymer 2.0 - jekyll refactor
* [v3.0](https://chromedevtools.github.io/devtools-protocol/)                            tim's Eleventy refactor
* which brings us to… [now](https://chromedevtools.github.io/devtools-protocol/).


## License

Apache

## Contributing

Report issues about the website via GitHub issues in this repo. Please report
issues with CDP itself via https://crbug.com/new. Pull requests very welcome!
