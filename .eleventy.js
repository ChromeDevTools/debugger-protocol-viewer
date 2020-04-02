module.exports = (eleventyConfig) => {
  eleventyConfig.addPassthroughCopy('pages/styles/protocol.css');
  eleventyConfig.addPassthroughCopy('pages/images/');
  eleventyConfig.addPassthroughCopy('search_index/');

  return {
    pathPrefix: '/devtools-protocol/',
    dir: {
      input: 'pages',
      output: 'devtools-protocol',
      data: '_data',
    },
  };
};