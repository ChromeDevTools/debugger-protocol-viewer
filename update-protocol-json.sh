#!/bin/bash
set -x

standalone_path="$HOME/code/devtools-standalone/protocol.json"
chromium_path="$HOME/chromium/src/third_party/WebKit/Source/devtools/protocol.json"
repo_path="dunno"

local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
local_protocol_path="_data/tot/protocol.json"

if [ -s $standalone_path ]; then
  repo_path=$standalone_path
elif [ -s $chromium_path ]; then
  repo_path=$chromium_path
else
  echo "error: couldn't find local checkout" >&2; exit 1
fi
# copy the protocol.json over
cp -r "$repo_path" "$local_protocol_path"

cd $local_script_path
node create-domain-files.js
node create-search-index.js

# get the latest change
cd $(dirname "$repo_path")
commit_line=$(git log --no-color HEAD~1..HEAD  | grep -E -o "^commit.*")
date_line=$(git log --no-color HEAD~1..HEAD  | grep -E -o "^Date.*")
commit_hash=$(echo $commit_line | grep -E -o "[0-9a-f]{20,80}")

# copy it into the HTML file
cd $local_script_path
cat _versions/tot.html | sed -e "s/^Date.*/$date_line/" | sed -E "s/[0-9a-f]{20,80}/$commit_hash/" > _versions/tot.html.new
mv _versions/tot.html.new _versions/tot.html


set +x
