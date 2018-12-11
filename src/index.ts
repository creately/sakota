/**
 * The key used to get the handler.
 */
const GET_SAKOTA = '__sakota__';

/**
 * A dynamic type which adds the __sakota__ key to the given type.
 */
export type Proxied<T extends object> = T & { [GET_SAKOTA]: Sakota<T> };

/**
 * Changes attempted on the object are stored in a mongo query like format.
 */
export type Changes = {
  $set: { [key: string]: any };
  $unset: { [key: string]: any };
};

/**
 * Types of object keys supported in js.
 */
type KeyType = string | number | symbol;

/**
 * SaKota proxies js objects and records all changes made on an object without
 * modifying the given object. Changes made to the object will be recorded in
 * a format similar to MongoDB udpate queries.
 */
export class Sakota<T extends object> implements ProxyHandler<T> {
  /**
   * Wraps the given object with a Sakota proxy and returns it.
   */
  public static create<T extends object>(obj: T): Proxied<T> {
    return this.createSakota(obj);
  }

  /**
   * Wraps the given object with a Sakota proxy and returns it.
   */
  private static createSakota<T extends object>(obj: T, parent: Sakota<any> | null = null): Proxied<T> {
    const handler = new Sakota(obj, parent);
    const proxied = new Proxy(obj, handler) as Proxied<T>;
    handler.proxied = proxied;
    return proxied;
  }

  /**
   * A map of proxy handlers created for nested objects. These
   * will be created only when needed.
   *
   * FIXME: the type should be the following but it is not allowed
   *        private kids: { [key: KeyType]: Sakota<any> };
   */
  private kids: any;

  /**
   * An object with changes made on the proxied object.
   */
  private diff: { $set: any; $unset: any } | null;

  /**
   * An object with untracked changes made on the proxied object.
   */
  private temp: { $set: any; $unset: any } | null;

  /**
   * Indicates whether the proxy is recording changes done to the object.
   */
  private tracked: boolean;

  /**
   * Indicates whether the proxy or any of it's children has changes.
   */
  private changed: boolean;

  /**
   * The cached result of getChanges method. Cleared when a change occurs.
   */
  private changes: { [prefix: string]: Changes | null };

  /**
   * Holds the proxied instance
   */
  private proxied!: Proxied<T>;

  /**
   * Initialize!
   */
  private constructor(private target: T, private parent: Sakota<any> | null = null) {
    this.kids = {};
    this.diff = null;
    this.temp = null;
    this.tracked = true;
    this.changed = false;
    this.changes = {};
  }

  // Proxy Handler Traps
  // -------------------

  /**
   * Proxy handler trap for the `in` operator.
   */
  public has(obj: any, key: string | number | symbol): any {
    for (const diff of [this.diff, this.temp]) {
      if (!diff) {
        continue;
      }
      if (key in diff.$unset) {
        return false;
      }
      if (key in diff.$set) {
        return true;
      }
    }
    return key in obj;
  }

  /**
   * Proxy handler trap for getting a property.
   */
  public get(obj: any, key: KeyType): any {
    if (key === GET_SAKOTA) {
      return this;
    }
    for (const diff of [this.diff, this.temp]) {
      if (!diff) {
        continue;
      }
      if (key in diff.$unset) {
        return undefined;
      }
      if (key in diff.$set) {
        return diff.$set[key as any];
      }
    }
    const val = obj[key];
    if (!val || typeof val !== 'object') {
      return val;
    }
    return this.getKid(key, val);
  }

  /**
   * Proxy handler trap for `Reflect.ownKeys()`.
   */
  public ownKeys(obj: any): (KeyType)[] {
    const keys = Reflect.ownKeys(obj);
    for (const diff of [this.diff, this.temp]) {
      if (!diff) {
        continue;
      }
      for (const key in diff.$set) {
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      }
      for (const key in diff.$unset) {
        const index = keys.indexOf(key);
        if (index !== -1) {
          keys.splice(index, 1);
        }
      }
    }
    return keys;
  }

  /**
   * Proxy handler trap for `Object.getOwnPropertyDescriptor()`
   */
  public getOwnPropertyDescriptor(obj: any, key: KeyType): any {
    if (key === GET_SAKOTA) {
      return { configurable: true, enumerable: false, value: this };
    }
    for (const diff of [this.diff, this.temp]) {
      if (!diff) {
        continue;
      }
      if (key in diff.$unset) {
        return undefined;
      }
      if (key in diff.$set) {
        return { configurable: true, enumerable: true, value: diff.$set[key] };
      }
    }
    return Object.getOwnPropertyDescriptor(obj, key);
  }

