module.exports = (eleventyConfig) => {
  eleventyConfig.addPassthroughCopy('pages/scripts/index.js');
  eleventyConfig.addPassthroughCopy('pages/styles/protocol.css');
  eleventyConfig.addPassthroughCopy('pages/images/');
  eleventyConfig.addPassthroughCopy('node_modules/lit-html');

  return {
    pathPrefix: '/devtools-protocol/',
    dir: {
      input: 'pages',
      output: 'devtools-protocol',
      data: '_data',
    },
  };
};