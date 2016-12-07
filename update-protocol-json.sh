#!/bin/bash
set -x

chromium_src_path="$HOME/chromium-tot/src"
local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# => into chromium
cd $chromium_src_path;

# check for what branch we're on. 
origBranchName="$(git symbolic-ref --quiet --short HEAD 2> /dev/null || \
    git describe --all --exact-match HEAD 2> /dev/null || \
    git rev-parse --short HEAD 2> /dev/null)";

git fetch origin
git checkout -f origin/master
env GYP_DEFINES=disable_nacl=1 gclient sync --jobs=70

browser_protocol_path="$chromium_src_path/third_party/WebKit/Source/core/inspector/browser_protocol.json"
js_protocol_path="$chromium_src_path/v8/src/inspector/js_protocol.json"

# => into viewer
cd $local_script_path
local_tot_protocol_path="_data/tot/protocol.json"
local_v8_protocol_path="_data/v8/protocol.json"

if ! [ -s $browser_protocol_path ]; then
  echo "error: couldn't find local checkout" >&2; exit 1
fi
# copy the protocol.json over
cp $js_protocol_path $local_v8_protocol_path
# merge and create all our data files
node merge-protocol-files.js $browser_protocol_path $js_protocol_path > $local_tot_protocol_path
node create-domain-files.js
node create-search-index.js

# get the latest change
# => into chromium
cd $(dirname "$browser_protocol_path")
br_commit_line=$(git log --no-color --max-count=1 -- browser_protocol.json | grep -E -o "^commit.*")
br_date_line=$(git log --no-color --max-count=1 -- browser_protocol.json | grep -E -o "^Date.*")
br_commit_hash=$(echo $br_commit_line | grep -E -o "[0-9a-f]{20,80}")

cd $(dirname "$js_protocol_path")
js_commit_line=$(git log --no-color --max-count=1 -- js_protocol.json | grep -E -o "^commit.*")
js_date_line=$(git log --no-color --max-count=1 -- js_protocol.json | grep -E -o "^Date.*")
js_commit_hash=$(echo $js_commit_line | grep -E -o "[0-9a-f]{20,80}")

# copy it into the HTML file
# => into viewer
cd $local_script_path

cat _versions/tot.html | sed -Ee "s/^(<code browser>)Date.*/\1$br_date_line/" | sed -Ee "s/(browser.*)([0-9a-f]{40,80})/\1$br_commit_line/" > _versions/tot.html.new
cat _versions/tot.html.new | sed -Ee "s/^(<code js>)Date.*/\1$js_date_line/"  | sed -Ee "s/(js.*)([0-9a-f]{40,80})/\1$js_commit_hash/" > _versions/tot.html
rm -f _versions/tot.html.new

set +x
