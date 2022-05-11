const express = require('express')
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())


//-------

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.evz2z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
      await client.connect();
      console.log('My Database Connected');

      const servicesCollection = client.db("doctors_portal").collection("services");

      app.get('/service', async(req, res)=>{
          const query = {}
          const cursor = servicesCollection.find(query);
          const services = await cursor.toArray()
          res.send(services)
      })
        
    } finally {
    //   await client.close();
    }
  }
  run().catch(console.dir);

//------
app.get('/', (req, res) => {
  res.send('<h1>Hello The Doctor Portal Server is Working</h1>')
})

app.listen(port, () => {
  console.log(`Doctor Portal Server app Running on port ${port}`)
})