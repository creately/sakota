# 2021-03-16 - v2.4.3

 - improved change tracking. now if the value of a property is updated with the same value it will not track as a change.
 - es getters/setters configuration.

# 2019-06-18 - v2.4.2

 - Cache getters and property descriptors using weakmaps to reduce property lookup overhead.
 - Log a warning message on the console if it tries to set a Sakota wrapped object as value.

# 2019-05-23 - v2.4.1

 - Fix an issue where proxied object does not have any methods from `Object.prototype`

# 2019-05-21 - v2.4.0

 - Add support for javascript getters, previously it used to get called using original values.

```ts
const proxy = Sakota.create({
    x: 1,
    get xx() {
        return Math.pow(this.x, 2);
    },
})
proxy.x = 10;
console.log(proxy.xx) // 100
```

# 2019-03-14 - v2.3.0

 - Add a method `cloneProxy` to clone a sakota proxy.

```ts
const proxy = Sakota.create({ foo: 'bar' })
const clone = proxy.__sakota__.cloneProxy();
```

# 2018-12-14 - v2.2.0

 - Allow changs to be filtered with a regular expression in `getChanges` and `hasChanges` methods.

```ts
const proxy = Sakota.create({ foo: 'bar' })
proxy.x = 100;
proxy.y = 200;
proxy.z = 400;
proxy.__sakota__.hasChanges(/x/)     // true
proxy.__sakota__.getChanges(/(x|y)/) // { $set: { x: 100, y: 200 } }
```

# 2018-12-03 - v2.1.1

 - Fixed a bug with `getChanges` method result cache used when the prefix changes.

# 2018-12-03 - v2.1.0

 - Added a `hasChanges` method to check whether the proxy has any changes

```ts
const proxy = Sakota.create({ foo: 'bar' })
proxy.x = 100;
proxy.__sakota__.hasChanges(/x/) // true
proxy.__sakota__.hasChanges(/y/) // false
```

 - Cached `getChanges` method result to improve performance

```ts
const proxy = Sakota.create({ foo: 'bar' })
proxy.x = 100;
proxy.__sakota__.getChanges(/x/) // { $set: { x: 100 } }
proxy.__sakota__.getChanges(/y/) // {}
```

 - Fixed a bug with tracking changes when deleting newly added property

# 2018-11-16 - v2.0.0

 - Removed the `Sakota.changes` method. It used to be the only way to get changes from the proxy.
 - The handler can be accessed with the string key `__sakota__` the handler has a `getChanges` method.
 - Added the type `Proxied<T>` which will add the `__sakota__` property to the proxied object type.

# 2018-11-06 - v1.0.0

 - Initial Release!
