
// Single-clicking on the permalink hash copies the URL to the clipboard
// Double-clicking on the permalink hash will copy markdown
//     [`Domain.method`](https://...)
for (const permalinkEl of document.querySelectorAll('.permalink')) {
  const href = permalinkEl.href;
  const h4el = permalinkEl.parentElement;
  // A bit verbose to filter out the permalink # and experimental flags.
  const textSlug = `${h4el.querySelector('.domain-dot').textContent.trim()}${h4el.querySelector('.name').textContent.trim()}`;
  const markdown = `[\`${textSlug}\`](${href})`;

  permalinkEl.addEventListener('click', handleClicks);
  permalinkEl.addEventListener('dblclick', handleClicks);

  function handleClicks(e) {
    // No need to scroll
    e.preventDefault();

    navigator.clipboard.writeText(e.type === 'dblclick' ? markdown : href)
    .then(_ => {
      const classNames = ['copied'];
      if (e.type === 'dblclick') classNames.push('copied__md');
      // Show psuedo-element. rAF used to trigger animation reliably
      permalinkEl.classList.remove(...classNames);
      requestAnimationFrame(_ => {
        permalinkEl.classList.add(...classNames);
      })
    })
    // This can happen if the user denies clipboard permissions
    .catch(err => console.error('Could not copy to clipboard: ', err));
  }

};