  /**
   * Proxy handler trap for setting a property.
   */
  public set(_obj: any, key: KeyType, val: any): boolean {
    const diff = this.getDiff();
    delete diff.$unset[key];
    delete this.kids[key];
    diff.$set[key] = val;
    this.onChange();
    return true;
  }

  /**
   * Proxy handler trap for the `delete` operator.
   */
  public deleteProperty(obj: any, key: KeyType): boolean {
    const diff = this.getDiff();
    if (!(key in obj) && (!diff || !diff.$set || !(key in diff.$set))) {
      return true;
    }
    delete diff.$set[key];
    delete this.kids[key];
    diff.$unset[key] = true;
    this.onChange();
    return true;
  }

  // Sakota Methods
  // --------------

  /**
   * Returns a boolean indicating whether the proxy has any changes.
   */
  public getTarget(): T {
    return this.target;
  }

  /**
   * Returns a boolean indicating whether the proxy has any changes.
   */
  public hasChanges(): boolean {
    return this.changed;
  }

  /**
   * Runs a callback function and do not include changes made inside
   * this function (synchronous). Changes will be tracked separately
   * and it will reflect on the proxied object but it will not be
   * included when the user calls getChanges.
   * @param callback The callback function to execute in do-not-track
   */
  public doNotTrack(callback: (p: Proxied<T>) => void): void {
    this.tracked = false;
    callback(this.proxied);
    this.tracked = true;
  }

  /**
   * Returns changes recorded by the proxy handler and child handlers.
   */
  public getChanges(prefix: string = ''): Partial<Changes> {
    if (this.changes[prefix]) {
      return this.changes[prefix] as Partial<Changes>;
    }
    const changes: Changes = { $set: {}, $unset: {} };
    if (this.diff) {
      for (const key in this.diff.$set) {
        if (typeof key === 'symbol') {
          continue;
        }
        const keyWithPrefix = `${prefix}${key}`;
        changes.$set[keyWithPrefix] = this.diff.$set[key];
      }
      for (const key in this.diff.$unset) {
        if (typeof key === 'symbol') {
          continue;
        }
        const keyWithPrefix = `${prefix}${key}`;
        changes.$unset[keyWithPrefix] = true;
      }
    }
    for (const key in this.kids) {
      if (typeof key === 'symbol') {
        continue;
      }
      const kid: Sakota<any> = this.kids[key][GET_SAKOTA];
      const keyWithPrefix = `${prefix}${key}`;
      const kidChanges: Partial<Changes> = kid.getChanges(`${keyWithPrefix}.`);
      Object.assign(changes.$set, kidChanges.$set);
      Object.assign(changes.$unset, kidChanges.$unset);
    }
    for (const key in changes) {
      if (!Object.keys((changes as any)[key]).length) {
        delete (changes as any)[key];
      }
    }
    this.changes[prefix] = changes;
    return changes;
  }

  // Private Methods
  // ---------------

  /**
   * Marks the proxy and all proxies in it's parent chain as changed.
   */
  private onChange(): void {
    if (!this.isTracked()) {
      return;
    }
    this.changed = true;
    this.changes = {};
    if (this.parent) {
      this.parent.onChange();
    }
  }

  /**
   * Creates and returns a proxy for a nested object.
   */
  private getKid<U extends object>(key: KeyType, obj: U): U {
    const cached = this.kids[key];
    if (cached) {
      return cached;
    }
    const proxy = Sakota.createSakota(obj, this);
    this.kids[key] = proxy;
    return proxy;
  }

  /**
   * Returns the diff object based on whether tracking or not.
   */
  private getDiff() {
    if (this.isTracked()) {
      if (!this.diff) {
        this.diff = { $set: {}, $unset: {} };
      }
      return this.diff;
    }
    if (!this.temp) {
      this.temp = { $set: {}, $unset: {} };
    }
    return this.temp;
  }

  /**
   * Indicates whether the proxy should record changes or not.
   */
  private isTracked(): boolean {
    let handler: Sakota<any> | null = this;
    while (handler) {
      if (!handler.tracked) {
        return false;
      }
      handler = handler.parent;
    }
    return true;
  }
}
