
// Single-clicking on the permalink hash copies the URL to the clipboard
// Double-clicking on the permalink hash will copy markdown
//     [`Domain.method`](https://...)
for (const permalinkEl of document.querySelectorAll('.permalink')) {
  const href = permalinkEl.href;
  const textSlug = permalinkEl.dataset.slug;
  const markdown = `[\`${textSlug}\`](${href})`;
  const htmlStr = `<meta charset="utf-8"><a href="${href}"><tt style="font-family: Consolas, Menlo, monospace;">${textSlug}</tt></a>`;

  permalinkEl.addEventListener('click', handleClicks);
  permalinkEl.addEventListener('dblclick', handleClicks);

  function handleClicks(e) {
    // No need to scroll
    e.preventDefault();
    // Add hash back to url, but without pushState cuz it usually creates more problems
    window.location.href = href;

    const textBlob = new Blob([e.type === 'dblclick' ? markdown : href], { type: 'text/plain' });
    const htmlBlob = new Blob([htmlStr], { type: 'text/html' });
    // text/markdown not supported. (for several reasons) 
    // …one being https://source.chromium.org/chromium/chromium/src/+/main:third_party/blink/renderer/modules/clipboard/clipboard_writer.cc;l=307-318;drc=717a5ba32f0aba300c860d5bff7c87bbcff44afc
    // const mdBlob = new Blob([markdown], { type: "text/markdown" });
    const cpItem = new ClipboardItem({
      [textBlob.type]: textBlob,
      [htmlBlob.type]: htmlBlob,
    });

    navigator.clipboard.write([cpItem])
    .then(_ => {
      const classNames = ['copied'];
      if (e.type === 'dblclick') {
        classNames.push('copied__md');
      }
      // Show psuedo-element. rAF used to trigger animation reliably
      permalinkEl.className = 'permalink';
      requestAnimationFrame(_ => {
        requestAnimationFrame(_ => {
          permalinkEl.classList.add(...classNames);
        });
      });
    })
    // This can happen if the user denies clipboard permissions
    .catch(err => console.error('Could not copy to clipboard: ', err));
  }
};

// Handle back-button navigations through hashes.  (yes it does seem weird that this need to be done manually.......)
window.addEventListener("popstate", scrollToCurrentHash);
document.addEventListener("DOMContentLoaded", scrollToCurrentHash);
function scrollToCurrentHash(e) {
  const u = new URL(location.href);
  const hash = u.hash.slice(1);
  if (!hash) return;

  const elem = document.querySelector(`#${hash}`);
  elem.scrollIntoView({block: 'start'});
}
