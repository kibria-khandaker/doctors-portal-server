const express = require('express')
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');

//--------------- SMTP 0-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
/*
const nodemailer = require('nodemailer');
const sgTransport = require('');
*/
//--------------- SMTP 1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

const app = express()
const port = process.env.PORT || 5000;

app.use(cors())
app.use(express.json())

//-------
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.evz2z.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
// console.log(uri);

const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization
  if (!authHeader) {
    return res.status(401).send({ message: 'UnAuthHeader access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: 'Forbidden access' })
    }
    // console.log(decoded)
    req.decoded = decoded;
    next()
  });
  // console.log('ABC');
}


//--------------- SMTP 0-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
/*
const emailSenderOptions = {
  auth: {
    // api_user: 'TRANSPORT_USER_NAME',
    // api_key: 'EMAIL_SENDER_KEY',
    api_key: process.env.EMAIL_SENDER_KEY
  }
}

const emailClient = nodemailer.createTransport(sgTransport(emailSenderOptions));

function sendAppointmentEmail(booking) {
  const { treatmentId, treatment, date, slot, patient, patientName, phone } = booking;
  const email = {
    from: process.env.EMAIL_SENDER,
    to: patient,
    subject: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed `,
    text: `Your Appointment for ${treatment} is on ${date} at ${slot} is Confirmed `,
    html: `
    <div>
      <p> Hello ${patientName}, </p>
      <h3> Your Appointment for ${treatment} is Confirmed  </h3>
      <p>  Looking forward to seeing you on ${date} at ${slot} </p>
      <h3> Our Address </h3>
      <p> Dhaka, Bangladesh </p>
      <a href="www.google.com"> unsubscribe </a>
    </div>
    `,
  };
  emailClient.sendMail(email, function (err, info) {
    if (err) {
      console.log(err);
    } else {
      console.log('Message Sent: ', info);
    }
  })

}
*/
//--------------- SMTP 1-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx


async function run() {
  try {
    await client.connect();
    // console.log('My Database Connected');

    const servicesCollection = client.db("doctors_portal").collection("services");
    const bookingCollection = client.db("doctors_portal").collection("bookings");
    const userCollection = client.db("doctors_portal").collection("users");
    const doctorCollection = client.db("doctors_portal").collection("doctors");

    // run function er vitore ei fun ta likhte hobe
    const verifyAdmin = async (req, res, next) => {
      const requester = req.decoded.email;
      const requesterAccount = await userCollection.findOne({ email: requester })
      if (requesterAccount.role === 'admin') {
        next();
      } else {
        res.status(403).send({ message: 'Forbidden to access' })
      }
    }

    // get all data from MDB 
    app.get('/service', async (req, res) => {
      const query = {}
      // const cursor = servicesCollection.find(query);
      const cursor = servicesCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray()
      res.send(services)
    })

    app.get('/admin/:email', async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === 'admin';
      res.send({ admin: isAdmin })
    })

    app.put('/user/admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;

      // const requester = req.decoded.email;
      // const requesterAccount = await userCollection.findOne({ email: requester })
      // if (requesterAccount.role === 'admin') {
      const filter = { email: email };
      const updateDoc = {
        $set: { role: 'admin' },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
      // } else {
      //   res.status(403).send({ message: 'Forbidden to access' })
      // }

    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      // res.send(result);
      // res.send({result, accessToken:token});
      res.send({ result, token });
    })

    app.get('/user', verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users)
    })

    // Warning: This is not the proper way to query multiple collection. 
    // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
    app.get('/available', async (req, res) => {
      // const date = req.query.date || 'May 16, 2022';
      const date = req.query.date;

      // step 1:  get all services
      const services = await servicesCollection.find().toArray();

      // step 2 get the booking of that day
      const query = { date: date };
      const bookings = await bookingCollection.find(query).toArray();

      // step 3: for each service, 
      services.forEach(service => {
        // step 4: find booking for that service 
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        // step 5:  service select slots for the service booking
        const bookedSlots = serviceBookings.map(book => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !bookedSlots.includes(slot));
        //step 7: set available to slots to make it easier 
        // service.available = available
        service.slots = available;


      })
      res.send(services);
    })

    /**
     * API Naming Convention 
     * app.get('/booking') // get all or more then one or by filter
     * app.get('/booking/:id') // get a specific booking
     * app.post('/booking') // Add new a booking
     * app.patch('/booking/:id')
     * app.put('/booking/:id') --->> upsert ==> update(if exists) or insert (if doesn't exist)
     * app.delete('/booking/:id')
     *--- 
     * treatmentId
     *treatmentName
     *treatmentDate
     *treatmentSlot
     *treatmentUserEmail
     *treatmentUserName
     *treatmentUserPhone
     */


    app.get('/booking', verifyJWT, async (req, res) => {
      const patient = req.query.patient;

      // const authorization = req.headers.authorization;
      // console.log('Auth Header', authorization);

      const decodedEmail = req.decoded.email;
      if (patient === decodedEmail) {
        const query = { patient: patient }
        // console.log(patient);
        // const query = {}
        const bookings = await bookingCollection.find(query).toArray()
        res.send(bookings)
      } else {
        return res.status(403).send({ message: 'Forbidden access' })
      }

    }) // http://localhost:5000/booking?patient=kibriakhandaker66@gmail.com

    // put or sent data to MDB 
    app.post('/booking', async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking.treatment,
        date: booking.date,
        patient: booking.patient
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists })
      }
      const result = await bookingCollection.insertOne(booking);

      //--------------- SMTP 0xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
      /*
      console.log('Sending Mail');
      sendAppointmentEmail(booking)
      */
      //--------------- SMTP 1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

      return res.send({ success: true, result });
    })


    app.get('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = await doctorCollection.find().toArray()
      res.send(doctor)
    })

    app.post('/doctor', verifyJWT, verifyAdmin, async (req, res) => {
      const doctor = req.body;
      const result = await doctorCollection.insertOne(doctor)
      res.send(result);
    })

    app.delete('/doctor/:email', verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await doctorCollection.deleteOne(filter)
      res.send(result);
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



/**
 * creat JWT secret Token key 
 * require('crypto').randomBytes(64).toString('hex')
 * require('crypto').randomBytes(256).toString('base64')
 * 
 * 
 * Important Extension:
  * auto import
  * code spell checker
  * eslint
  * JavaScript (ES6) code snippets
  * Prettier - Code formatter
  * npm
  * npm Intellisense
  * React Extension Pack
  * Reactjs code snippets
  * Search node_modules
  * Tabnine 
  * Auto Rename Tag
  * Bracket Pair Colorizer
 */