# debugging-protocol-viewer
Explore the Chrome Debugging Protocol, its methods, events and basic documentation.

More on the [Chrome DevTools Debugging Protocol](https://developer.chrome.com/devtools/docs/debugger-protocol)


##  Building

Dependencies:

```sh
bundle install
bower install
```

Building:
```sh
jekyll server --incremental # compiles site to _site/ and watches for file changes
# may need to prefix however: `bundle exec jekyll server --incremental`
```
Updating protocol:

```sh
./update-protocol-json.sh

jekyll build # to build, though gh-pages will do that on its own.
```

[#33](https://github.com/ChromeDevTools/debugger-protocol-viewer/issues/33) tracks a better flow.

Deploying:

All pushes to gh-pages instantly trigger a jeklyll build and the site will serve the resulting `_site`.

## Adding new version

To add a new protocol version:

1. Modify `_data/versions.json`
1. Create `_data/VERSION_SLUG` folder and put `protocol.json` file there
1. Create `_versions/VERSION_SLUG.html` file with protocol version description
1. Build project

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
