#!/bin/bash
set -euxo pipefail

local_script_path="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
build_dp_path=$local_script_path/../devtools-protocol

# v lame assertions
cat $build_dp_path/index.html | grep DOMSnapshot
cat $build_dp_path/tot/Page/index.html | grep --no-messages navigateToHistoryEntry

stat $build_dp_path/search_index/v8.json
stat $build_dp_path/search_index/tot.jsson

echo "assertions passed ✅"
