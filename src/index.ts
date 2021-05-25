import isEqual from 'lodash.isequal';

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
 * These weakmaps hold caches of property descriptors of objects and getters used by sakota.
 */
const $getters = new WeakMap<object, { [key: string]: (() => any) | null }>();
const $setters = new WeakMap<object, { [key: string]: ((val: any) => void) | null }>();
const $descriptors = new WeakMap<object, { [key: string]: PropertyDescriptor | null }>();

/**
 * SaKota proxies js objects and records all changes made on an object without
 * modifying the given object. Changes made to the object will be recorded in
 * a format similar to MongoDB udpate queries.
 *
 * NOTE: assumes the target object does not change and caches certain values.
 */
export class Sakota<T extends object> implements ProxyHandler<T> {
  /**
   * Globally configure how Sakota proxies should behave.
   */
  private static config = {
    prodmode: false,
    esgetter: true,
    essetter: true,
  };

  /**
   * Makes Sakota work faster by removing dev-only code.
   */
  public static enableProdMode(): void {
    this.config.prodmode = true;
  }

  /**
   * Makes Sakota support javascript getters (expensive!).
   */
  public static disableESGetters(): void {
    this.config.esgetter = false;
  }

  /**
   * Makes Sakota support javascript getters (expensive!).
   */
  public static disableESSetters(): void {
    this.config.essetter = false;
  }

  /**
   * Wraps the given object with a Sakota proxy and returns it.
   * This is the public function used to create the proxies.
   */
  public static create<T extends object>(obj: T): Proxied<T> {
    return Sakota._create(obj, null);
  }

