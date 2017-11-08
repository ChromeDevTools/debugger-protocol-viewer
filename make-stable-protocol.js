'use strict';

/**
 * 
 */

const fs = require('fs');
const tot = require('./_data/tot/protocol.json');


const isNotExperimentalOrDeprecated = item => !item.experimental && !item.deprecated;

const stableProtocol = tot;


stableProtocol.domains = stableProtocol.domains.filter(isNotExperimentalOrDeprecated);
stableProtocol.domains.forEach(domain => {
	if (domain.types)
		domain.types = domain.types.filter(isNotExperimentalOrDeprecated);

	if (domain.commands)
		domain.commands = domain.commands.filter(isNotExperimentalOrDeprecated);
	
	if (domain.events)
		domain.events = domain.events.filter(isNotExperimentalOrDeprecated);
});

// filter out command params, too?
fs.writeFileSync('./_data/1-3/protocol.json', JSON.stringify(stableProtocol, null, 2));

