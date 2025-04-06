import { Sakota } from '../';

/**
 * Function returns an array of different types of values.
 */
export const values = () => [
  undefined,
  null,
  false,
  true,
  100,
  'asd',
  {},
  [],
  { a: 'b' },
  { a: 'b', c: { d: 'e' } },
  () => null,
  class {},
];

export class Point {
  constructor(
    public x = 1,
    public y = 2
  ) {}
  set p(p: { x: number; y: number }) {
    this.x = p.x;
    this.y = p.y;
  }
  get d() {
    return this.x + this.y;
  }
  getD() {
    return this.x + this.y;
  }
}

/**
 * Proxies the object to throw when attempted to modify.
 */
export function freeze<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get: (o, p): any => {
      const val = o[p as keyof T];
      if (val && typeof val === 'object') {
        return freeze(val as any);
      }
      return val;
    },
    set: () => fail() as any,
  });
}

/**
 * The main unit test block
 */
describe('Sakota', () => {
  [
    // setting a new value with an empty target
    // ----------------------------------------
    ...values().map((val) => () => ({
      target: {},
      action: (obj: any) => {
        obj.x = val;
      },
      result: { x: val },
      change: {
        $set: { x: val },
      },
    })),

    // setting a new value when the target is not empty
    // ------------------------------------------------
    ...values().map((val) => () => ({
      target: { a: 1, b: 2 },
      action: (obj: any) => {
        obj.x = val;
      },
      result: { a: 1, b: 2, x: val },
      change: {
        $set: { x: val },
      },
    })),

    // modifying an existing value
    // ---------------------------
    ...values().map((val) => () => ({
      target: { a: 1, b: 2 },
      action: (obj: any) => {
        obj.a = val;
      },
      result: { a: val, b: 2 },
      change: {
        $set: { a: val },
      },
    })),

    // deleting an existing property
    // -----------------------------
    ...values().map((val) => () => ({
      target: { a: 1, b: val },
      action: (obj: any) => {
        delete obj.b;
      },
      result: { a: 1 },
      change: {
        $unset: { b: true },
      },
    })),

    // deleting a missing property
    // ---------------------------
    () => ({
      target: { a: 1 },
      action: (obj: any) => {
        delete obj.x;
      },
      result: { a: 1 },
      change: {},
    }),

    // setting a new value in a nested object
    // --------------------------------------
    ...values().map((val) => () => ({
      target: { a: { b: 1 }, c: { d: { e: 2 } } },
      action: (obj: any) => {
        obj.a.x = val;
        obj.c.d.y = val;
      },
      result: { a: { b: 1, x: val }, c: { d: { e: 2, y: val } } },
      change: {
        $set: { 'a.x': val, 'c.d.y': val },
      },
      nested: {
        a: { $set: { x: val } },
        c: { $set: { 'd.y': val } },
      },
    })),

    // modifying an existing value in a nested object
    // ----------------------------------------------
    ...values().map((val) => () => ({
      target: { a: { b: 1 }, c: { d: { e: 2 } } },
      action: (obj: any) => {
        obj.a.b = val;
        obj.c.d.e = val;
      },
      result: { a: { b: val }, c: { d: { e: val } } },
      change: {
        $set: { 'a.b': val, 'c.d.e': val },
      },
      nested: {
        a: { $set: { b: val } },
        c: { $set: { 'd.e': val } },
      },
    })),

    // deleting an existing value in a nested object
    // ---------------------------------------------
    ...values().map((val) => () => ({
      target: { a: { b: val }, c: { d: { e: val } } },
      action: (obj: any) => {
        delete obj.a.b;
        delete obj.c.d.e;
      },
      result: { a: {}, c: { d: {} } },
      change: {
        $unset: { 'a.b': true, 'c.d.e': true },
      },
      nested: {
        a: { $unset: { b: true } },
        c: { $unset: { 'd.e': true } },
      },
    })),

    // deleting a missing property in a nested object
    // ----------------------------------------------
    () => ({
      target: { a: { b: 1 }, c: { d: { e: 2 } } },
      action: (obj: any) => {
        delete obj.a.x;
        delete obj.c.d.y;
      },
      result: { a: { b: 1 }, c: { d: { e: 2 } } },
      change: {},
    }),

    // resetting a value on the proxy by it's key
    // ------------------------------------------
    ...values().map((val) => () => ({
      target: {},
      action: (obj: any) => {
        obj.x = val;
        obj.y = val;
        obj.__sakota__.reset('y');
      },
      result: { x: val },
      change: {
        $set: { x: val },
      },
    })),

    // resetting all recorded values on the proxy
    // ------------------------------------------
    ...values().map((val) => () => ({
      target: {},
      action: (obj: any) => {
        obj.x = val;
        obj.y = val;
        obj.__sakota__.reset();
        obj.z = val;
      },
      result: { z: val },
      change: { $set: { z: val } },
    })),

    // getting a value using getter functions in target
    // ------------------------------------------------
    () => ({
      target: {
        x: 1,
        y: 2,
        get d() {
          return this.x + this.y;
        },
      },
      action: (obj: any) => {
        obj.x = 10;
      },
      result: { x: 10, y: 2, d: 12 },
      change: {
        $set: { x: 10 },
      },
    }),

    // getting a value using getter functions in target (nested)
    // ---------------------------------------------------------
    () => ({
      target: {
        t: {
          x: 1,
          y: 2,
          get d() {
            return this.x + this.y;
          },
        },
      },
      action: (obj: any) => {
        obj.t.x = 10;
      },
      result: { t: { x: 10, y: 2, d: 12 } },
      change: {
        $set: { 't.x': 10 },
      },
    }),

    // getting a value using getter functions in prototype
    // ---------------------------------------------------
    () => ({
      target: new Point(),
      action: (obj: any) => {
        obj.x = 10;
        expect(obj.d).toEqual(12);
      },
      result: new Point(10, 2),
      change: {
        $set: { x: 10 },
      },
    }),

    // getting a value using getter functions in prototype (nested)
    // ------------------------------------------------------------
    () => ({
      target: {
        t: new Point(),
      },
      action: (obj: any) => {
        obj.t.x = 10;
        expect(obj.t.d).toEqual(12);
      },
      result: { t: new Point(10, 2) },
      change: {
        $set: { 't.x': 10 },
      },
    }),

    // getting a value using method functions in target
    // ------------------------------------------------
    () => ({
      target: {
        x: 1,
        y: 2,
        getD() {
          return this.x + this.y;
        },
      },
      action: (obj: any) => {
        obj.x = 10;
        expect(obj.getD()).toEqual(12);
      },
      result: { x: 10, y: 2, getD: jasmine.any(Function) },
      change: {
        $set: { x: 10 },
      },
    }),

    // getting a value using method functions in target (nested)
    // ---------------------------------------------------------
    () => ({
      target: {
        t: {
          x: 1,
          y: 2,
          getD() {
            return this.x + this.y;
          },
        },
      },
      action: (obj: any) => {
        obj.t.x = 10;
        expect(obj.t.getD()).toEqual(12);
      },
      result: { t: { x: 10, y: 2, getD: jasmine.any(Function) } },
      change: {
        $set: { 't.x': 10 },
      },
    }),

    // getting a value using method functions in prototype
    // ---------------------------------------------------
    () => ({
      target: new Point(),
      action: (obj: any) => {
        obj.x = 10;
        expect(obj.getD()).toEqual(12);
      },
      result: new Point(10, 2),
      change: {
        $set: { x: 10 },
      },
    }),

    // getting a value using method functions in prototype (nested)
    // ------------------------------------------------------------
    () => ({
      target: {
        t: new Point(),
      },
      action: (obj: any) => {
        obj.t.x = 10;
        expect(obj.t.getD()).toEqual(12);
      },
      result: { t: new Point(10, 2) },
      change: {
        $set: { 't.x': 10 },
      },
    }),

    // setting a value using setter functions in target
    // ------------------------------------------------
    () => ({
      target: {
        x: 1,
        y: 2,
        set p(p: { x: number; y: number }) {
          this.x = p.x;
          this.y = p.y;
        },
      },
      action: (obj: any) => {
        obj.p = { x: 10, y: 20 };
      },
      result: { x: 10, y: 20, p: undefined },
      change: {
        $set: { x: 10, y: 20 },
      },
    }),

    // setting a value using setter functions in target (nested)
    // ---------------------------------------------------------
    () => ({
      target: {
        t: {
          x: 1,
          y: 2,
          set p(p: { x: number; y: number }) {
            this.x = p.x;
            this.y = p.y;
          },
        },
      },
      action: (obj: any) => {
        obj.t.p = { x: 10, y: 20 };
      },
      result: { t: { x: 10, y: 20, p: undefined } },
      change: {
        $set: { 't.x': 10, 't.y': 20 },
      },
    }),

    // setting a value using setter functions in prototype
    // ---------------------------------------------------
    () => ({
      target: new Point(),
      action: (obj: any) => {
        obj.p = { x: 10, y: 20 };
      },
      result: new Point(10, 20),
      change: {
        $set: { x: 10, y: 20 },
      },
    }),

    // setting a value using setter functions in prototype (nested)
    // ------------------------------------------------------------
    () => ({
      target: {
        t: new Point(),
      },
      action: (obj: any) => {
        obj.t.p = { x: 10, y: 20 };
      },
      result: { t: new Point(10, 20) },
      change: {
        $set: { 't.x': 10, 't.y': 20 },
      },
    }),

    // modify the object and check result multiple times
    // -------------------------------------------------
    () => ({
      target: { a: { b: 1 }, c: { d: { e: 2 } } },
      action: [
        (obj: any) => (obj.a.b = 10),
        (obj: any) => (obj.x = 30),
        (obj: any) => (obj.c.d.e = 20),
        (obj: any) => (obj.a.b = 100),
        (obj: any) => delete obj.x,
        (obj: any) => delete obj.c,
      ],
      result: [
        { a: { b: 10 }, c: { d: { e: 2 } } },
        { a: { b: 10 }, c: { d: { e: 2 } }, x: 30 },
        { a: { b: 10 }, c: { d: { e: 20 } }, x: 30 },
        { a: { b: 100 }, c: { d: { e: 20 } }, x: 30 },
        { a: { b: 100 }, c: { d: { e: 20 } } },
        { a: { b: 100 } },
      ],
      change: [
        { $set: { 'a.b': 10 } },
        { $set: { 'a.b': 10, x: 30 } },
        { $set: { 'a.b': 10, x: 30, 'c.d.e': 20 } },
        { $set: { 'a.b': 100, x: 30, 'c.d.e': 20 } },
        { $set: { 'a.b': 100, 'c.d.e': 20 } },
        { $set: { 'a.b': 100 }, $unset: { c: true } },
      ],
      nested: [
        { a: { $set: { b: 10 } }, c: {} },
        { a: { $set: { b: 10 } }, c: {} },
        { a: { $set: { b: 10 } }, c: { $set: { 'd.e': 20 } } },
        { a: { $set: { b: 100 } }, c: { $set: { 'd.e': 20 } } },
        { a: { $set: { b: 100 } }, c: { $set: { 'd.e': 20 } } },
        { a: { $set: { b: 100 } } },
      ],
    }),
  ].forEach((f, i) => {
    describe(`test case: ${i}`, () => {
      let c: any;

      beforeEach(() => {
        c = f();
        if (!Array.isArray(c.action)) {
          c.action = [c.action];
        }
        if (!Array.isArray(c.result)) {
          c.result = [c.result];
        }
        if (!Array.isArray(c.change)) {
          c.change = [c.change];
        }
        if (!Array.isArray(c.nested)) {
          c.nested = [c.nested];
        }
      });

      it('should apply the change on the proxy', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
          expect(proxy).toEqual(c.result[i] as any);
        }
      });

      it('should record all applied changes', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
          expect(proxy.__sakota__.getChanges()).toEqual(c.change[i]);
        }
      });

      it('should record changes for nested objects', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
          for (const key in c.nested[i]) {
            expect(proxy[key].__sakota__.getChanges()).toEqual(c.nested[i][key]);
          }
        }
      });

      it('should not modify the proxy target', () => {
        const proxy = Sakota.create(freeze(c.target));
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
        }
      });

      it('should hold a reference to the proxy target', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
        }
        expect(proxy.__sakota__.getTarget()).toBe(c.target);
      });

      it('should indicate the proxy has changed', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
          expect(proxy.__sakota__.hasChanges()).toEqual(Object.keys(c.change[i]).length > 0);
          expect(proxy.__sakota__.isDirty()).toEqual(Object.keys(c.change[i]).length > 0);
        }
      });

      it('should indicate the proxy has changed for nested objects', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
          for (const key in c.nested[i]) {
            expect(proxy[key].__sakota__.hasChanges()).toEqual(Object.keys(c.nested[i][key]).length > 0);
          }
        }
      });

      it('should clone the proxy without any applied changes', () => {
        const proxy = Sakota.create(c.target);
        for (let i = 0; i < c.action.length; ++i) {
          c.action[i](proxy);
        }
        const clone = proxy.__sakota__.cloneProxy();
        expect(clone.__sakota__.getChanges()).toEqual({});
      });
    });
  });

  // Test special cases
  // ------------------

  describe('hasOwnProperty', () => {
    it('should return true or false based on available properties', () => {
      const target = { foo: 'bar' };
      const proxy = Sakota.create(target);
      expect(proxy.hasOwnProperty('foo')).toEqual(true);
      expect(proxy.hasOwnProperty('foo')).toEqual(true);
    });
  });

  // Test for filtering
  // ------------------

  describe('filtering changes', () => {
    describe('getChanges', () => {
      it('should filter changes with a regexp (string)', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 }) as any;
        proxy.a = 1000;
        delete proxy.c;
        expect(proxy.__sakota__.getChanges('', 'a')).toEqual({ $set: { a: 1000 } });
        expect(proxy.__sakota__.getChanges('', 'c')).toEqual({ $unset: { c: true } });
      });

      it('should filter changes with a regexp', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 }) as any;
        proxy.a = 1000;
        delete proxy.c;
        expect(proxy.__sakota__.getChanges('', /a/)).toEqual({ $set: { a: 1000 } });
        expect(proxy.__sakota__.getChanges('', /c/)).toEqual({ $unset: { c: true } });
      });

      it('should not track changes if value is not changed', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 10;
        expect(proxy.__sakota__.getChanges()).toEqual({});
        proxy.a = 12;
        expect(proxy.__sakota__.getChanges()).toEqual({ $set: { a: 12 } });
        proxy.a = 10;
        expect(proxy.__sakota__.getChanges()).toEqual({});
      });

      it('should not track changes if value is not changed (2)', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 } as any);
        proxy.x = 10;
        expect(proxy.__sakota__.getChanges()).toEqual({ $set: { x: 10 } });
        delete proxy.x;
        expect(proxy.__sakota__.getChanges()).toEqual({});
      });

      it('should not track changes if value is not changed - intermediate falsy value', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 0;
        expect(proxy.__sakota__.getChanges()).toEqual({ $set: { a: 0 } });
        proxy.a = 10;
        expect(proxy.__sakota__.getChanges()).toEqual({});
      });
    });

    describe('hasChanges', () => {
      it('should return whether there are changes filtered by a regexp (string)', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 1000;
        expect(proxy.__sakota__.hasChanges('a')).toEqual(true);
        expect(proxy.__sakota__.hasChanges('c')).toEqual(false);
      });

      it('should return whether there are changes filtered by a regexp', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 1000;
        expect(proxy.__sakota__.hasChanges(/a/)).toEqual(true);
        expect(proxy.__sakota__.hasChanges(/c/)).toEqual(false);
      });

      it('should return false if the change path is reset', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 1000;
        proxy.__sakota__.reset('a');
        expect(proxy.__sakota__.hasChanges('a')).toEqual(false);
        expect(proxy.__sakota__.hasChanges()).toEqual(false);
        expect(proxy.__sakota__.isDirty()).toEqual(true);
      });
    });
  });

  // Test for proxy as value
  // -----------------------

  describe('filtering proxy values', () => {
    it('should throw an error if the value is also a proxy', () => {
      const object1 = Sakota.create({ a: { x: 3 }, b: 20, c: 30 });
      const object2 = Sakota.create({ x: 2 });
      spyOn(console, 'warn');
      object1.a = object2;
      expect(console.warn).toHaveBeenCalledTimes(1);
    });
  });

  // Test for mergeChanges
  // -----------------------

  describe('mergeChanges', () => {
    it('should merge given changes into the sakota model', () => {
      const source = {
        a: 123,
        a1: 23,
        b: {
          x: 234,
          y: 345,
        },
        b1: {
          x: 234,
          y: 345,
        },
        c: [{ a: 123 }],
        d: [1, 2, 3],
        e: [{ a: 123 }],
      };

      const target = {
        a: 234,
        a2: 23,
        b: {
          x: 234,
          z: 234,
        },
        b1: {
          x: 234,
        },
        c: [{ b: 123 }, { a: 234 }],
        d: [1, 3],
        e: [{ a: 234 }],
      };

      const wrapped: any = Sakota.create(source);
      wrapped.a = 234;
      delete wrapped.a1;
      wrapped.a2 = 23;
      wrapped.b.x = 234;
      delete wrapped.b.y;
      wrapped.c = [{ b: 123 }, { a: 234 }];
      wrapped.b.z = 234;
      wrapped.d = [1, 3];
      wrapped.e[0].a = 234;
      delete wrapped.b1.y;

      const wrapped1: any = Sakota.create(source);
      wrapped1.__sakota__.mergeChanges(wrapped.__sakota__.getChanges());
      expect(wrapped1).toEqual(target as any);
    });

    it('should merge given changes into the existing sakota changes', () => {
      const source = {
        a: 123,
        a1: 23,
        b: {
          x: 234,
          y: 345,
        },
        c: [{ a: 123 }],
        d: [1, 2, 3],
        e: [{ a: 123 }, { b: 123 }],
      };

      const target = {
        a: 234,
        a2: 23,
        b: {
          x: 234,
          z: 234,
        },
        c: [{ b: 123 }, { a: 234 }],
        d: [1, 3],
        e: [{ a: 234 }, { b: 345 }],
      };

      const wrapped: any = Sakota.create(source);
      wrapped.a = 234;
      delete wrapped.a1;
      wrapped.a2 = 23;
      wrapped.b.x = 234;
      delete wrapped.b.y;
      wrapped.c = [{ b: 123 }, { a: 234 }];

      const wrapped1: any = Sakota.create(source);
      wrapped1.b.z = 234;
      wrapped1.d = [1, 3];
      wrapped1.e[0].a = 234;
      wrapped1.e[1].b = 345;

      wrapped.__sakota__.mergeChanges(wrapped1.__sakota__.getChanges());
      expect(wrapped).toEqual(target as any);
    });

    it('should merge only upto 2 levels', () => {
      const entity = {
        data: { d1: 'data1' },
      };
      const wrapped = Sakota.create(entity);
      const modifier = { $set: { 'links.l1': { id: 'l1' } } };
      spyOn(console, 'warn');
      wrapped.__sakota__.mergeChanges(modifier);
      expect(wrapped).toEqual({
        ...entity,
        links: {
          l1: {
            id: 'l1',
          },
        },
      } as any);
      expect(console.warn).toHaveBeenCalled();
    });

    it('throw if the modifier is incorrect', () => {
      const entity = {
        data: { d1: 'data1' },
      };
      const wrapped = Sakota.create(entity);
      const modifier = { $set: { 'links.l1.data': 'data1' } };
      spyOn(console, 'warn');
      expect(() => wrapped.__sakota__.mergeChanges(modifier)).toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('throw if the modifier is incorrect(2)', () => {
      const entity = {
        data: { d1: 'data1' },
      };
      const wrapped = Sakota.create(entity);
      const modifier = { $unset: { 'links.l1': true } };
      spyOn(console, 'warn');
      expect(() => wrapped.__sakota__.mergeChanges(modifier)).toThrow();
      expect(console.warn).toHaveBeenCalled();
    });

    it('should clear the changes if the value is set to original value again', () => {
      const entity = {
        data: { d1: 'data1' },
      };
      const wrapped = Sakota.create(entity);
      wrapped.data.d1 = 'data2';
      const wrapped1 = Sakota.create(wrapped);
      wrapped1.data.d1 = 'data1';
      wrapped.__sakota__.mergeChanges(wrapped1.__sakota__.getChanges());
      expect(wrapped.__sakota__.getChanges()).toEqual({});
    });

    it('should clear the changes if the non existing value is removed', () => {
      const entity = {
        data: { d1: 'data1' } as any,
      };
      const wrapped = Sakota.create(entity);
      wrapped.data.d2 = 'data2';
      const wrapped1 = Sakota.create(wrapped);
      delete wrapped1.data.d2;
      wrapped.__sakota__.mergeChanges(wrapped1.__sakota__.getChanges());
      expect(wrapped.__sakota__.getChanges()).toEqual({});
    });
  });

  // Test for unwrap
  // -----------------------
  describe('unwrap', () => {
    it('should create a copy of the object removing sakota', () => {
      const obj: any = {
        a: 123,
        b: {
          c: 234,
        },
      };
      const wrapped = Sakota.create(freeze(obj));
      wrapped.a = 345;
      wrapped.a1 = 234;
      wrapped.b.c = 2345;

      const expected = {
        a: 345,
        a1: 234,
        b: {
          c: 2345,
        },
      };

      const unwrapped = wrapped.__sakota__.unwrap();
      expect(unwrapped).toEqual(expected);
      expect(unwrapped === obj).toBeFalsy();
      expect(Sakota.hasSakota(unwrapped)).toBeFalsy();
    });

    it('should apply the changes to the target object if unwrapped in place', () => {
      const obj: any = {
        a: 123,
        b: {
          c: 234,
        },
      };
      const wrapped = Sakota.create(obj);
      wrapped.a = 345;
      wrapped.a1 = 234;
      wrapped.b.c = 2345;

      const expected = {
        a: 345,
        a1: 234,
        b: {
          c: 2345,
        },
      };

      const unwrapped = wrapped.__sakota__.unwrap(true);
      expect(unwrapped === obj).toBeTruthy();
      expect(obj).toEqual(expected);
      expect(Sakota.hasSakota(unwrapped)).toBeFalsy();
    });

    it('should remove Sakota wrapper around array props', () => {
      const obj: any = {
        a: [{ b: 234 }],
      };
      const wrapped = Sakota.create(freeze(obj));
      wrapped.a[0].b = 345;
      const expected = {
        a: [{ b: 345 }],
      };

      const unwrapped = wrapped.__sakota__.unwrap();
      expect(unwrapped).toEqual(expected);
      expect(unwrapped === obj).toBeFalsy();
      expect(Sakota.hasSakota(unwrapped)).toBeFalsy();
    });

    it('should return the same object as target', () => {
      const obj: any = {
        a: [{ b: 234 }],
      };
      const wrapped = Sakota.create(obj);
      delete wrapped.a[0].b;

      const unwrapped = wrapped.__sakota__.unwrap(true);
      expect(unwrapped === obj).toBeTruthy();
      expect(unwrapped).toEqual({ a: [{}] });
      expect(Sakota.hasSakota(unwrapped)).toBeFalsy();
    });

    it('should preserve the object type information after unwrap', () => {
      // class APoint extends Point {}
      const obj: any = new Point();
      const wrapped = Sakota.create(obj);
      wrapped.p = { x: 2, y: 3 };

      const unwrapped = wrapped.__sakota__.unwrap();
      expect(unwrapped).toEqual(new Point(2, 3));
    });
  });

  describe('mergeChanges + unwrap', () => {
    it('should handle multiple changes properly', () => {
      const source = {
        a: 123,
      };
      const target = {
        a: 234,
        b: {
          c: 345,
        },
        c: {
          d: 456,
        },
      };
      const sakotaWrapped: any = Sakota.create(source);
      sakotaWrapped.a = 234;
      sakotaWrapped.b = {
        c: 234,
        d: 345,
      };
      const sakotaWrapped1 = Sakota.create(sakotaWrapped.__sakota__.unwrap());
      sakotaWrapped1.b.c = 345;
      delete sakotaWrapped1.b.d;
      sakotaWrapped1.c = { d: 234 };
      sakotaWrapped1.c.d = 456;
      sakotaWrapped.__sakota__.mergeChanges(sakotaWrapped1.__sakota__.getChanges());
      expect(sakotaWrapped.__sakota__.unwrap()).toEqual(sakotaWrapped);
      expect(sakotaWrapped).toEqual(target);
    });
  });
});
