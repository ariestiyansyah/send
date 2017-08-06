let links = [];

document.addEventListener('DOMContentLoaded', function() {
  links = document.querySelectorAll('a:not([target])');
});

function setOpenInNewTab(bool) {
  if (bool === false) {
    links.forEach(l => {
      l.removeAttribute('target');
      l.removeAttribute('rel');
    });
  } else {
    links.forEach(l => {
      l.setAttribute('target', '_blank');
      l.setAttribute('rel', 'noopener noreferrer');
    });
  }
}

module.exports = {
  setOpenInNewTab
};
