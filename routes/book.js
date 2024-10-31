const express = require('express');
const router = express.Router();
const nodemailer = require("nodemailer");

require("dotenv").config();
const apiPrefix = process.env.API_PREFIX;
const mailPassword = process.env.MAIL_PWD;

const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: "noreply@coastalcharmnh.com",
    pass: mailPassword,
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

router.post(apiPrefix + "/book-form", (req, res) => {
  const formDataJson = req.body;

  const mailOptions = {
    from: "noreply@coastalcharmnh.com",
    to: "jakereardon13@gmail.com",
    subject: "Coastal Charm event request",
    html: formatJsonForMail(formDataJson)
  }

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) {
      res.sendStatus(500);
    } else {
      res.sendStatus(201);
      console.log("successful");
    };
  });
});

module.exports = router;