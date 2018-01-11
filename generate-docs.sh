#!/bin/bash
set -x

# Machine-specific path, naturally
local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
protocol_repo_path="$local_script_path/../devtools-protocol"

browser_protocol_path="$protocol_repo_path/json/browser_protocol.json"
js_protocol_path="$protocol_repo_path/json/js_protocol.json"

# => into viewer
cd $local_script_path
local_tot_protocol_path="_data/tot/protocol.json"
local_v8_protocol_path="_data/v8/protocol.json"

if ! [ -s $browser_protocol_path ]; then
  echo "error: couldn't find local protocol file" >&2; exit 1
fi
# copy the protocol.json over
cp $js_protocol_path $local_v8_protocol_path
# merge and create all our data files
node merge-protocol-files.js $browser_protocol_path $js_protocol_path > $local_tot_protocol_path

node make-stable-protocol.js

node create-search-index.js

# get the latest change
# => into chromium
cd $(dirname "$browser_protocol_path")
br_commit_line=$(git log --date=iso --no-color --max-count=1 -- browser_protocol.json | grep -E -o "^commit.*")
br_date_line=$(git log --date=iso --no-color --max-count=1 -- browser_protocol.json | grep -E -o "^Date.*")

cd $(dirname "$js_protocol_path")
js_commit_line=$(git log --date=iso --no-color --max-count=1 -- js_protocol.json | grep -E -o "^commit.*")
js_date_line=$(git log --date=iso --no-color --max-count=1 -- js_protocol.json | grep -E -o "^Date.*")

# copy it into the HTML file
# => into viewer
cd $local_script_path

# we no longer printing the most recent protocol git hashes.
# we can restore this when the devtools-protocol repo starts includes that data

cat _versions/tot.html | sed -Ee "s/^(<code browser>)Date.*/\1$br_date_line/" > _versions/tot.html.new
cat _versions/tot.html.new | sed -Ee "s/^(<code js>)Date.*/\1$js_date_line/"  > _versions/tot.html
rm -f _versions/tot.html.new

yarn run build

# cd ..

# git clone git@github.com:ChromeDevTools/devtools-protocol.git --single-branch devtools-temp

# cd devtools-temp

# git checkout --orphan gh-pages

# # remove all content
# git rm -rf -q .

# cp -R ../debugger-protocol-viewer/devtools-protocol/{*,.nojekyll} ./

# git add .

# git commit -am 'seed gh-pages'

# git push -u origin gh-pages --force

# cd ..

# rm -rf devtools-temp

# set +x
