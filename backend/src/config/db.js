
const mysql = require("mysql2/promise");
require("dotenv").config({ quiet: true });

const sslEnabled = process.env.DB_SSL === "true";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "kisan_pathshala",

  ssl: sslEnabled
    ? {
        ca: process.env.DB_SSL_CA
          ? Buffer.from(process.env.DB_SSL_CA, "base64").toString("utf8")
          : undefined,
        rejectUnauthorized: true,
      }
    : undefined,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

module.exports = pool;
