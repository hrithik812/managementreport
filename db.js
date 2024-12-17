// db.js
const sql = require('mssql');
const config = require('./config');

// Function to connect to SQL Server and return the pool (connection object)
const connectToDB = async () => {
  try {
    const pool = await sql.connect(config.db);
    console.log('Connected to SQL Server');
    return pool;
  } catch (err) {
    console.error('Error connecting to the database:', err.message);
    throw err;
  }
};

// Function to query the database (for example, fetching some data)
const queryDatabase = async (query) => {
  const pool = await connectToDB();
  
  try {
    const result = await pool.request().query(query);
    return result.recordset; // Return the result
  } catch (err) {
    console.error('Error querying the database:', err.message);
    throw err;
  } finally {
    pool.close();
  }
};

module.exports = { connectToDB, queryDatabase };
