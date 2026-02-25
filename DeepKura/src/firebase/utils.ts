import { collection, query, getDocs, writeBatch, limit, Firestore } from 'firebase/firestore';

/**
 * Delete a collection, in batches of batchSize. Note that this does
 * not recursively delete subcollections of documents in the collection
 * (but in this use case, messages don't have subcollections).
 */
export async function deleteCollection(db: Firestore, collectionPath: string, batchSize: number = 400) {
    const collectionRef = collection(db, collectionPath);
    const q = query(collectionRef, limit(batchSize));

    return new Promise<void>((resolve, reject) => {
        deleteQueryBatch(db, q, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db: Firestore, query: any, resolve: () => void) {
    const snapshot = await getDocs(query);

    const batchSize = snapshot.size;
    if (batchSize === 0) {
        // When there are no documents left, we are done
        resolve();
        return;
    }

    const batch = writeBatch(db);
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    // Recurse on the next event loop tick, to avoid
    // exploding the stack.
    setTimeout(() => {
        deleteQueryBatch(db, query, resolve);
    }, 0);
}
