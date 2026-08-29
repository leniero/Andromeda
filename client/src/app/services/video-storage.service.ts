import { Injectable } from '@angular/core';
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'andromeda-video-store';
const STORE_NAME = 'videos';

@Injectable({
  providedIn: 'root'
})
export class VideoStorageService {
  private dbPromise: Promise<IDBPDatabase>;

  constructor() {
    this.dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      }
    });
  }

  async saveVideo(id: string, blob: Blob): Promise<void> {
    const db = await this.dbPromise;
    await db.put(STORE_NAME, blob, id);
    console.log(`Video saved locally for emotion: ${id}`);
  }

  async getVideo(id: string): Promise<Blob | undefined> {
    const db = await this.dbPromise;
    return await db.get(STORE_NAME, id);
  }

  async deleteVideo(id: string): Promise<void> {
    const db = await this.dbPromise;
    await db.delete(STORE_NAME, id);
  }
}
