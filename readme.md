# debugger-protocol-viewer
Explore the Chrome DevTools debugger protocol, its methods, events and basic documentation.

More on the [Chrome DevTools debugger protocol](https://developer.chrome.com/devtools/docs/debugger-protocol)


##  Building

Dependencies: 

    gem install jekyll
    npm install -g bower
    
    bower install
    
Building:

    jekyll build  # compiles site to ._site/
        
    jekyll serve
    
Deploying:

All pushes to gh-pages instantly trigger a jeklyll build and the site will serve the resulting `_site`.


## License

Apache

## Contributing

Pull requests very welcome!