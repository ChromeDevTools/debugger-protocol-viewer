/**
 * @fileoverview DOM Construction Helpers.
 */

/** @type {import('./types.d.ts').EHelper} */
const E = {
  /**
   * @param {string} name
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLElement}
   */
  el: function(name, className, textContent) {
    let e = document.createElement(name);
    if (className)
      e.className = className;
    if (textContent)
      e.textContent = textContent;
    return e;
  },

  /**
   * @param {string} text
   * @returns {Text}
   */
  textNode: function(text) {
    return document.createTextNode(text);
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLDivElement}
   */
  div: function(className, textContent) {
    return /** @type {HTMLDivElement} */ (E.el('div', className, textContent));
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLSpanElement}
   */
  span: function(className, textContent) {
    return /** @type {HTMLSpanElement} */ (E.el('span', className, textContent));
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLParagraphElement}
   */
  p: function(className, textContent) {
    return /** @type {HTMLParagraphElement} */ (E.el('p', className, textContent));
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLDivElement}
   */
  box: function(className, textContent) {
    let e = E.div(className, textContent);
    e.classList.add('box');
    return e;
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLDivElement}
   */
  hbox: function(className, textContent) {
    let e = E.div(className, textContent);
    e.classList.add('hbox');
    return e;
  },

  /**
   * @param {string} [className]
   * @param {string} [textContent]
   * @returns {HTMLDivElement}
   */
  vbox: function(className, textContent) {
    let e = E.div(className, textContent);
    e.classList.add('vbox');
    return e;
  },

  /**
   * @param {string} text
   * @returns {HTMLElement}
   */
  strong: function(text) {
    return E.el('strong', '', text);
  },

  /**
   * @param {string} text
   * @returns {HTMLElement}
   */
  code: function(text) {
    return E.el('code', '', text);
  },

  /**
   * @param {string} href
   * @param {string} [text]
   * @returns {HTMLAnchorElement}
   */
  a: function(href, text) {
    let link = /** @type {HTMLAnchorElement} */ (E.el('a', '', text || href));
    link.href = href;
    return link;
  },
};

// Install element creation helpers on Node.prototype so chained calls work seamlessly
for (const [helperName, fn] of Object.entries(E)) {
  if (helperName === 'a') continue; // Do not collide with HTMLAnchorElement.prototype.text or custom a
  Object.defineProperty(Node.prototype, helperName, {
    /**
     * @this {Node}
     * @param {...any} args
     * @returns {any}
     */
    value: function(...args) {
      const element = /** @type {any} */ (fn)(...args);
      this.appendChild(element);
      return element;
    },
    writable: true,
    configurable: true,
    enumerable: false,
  });
}

if (typeof window !== 'undefined') {
  /** @type {any} */ (window).E = E;
}
