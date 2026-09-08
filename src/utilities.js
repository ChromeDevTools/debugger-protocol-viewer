const E = {
  el: function(name, className, textContent) {
    let e = document.createElement(name);
    if (className)
      e.className = className;
    if (textContent)
      e.textContent = textContent;
    return e;
  },

  textNode: function(text) {
    return document.createTextNode(text);
  },

  text: function(text, className, tagName = 'span') {
    let e = E.el(tagName, className);
    e.textContent = text;
    return e;
  },

  div: function(...args) {
    return E.el('div', ...args);
  },

  span: function(...args) {
    return E.el('span', ...args);
  },

  p: function(...args) {
    return E.el('p', ...args);
  },

  box: function(...args) {
    let e = E.el('div', ...args);
    e.classList.add('box');
    return e;
  },

  hbox: function(...args) {
    let e = E.div(...args);
    e.classList.add('hbox');
    return e;
  },

  vbox: function(...args) {
    let e = E.div(...args);
    e.classList.add('vbox');
    return e;
  },

  strong: function(text) {
    return E.el('strong', '', text);
  },

  code: function(text) {
    return E.el('code', '', text);
  },

  a: function(href, text) {
    let link = E.el('a', '', text || href);
    link.href = href;
    return link;
  },
};

// Install helpers on Node.prototype
for (let helper in E) {
  Node.prototype[helper] = function(...args) {
    let element = E[helper].apply(null, args);
    this.appendChild(element);
    return element;
  };
}

Event.prototype.consume = function() {
    this.preventDefault();
    this.stopPropagation();
}

Array.prototype.last = function() {
  return this.length ? this[this.length - 1] : undefined;
}

Set.prototype.first = function() {
  if (!this.size)
    return null;
  return this.values().next().value;
}

Element.prototype.selfOrParentWithClass = function(className) {
  let node = this;
  while (node && !node.classList.contains(className))
    node = node.parentElement;
  return node;
}
