The 1.1 version of the real protocol viewer.

This repo is (hopefully) a mirror of the `gh-pages-1.1` [branch](https://github.com/ChromeDevTools/debugger-protocol-viewer/tree/) of https://github.com/ChromeDevTools/debugger-protocol-viewer/. Here's the delta between the original: https://github.com/ChromeDevTools/debugger-protocol-viewer/compare/gh-pages-1.1

### setup
```sh
# starting from gh-pages branch on the original repo
git checkout -b gh-pages-1.1
git remote add 1.1 git@github.com:ChromeDevTools/debugger-protocol-viewer-1.1.git
git pull 1.1 gh-pages
```

### hack
```sh
# after making edits
git push 1.1 gh-pages-1.1:gh-pages  # to deploy
git push origin gh-pages-1.1  # to keep origin in sync
```
