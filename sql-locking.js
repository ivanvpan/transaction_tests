const { Client, Pool } = require('pg')
const _ = require('lodash')

const pg = new Client({ user: 'postgres', database: 'test'})
const pool = new Pool({ user: 'postgres', database: 'test'})

let things

async function wait(duration) {
  return new Promise((resolve) => {
    setTimeout(resolve, duration)
  })
}

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
}

async function insert() {
  const promises = _.range(100).map(async (num) => {
    await pg.query('INSERT INTO things(id) VALUES ($1)', [num])
  })

  await Promise.all(promises)
}


async function update(value) {
  const first = new Promise(async (resolve) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      const res = await client.query('SELECT id from things FOR UPDATE ')
      // const res = await client.query('SELECT id from things WHERE ID < 20 FOR UPDATE ')
      console.log('rows', res.rows.length)
      await wait(2000)
      await client.query('UPDATE things set id = $1', [value])
      await client.query('COMMIT')
    } finally {
      client.release()
      resolve()
    }
  })

  const second = new Promise(async (resolve) => {
    const client = await pool.connect()
    try {
      await wait(500)
      await client.query('BEGIN')
      // await client.query('UPDATE things set id = 33 WHERE id > 80')
      await client.query('UPDATE things set id = id * 2')
      await client.query('COMMIT')
      console.log('Finished second')
      await checkValues()
    } finally {
      client.release()
      resolve()
    }
  })

  await Promise.all([first, second])
}

async function checkValues() {
  const res = await pg.query('SELECT id from things')
  const ids = res.rows.map((row) => row.id)
  console.log(ids)
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

  // const promises = 
  //   [1,2,3,4,5,6,7,8,9,10].map((num) => {
  //     return time('update', async () => {
  //       await update(num)
  //     })
  //   })

  // await Promise.all(promises)

  await time('update', async () => {
    await update(5)
  })

  await time('read back values', checkValues)

  await getCount()

  pg.end()
}

run()
