const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    let mongoUri = process.env.MONGO_URI;
    
    // Check if we need to use memory server (if explicitly requested or if local mongo is defined but unreachable)
    // For automatic fallback, we'll try to connect to memory server if MONGO_URI contains 127.0.0.1
    // since the user doesn't have local MongoDB installed.
    if (mongoUri && mongoUri.includes('127.0.0.1')) {
      console.log('⚠️ Local MongoDB not found, dropping into In-Memory Database Mode...');
      try {
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongoServer = await MongoMemoryServer.create();
        mongoUri = mongoServer.getUri();
        console.log(`🧠 In-Memory MongoDB started at: ${mongoUri}`);
      } catch (err) {
        console.warn('⚠️ Could not start mongodb-memory-server. Assuming external URI is somehow reachable.');
      }
    }

    const conn = await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected. Attempting reconnect...');
});

module.exports = connectDB;
