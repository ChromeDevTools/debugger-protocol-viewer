#!/bin/bash
set -x -e

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
local_tot_protocol_path="data/tot.json"
local_v8_protocol_path="data/v8.json"

if ! [ -s $browser_protocol_path ]; then
  echo "error: couldn't find local protocol file" >&2; exit 1
fi
# copy the protocol.json over
cp $js_protocol_path $local_v8_protocol_path
# merge and create all our data files
node merge-protocol-files.cjs $browser_protocol_path $js_protocol_path > $local_tot_protocol_path

node make-stable-protocol.cjs

node create-search-index.cjs


