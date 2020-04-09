"use strict";

module.exports = {
  ci: {
    collect: {
      numberOfRuns: 5,
      startServerCommand: "npm run serve",
      startServerReadyPattern: "Served by",
    },
    assert: {
      preset: "lighthouse:recommended",
    },
    upload: {
      serverBaseUrl: "https://lhci-canary.herokuapp.com/",
    },
  },
};
