const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '', // sesuaikan dengan password MySQL/phpMyAdmin kamu
  database: 'db_pengaduan', // sesuaikan dengan nama database kamu
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool.promise();