const { MongoClient } = require("mongodb");
const _ = require('lodash')

const uri = "mongodb://localhost:27017";
const client = new MongoClient(uri);

async function time(label, func) {
  const start = Date.now()
  await func()
  console.log(label, 'completed in', Date.now() - start)
}

async function connect() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
}

let things, session

async function clean() {
  await things.deleteMany({})
}

async function insert() {
  const promises = _.range(100).map(() => {
    return things.insertOne({
      value: 0
    })
  })

  await Promise.all(promises)
}

async function update(value) {
  const session = await client.startSession()
  // If we have on session and do this then `withTransaction` errors out
  // cause you can have only one in progress
  await session.withTransaction(async () => {
    await things.updateMany({}, {$set: {value: value}})
  })
  await session.endSession()
}

async function checkValues() {
  const all = await things.find({}).toArray()
  const values = all.map((thing) => thing.value)
  console.log(values)
}

async function run() {
  await connect()

  // Connect the client to the server
  console.log("Connected successfully to server");
  things = client.db("tcoop_db_stage").collection("things")

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

  console.log(await things.countDocuments())

  client.close()
}

run()
