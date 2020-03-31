module.exports = (eleventyConfig) => {
  eleventyConfig.addPassthroughCopy('pages/scripts/index.js');
  eleventyConfig.addPassthroughCopy('pages/styles/protocol.css');

  return {
    pathPrefix: '/devtools-protocol/',
    dir: {
      input: 'pages',
      output: 'devtools-protocol',
      data: '_data',
    },
  };
};