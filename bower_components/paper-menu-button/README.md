[![Build status](https://travis-ci.org/PolymerElements/paper-menu-button.svg?branch=master)](https://travis-ci.org/PolymerElements/paper-menu-button)

_[Demo and API docs](https://elements.polymer-project.org/elements/paper-menu-button)_


## &lt;paper-menu-button&gt;

Material design: [Dropdown buttons](https://www.google.com/design/spec/components/buttons.html#buttons-dropdown-buttons)

`paper-menu-button` allows one to compose a designated "trigger" element with
another element that represents "content", to create a dropdown menu that
displays the "content" when the "trigger" is clicked.

The child element assigned to the `dropdown-trigger` slot will be used as the
"trigger" element. The child element assigned to the `dropdown-content` slot will be
used as the "content" element.

The `paper-menu-button` is sensitive to its content's `iron-select` events. If
the "content" element triggers an `iron-select` event, the `paper-menu-button`
will close automatically.

Example:

```html
<paper-menu-button>
  <paper-icon-button icon="menu" slot="dropdown-trigger"></paper-icon-button>
  <paper-listbox slot="dropdown-content">
    <paper-item>Share</paper-item>
    <paper-item>Settings</paper-item>
    <paper-item>Help</paper-item>
  </paper-listbox>
</paper-menu-button>
```

### Styling

The following custom properties and mixins are also available for styling:

| Custom property | Description | Default |
| --- | --- | --- |
| `--paper-menu-button-dropdown-background` | Background color of the paper-menu-button dropdown | `--primary-background-color` |
| `--paper-menu-button` | Mixin applied to the paper-menu-button | `{}` |
| `--paper-menu-button-disabled` | Mixin applied to the paper-menu-button when disabled | `{}` |
| `--paper-menu-button-dropdown` | Mixin applied to the paper-menu-button dropdown | `{}` |
| `--paper-menu-button-content` | Mixin applied to the paper-menu-button content | `{}` |

## paper-menu-button-animations.html

Defines these animations:
- &lt;paper-menu-grow-height-animation&gt;
- &lt;paper-menu-grow-width-animation&gt;
- &lt;paper-menu-shrink-height-animation&gt;
- &lt;paper-menu-shrink-width-animation&gt;

### Changes in 2.0
- `neon-animation 2.0` doesn't import the Web Animations polyfill, so you'll have to import it ([see example](demo/index.html))





