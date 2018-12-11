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

      describe('tracking', () => {
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
      });

      describe('do-not-track', () => {
        it('should apply the change on the proxy', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
            expect(proxy).toEqual(c.result[i] as any);
          }
        });

        it('should not record any applied changes', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
            expect(proxy.__sakota__.getChanges()).toEqual({});
          }
        });

        it('should not record changes for nested objects', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
            for (const key in c.nested[i]) {
              expect(proxy[key].__sakota__.getChanges()).toEqual({});
            }
          }
        });

        it('should not modify the proxy target', () => {
          const proxy = Sakota.create(freeze(c.target));
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
          }
        });

        it('should hold a reference to the proxy target', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
          }
          expect(proxy.__sakota__.getTarget()).toBe(c.target);
        });

        it('should indicate the proxy has not changed', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
            expect(proxy.__sakota__.hasChanges()).toEqual(false);
          }
        });

        it('should indicate the proxy has changed for nested objects', () => {
          const proxy = Sakota.create(c.target);
          for (let i = 0; i < c.action.length; ++i) {
            proxy.__sakota__.doNotTrack(() => c.action[i](proxy));
            for (const key in c.nested[i]) {
              expect(proxy[key].__sakota__.hasChanges()).toEqual(false);
            }
          }
        });
      });
    });
  });
});
