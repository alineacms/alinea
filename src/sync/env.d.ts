declare module 'tiny-tree' {
  interface Bounds<T> {
    min?: T | null;
    minInclusive?: T | null;
    minExclusive?: T | null;
    max?: T | null;
    maxInclusive?: T | null;
    maxExclusive?: T | null;
  }

  interface IndexInfo<T> {
    index: number;
    key: T;
  }

  interface Stats {
    size: number;
  }

  export class ArrayTree<K, V> {
    constructor();
    clear(): void;
    get(key: K): V | undefined;
    getByIndex(index: number): V | undefined;
    toArray(bounds?: Bounds<K>): [K, V][];
    toArray(bounds: Bounds<K>, valuesOnly: true): V[];
    toArrayByIndex(start: number, count: number, valuesOnly?: boolean): [K, V][] | V[];
    set(key: K, value: V): void;
    bulkLoad(data: [K, V][]): void;
    delete(key: K): void;
    getStats(): Stats;
    readonly size: number;

    private _keys: K[];
    private _values: V[];
    private _indexAtOrAboveKey(key: K): IndexInfo<K> | null;
    private _indexAtOrBelowKey(key: K): IndexInfo<K> | null;
    private _boundsToIndex(bounds?: Bounds<K>): [number, number];
  }
}