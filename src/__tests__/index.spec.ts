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
  constructor(public x = 1, public y = 2) {}
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
    get: (o, p: keyof T): any => {
      const val = o[p];
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
    ...values().map(val => () => ({
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
        { $set: { 'a.b': 100, 'c.d.e': 20 }, $unset: { x: true } },
        { $set: { 'a.b': 100 }, $unset: { x: true, c: true } },
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
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
        proxy.a = 1000;
        delete proxy.c;
        expect(proxy.__sakota__.getChanges('', 'a')).toEqual({ $set: { a: 1000 } });
        expect(proxy.__sakota__.getChanges('', 'c')).toEqual({ $unset: { c: true } });
      });

      it('should filter changes with a regexp', () => {
        const proxy = Sakota.create({ a: 10, b: 20, c: 30 });
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
});
