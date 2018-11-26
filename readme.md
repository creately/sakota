# SaKota

[![Greenkeeper badge](https://badges.greenkeeper.io/creately/sakota.svg)](https://greenkeeper.io/)

SaKota proxies js objects and records all changes made on an object without modifying the given object.

## Getting Started

Install @creately/sakota module from npm.

```shell
npm install @creately/sakota
```

Wrap an existing object with a proxy and make some changes to the proxied object.
It should reflect all changes made to the object without modifying the source.

```js
import { Sakota } from '@creately/sakota'

const source = { x: 10, y: 20, c1: { x: 20, y: 30, z: 40 }}
const proxy = Sakota.create(source);

// make some changes
proxy.z = 30;
proxy.c1.y = 40;
delete proxy.c1.z;

console.log(source)
// { x: 10, y: 20, c1: { x: 20, y: 30, z: 40 }}

console.log(proxy)
// { x: 10, y: 20, z: 30, c1: { x: 20, y: 40 }}
```

Changes made to the object are all recorded as a MongoDB like modifier.

```js
const changes = Sakota.changes(proxy);
console.log(changes)
// {
//     $set: { z: 30, 'c1.y': 40 },
//     $unset: { 'c1.z': true },
// }
```
