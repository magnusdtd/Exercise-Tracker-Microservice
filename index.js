const express = require('express')
const app = express()
const cors = require('cors')
require('dotenv').config()
const mongoose = require('mongoose')
const bodyParser = require('body-parser')
const shortid = require('shortid') 

/* Middleware */
app.use(cors())
app.use(express.static('public'))
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}))

/* Mongo DB */
const { MongoClient, ServerApiVersion } = require('mongodb');
const client = new MongoClient(process.env.MONGO_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});
async function run() {
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    await client.close();
  }
}
run().catch(console.dir);

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("Error connecting to MongoDB with Mongoose:", err);
    setTimeout(() => {
      mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
        .then(() => console.log("MongoDB reconnected"))
        .catch(err => console.error("Error reconnecting to MongoDB with Mongoose:", err));
    }, 5000);
  });

/* Schemas */
const exerciseSchema = new mongoose.Schema({
	userId: String,
	username: String,
	description: { type: String, required: true },
	duration: { type: Number, required: true },
	date: String,
});

const userSchema = new mongoose.Schema({
	username: String,
});

/* Models */
let User = mongoose.model('User', userSchema);

let Exercise = mongoose.model('Exercise', exerciseSchema);


/* Endpoints */
app.get('/', async (req, res) => {
  res.sendFile(__dirname + '/views/index.html');
  await User.syncIndexes();
  await Exercise.syncIndexes();
});

app.get("/api/user/delete", (req, res) => {
  console.log("### delete all users ###");
  User.deleteMany({}, (err, result) => {
    if (err) {
      console.error(err);
      res.json({message: "Deleting all users failed!"})
    } else {
      res.json({message: "All users have been deleted!", result: result})
    }
  });
});

app.get("/api/exercises/delete", (req, res) => {
  console.log("### delete all exercises ###");
  Exercise.deleteMany({}, (err, result) => {
    if (err) {
      console.error(err);
      res.json({message: "Deleting all exercises failed!"})
    } else {
      res.json({message: "All exercises have been deleted!", result: result})
    }
  });
});

app.get("/api/users", (req, res) => {
  console.log("### Get all users ###");

  User.find({}, (err, users) => {
    if (err) {
      console.error(err);
      res.json({message: "Getting all users failed!"});
    } else {
      if (users.length === 0) {
        res.json({ message: "There are no users in the database!" })
      } else {
        console.log("There are " + users.length + " user(s) in database.");
        res.json(users);
      }
    }
  });
});

app.post("/api/users", (req, res) => {
  const inputUserName = req.body.username;
  console.log("### Create a new user ###");

  let newUser = new User({ username: inputUserName });
  console.log("Creating a new user with username: " + inputUserName);

  newUser.save((err, user) => {
    if (err) {
      console.error(err);
      res.json({message: "User creation failed!"});
    } else {
      res.json({ username: user.username, _id: user._id });
    }
  });
});

app.post("/api/users/:_id/exercises", (req, res) => {
    let userId = req.params._id;
    let description = req.body.description;
    let duration = req.body.duration;
    let date = req.body.date;

    console.log("### add a new exercise ###");

    if (!date) {
      date = new Date().toISOString().substring(0, 10);
    }

    console.log("Finding for user with id: " + userId);
    User.findById(userId, (err, userInDatabase) => {
      if (err) {
        console.error(err);
        res.json({ message: "There are no users with that ID in the database!" });
      } else {

        let newExercise = new Exercise({
          userId: userInDatabase._id,
          username: userInDatabase.username,
          description: description,
          duration: parseInt(duration),
          date: date
        });
    
        newExercise.save((err, exercise) => {
          if (err) {
            console.error(err);
            res.json({ message: 'Exercise creation failed!' });
          } else{
            res.json({
              _id: userInDatabase._id,
              username: userInDatabase.username,
              description: exercise.description,
              duration: exercise.duration,
              date: new Date(exercise.date).toDateString(),
            });
          }
  
        });

      }
    });

    
});

app.get("/api/users/:_id/logs", async (req, res) => {
  const userId = req.params._id;
  const from = req.query.from || new Date(0).toISOString().substring(0, 10);
  const to = req.query.to || new Date(Date.now()).toISOString().substring(0, 10);
  const limit = Number(req.query.limit) || 0;

  console.log("'### Get the log from a user ###");

  let user = await User.findById(userId).exec();
  console.log("Looking for exercises with id: " + userId);

  let exercises = await Exercise.find({
    userId: userId,
    date: { $gte: from, $lte: to }
  })
  .select("description duration date")
  .limit(limit)
  .exec();

  let parsedDatesLog = exercises.map((exercise => {
    return {
      description: exercise.description,
      duration: exercise.duration,
      date: new Date(exercise.date).toDateString()
    }
  }));

  res.json({
    _id: user._id,
    username: user.username,
    count: parsedDatesLog.length,
    log: parsedDatesLog,
  })
});


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
