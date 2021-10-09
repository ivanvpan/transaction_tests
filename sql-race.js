const { Client, Pool } = require('pg')
const _ = require('lodash')

const pg = new Client({ user: 'postgres', database: 'test'})
const pool = new Pool({ user: 'postgres', database: 'test'})

let things

async function time(label, func) {
  const start = Date.now()
  await func()
  console.log(label, 'completed in', Date.now() - start)
}

async function connect() {
  await pg.connect()
}


async function clean() {
  await pg.query('DELETE FROM things')
  await pg.query('DELETE FROM things2')
}

async function insert() {
  const promises = _.range(100).map(async () => {
    await pg.query('INSERT INTO things(id) VALUES (0)')
    await pg.query('INSERT INTO things2(id) VALUES (0)')
  })

  await Promise.all(promises)
}

async function update(value) {
  // A parametrized multi-statement is not possible with PG protocol
  // This should not be problem with connection pooling, but I will not implement ATM
  // await pg.query(`
  //   BEGIN;
  //   UPDATE things set id = ${value};
  //   UPDATE things2 set id = ${value};
  //   COMMIT;
  //   `)

  // This will be all atomic, but because there is lag on`pool.connect` the ordering
  // of transactions will be unpredictable
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query('UPDATE things set id = $1', [value])
    await client.query('UPDATE things2 set id = $1', [value])
    await client.query('COMMIT')
  } finally {
    client.release()
  }
}

async function checkValues() {
  const res = await pg.query('SELECT id from things')
  const ids = res.rows.map((row) => row.id)
  console.log(ids)

  const res2 = await pg.query('SELECT id from things2')
  const ids2 = res2.rows.map((row) => row.id)
  console.log(ids2)
}

async function getCount() {
  const res = await pg.query('SELECT COUNT(*) from things')
  console.log('total count', +res.rows[0].count)
}

async function run() {
  await connect()

  console.log("Connected successfully to server");

  await time('remove all', clean)
  await time('insert', insert)

  const promises = 
    [1,2,3,4,5,6,7,8,9,10].map((num) => {
      return time('update', async () => {
        await update(num)
      })
    })

  await Promise.all(promises)
  await time('read back values', checkValues)

  await getCount()

  pg.end()
}

run()
