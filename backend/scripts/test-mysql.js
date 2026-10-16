const pool = require('../src/config/db')

async function testMySqlConnection() {
	let connection
	let failed = false

	try {
		connection = await pool.getConnection()
		const [rows] = await connection.execute('SELECT VERSION() AS version, DATABASE() AS databaseName')
		console.log(`MySQL version: ${rows[0].version}`)
		console.log(`Database name: ${rows[0].databaseName}`)
	} catch {
		console.error('MySQL connection test failed. Check backend DB_* environment variables and MySQL availability.')
		failed = true
	} finally {
		if (connection) connection.release()
		try {
			await pool.end()
		} catch {
			failed = true
		}
	}

	if (failed) process.exitCode = 1
}

testMySqlConnection()