const { MongoClient} = require("mongodb");

require("dotenv").config()

const express = require("express");
const nodemailer = require("nodemailer");

const app = express();
const port = 8000;

const mongoClient = new MongoClient(process.env.MONGODB_URI);

app.use(express.json());

app.get("/charms", async (req, res) => {
  console.log("request recieved");
  res.json(
    await mongoClient.db("inventory").collection("charms").find().toArray()
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
