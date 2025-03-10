// config.js

// Use environment variables to store sensitive data securely.
require('dotenv').config();

module.exports = {
  email: {
    user: process.env.EMAIL_USER,       // Your email (stored in .env)
    pass: process.env.EMAIL_PASS,       // Your app password (stored in .env)
    service: 'gmail',
    tousermail:process.env.EMAIL_TOUSER
  },
  db: {
    server: process.env.DB_SERVER,     // SQL Server name or IP (stored in .env)
    database: process.env.DB_DATABASE, // Database name (stored in .env)
    user:process.env.DB_USERNAME,
    password:process.env.DB_PASSWORD,
    port: 1433,
    options: {
      encrypt: true,                   // Use SSL encryption
      trustServerCertificate: true,    // Trust self-signed certificates
      trustedConnection: true      
    },
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    requestTimeout: 600000 // Increase request timeout to 60 seconds                 
  }
};
