#!/bin/bash
set -x

local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ -n "$CI" ]; then
  # https://github.com/ChromeDevTools/devtools-protocol/blob/HEAD/.github/workflows/update.yml
  protocol_repo_path="$local_script_path/.."
else
  # Assume `devtools-protocol` lives alongside `debugger-protocol-viewer`.
  protocol_repo_path="$local_script_path/../devtools-protocol"
fi

browser_protocol_path="$protocol_repo_path/json/browser_protocol.json"
js_protocol_path="$protocol_repo_path/json/js_protocol.json"

# => into viewer
cd $local_script_path
local_tot_protocol_path="pages/_data/tot.json"
local_v8_protocol_path="pages/_data/v8.json"

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

cat pages/tot.md | sed -Ee "s/^(<code browser>)Date.*/\1$br_date_line/" > pages/tot.md.new
cat pages/tot.md.new | sed -Ee "s/^(<code js>)Date.*/\1$js_date_line/"  > pages/tot.md
rm -f pages/tot.md.new

