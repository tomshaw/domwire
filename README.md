# domwire

DOM-driven, on-demand component loader. Initialize JavaScript classes utilizing simple DOM attributes.

Zero runtime dependencies. ~2 KB minified. Works in any browser app — no framework required.

## Install

```sh
npm install domwire
```

## Usage

```html
<div data-component="user-card" data-options='{"id": 42}'></div>
```

```js
import { ComponentManager, AbstractComponent } from "domwire";

class UserCard extends AbstractComponent {
    mounted() {
        this.el.textContent = `User ${this.options.id}`;
    }
}

const manager = new ComponentManager({
    registry: {
        UserCard: () => Promise.resolve({ default: UserCard }),
        // Or, more typically, lazy-loaded:
        // UserCard: () => import("./components/UserCard.js"),
    },
});

await manager.boot();
```

The registry key is the PascalCase form of the `data-component` value (`user-card` → `UserCard`). When a `data-component` element is found, its importer runs, the class is instantiated, and lifecycle hooks fire.

### Options

```ts
new ComponentManager({
    selector: "[data-component]",      // default
    registry: { ... },                 // name → () => import(...)
    onMissing: (name, el) => { ... },  // unknown component
    onError:   (name, err, el) => { ... },
});
```

### Lifecycle hooks

`beforeCreate` → `created` → `beforeMount` → `mounted` (on init), and `beforeDestroy` → `destroy` (on teardown).

### Dynamic content

For pages that inject markup after initial load (server partials, htmx swaps, etc.):

```js
manager.observe();   // start watching the DOM
manager.unobserve(); // stop
```

New `[data-component]` nodes get initialized automatically; removed nodes get destroyed.

### Namespaces

Pass `namespace` in `data-options` to scope the registry key:

```html
<div data-component="card" data-options='{"namespace": "admin"}'></div>
```

Looks up `admin/Card` in the registry.

### Accessing the instance

After boot, the instance is attached as `el._component`. You can also call `manager.destroyComponent(el)` or `manager.destroyAll()`.

## Alpine.js integration (optional)

```js
import { registerAlpineMagic } from "domwire/alpine";

registerAlpineMagic();
```

Now `$component` inside Alpine resolves to the nearest `[data-component]` element's instance.

## Environment

Browser-only — relies on `document`, `HTMLElement`, and `MutationObserver`. For Node tests, use jsdom or happy-dom.

## License

[MIT](./LICENSE)
