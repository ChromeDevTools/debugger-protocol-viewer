"use strict";

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 3, // ignored due to https://github.com/treosh/lighthouse-ci-action/issues/48
      startServerCommand: "npm run serve",
      startServerReadyPattern: "Served by",
    },
    assert: {
      preset: "lighthouse:no-pwa",
    }
  },
};
