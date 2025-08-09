import handlebarsPlugin from '@11ty/eleventy-plugin-handlebars';

export default (eleventyConfig) => {
  eleventyConfig.addPlugin(handlebarsPlugin);
  eleventyConfig.addPassthroughCopy('pages/styles/protocol.css');
  eleventyConfig.addPassthroughCopy('pages/images/');
  eleventyConfig.addPassthroughCopy('search_index/');
  eleventyConfig.addPassthroughCopy('.nojekyll');
  eleventyConfig.addPassthroughCopy('pages/service-worker.js');

  return {
    pathPrefix: '/devtools-protocol/',
    dir: {
      input: 'pages',
      output: 'devtools-protocol',
      data: '_data',
    },
  };
};
