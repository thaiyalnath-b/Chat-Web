const dotenv = require("dotenv");

dotenv.config();

const admin = require("firebase-admin");

const serviceAccount = {

    projectId: process.env.FIREBASE_PROJECT_ID,

    privateKeyId: process.env.FIREBASE_PRIVATE_KEY_ID,

    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),

    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,

    clientId: process.env.FIREBASE_CLIENT_ID
};

admin.initializeApp({

    credential: admin.credential.cert(serviceAccount)

});

module.exports = admin;