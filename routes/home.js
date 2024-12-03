const express = require('express');
const router = express.Router();

require("dotenv").config();
const apiPrefix = process.env.API_PREFIX;

const { MongoClient} = require("mongodb");
const mongoClient = new MongoClient(process.env.MONGODB_URI);

router.get(apiPrefix + "/nextEventInfo", async (req, res) => {
  const events = mongoClient.db("business").collection("events");
  const event = await events.findOne({});

  res.json(await event);
});

module.exports = router;