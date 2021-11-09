const express = require('express');
const admin = require('firebase-admin');
const { MongoClient } = require('mongodb');
const cors = require('cors');
require('dotenv').config();

const app = express();

const port = process.env.PORT || 5000;

const serviceAccount = require('./doctors-portal-firebase-adminsdk.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.2yruo.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
// console.log(uri);

async function verifyToken(req, res, next) {
  if (req.headers.authorization.startsWith('Bearer ')) {
    const token = req.headers.authorization.split(' ')[1];

    try {
      const decodedUser = await admin.auth().verifyIdToken(token);
      req.decodedEmail = decodedUser.email;
    } catch {}
  }
  next();
}

async function run() {
  try {
    await client.connect();
    const database = client.db('doctorsPortal');
    const appointmentsCollection = database.collection('appointments');
    const usersCollection = database.collection('users');

    app.get('/appointments', verifyToken, async (req, res) => {
      const email = req.query.email;
      const date = req.query.date;
      // console.log(date);
      const query = { email: email, date: date };
      // console.log(query);
      const cursor = appointmentsCollection.find(query);
      const appointments = await cursor.toArray();
      res.json(appointments);
    });

    app.post('/appointments', async (req, res) => {
      // console.log(req.body);
      const appointment = req.body;
      const result = await appointmentsCollection.insertOne(appointment);
      res.json(result);
    });

    app.get('/users/:email', async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      // console.log(user);
      let isAdmin = false;
      if (user?.role === 'admin') {
        isAdmin = true;
      }
      res.json({ admin: isAdmin });
    });

    // keep users to db

    app.post('/users', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const result = await usersCollection.insertOne(user);
      // console.log(result);
      res.json(result);
    });
    // add new user if not exists id users collection using upsert
    // upsert meaning update or insert
    app.put('/users', async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = { $set: user };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.json(result);
    });

    // make admin
    app.put('/users/admin', verifyToken, async (req, res) => {
      const user = req.body;
      console.log(req.decodedEmail);
      const requester = req.decodedEmail;
      if (requester) {
        const requesterAccount = usersCollection.findOne({ email: requester });
        if (requesterAccount.role === 'admin') {
          const filter = { email: user?.email };
          const updateDoc = { $set: { role: 'admin' } };
          const result = await usersCollection.updateOne(filter, updateDoc);
          res.json(result);
        }
      } else {
        res.status(403).json({ message: 'you do not have to create admin' });
      }
    });
  } finally {
    // await client.close;
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello Doctors Portal!');
});

app.listen(port, () => {
  console.log(`Listening at : ${port}`);
});
/* 
app.get('/users')
app.get('/users/:id')
app.post('/users')
app.put('/users/:id')
app.delete('/users/:id')
*/
