# bedrockKit

> ⚠️ **Experimental:** Version 0.x.x is under active development. APIs may change between patch releases. Pin your version if stability matters.

A library for navigating Minecraft Bedrock addon files programmatically.
Works in Deno, Node.js, and browsers.
...

## Documentation

Full API documentation is available at [yourwebsite.com/docs](https://yourwebsite.com/docs).

## Installation

```bash
npm install bedrock-kit
```

## Quick Start

```ts
import { AddOn } from "bedrock-kit";

const addon = new AddOn("./behavior_pack", "./resource_pack");

const zombie = addon.getEntity("minecraft:zombie");
console.log(zombie?.getLootTables());
```

## License

MIT
