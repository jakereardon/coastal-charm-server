require("dotenv").config()

const { MongoClient} = require("mongodb");
const stripe = require('stripe')(process.env.STRIPE_SECRET);

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const port = 8000;

const mongoClient = new MongoClient(process.env.MONGODB_URI);

app.use(express.json());

function computeItemCost(item) {
  const charmsCost = item.charms.reduce((totalCost, charm) => totalCost + charm.price, 0);
  return item.chain.price + charmsCost;
}

function computeCartCost(cart) {
  return cart.reduce((totalCost, item) => totalCost + computeItemCost(item), 0);
}

app.post("/create-confirm-intent", async (req, res) => {
  const totalCost = computeCartCost(req.body.items);

  try {
    const intent = await stripe.paymentIntents.create({
      confirm: true,
      amount: totalCost * 100,
      currency: "usd",
      confirmation_token: req.body.confirmationTokenId,
      return_url: "http://localhost:3000"
    });
    res.json({
      client_secret: intent.client_secret,
      status: intent.status
    });
  } catch (err) {
    res.json({
      error: err
    });
    console.log(err)
  }
});

app.get("/gallery", async (req, res) => {
  
});


app.get("/charms", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("charms").find().toArray()
  );

});

app.get("/chains", async (req, res) => {
  res.json(
    await mongoClient.db("inventory").collection("chains").find().toArray()
  );

});

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@coastalcharmnh.com",
    pass: "2xe^$nG]zHi&~L_",
  }
});

function formatJsonForMail(formJson) {
  var formattedInfo = "A new request for an event has been submitted: <br /><br />";
  // iterate through keys of form JSON 
  for (var field in formJson) { 
    formattedInfo += "<b>" + field + ":</b> " + formJson[field] + "<br /><br />";
  }

  return formattedInfo;
}

app.post("/book-form", (req, res) => {
  const formDataJson = req.body;

  res.sendStatus(201);
  console.log("recieved");

  const mailOptions = {
    from: "noreply@coastalcharmnh.com",
    to: "jakereardon13@gmail.com",
    subject: "Coastal Charm event request",
    html: formatJsonForMail(formDataJson)
  }

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.log(err);
  });
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
