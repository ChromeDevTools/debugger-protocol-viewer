# debugger-protocol-viewer
Explore the Chrome DevTools debugger protocol, its methods, events and basic documentation.

More on the [Chrome DevTools debugger protocol](https://developer.chrome.com/devtools/docs/debugger-protocol)


##  Building

Dependencies:

    gem install jekyll
    npm install -g bower

    bower install

Building:

    jekyll serve # compiles site to _site/ and watches for file changes

Updating protocol:

* Update `_data/protocol.json` to latest
* Run `node create-domain-files.js`
* Run `node create-search-index.js`

[#33](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/33) tracks a better flow.

Deploying:

All pushes to gh-pages instantly trigger a jeklyll build and the site will serve the resulting `_site`.

## History


* [v0.1](https://rawgit.com/ChromeDevTools/debugger-protocol-viewer/v0.1/index.html)            original Eric Guzman app.
* [v0.2](https://rawgit.com/ChromeDevTools/debugger-protocol-viewer/v0.2/index.html)            irish's "upgrades".
* [v0.8](https://rawgit.com/ChromeDevTools/debugger-protocol-viewer/v0.8/index.html)            guzman's polymer 0.8 refactor
* [v1.0](https://rawgit.com/ChromeDevTools/debugger-protocol-viewer/v1.0/index.html)            konrad's polymer 1.0 + jekyll refactor
* which brings us to… [now](https://chromedevtools.github.io/debugger-protocol-viewer/).


## License

Apache

## Contributing

Pull requests very welcome!
