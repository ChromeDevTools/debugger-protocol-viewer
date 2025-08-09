'use strict';

/**
 * Utility command that creates the search index for pages/_data/?.json.
 */

const fs = require('fs');
const VERSIONS_FILE = 'pages/_data/versions.json';

const versionsText = fs.readFileSync(VERSIONS_FILE);
const versions = JSON.parse(versionsText);

versions.forEach(generateSearchIndex);

function generateSearchIndex(version) {
  const protocolText = fs.readFileSync(`pages/_data/${version.slug}.json`);
  const protocol = JSON.parse(protocolText);

  // Set up Keyword bank
  // Split up search keywords into primary and secondary matches.
  // Primary kewords - event, domain, command names; plus type ids.
  // Secondary keywords - command parameter names, event parameter names, type
  // properties.
  // Reasoning: Primary keyword matches will appear at the top of the search
  // result list, while secondary matches, which are likely to have duplicates,
  // will appear at the bottom.

  var PageRefType = {
    DOMAIN: '0',
    EVENT: '1',
    PARAM: '2',
    TYPE_ID: '3',
    COMMAND: '4'
  };
  // Optional root path to be prepended to page reference URLs.
  var SITE_ROOT = '';
  var MAX_DESCRIPTION_LENGTH = 200;

  function getShortDescription(description) {
    return description && description.length > MAX_DESCRIPTION_LENGTH ?
        description.substr(0, MAX_DESCRIPTION_LENGTH) + '...' : description;
  }

  // Represents a page reference.
  var PageReference = {
    init: function(domain, type, description) {
      this.domain = domain;
      this.type = type;
      this.description = description
    },
    createPageReference: function(title, type, description) {
      var ref = Object.create(PageReference);
      ref.init(title, type, getShortDescription(description));
      return ref;
    },
    setHrefs: function(href, domainHref) {
      this.domainHref = domainHref;
      if (href) {
        this.href = href;
      }
    }
  };

  // Represents a keyword match, which may have many page references.
  var KeyRecord = {
    init: function(keyword) {
      this.keyword = keyword;
      this.pageReferences = [];
    },
    addReference: function(pageRef) {
      this.pageReferences.push(pageRef);
    },
    createKeyRecord: function(keyword, opt_pageRef) {
      var keyRecord = Object.create(KeyRecord);
      keyRecord.init(keyword);
      if (opt_pageRef) {
        keyRecord.addReference(opt_pageRef);
      }
      return keyRecord;
    }
  };

  // Used to store our key records.
  var keywordMap = {
    // Lazily creates a KeyRecord.
    addReferenceForKey: function(keyword, pageRef) {
      const key = keyword.toLowerCase();
      var record = this[key];
      if (record) {
        record.addReference(pageRef);
      } else {
        this[key] = KeyRecord.createKeyRecord(keyword, pageRef);
      }
    }
  };

  (protocol.domains).forEach(function (domain, idx) {
    var domainName = domain.domain;
    var domainPath = SITE_ROOT + version.slug + '/' + domainName + '/';
    // Reminder: You may have multiple pages per keyword.
    // Store domain name as a page reference under itself as a keyword.
    var ref = PageReference.createPageReference(
        domainName, PageRefType.DOMAIN, domain.description);
    ref.setHrefs('', domainPath);
    keywordMap.addReferenceForKey(domainName, ref);

    if (domain.commands) {
      domain.commands.forEach(function(command) {
        var commandName = command.name;
        var commandNameHref = '#method-' + commandName;
        var ref = PageReference.createPageReference(
            domainName, PageRefType.COMMAND, command.description);
        ref.setHrefs(commandNameHref, domainPath);
        keywordMap.addReferenceForKey(`${domainName}.${commandName}`, ref);
      });
    }
    if (domain.events) {
      domain.events.forEach(function(event) {
        var eventName = event.name;
        var eventNameHref = '#event-' + eventName;
        var ref = PageReference.createPageReference(
            domainName, PageRefType.EVENT, event.description);
        ref.setHrefs(eventNameHref, domainPath);
        keywordMap.addReferenceForKey(`${domainName}.${eventName}`, ref);
      });
    }
    if (domain.types) {
      domain.types.forEach(function(type) {
        var typeName = type.id;
        var typeNameHref = '#type-' + typeName;
        var ref = PageReference.createPageReference(
            domainName, PageRefType.TYPE_ID, type.description);
        ref.setHrefs(typeNameHref, domainPath);
        keywordMap.addReferenceForKey(`${domainName}.${typeName}`, ref);
      });
    }
    // TODO(ericguzman): Index other keyword types.
  });

  const fileName = `search_index/${version.slug}.json`;
  const content = JSON.stringify(keywordMap);
  fs.writeFileSync(fileName, content);
}