  /**
   * Wraps the given object with a Sakota proxy and returns it.
   * Optionally sets the parent proxy agent when creating a new agent.
   */
  private static _create<T extends object>(obj: T, parent: Sakota<any> | null): Proxied<T> {
    const agent = new Sakota(obj, parent);
    const proxy = new Proxy(obj, agent) as Proxied<T>;
    agent.proxy = proxy;
    return proxy;
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
   * Indicates whether the proxy or any of it's children has changes.
   */
  private changed: boolean;

  /**
   * The cached result of getChanges method. Cleared when a change occurs.
   */
  private changes: { [prefix: string]: Partial<Changes> | null };

  /**
   * The proxied value. This property should be set imemdiately after constructor
   */
  private proxy!: Proxied<T>;

  /**
   * Initialize!
   */
  private constructor(private target: T, private parent: Sakota<any> | null) {
    this.kids = {};
    this.diff = null;
    this.changed = false;
    this.changes = {};
  }

  // Proxy Handler Traps
  // -------------------

  /**
   * Proxy handler trap for the `in` operator.
   */
  public has(obj: any, key: string | number | symbol): any {
    if (this.diff) {
      if (Object.prototype.hasOwnProperty.call(this.diff.$unset, key)) {
        return false;
      }
      if (Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
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
    if (this.diff) {
      if (Object.prototype.hasOwnProperty.call(this.diff.$unset, key)) {
        return undefined;
      }
      if (Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
        return this.diff.$set[key as any];
      }
    }
    if (Sakota.config.esgetter) {
      const getter = this.getGetterFunction(obj, key);
      if (getter) {
        return getter.call(this.proxy);
      }
    }
    const value = obj[key];
    if (!value) {
      return value;
    }
    if (typeof value === 'object') {
      return this.getKid(key, value);
    }
    return value;
  }

  /**
   * Proxy handler trap for `Reflect.ownKeys()`.
   */
  public ownKeys(obj: any): (KeyType)[] {
    const keys = Reflect.ownKeys(obj);
    if (this.diff) {
      for (const key in this.diff.$set) {
        if (!Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
          continue;
        }
        if (keys.indexOf(key) === -1) {
          keys.push(key);
        }
      }
      for (const key in this.diff.$unset) {
        if (!Object.prototype.hasOwnProperty.call(this.diff.$unset, key)) {
          continue;
        }
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
    if (this.diff) {
      if (Object.prototype.hasOwnProperty.call(this.diff.$unset, key)) {
        return undefined;
      }
      if (Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
        return { configurable: true, enumerable: true, value: this.diff.$set[key] };
      }
    }
    return Object.getOwnPropertyDescriptor(obj, key);
  }

  /**
   * Proxy handler trap for setting a property.
   */
  public set(obj: any, key: KeyType, val: any): boolean {
    if (!Sakota.config.prodmode) {
      if (this._hasSakota(val)) {
        console.warn('Sakota: value is also wrapped by Sakota!', { obj: obj, key, val });
      }
    }
    if (Sakota.config.essetter) {
      const setter = this.getSetterFunction(obj, key);
      if (setter) {
        setter.call(this.proxy, val);
        return true;
      }
    }
    if (!this.diff) {
      this.diff = { $set: {}, $unset: {} };
    }
    if (key in obj && isEqual(obj[key], val)) {
      if (this.diff.$unset[key] || this.diff.$set[key]) {
        delete this.diff.$unset[key];
        delete this.diff.$set[key];
        this.onChange();
      }
      return true;
    }
    delete this.diff.$unset[key];
    delete this.kids[key];
    this.diff.$set[key] = val;
    this.onChange();
    return true;
  }

  /**
   * Proxy handler trap for the `delete` operator.
   */
  public deleteProperty(obj: any, key: KeyType): boolean {
    if (!(key in obj)) {
      if (!this.diff || !this.diff.$set || !Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
        return true;
      }
    }
    if (!this.diff) {
      this.diff = { $set: {}, $unset: {} };
    }
    delete this.diff.$set[key];
    delete this.kids[key];
    this.diff.$unset[key] = true;
    this.onChange();
    return true;
  }

  // Sakota Methods
  // --------------

  /**
   * Create a clone of Sakota proxy. This does not include any changes.
   */
  public cloneProxy(): Proxied<T> {
    return Sakota.create(this.target);
  }

  /**
   * Returns a boolean indicating whether the proxy has any changes.
   */
  public getTarget(): T {
    return this.target;
  }

  /**
   * Returns a boolean indicating whether the proxy has any changes.
   */
  public hasChanges(pattern?: string | RegExp): boolean {
    if (!this.changed || !pattern) {
      return this.changed;
    }
    const changes = this.getChanges('', pattern);
    return Object.keys(changes).length > 0;
  }

  /**
   * Returns changes recorded by the proxy handler and child handlers.
   */
  public getChanges(prefix: string = '', pattern?: string | RegExp): Partial<Changes> {
    const cached = this.changes[prefix];
    if (cached) {
      return pattern ? this.filterChanges(cached, pattern) : cached;
    }
    const changes = this.buildChanges(prefix) as Changes;
    this.changes[prefix] = changes;
    return pattern ? this.filterChanges(changes, pattern) : changes;
  }

  /**
   * This is an internal method to merge the changes from a different sakota object.
   * If there are 2 skota objects, and one is modified and the same modification
   * needs to be applied to the other object this method can be used.
   * @param changes changes in Sakota format.
   */
  public mergeChanges(changes: Partial<Changes>) {
    if (Object.keys(changes).length === 0) {
      return;
    }
    const diff = this.diff || { $set: {}, $unset: {} };
    const kidChanges: { [prefix: string]: Changes } = {};
    if (changes.$set) {
      const $set = changes.$set;
      Object.keys(changes.$set).forEach(key => {
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) {
          delete diff.$unset[key];
          delete this.kids[key];
          diff.$set[key] = $set[key];
        } else {
          const kkey = key.substring(0, dotIndex);
          if (kidChanges.hasOwnProperty(kkey)) {
            kidChanges[kkey].$set[key.substring(dotIndex + 1)] = $set[key];
          } else {
            kidChanges[kkey] = {
              $set: { [key.substring(dotIndex + 1)]: $set[key] },
              $unset: {},
            };
          }
        }
      });
    }
    if (changes.$unset) {
      Object.keys(changes.$unset).forEach(key => {
        const dotIndex = key.indexOf('.');
        if (dotIndex === -1) {
          delete diff.$set[key];
          delete this.kids[key];
          diff.$unset[key] = true;
        } else {
          const kkey = key.substring(0, dotIndex);
          if (kidChanges.hasOwnProperty(kkey)) {
            kidChanges[kkey].$unset[key.substring(dotIndex + 1)] = true;
          } else {
            kidChanges[kkey] = {
              $set: {},
              $unset: { [key.substring(dotIndex + 1)]: true },
            };
          }
        }
      });
    }

    Object.keys(kidChanges).forEach(k => {
      this.getKid(k, (this.target as any)[k]).__sakota__.mergeChanges(kidChanges[k]);
    });

    this.diff = diff;
    this.changed = true;
    this.changes = {};
  }

  /**
   * Resets changes recorded in the proxy. Can be filtered by key name.
   */
  public reset(key?: string): void {
    if (key === undefined) {
      this.kids = {};
      this.diff = { $set: {}, $unset: {} };
    } else {
      delete this.kids[key];
      if (this.diff) {
        delete this.diff.$set[key];
        delete this.diff.$unset[key];
      }
    }
    this.onChange();
  }

  /**
   * this method removes Sakota wrapper for the target object
   * @param inplace if true modifies the target object otherwise returns a copy of the target
   * @returns Sakota wrapper removed object
   */
  public unwrap(inplace: boolean = false) {
    const $set = this.diff ? Object.assign({}, this.diff.$set) : {};
    const $unset = this.diff ? Object.keys(this.diff.$unset) : [];
    Object.keys(this.kids).forEach(k => {
      $set[k] = this.kids[k].__sakota__.unwrap(inplace);
    });
    let val: any;
    if (Array.isArray(this.target)) {
      val = inplace ? this.target : this.target.slice();
      Object.keys($set).forEach(k => (val[k] = $set[k]));
    } else {
      val = inplace ? Object.assign(this.target, $set) : Object.assign({}, this.target, $set);
    }
    $unset.forEach(k => delete val[k]);
    return val;
  }

  // Private Methods
  // ---------------

  /**
   * Returns the getter function of a property if available. Checks prototypes as well.
   */
  private getGetterFunction(obj: any, key: KeyType): (() => any) | null {
    let gettersMap = $getters.get(obj);
    if (gettersMap) {
      // NOTE: hasOwnProperty canm also he available as a value
      if (Object.prototype.hasOwnProperty.call(gettersMap, key)) {
        return gettersMap[key as any];
      }
    } else {
      gettersMap = {};
      $getters.set(obj, gettersMap);
    }
    for (let p = obj; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
      const desc = this.getObjPropertyDescriptor(p, key);
      if (desc) {
        const getter = desc.get || null;
        gettersMap[key as any] = getter;
        return getter;
      }
    }
    gettersMap[key as any] = null;
    return null;
  }

  /**
   * Returns the setter function of a property if available. Checks prototypes as well.
   */
  private getSetterFunction(obj: any, key: KeyType): ((val: any) => void) | null {
    let settersMap = $setters.get(obj);
    if (settersMap) {
      // NOTE: hasOwnProperty canm also he available as a value
      if (Object.prototype.hasOwnProperty.call(settersMap, key)) {
        return settersMap[key as any];
      }
    } else {
      settersMap = {};
      $setters.set(obj, settersMap);
    }
    for (let p = obj; p && p !== Object.prototype; p = Object.getPrototypeOf(p)) {
      const desc = this.getObjPropertyDescriptor(p, key);
      if (desc) {
        const setter = desc.set || null;
        settersMap[key as any] = setter;
        return setter;
      }
    }
    settersMap[key as any] = null;
    return null;
  }

  /**
   * Returns the property descriptor for an object. Use cached value when available.
   */
  private getObjPropertyDescriptor(obj: any, key: any): PropertyDescriptor | null {
    const cachedDescriptorsMap = $descriptors.get(obj);
    if (!cachedDescriptorsMap) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key) || null;
      $descriptors.set(obj, { [key]: descriptor });
      return descriptor;
    }
    // NOTE: hasOwnProperty canm also he available as a value
    if (!Object.prototype.hasOwnProperty.call(cachedDescriptorsMap, key)) {
      const descriptor = Object.getOwnPropertyDescriptor(obj, key) || null;
      cachedDescriptorsMap[key] = descriptor;
      return descriptor;
    }
    return cachedDescriptorsMap[key];
  }

  /**
   * Marks the proxy and all proxies in it's parent chain as changed.
   */
  private onChange(): void {
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
    const proxy = Sakota._create(obj, this);
    this.kids[key] = proxy;
    return proxy;
  }

  /**
   * Builds the changes object using recorded changes.
   */
  private buildChanges(prefix: string): Partial<Changes> {
    const changes: Changes = { $set: {}, $unset: {} };
    if (this.diff) {
      for (const key in this.diff.$set) {
        if (!Object.prototype.hasOwnProperty.call(this.diff.$set, key)) {
          continue;
        }
        if (typeof key === 'symbol') {
          continue;
        }
        const keyWithPrefix = `${prefix}${key}`;
        changes.$set[keyWithPrefix] = this.diff.$set[key];
      }
      for (const key in this.diff.$unset) {
        if (!Object.prototype.hasOwnProperty.call(this.diff.$unset, key)) {
          continue;
        }
        if (typeof key === 'symbol') {
          continue;
        }
        const keyWithPrefix = `${prefix}${key}`;
        changes.$unset[keyWithPrefix] = true;
      }
    }
    for (const key in this.kids) {
      if (!Object.prototype.hasOwnProperty.call(this.kids, key)) {
        continue;
      }
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
      if (!Object.prototype.hasOwnProperty.call(changes, key)) {
        continue;
      }
      if (!Object.keys((changes as any)[key]).length) {
        delete (changes as any)[key];
      }
    }
    return changes;
  }

  /**
   * Filters properties in the changes object by key.
   */
  private filterChanges(changes: Partial<Changes>, pattern: string | RegExp): Partial<Changes> {
    const regexp = pattern instanceof RegExp ? pattern : new RegExp(pattern);
    const filtered: Partial<Changes> = {};
    for (const opkey in changes) {
      if (!Object.prototype.hasOwnProperty.call(changes, opkey)) {
        continue;
      }
      const opChanges = (changes as any)[opkey];
      if (!opChanges) {
        continue;
      }
      for (const key in opChanges) {
        if (!Object.prototype.hasOwnProperty.call(opChanges, key)) {
          continue;
        }
        regexp.lastIndex = 0;
        if (regexp.test(key)) {
          if (!(filtered as any)[opkey]) {
            (filtered as any)[opkey] = {};
          }
          (filtered as any)[opkey][key] = (changes as any)[opkey][key];
        }
      }
    }
    return filtered;
  }

  /**
   * Checks whether the value or it's children is proxied with Sakota.
   */
  private _hasSakota(value: unknown): boolean {
    if (typeof value !== 'object') {
      return false;
    }
    if (value === null) {
      return false;
    }
    if ((value as any)[GET_SAKOTA]) {
      return true;
    }
    if (Array.isArray(value)) {
      for (const child of value) {
        if (this._hasSakota(child)) {
          return true;
        }
      }
      return false;
    }
    for (const key in value) {
      const child = (value as any)[key];
      if (this._hasSakota(child)) {
        return true;
      }
    }
    return false;
  }
}
