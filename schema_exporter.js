
const admin = require('firebase-admin');
const fs = require('fs').promises;

async function exportSchema() {
  try {
    // This initializes the app using the GOOGLE_APPLICATION_CREDENTIALS environment variable
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });

    const db = admin.firestore();
    console.log('Successfully connected to Firestore.');

    const schema = {};
    const collections = await db.listCollections();
    console.log(`Found ${collections.length} collections. Analyzing...`);

    for (const collection of collections) {
      const collectionId = collection.id;
      // Fetch the first document to infer schema
      const snapshot = await collection.limit(1).get();
      
      if (!snapshot.empty) {
        const docData = snapshot.docs[0].data();
        const fields = {};
        
        // Recursively get field types
        for (const key in docData) {
            fields[key] = getType(docData[key]);
        }
        schema[collectionId] = fields;
        console.log(`- Analyzed collection: ${collectionId}`);
      } else {
        schema[collectionId] = {}; // Collection is empty
        console.log(`- Collection ${collectionId} is empty, noted.`);
      }
    }

    await fs.writeFile('firestore_schema.json', JSON.stringify(schema, null, 2));
    console.log('\nSchema exported successfully to firestore_schema.json!');

  } catch (error) {
    console.error('ERROR:', error.message);
    if (error.code === 'GOOGLE_APPLICATION_CREDENTIALS_NOT_SET') {
        console.error('FATAL: The GOOGLE_APPLICATION_CREDENTIALS environment variable is not set.');
        console.error('Please set it to the path of your Firebase service account JSON file.');
    } else if (error.message.includes('Error getting access token')) {
        console.error('FATAL: Could not authenticate with Google Cloud. Is your service account key file valid?');
    }
  }
}

function getType(value) {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (value instanceof admin.firestore.Timestamp) return 'timestamp';
    if (value instanceof admin.firestore.GeoPoint) return 'geopoint';
    if (typeof value === 'object' && value !== null) {
        const subFields = {};
        for (const key in value) {
            subFields[key] = getType(value[key]);
        }
        return subFields;
    }
    return typeof value;
}


exportSchema();
