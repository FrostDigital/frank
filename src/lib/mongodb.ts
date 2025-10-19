import { MongoClient } from "mongodb";

const options = {};

let _clientPromise: Promise<MongoClient> | null = null;

// Lazy initialization - only create client when function is called
export default function getClientPromise(): Promise<MongoClient> {
    if (_clientPromise) {
        return _clientPromise;
    }

    const uri = process.env.MONGO_URL || "";

    if (process.env.NODE_ENV === "development") {
        // In development mode, use a global variable so that the value
        // is preserved across module reloads caused by HMR (Hot Module Replacement).
        //@ts-ignore
        if (!global._mongoClientPromise) {
            const client = new MongoClient(uri, options);
            //@ts-ignore
            global._mongoClientPromise = client.connect();
        }
        //@ts-ignore
        _clientPromise = global._mongoClientPromise;
        return _clientPromise!;
    } else {
        // In production mode, it's best to not use a global variable.
        const client = new MongoClient(uri, options);
        _clientPromise = client.connect();
        return _clientPromise!;
    }
}