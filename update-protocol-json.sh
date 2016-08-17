#!/bin/bash
set -x

chromium_src_path="$HOME/chromium/src"
git -C "$chromium_src_path" checkout origin/master

browser_protocol_path="$chromium_src_path/third_party/WebKit/Source/core/inspector/browser_protocol.json"
js_protocol_path="$chromium_src_path/third_party/WebKit/Source/platform/v8_inspector/js_protocol.json"

local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
local_tot_protocol_path="_data/tot/protocol.json"
local_v8_protocol_path="_data/v8/protocol.json"

if ! [ -s $browser_protocol_path ]; then
  echo "error: couldn't find local checkout" >&2; exit 1
fi
# copy the protocol.json over
cp $js_protocol_path $local_v8_protocol_path
node merge-protocol-files.js $browser_protocol_path $js_protocol_path > $local_tot_protocol_path

cd $local_script_path
node create-domain-files.js
node create-search-index.js

# get the latest change
cd $(dirname "$browser_protocol_path")
commit_line=$(git log --no-color HEAD~1..HEAD  | grep -E -o "^commit.*")
date_line=$(git log --no-color HEAD~1..HEAD  | grep -E -o "^Date.*")
commit_hash=$(echo $commit_line | grep -E -o "[0-9a-f]{20,80}")

# copy it into the HTML file
cd $local_script_path
cat _versions/tot.html | sed -e "s/^Date.*/$date_line/" | sed -E "s/[0-9a-f]{20,80}/$commit_hash/" > _versions/tot.html.new
mv _versions/tot.html.new _versions/tot.html


set +x
