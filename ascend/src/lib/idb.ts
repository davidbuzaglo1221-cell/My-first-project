const DB = 'ascend-audio'
const STORE = 'files'

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open()
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE))
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export const putFile = (id: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, id))
export const getFile = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id))
export const deleteFile = (id: string) => tx('readwrite', (s) => s.delete(id))
