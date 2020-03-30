import {ChromeDevToolsDomain} from './elements/cr-domain/cr-domain.js';

const homePageContent = document.querySelector('main > section');
const domainElement = new ChromeDevToolsDomain();
const sectionElement = document.createElement('section');
sectionElement.appendChild(domainElement);

for (const link of [...document.querySelectorAll('#domains nav a')]) {
  link.addEventListener('click', async (event) => {
    event.preventDefault();

    
    const url = new URL(link.href);
    const [,version, newDomain] = url.pathname.split('/');
    const protocolData = await fetch(`_data/${version}/protocol.json`);
    const versionData = await protocolData.json();

    domainElement.domain = versionData.domains.find(d => d.domain === newDomain);
    domainElement.version = version;
    
    homePageContent.replaceWith(sectionElement);
  });
}





// const searchButton = document.getElementById('searchButton');
// const searchMenu = document.getElementById('searchMenu');
// const toolbar = document.getElementById('mainToolbar');
// const listbox = document.getElementById('versions').querySelector('paper-listbox');
// const mainSelector = document.getElementById('main-selector');
// const domainContainer = document.getElementById('domainContainer');
// const crDomain = document.querySelector('cr-domain');
// const domainSummary = document.getElementById('domain-summary');
// const mainElement = document.querySelector('main');

// /**
//  * Mapping from domain shortcut to its full name. Used for updating the title.
//  */
// const domainToNameMapping = {
//   '1-2': 'stable (1.2)',
//   '1-3': 'stable (1.3)',
//   'tot': 'latest (tip-of-tree)',
//   'v8': 'v8-inspector (node)',
// }

// const defaultTitle = 'Chrome DevTools Protocol Viewer';

// /**
//  * Hide links based on the domain that we are showing. The classList of
//  * each link has the (multiple) domains it is documented for.
//  * @param  {String} domain The domain that we have currently selected
//  */
// function updateDomainSelectorLinks(domain) {
//   for (const link of domainContainer.querySelectorAll('a')) {
//     if (link.classList.contains(domain)) {
//       link.style.display = 'flex';
//       link.href = `${domain}/${link.dataset.title}`;
//     } else {
//       link.style.display = 'none';
//     }
//   }
// }

// let domainSelectionPromise;

// async function updateLocationBindings(newLocation) {
//   // 18 is length of "/devtools-protocol"
//   let newPage = newLocation.startsWith('/devtools-protocol') ? newLocation.substring(18) : newLocation;
//   // Cut off start slash if it exists
//   if (newPage.startsWith('/')) {
//     newPage = newPage.substring(1);
//   }
//   let index, newVersion = newPage;
//   if ((index = newVersion.indexOf('/')) !== -1) {
//     newVersion = newVersion.substring(0, index);
//   }
//   listbox.selected = newVersion;

//   if (!domainToNameMapping[newVersion]) {
//     document.title = defaultTitle;
//     mainSelector.selected = newVersion;
//     newVersion = 'tot';
//   } else if (index === -1 || !newVersion.substring(index)) {
//     document.title = `${defaultTitle} - ${domainToNameMapping[newVersion]}`;

//     // Show the summary page if no sub-category was selected
//     mainSelector.selected = 'domain-summary';
//     fetch(`_versions/${newVersion}.html`)
//       .then(result => result.text())
//       .then((content) => domainSummary.innerHTML = `<h2 class="heading">${domainToNameMapping[newVersion]}</h2>${content}`);
//   }

//   updateDomainSelectorLinks(newVersion);
//   searchButton.protocolSrc = `search_index/${newVersion}.json`;

//   if (index !== -1 && newPage.substring(index) !== '/') {
//     let newDomain = newPage.substring(index + 1);
//     if (newDomain.endsWith('/')) {
//       newDomain = newDomain.substring(0, newDomain.length - 1);
//     }

//     document.title = `${defaultTitle} - ${newDomain}`;

//     // If we are switching between domains, but do not select a sub-category
//     // scroll all the way to the top again.
//     if (!location.hash) {
//       mainElement.scrollTop = '0';
//     }

//     domainSelectionPromise = new Promise(async (resolve) => {
//       mainSelector.selected = 'domain';

//       const result = await fetch('_data/' + newVersion + '/protocol.json');
//       const versionData = await result.json();

//       // confirm we have the dom elements present in the nav
//       const hardcodedDomains = Array.from(domainContainer.children).map(e => e.dataset.title);
//       versionData.domains.forEach(d => {
//         if (!hardcodedDomains.includes(d.domain)) console.error(`${d.domain} not present in domainContainer`);
//       });

//       crDomain.domain = versionData.domains.find(d => d.domain === newDomain);
//       domainContainer.selected = newDomain;
//       crDomain.version = newVersion;

//       // Wait for one frame and then resolve this promise, to make sure
//       // all data and elements are rendered, such that we can correctly
//       // scroll into view.
//       window.requestAnimationFrame(() => {
//         resolve();
//         domainSelectionPromise = undefined;
//       });
//     });
//   } else {
//     // We have not selected any domain, so we have to show the summar at the top
//     mainElement.scrollTop = '0';
//   }
// }

// const domainElement = document.querySelector('cr-domain');

// function processHashUpdate() {
//   function scrollIntoView() {
//     let scrollTarget = null;
//     if (!domainElement) {
//       return;
//     }
//     for (const details of domainElement.shadowRoot.querySelectorAll('cr-domain-details')) {
//       if (scrollTarget) continue;
//       if (`${details.type}-${details.name}` === location.hash) {
//         scrollTarget = details;
//       }
//     }

//     // Intra page link to a regular ID
//     if (!scrollTarget) {
//       scrollTarget = document.querySelector(`main [id="${location.hash}"]`);
//     }

//     if (scrollTarget) {
//       scrollTarget.scrollIntoView({behavior: 'instant', block: 'start'});
//     } else {
//       // After the hash update, we have not found any match.
//       // Could be the case that the hash is empty,
//       // or there is simply no match. Anyways, scroll all the way to the top
//       mainElement.scrollTop = '0';
//     }
//   }
//   window.requestAnimationFrame(() => {
//     // If we are still switching domains and fetching data (which is async)
//     // have to wait for that promise to resolve. Only then we have rendered
//     // data and can scroll to the correct element in the view
//     if (domainSelectionPromise) {
//       domainSelectionPromise.then(scrollIntoView);
//     } else {
//       scrollIntoView();
//     }
//   });
// }

// searchButton.resultsMenu = searchMenu;

// let lastSelected;
// searchButton.addEventListener('active', () => {
//   lastSelected = mainSelector.selected;
//   mainSelector.selected = 'search';
// });

// searchButton.addEventListener('inactive', () => {
//   mainSelector.selected = lastSelected;
// });

// searchMenu.addEventListener('item-activate', () => {
//   searchButton.handleItemActivate_();
// });

// const location = document.getElementById('location');
// location.addEventListener('path-changed', (e) => {
//   searchButton.inputActive = false;
//   updateLocationBindings(e.detail.value);
// });

// location.addEventListener('hash-changed', (e) => {
//   processHashUpdate();
// });


// window.addEventListener('load', function() {
//   customElements.whenDefined('iron-location').then(() => {
//     updateLocationBindings(location.path);
//     processHashUpdate();
//   });
//   searchButton.addEventListener('active', function() {
//     toolbar.classList.add('search-active');
//   }, false);
//   searchButton.addEventListener('inactive', function() {
//     toolbar.classList.remove('search-active');
//   }, false);
// });

// if ('serviceWorker' in window.navigator) {
//   navigator.serviceWorker.register('service-worker.js');
// }